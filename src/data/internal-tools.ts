import { issueProjects } from '@/data/issue-projects';

export interface InternalTool {
  id: string;
  name: string;
  description: string;
  url: string;
  group: 'team-workspace' | 'public-service-f';
  iconSrc?: string;
  iconAlt?: string;
  openInNewTab?: boolean;
  team?: string;
  tags?: string[];
}

const issueServiceTools: InternalTool[] = issueProjects
  .filter((project) => Boolean(project.serviceUrl) && project.slug !== 'wiki')
  .map((project) => ({
    id: `issue-service-${project.slug}`,
    name: project.slug === 'dashboard' ? '지원사업 대시보드' : `${project.name} 서비스`,
    description: project.slug === 'dashboard' ? '지원사업 대시보드 화면 바로가기' : `${project.name} 운영 화면 바로가기`,
    url: project.serviceUrl as string,
    group: project.slug === 'dashboard' ? 'team-workspace' : 'public-service-f',
    iconSrc: project.slug === 'dashboard' ? '/support-dashboard-icon-v2.png' : undefined,
    iconAlt: project.slug === 'dashboard' ? '지원사업 대시보드 아이콘' : undefined,
    openInNewTab: true,
    tags: ['ISSUE', project.slug === 'dashboard' ? '지원사업' : project.name],
  }));

export const internalTools: InternalTool[] = [
  {
    id: 'wiki-home',
    name: 'Wiki 홈',
    description: '사내 위키 문서를 검색·작성·열람하는 메인 공간입니다.',
    url: '/home',
    group: 'team-workspace',
    iconSrc: '/wiki-home-tool-icon.png',
    iconAlt: '위키 홈 아이콘',
    tags: ['Wiki', '문서', '가이드'],
  },
  {
    id: 'issue-management',
    name: 'ISSUE 관리',
    description: '이슈를 등록하고 진행 상태를 관리하는 이슈 트래킹 화면입니다.',
    url: '/issues',
    group: 'team-workspace',
    iconSrc: '/issue-tool-icon.png',
    iconAlt: '이슈 관리 아이콘',
    tags: ['Issue', 'Tracking', 'QA'],
  },
  {
    id: 'channel-dashboard',
    name: '채널관리 대시보드',
    description: '회사 SNS/이메일 채널을 운영하고 콘텐츠를 관리하는 대시보드입니다.',
    url: 'https://channel.askcuri.com/topics',
    group: 'team-workspace',
    iconSrc: '/channel-management-icon.png',
    iconAlt: '채널관리 아이콘',
    openInNewTab: true,
    team: 'Marketing',
    tags: ['SNS', 'Email', 'LinkedIn', 'Instagram'],
  },
  {
    id: 'google-shared-drive',
    name: '공유드라이브',
    description: '팀 공유드라이브 폴더로 이동합니다. 접근 권한은 Google에서 확인됩니다.',
    url: 'https://drive.google.com/drive/folders/0AALubvqZT_SnUk9PVA',
    group: 'team-workspace',
    iconSrc: '/google-drive-file-icon.svg',
    iconAlt: '공유드라이브 파일 아이콘',
    openInNewTab: true,
    tags: ['Google Drive', 'Shared Drive', '문서'],
  },
  ...issueServiceTools,
];
