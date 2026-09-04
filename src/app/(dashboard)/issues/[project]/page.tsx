'use client';

import { use, useState, useMemo } from 'react';
import Link from 'next/link';
import { Plus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIssueStore } from '@/lib/issue-store';
import { IssueSummaryCards } from '@/components/issues/issue-summary-cards';
import { IssueFilters } from '@/components/issues/issue-filters';
import { IssueListItem } from '@/components/issues/issue-list-item';
import type { IssueStatus, IssuePriority, IssueProject } from '@/types';

const projectMap: Record<string, IssueProject> = {
  admin: 'Admin',
  healthcare: 'Healthcare',
  dashboard: 'Dashboard',
};

export default function ProjectIssuesPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectSlug } = use(params);
  const projectName = projectMap[projectSlug];
  const { issues } = useIssueStore();
  const [status, setStatus] = useState<IssueStatus | 'all'>('all');
  const [priority, setPriority] = useState<IssuePriority | 'all'>('all');
  const [search, setSearch] = useState('');

  const projectIssues = useMemo(() => {
    return issues.filter((i) => i.project === projectName);
  }, [issues, projectName]);

  const filtered = useMemo(() => {
    return projectIssues
      .filter((i) => status === 'all' || i.status === status)
      .filter((i) => priority === 'all' || i.priority === priority)
      .filter((i) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return i.title.toLowerCase().includes(q) || i.id.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [projectIssues, status, priority, search]);

  if (!projectName) {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center">
        <p className="text-text-muted">프로젝트를 찾을 수 없습니다.</p>
        <Link href="/issues">
          <Button variant="ghost" size="sm" className="mt-4">돌아가기</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/issues">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <p className="text-xs text-text-muted">Issue</p>
            <h1 className="text-xl font-bold text-text-primary">{projectName}</h1>
          </div>
        </div>
        <Link href={`/issues/${projectSlug}/new`}>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Issue
          </Button>
        </Link>
      </div>

      <IssueSummaryCards issues={projectIssues} />
      <IssueFilters
        status={status}
        priority={priority}
        search={search}
        onStatusChange={setStatus}
        onPriorityChange={setPriority}
        onSearchChange={setSearch}
      />

      {/* Header */}
      <div className="hidden md:flex items-center gap-3 px-4 text-[11px] font-medium text-text-muted uppercase tracking-wider">
        <span className="w-[80px]">ID</span>
        <span className="w-[90px]">중요도</span>
        <span className="flex-1">이슈 제목</span>
        <span className="w-[70px]">상태</span>
        <span className="w-[60px] text-right">담당자</span>
        <span className="w-[80px] text-right">등록일</span>
      </div>

      <div className="space-y-0.5">
        {filtered.length === 0 ? (
          <div className="rounded-xl bg-surface-elevated/50 p-12 text-center">
            <p className="text-text-muted text-sm">이슈가 없습니다.</p>
          </div>
        ) : (
          filtered.map((issue) => (
            <IssueListItem key={issue.id} issue={issue} />
          ))
        )}
      </div>
    </div>
  );
}
