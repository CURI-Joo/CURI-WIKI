import type { IssueProject } from '@/types';

interface IssueProjectConfig {
  name: IssueProject;
  slug: string;
  description: string;
  serviceUrl?: string;
}

export const issueProjects: IssueProjectConfig[] = [
  { name: 'Admin', slug: 'admin', description: 'Admin 서비스 관련 이슈 관리', serviceUrl: 'https://admin.curiai.io/ko/auth/login' },
  { name: 'Healthcare', slug: 'healthcare', description: 'Healthcare 서비스 관련 이슈 관리', serviceUrl: 'https://healthcare.curiai.io/dashboard?lang=ko' },
  { name: 'Dashboard', slug: 'dashboard', description: 'Dashboard 관련 이슈 관리', serviceUrl: 'https://claude.ai/code/artifact/9c8fa54b-7785-45e4-bc75-3bc4ace81827' },
  { name: 'Wiki', slug: 'wiki', description: 'CURI Wiki 관련 이슈 관리', serviceUrl: 'https://curi-wiki-six.vercel.app' },
  { name: 'WAME', slug: 'wame', description: 'WAME 서비스 관련 이슈 관리', serviceUrl: 'https://www.wame.is/ko/calendar?date=2026-09-04' },
];

export const issueProjectMap = issueProjects.reduce<Partial<Record<string, IssueProject>>>(
  (map, project) => {
    map[project.slug] = project.name;
    return map;
  },
  {}
);
