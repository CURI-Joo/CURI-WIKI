'use client';

import Link from 'next/link';
import { Folder } from 'lucide-react';
import { useIssueStore } from '@/lib/issue-store';
import type { IssueProject } from '@/types';

const projects: { name: IssueProject; slug: string; description: string }[] = [
  { name: 'Admin', slug: 'admin', description: 'Admin 서비스 관련 이슈 관리' },
  { name: 'Healthcare', slug: 'healthcare', description: 'Healthcare 서비스 관련 이슈 관리' },
  { name: 'Dashboard', slug: 'dashboard', description: 'Dashboard 관련 이슈 관리' },
];

export default function IssuesPage() {
  const { issues } = useIssueStore();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-bold text-text-primary">Issue Projects</h1>

      <div className="space-y-3">
        {projects.map((project) => {
          const projectIssues = issues.filter((i) => i.project === project.name);
          const unresolvedCount = projectIssues.filter((i) => i.status !== '이슈 해결').length;

          return (
            <Link
              key={project.slug}
              href={`/issues/${project.slug}`}
              className="flex items-center gap-4 rounded-xl bg-surface-elevated/50 px-5 py-4 transition-colors hover:bg-surface-elevated"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
                <Folder className="h-5 w-5 text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-text-primary">{project.name}</p>
                <p className="text-[12px] text-text-muted">{project.description}</p>
              </div>
              {unresolvedCount > 0 && (
                <span className="shrink-0 rounded-full bg-curi-pink/10 px-2.5 py-0.5 text-xs font-medium text-curi-pink">
                  미해결 {unresolvedCount}건
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
