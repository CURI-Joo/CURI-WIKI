'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Issue, IssueActivity, IssueStatus, IssueProject, IssuePriority } from '@/types';
import { demoIssueActivities, demoIssues } from '@/data/demo-data';
import { isDemoMode } from '@/lib/demo-mode';
import { createClient } from '@/lib/supabase/client';
import { dispatchIssueEvent, buildIssueUrl } from '@/lib/issue-events';

const ISSUES_KEY = 'curi-wiki-issues-v2';
const ACTIVITIES_KEY = 'curi-wiki-issue-activities-v2';
const DELETED_ISSUE_IDS_KEY = 'curi-wiki-deleted-issue-ids-v2';
const STORE_EVENT = 'curi-wiki-issue-store-change';

export const VALID_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  '이슈 등록': ['해결 중'],
  '해결 중': ['이슈 해결'],
  '이슈 해결': [],
};

interface IssueStoreState {
  issues: Issue[];
  activities: IssueActivity[];
  loading: boolean;
}

interface CreateIssueInput {
  title: string;
  description: string;
  project: IssueProject;
  priority: IssuePriority;
  reporter_id: string;
  assignee_id?: string | null;
  attachments?: string[];
}

function isBrowser() {
  return typeof window !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function emitStoreChange() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(STORE_EVENT));
}

