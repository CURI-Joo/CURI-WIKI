export interface InternalTool {
  id: string;
  name: string;
  description: string;
  url: string;
  iconSrc?: string;
  iconAlt?: string;
  openInNewTab?: boolean;
  team?: string;
  tags?: string[];
}

export const internalTools: InternalTool[] = [
  {
    id: 'wiki-home',
    name: 'Wiki 홈',
    description: '사내 위키 문서를 검색·작성·열람하는 메인 공간입니다.',
    url: '/home',
    iconSrc: '/wiki-home-tool-icon.png',
    iconAlt: '위키 홈 아이콘',
    tags: ['Wiki', '문서', '가이드'],
  },
  {
    id: 'issue-management',
    name: 'ISSUE 관리',
    description: '이슈를 등록하고 진행 상태를 관리하는 이슈 트래킹 화면입니다.',
    url: '/issues',
    iconSrc: '/issue-tool-icon.png',
    iconAlt: '이슈 관리 아이콘',
    tags: ['Issue', 'Tracking', 'QA'],
  },
  {
    id: 'channel-dashboard',
    name: '채널관리 대시보드',
    description: '회사 SNS/이메일 채널을 운영하고 콘텐츠를 관리하는 대시보드입니다.',
    url: 'https://channel.askcuri.com/topics',
    openInNewTab: true,
    team: 'Marketing',
    tags: ['SNS', 'Email', 'LinkedIn', 'Instagram'],
  },
];
