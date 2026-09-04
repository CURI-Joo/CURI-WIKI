import type { IssueProject } from '@/types';

interface IssueProjectConfig {
  name: IssueProject;
  slug: string;
  description: string;
}

export const issueProjects: IssueProjectConfig[] = [
  { name: 'Admin', slug: 'admin', description: 'Admin 서비스 관련 이슈 관리' },
  { name: 'Healthcare', slug: 'healthcare', description: 'Healthcare 서비스 관련 이슈 관리' },
  { name: 'Dashboard', slug: 'dashboard', description: 'Dashboard 관련 이슈 관리' },
  { name: 'Wiki', slug: 'wiki', description: 'CURI Wiki 관련 이슈 관리' },
];

export const issueProjectMap = issueProjects.reduce<Partial<Record<string, IssueProject>>>(
  (map, project) => {
    map[project.slug] = project.name;
    return map;
  },
  {}
);