function createActivityId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `act-${crypto.randomUUID()}`;
  }
  return `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCustomIssues() {
  return readJson<Issue[]>(ISSUES_KEY, []);
}

function writeCustomIssues(issues: Issue[]) {
  writeJson(ISSUES_KEY, issues);
}

function getCustomActivities() {
  return readJson<IssueActivity[]>(ACTIVITIES_KEY, []);
}

function writeCustomActivities(activities: IssueActivity[]) {
  writeJson(ACTIVITIES_KEY, activities);
}

function getDeletedIssueIds() {
  return readJson<string[]>(DELETED_ISSUE_IDS_KEY, []);
}

function writeDeletedIssueIds(issueIds: string[]) {
  writeJson(DELETED_ISSUE_IDS_KEY, Array.from(new Set(issueIds)));
}

function getMergedIssues() {
  const deletedIssueIds = new Set(getDeletedIssueIds());
  const byId = new Map<string, Issue>();

  for (const issue of demoIssues) {
    if (deletedIssueIds.has(issue.id)) continue;
    byId.set(issue.id, issue);
  }

  for (const issue of getCustomIssues()) {
    if (deletedIssueIds.has(issue.id)) continue;
    byId.set(issue.id, issue);
  }

  return Array.from(byId.values());
}

function getMergedActivities() {
  const deletedIssueIds = new Set(getDeletedIssueIds());
  const byId = new Map<string, IssueActivity>();

  for (const activity of demoIssueActivities) {
    if (deletedIssueIds.has(activity.issue_id)) continue;
    byId.set(activity.id, activity);
  }

  for (const activity of getCustomActivities()) {
    if (deletedIssueIds.has(activity.issue_id)) continue;
    byId.set(activity.id, activity);
  }

  return Array.from(byId.values());
}

function getNextIssueNumber() {
  const issues = [...demoIssues, ...getCustomIssues()];
  let maxNum = 0;

  for (const issue of issues) {
    const match = issue.id.match(/^ISSUE-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }

  for (const issueId of getDeletedIssueIds()) {
    const match = issueId.match(/^ISSUE-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }

  return maxNum + 1;
}

export function getAllIssues() {
  return isDemoMode() ? getMergedIssues() : [];
}

function createLocalIssue(input: CreateIssueInput): Issue {
  if (!input.title.trim()) {
    throw new Error('이슈 제목은 필수입니다.');
  }
  if (!input.description.trim()) {
    throw new Error('이슈 내용은 필수입니다.');
  }
  if (input.attachments && input.attachments.length > 4) {
    throw new Error('첨부파일은 최대 4개까지 가능합니다.');
  }

  const now = new Date().toISOString();
  const id = `ISSUE-${String(getNextIssueNumber()).padStart(3, '0')}`;
  const issue: Issue = {
    id,
    title: input.title.trim(),
    description: input.description.trim(),
    project: input.project,
    status: '이슈 등록',
    priority: input.priority,
    reporter_id: input.reporter_id,
    assignee_id: input.assignee_id ?? null,
    attachments: input.attachments ?? [],
    created_at: now,
    updated_at: now,
  };
  const activity: IssueActivity = {
    id: createActivityId(),
    issue_id: id,
    actor_id: input.reporter_id,
    type: 'created',
    detail: '이슈를 등록했습니다.',
    metadata: {},
    created_at: now,
  };

  writeCustomIssues([...getCustomIssues(), issue]);
  writeCustomActivities([...getCustomActivities(), activity]);
  emitStoreChange();

  dispatchIssueEvent({
    type: 'issue_created',
    issue,
    actor_id: input.reporter_id,
    issue_url: buildIssueUrl(issue),
    timestamp: now,
  });

  if (issue.assignee_id) {
    dispatchIssueEvent({
      type: 'issue_assigned',
      issue,
      actor_id: input.reporter_id,
      issue_url: buildIssueUrl(issue),
      timestamp: now,
    });
  }

  return issue;
}

export async function createIssue(input: CreateIssueInput): Promise<Issue> {
  if (isDemoMode()) return createLocalIssue(input);

  if (!input.title.trim()) {
    throw new Error('이슈 제목은 필수입니다.');
  }
  if (!input.description.trim()) {
    throw new Error('이슈 내용은 필수입니다.');
  }

  const supabase = createClient();
  const id = await getNextRemoteIssueId(supabase);

  const { data: issue, error } = await supabase
    .from('issues')
    .insert({
      id,
      title: input.title.trim(),
      description: input.description.trim(),
      project: input.project,
      status: '이슈 등록',
      priority: input.priority,
      reporter_id: input.reporter_id,
      assignee_id: input.assignee_id ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from('issue_activities').insert({
    issue_id: id,
    actor_id: input.reporter_id,
    type: 'created',
    detail: '이슈를 등록했습니다.',
    metadata: {},
  });

  const issueWithAttachments = { ...issue, attachments: [] } as Issue;

  dispatchIssueEvent({
    type: 'issue_created',
    issue: issueWithAttachments,
    actor_id: input.reporter_id,
    issue_url: buildIssueUrl(issueWithAttachments),
    timestamp: issue.created_at,
  });

  if (issue.assignee_id) {
    dispatchIssueEvent({
      type: 'issue_assigned',
      issue: issueWithAttachments,
      actor_id: input.reporter_id,
      issue_url: buildIssueUrl(issueWithAttachments),
      timestamp: issue.created_at,
    });
  }

  return issueWithAttachments;
}

async function getNextRemoteIssueId(
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const { data } = await supabase
    .from('issues')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(500);

  let maxNum = 0;
  for (const row of data ?? []) {
    const match = row.id.match(/^ISSUE-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }

  return `ISSUE-${String(maxNum + 1).padStart(3, '0')}`;
}

function transitionLocalIssueStatus(
  issueId: string,
  newStatus: IssueStatus,
  actorId: string
): Issue {
  const issue = getMergedIssues().find((item) => item.id === issueId);
  if (!issue) throw new Error('이슈를 찾을 수 없습니다.');

  const allowed = VALID_TRANSITIONS[issue.status];
  if (!allowed.includes(newStatus)) {
    throw new Error(`상태 전환이 허용되지 않습니다: ${issue.status} -> ${newStatus}`);
  }

  const now = new Date().toISOString();
  const updated: Issue = {
    ...issue,
    status: newStatus,
    updated_at: now,
  };
  const activity: IssueActivity = {
    id: createActivityId(),
    issue_id: issueId,
    actor_id: actorId,
    type: 'status_changed',
    detail: `${issue.status} -> ${newStatus}으로 변경했습니다.`,
    metadata: { from: issue.status, to: newStatus },
    created_at: now,
  };

  writeCustomIssues([
    ...getCustomIssues().filter((item) => item.id !== issueId),
    updated,
  ]);
  writeCustomActivities([...getCustomActivities(), activity]);
  emitStoreChange();

  dispatchIssueEvent({
    type: newStatus === '이슈 해결' ? 'issue_resolved' : 'issue_status_changed',
    issue: updated,
    actor_id: actorId,
    from_status: issue.status,
    issue_url: buildIssueUrl(updated),
    timestamp: now,
  });

  return updated;
}

export async function transitionIssueStatus(
  issueId: string,
  newStatus: IssueStatus,
  actorId: string
): Promise<Issue> {
  if (isDemoMode()) return transitionLocalIssueStatus(issueId, newStatus, actorId);

  const supabase = createClient();
  const { data: issue, error: fetchErr } = await supabase
    .from('issues')
    .select('*')
    .eq('id', issueId)
    .single();

  if (fetchErr || !issue) {
    throw new Error('이슈를 찾을 수 없습니다.');
  }

  const allowed = VALID_TRANSITIONS[issue.status as IssueStatus];
  if (!allowed?.includes(newStatus)) {
    throw new Error(
      `상태 전환이 허용되지 않습니다: ${issue.status} -> ${newStatus}`
    );
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from('issues')
    .update({ status: newStatus, updated_at: now })
    .eq('id', issueId)
    .select()
    .single();

  if (updateErr) throw new Error(updateErr.message);

  await supabase.from('issue_activities').insert({
    issue_id: issueId,
    actor_id: actorId,
    type: 'status_changed',
    detail: `${issue.status} -> ${newStatus}으로 변경했습니다.`,
    metadata: { from: issue.status, to: newStatus },
  });

  const updatedWithAttachments = { ...updated, attachments: [] } as Issue;

  dispatchIssueEvent({
    type: newStatus === '이슈 해결' ? 'issue_resolved' : 'issue_status_changed',
    issue: updatedWithAttachments,
    actor_id: actorId,
    from_status: issue.status as IssueStatus,
    issue_url: buildIssueUrl(updatedWithAttachments),
    timestamp: now,
  });

  return updatedWithAttachments;
}

function deleteLocalIssue(issueId: string) {
  const issue = getMergedIssues().find((item) => item.id === issueId);
  if (!issue) throw new Error('이슈를 찾을 수 없습니다.');

  writeDeletedIssueIds([...getDeletedIssueIds(), issueId]);
  writeCustomIssues(getCustomIssues().filter((item) => item.id !== issueId));
  writeCustomActivities(
    getCustomActivities().filter((activity) => activity.issue_id !== issueId)
  );
  emitStoreChange();
}

export async function deleteIssue(issueId: string): Promise<void> {
  if (isDemoMode()) {
    deleteLocalIssue(issueId);
    return;
  }

  const supabase = createClient();

  const { error } = await supabase
    .from('issues')
    .delete()
    .eq('id', issueId);

  if (error) throw new Error(error.message);
}

export function useIssueStore() {
  const isDemo = isDemoMode();
  const [state, setState] = useState<IssueStoreState>(() => ({
    issues: isDemo ? getMergedIssues() : [],
    activities: isDemo ? getMergedActivities() : [],
    loading: !isDemo,
  }));

  const refresh = useCallback(async () => {
    if (isDemo) {
      setState({
        issues: getMergedIssues(),
        activities: getMergedActivities(),
        loading: false,
      });
      return;
    }

    const supabase = createClient();

    const [issuesRes, activitiesRes] = await Promise.all([
      supabase
        .from('issues')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('issue_activities')
        .select('*')
        .order('created_at', { ascending: true }),
    ]);

    const issues = (issuesRes.data ?? []).map((issue: Record<string, unknown>) => ({
      ...issue,
      attachments: [],
    })) as Issue[];

    setState({
      issues,
      activities: (activitiesRes.data ?? []) as IssueActivity[],
      loading: false,
    });
  }, [isDemo]);

  useEffect(() => {
    if (!isDemo) {
      let cancelled = false;

      async function loadIssues() {
        const supabase = createClient();
        const [issuesRes, activitiesRes] = await Promise.all([
          supabase
            .from('issues')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('issue_activities')
            .select('*')
            .order('created_at', { ascending: true }),
        ]);

        if (cancelled) return;

        const issues = (issuesRes.data ?? []).map((issue: Record<string, unknown>) => ({
          ...issue,
          attachments: [],
        })) as Issue[];

        setState({
          issues,
          activities: (activitiesRes.data ?? []) as IssueActivity[],
          loading: false,
        });
      }

      void loadIssues();

      return () => {
        cancelled = true;
      };
    }

    const sync = () => {
      setState({
        issues: getMergedIssues(),
        activities: getMergedActivities(),
        loading: false,
      });
    };
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === ISSUES_KEY ||
        event.key === ACTIVITIES_KEY ||
        event.key === DELETED_ISSUE_IDS_KEY
      ) {
        sync();
      }
    };

    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener('storage', handleStorage);
    };
  }, [isDemo]);

  return { ...state, refresh };
}
