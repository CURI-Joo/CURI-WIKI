'use client';

import { useEffect, useState, useCallback } from 'react';
import type { WorkLog, WorkLogProject, WorkLogStatus } from '@/types';
import { isDemoMode } from '@/lib/demo-mode';
import { createClient } from '@/lib/supabase/client';

const WORK_LOGS_KEY = 'curi-wiki-work-logs-v1';
const STORE_EVENT = 'curi-wiki-work-log-store-change';

interface WorkLogStoreState {
  logs: WorkLog[];
  loading: boolean;
}

export interface CreateWorkLogInput {
  user_id: string;
  work_date: string;
  project: WorkLogProject;
  title: string;
  description?: string;
  status?: WorkLogStatus;
  related_link?: string | null;
}

export interface UpdateWorkLogInput {
  work_date?: string;
  project?: WorkLogProject;
  title?: string;
  description?: string;
  status?: WorkLogStatus;
  related_link?: string | null;
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

function getLocalLogs() {
  return readJson<WorkLog[]>(WORK_LOGS_KEY, []);
}

function writeLocalLogs(logs: WorkLog[]) {
  writeJson(WORK_LOGS_KEY, logs);
}

function createLocalLog(input: CreateWorkLogInput): WorkLog {
  if (!input.title.trim()) throw new Error('업무 제목은 필수입니다.');

  const now = new Date().toISOString();
  const id = `wlog-${crypto.randomUUID()}`;
  const next: WorkLog = {
    id,
    user_id: input.user_id,
    work_date: input.work_date,
    project: input.project,
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    status: input.status ?? 'In Progress',
    related_link: input.related_link?.trim() || null,
    created_at: now,
    updated_at: now,
  };

  writeLocalLogs([...getLocalLogs(), next]);
  emitStoreChange();
  return next;
}

function updateLocalLog(logId: string, input: UpdateWorkLogInput): WorkLog {
  const logs = getLocalLogs();
  const existing = logs.find((log) => log.id === logId);
  if (!existing) throw new Error('업무일지를 찾을 수 없습니다.');

  const updated: WorkLog = {
    ...existing,
    ...input,
    title: input.title?.trim() ?? existing.title,
    description: input.description?.trim() ?? existing.description,
    related_link: input.related_link === undefined
      ? existing.related_link
      : input.related_link?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  writeLocalLogs(logs.map((log) => (log.id === logId ? updated : log)));
  emitStoreChange();
  return updated;
}

function deleteLocalLog(logId: string) {
  writeLocalLogs(getLocalLogs().filter((log) => log.id !== logId));
  emitStoreChange();
}

export async function createWorkLog(input: CreateWorkLogInput): Promise<WorkLog> {
  if (isDemoMode()) return createLocalLog(input);
  if (!input.title.trim()) throw new Error('업무 제목은 필수입니다.');

  const supabase = createClient();
  const { data, error } = await supabase
    .from('work_logs')
    .insert({
      user_id: input.user_id,
      work_date: input.work_date,
      project: input.project,
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      status: input.status ?? 'In Progress',
      related_link: input.related_link?.trim() || null,
    })
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? '업무일지 생성에 실패했습니다.');
  return data as WorkLog;
}

export async function updateWorkLog(logId: string, input: UpdateWorkLogInput): Promise<WorkLog> {
  if (isDemoMode()) return updateLocalLog(logId, input);

  const supabase = createClient();
  const payload: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  };

  if (input.title !== undefined) payload.title = input.title.trim();
  if (input.description !== undefined) payload.description = input.description.trim();
  if (input.related_link !== undefined) payload.related_link = input.related_link?.trim() || null;

  const { data, error } = await supabase
    .from('work_logs')
    .update(payload)
    .eq('id', logId)
    .select('*')
    .single();

  if (error || !data) throw new Error(error?.message ?? '업무일지 수정에 실패했습니다.');
  return data as WorkLog;
}

export async function deleteWorkLog(logId: string): Promise<void> {
  if (isDemoMode()) {
    deleteLocalLog(logId);
    return;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('work_logs')
    .delete()
    .eq('id', logId);

  if (error) throw new Error(error.message);
}

export function useWorkLogStore(userId: string | null | undefined) {
  const isDemo = isDemoMode();
  const [state, setState] = useState<WorkLogStoreState>({ logs: [], loading: true });

  const refresh = useCallback(async () => {
    if (!userId) {
      return;
    }

    if (isDemo) {
      const allLogs = getLocalLogs();
      const logs = allLogs
        .filter((log) => log.user_id === userId)
        .sort((a, b) => {
          const byDate = b.work_date.localeCompare(a.work_date);
          if (byDate !== 0) return byDate;
          return b.created_at.localeCompare(a.created_at);
        });

      setState({ logs, loading: false });
      return;
    }

    const supabase = createClient();
    const { data } = await supabase
      .from('work_logs')
      .select('*')
      .eq('user_id', userId)
      .order('work_date', { ascending: false })
      .order('created_at', { ascending: false });

    setState({ logs: (data ?? []) as WorkLog[], loading: false });
  }, [isDemo, userId]);

  useEffect(() => {
    if (!userId) return;

    if (!isDemo) {
      let cancelled = false;

      async function load() {
        const supabase = createClient();
        const { data } = await supabase
          .from('work_logs')
          .select('*')
          .eq('user_id', userId)
          .order('work_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (cancelled) return;
        setState({ logs: (data ?? []) as WorkLog[], loading: false });
      }

      void load();

      return () => {
        cancelled = true;
      };
    }

    const sync = () => {
      const allLogs = getLocalLogs();
      const logs = allLogs
        .filter((log) => log.user_id === userId)
        .sort((a, b) => {
          const byDate = b.work_date.localeCompare(a.work_date);
          if (byDate !== 0) return byDate;
          return b.created_at.localeCompare(a.created_at);
        });

      setState({ logs, loading: false });
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === WORK_LOGS_KEY) sync();
    };

    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, [isDemo, userId]);

  if (!userId) {
    return {
      logs: [],
      loading: false,
      refresh,
    };
  }

  return { ...state, refresh };
}
