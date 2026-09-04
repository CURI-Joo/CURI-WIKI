'use client';

import { useEffect, useState } from 'react';
import type { Issue, IssueActivity, IssueStatus, IssueProject, IssuePriority } from '@/types';
import { seedIssues, seedIssueActivities } from '@/data/seed-issues';
import { dispatchIssueEvent, buildIssueUrl } from '@/lib/issue-events';

const ISSUES_KEY = 'curi-wiki-issues-v1';
const ACTIVITIES_KEY = 'curi-wiki-issue-activities-v1';
const STORE_EVENT = 'curi-wiki-issue-store-change';

const VALID_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  '이슈 등록': ['해결 중'],
  '해결 중': ['이슈 해결'],
  '이슈 해결': [],
};

interface IssueStoreState {
  issues: Issue[];
  activities: IssueActivity[];
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

function getCustomIssues(): Issue[] {
  return readJson<Issue[]>(ISSUES_KEY, []);
}

function writeCustomIssues(issues: Issue[]) {
  writeJson(ISSUES_KEY, issues);
}

function getCustomActivities(): IssueActivity[] {
  return readJson<IssueActivity[]>(ACTIVITIES_KEY, []);
}

function writeCustomActivities(activities: IssueActivity[]) {
  writeJson(ACTIVITIES_KEY, activities);
}

function getMergedIssues(): Issue[] {
  const byId = new Map<string, Issue>();
  for (const issue of seedIssues) {
    byId.set(issue.id, issue);
  }
  for (const issue of getCustomIssues()) {
    byId.set(issue.id, issue);
  }
  return Array.from(byId.values());
}

function getMergedActivities(): IssueActivity[] {
  const byId = new Map<string, IssueActivity>();
  for (const activity of seedIssueActivities) {
    byId.set(activity.id, activity);
  }
  for (const activity of getCustomActivities()) {
    byId.set(activity.id, activity);
  }
  return Array.from(byId.values());
}

function getNextIssueNumber(): number {
  const issues = getMergedIssues();
  let maxNum = 0;
  for (const issue of issues) {
    const match = issue.id.match(/^ISSUE-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return maxNum + 1;
}

export function getIssueStoreState(): IssueStoreState {
  return {
    issues: getMergedIssues(),
    activities: getMergedActivities(),
  };
}

export function getAllIssues(): Issue[] {
  return getMergedIssues();
}

export function getIssueById(id: string): Issue | null {
  return getMergedIssues().find((issue) => issue.id === id) ?? null;
}

export function getActivitiesForIssue(issueId: string): IssueActivity[] {
  return getMergedActivities()
    .filter((a) => a.issue_id === issueId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export function createIssue(input: CreateIssueInput): Issue {
  const now = new Date().toISOString();
  const num = getNextIssueNumber();
  const id = `ISSUE-${String(num).padStart(3, '0')}`;

  if (!input.title.trim()) {
    throw new Error('이슈 제목은 필수입니다.');
  }
  if (!input.description.trim()) {
    throw new Error('이슈 내용은 필수입니다.');
  }
  if (input.attachments && input.attachments.length > 4) {
    throw new Error('첨부파일은 최대 4개까지 가능합니다.');
  }

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

export function transitionIssueStatus(
  issueId: string,
  newStatus: IssueStatus,
  actorId: string
): Issue {
  const issues = getCustomIssues();
  const allIssues = getMergedIssues();
  const issue = allIssues.find((i) => i.id === issueId);

  if (!issue) {
    throw new Error('이슈를 찾을 수 없습니다.');
  }

  const allowed = VALID_TRANSITIONS[issue.status];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `상태 전환이 허용되지 않습니다: ${issue.status} → ${newStatus}`
    );
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
    detail: `${issue.status} → ${newStatus}으로 변경했습니다.`,
    metadata: { from: issue.status, to: newStatus },
    created_at: now,
  };

  const updatedIssues = issues.filter((i) => i.id !== issueId);
  updatedIssues.push(updated);
  writeCustomIssues(updatedIssues);
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

export function useIssueStore() {
  const [state, setState] = useState<IssueStoreState>(() =>
    getIssueStoreState()
  );

  useEffect(() => {
    const sync = () => setState(getIssueStoreState());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ISSUES_KEY || event.key === ACTIVITIES_KEY) sync();
    };

    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return state;
}
