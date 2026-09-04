'use client';

import Link from 'next/link';
import type { Issue, Profile } from '@/types';
import { IssueStatusBadge } from './issue-status-badge';
import { IssuePriorityBadge } from './issue-priority-badge';
import { formatDate } from '@/lib/utils';

export function IssueListItem({
  issue,
  profiles,
}: {
  issue: Issue;
  profiles: Profile[];
}) {
  const assignee = issue.assignee_id
    ? profiles.find((p) => p.id === issue.assignee_id)
    : null;

  const projectSlug = issue.project.toLowerCase();

  return (
    <Link
      href={`/issues/${projectSlug}/${issue.id}`}
      className="flex items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-surface-elevated"
    >
      <span className="shrink-0 text-xs font-mono text-text-muted w-[80px]">
        {issue.id}
      </span>
      <IssuePriorityBadge priority={issue.priority} />
      <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-text-primary">
        {issue.title}
      </span>
      <IssueStatusBadge status={issue.status} />
      <span className="shrink-0 text-xs text-text-muted w-[60px] text-right">
        {assignee ? assignee.name : '-'}
      </span>
      <span className="shrink-0 text-xs text-text-muted w-[80px] text-right">
        {formatDate(issue.created_at)}
      </span>
    </Link>
  );
}
