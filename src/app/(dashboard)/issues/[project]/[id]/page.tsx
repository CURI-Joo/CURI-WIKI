'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Film, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { useIssueStore, transitionIssueStatus, deleteIssue } from '@/lib/issue-store';
import { canDeleteIssue, canTransitionIssue } from '@/lib/issue-permissions';
import { IssueStatusBadge } from '@/components/issues/issue-status-badge';
import { IssuePriorityBadge } from '@/components/issues/issue-priority-badge';
import { IssueActionButtons } from '@/components/issues/issue-action-buttons';
import { IssueActivityLog } from '@/components/issues/issue-activity-log';
import { seedProfiles } from '@/data/seed-profiles';
import { formatDate } from '@/lib/utils';
import type { IssueStatus } from '@/types';

export default function ProjectIssueDetailPage({
  params,
}: {
  params: Promise<{ project: string; id: string }>;
}) {
  const { project: projectSlug, id } = use(params);
  const { user } = useAuth();
  const { issues, activities } = useIssueStore();
  const router = useRouter();

  const issue = issues.find((i) => i.id === id);
  const issueActivities = activities
    .filter((a) => a.issue_id === id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (!issue) {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center">
        <p className="text-text-muted">이슈를 찾을 수 없습니다.</p>
        <Link href={`/issues/${projectSlug}`}>
          <Button variant="ghost" size="sm" className="mt-4">목록으로 돌아가기</Button>
        </Link>
      </div>
    );
  }

  const reporter = seedProfiles.find((p) => p.id === issue.reporter_id);
  const assignee = issue.assignee_id
    ? seedProfiles.find((p) => p.id === issue.assignee_id)
    : null;

  const handleTransition = (newStatus: IssueStatus) => {
    if (!user) return;
    try {
      transitionIssueStatus(issue.id, newStatus, user.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : '상태 변경에 실패했습니다.');
    }
  };

  const handleDelete = () => {
    if (!user) return;
    const confirmed = window.confirm(`${issue.id} 이슈를 삭제할까요? 삭제 후에는 목록에서 보이지 않습니다.`);
    if (!confirmed) return;

    try {
      deleteIssue(issue.id);
      router.push(`/issues/${projectSlug}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '이슈 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/issues/${projectSlug}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <p className="text-xs text-text-muted">Issue &gt; {issue.project}</p>
          <span className="text-sm font-mono text-text-muted">{issue.id}</span>
        </div>
      </div>

      {/* Issue Card */}
      <div className="rounded-2xl border border-border bg-surface p-6 space-y-5">
        {/* Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{issue.project}</Badge>
            <IssuePriorityBadge priority={issue.priority} />
            <IssueStatusBadge status={issue.status} />
          </div>
          {user && canDeleteIssue(user) && (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-error/15 bg-error/5 px-2.5 text-xs font-medium text-error transition-colors hover:bg-error/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </button>
          )}
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h1 className="text-lg font-bold text-text-primary leading-relaxed">
            {issue.title}
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {issue.description}
          </p>
        </div>

        {/* Attachments */}
        {issue.attachments.length > 0 && (
          <div className="space-y-2">
            <p className="text-[13px] font-medium text-text-secondary">첨부파일</p>
            <div className="grid grid-cols-2 gap-2">
              {issue.attachments.map((url, i) => (
                <div key={i} className="rounded-lg border border-border overflow-hidden bg-surface-elevated">
                  {url.includes('video') ? (
                    <div className="flex items-center justify-center h-32">
                      <Film className="h-8 w-8 text-text-muted" />
                    </div>
                  ) : (
                    <img src={url} alt={`첨부 ${i + 1}`} className="h-32 w-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-elevated p-4 text-[13px]">
          <div>
            <span className="text-text-muted">등록자</span>
            <p className="font-medium text-text-primary">{reporter?.name ?? issue.reporter_id}</p>
          </div>
          <div>
            <span className="text-text-muted">담당자</span>
            <p className="font-medium text-text-primary">{assignee?.name ?? '-'}</p>
          </div>
          <div>
            <span className="text-text-muted">등록일</span>
            <p className="font-medium text-text-primary">{formatDate(issue.created_at)}</p>
          </div>
          <div>
            <span className="text-text-muted">최종 수정</span>
            <p className="font-medium text-text-primary">{formatDate(issue.updated_at)}</p>
          </div>
        </div>

        {/* Actions */}
        {user && canTransitionIssue(user) && (
          <div className="flex items-center gap-2 pt-2">
            <IssueActionButtons issue={issue} onTransition={handleTransition} />
          </div>
        )}
      </div>

      {/* Activity */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-text-primary">Activity</h2>
        <IssueActivityLog activities={issueActivities} />
      </div>
    </div>
  );
}
