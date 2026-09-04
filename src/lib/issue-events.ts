import type { Issue, IssueStatus } from '@/types';

// ─── Event Types ─────────────────────────────────────────
export type IssueEventType =
  | 'issue_created'
  | 'issue_assigned'
  | 'issue_status_changed'
  | 'issue_resolved';

export interface IssueEventPayload {
  type: IssueEventType;
  issue: Issue;
  actor_id: string;
  /** status_changed 시 이전 상태 */
  from_status?: IssueStatus;
  /** Issue 상세 URL (클라이언트 기준) */
  issue_url: string;
  timestamp: string;
}

// ─── Listener Registry ──────────────────────────────────
type IssueEventListener = (payload: IssueEventPayload) => void;

const listeners: IssueEventListener[] = [];

export function onIssueEvent(listener: IssueEventListener) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

// ─── Dispatch ────────────────────────────────────────────
// 현재 DEMO_MODE: 등록된 listener에만 전달 (Telegram 미연동)
// 추후 서버 API 호출로 교체 예정:
//   Issue Event → POST /api/notifications → Telegram Bot → 채팅방
export function dispatchIssueEvent(payload: IssueEventPayload) {
  for (const listener of listeners) {
    try {
      listener(payload);
    } catch {
      // listener 에러가 핵심 로직에 영향 주지 않도록 무시
    }
  }
}

// ─── Helper ──────────────────────────────────────────────
export function buildIssueUrl(issue: Issue): string {
  const projectSlug = issue.project.toLowerCase();
  return `/issues/${projectSlug}/${issue.id}`;
}
