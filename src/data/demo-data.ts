import type { AuditLog, Document, DocumentAccess, DocumentTag, Issue, IssueActivity, Profile, Tag } from '@/types';

export const demoProfiles: Profile[] = [
  {
    id: 'user-minjoo',
    email: 'joo@askcuri.com',
    name: '서민주',
    avatar_url: null,
    role: 'admin',
    status: 'approved',
    created_at: '2024-03-01T09:00:00Z',
    updated_at: '2024-03-01T09:00:00Z',
  },
  {
    id: 'user-ceo',
    email: 'jesse@askcuri.com',
    name: 'jesse',
    avatar_url: null,
    role: 'member',
    status: 'approved',
    created_at: '2024-01-01T09:00:00Z',
    updated_at: '2024-01-01T09:00:00Z',
  },
  {
    id: 'user-dev1',
    email: 'dean@askcuri.com',
    name: 'dean',
    avatar_url: null,
    role: 'member',
    status: 'approved',
    created_at: '2024-02-15T09:00:00Z',
    updated_at: '2024-02-15T09:00:00Z',
  },
  {
    id: 'user-dev2',
    email: 'calix@askcuri.com',
    name: 'calix',
    avatar_url: null,
    role: 'member',
    status: 'approved',
    created_at: '2024-04-01T09:00:00Z',
    updated_at: '2024-04-01T09:00:00Z',
  },
  {
    id: 'user-designer',
    email: 'jun@askcuri.com',
    name: 'jun',
    avatar_url: null,
    role: 'member',
    status: 'approved',
    created_at: '2024-05-01T09:00:00Z',
    updated_at: '2024-05-01T09:00:00Z',
  },
];

export const demoDocuments: Document[] = [
  {
    id: 'doc-wiki-guide',
    title: 'CURI Wiki Guide',
    slug: 'wiki-guide',
    summary: 'CURI Wiki의 목적과 문서 작성 방법을 정리한 사내 가이드',
    content_markdown: `# CURI Wiki Guide

> CURI Wiki는 CURI 팀의 제품 지식, 작업 기준, 운영 문서, 의사결정 기록을 한 곳에 모아 함께 관리하기 위한 내부 Wiki입니다.

## Wiki에 남기면 좋은 정보

| 종류 | 예시 |
| --- | --- |
| 제품 지식 | 기능 설명, 사용자 흐름, 주요 정책 |
| 작업 기준 | 디자인 기준, 개발 컨벤션, QA 기준 |
| 운영 정보 | 계정 관리, 배포 전 체크리스트, 장애 대응 방법 |
| 온보딩 자료 | 신규 팀원이 처음 알아야 할 제품/업무 정보 |

## 작성 흐름

1. 공유해야 할 정보가 생기면 일회성 대화인지 계속 참고할 정보인지 판단합니다.
2. 계속 참고할 정보라면 Wiki 문서로 남깁니다.
3. CURI AI, WAME, ETC 중 가장 맞는 카테고리를 선택합니다.
4. 제목과 요약은 나중에 검색하기 쉬운 표현으로 작성합니다.
5. 내용이 바뀌면 기존 문서를 수정해 최신 상태를 유지합니다.`,
    category_id: 'cat-etc',
    owner_id: 'user-minjoo',
    status: 'Published',
    visibility: 'COMPANY',
    external_status: 'INTERNAL_ONLY',
    created_by: 'user-minjoo',
    updated_by: 'user-minjoo',
    created_at: '2026-09-03T12:00:00Z',
    updated_at: '2026-09-03T12:00:00Z',
    published_at: '2026-09-03T12:00:00Z',
  },
  {
    id: 'doc-issue-guide',
    title: 'CURI Wiki Issue Guide',
    slug: 'issue-guide',
    summary: 'ISSUE 기능 사용법과 상태 전환 기준을 정리한 문서',
    content_markdown: `# CURI Wiki Issue Guide

ISSUE는 제품에서 발견된 문제와 개선사항을 등록하고, 해결 상태를 팀에서 함께 확인하기 위한 기능입니다.

## 상태

\`\`\`text
이슈 등록 -> 해결 중 -> 이슈 해결
\`\`\`

상태는 순서대로만 변경합니다. 작업자가 이슈를 확인하면 해결 중으로 바꾸고, 수정과 확인이 끝나면 이슈 해결로 바꿉니다.

## 등록 기준

- 재현 방법, 기대 동작, 실제 동작을 함께 적습니다.
- 스크린샷이나 영상을 첨부하면 담당자가 빠르게 파악할 수 있습니다.
- 담당자를 모르면 미지정으로 등록한 뒤 목록에서 우선순위를 확인합니다.`,
    category_id: 'cat-etc',
    owner_id: 'user-minjoo',
    status: 'Published',
    visibility: 'COMPANY',
    external_status: 'INTERNAL_ONLY',
    created_by: 'user-minjoo',
    updated_by: 'user-minjoo',
    created_at: '2026-09-03T11:00:00Z',
    updated_at: '2026-09-03T11:00:00Z',
    published_at: '2026-09-03T11:00:00Z',
  },
  {
    id: 'doc-design-guide',
    title: 'CURI Design Guide',
    slug: 'design',
    summary: 'CURI 제품과 사내 도구에서 일관된 사용자 경험을 만들기 위한 디자인 가이드',
    content_markdown: `# CURI Design Guide

## Design Principles

### Simple First

사용자가 지금 무엇을 해야 하는지 먼저 보이게 합니다. 불필요한 UI 요소와 설명을 줄이고 핵심 행동에 집중합니다.

### Consistent Experience

CURI AI, WAME, Admin, Dashboard 등 서로 다른 제품에서도 동일한 패턴을 최대한 재사용합니다.

## Components

- Primary Button은 새 문서, New Issue처럼 화면의 주요 행동에 사용합니다.
- Badge는 상태와 짧은 metadata를 표현합니다.
- Input과 Textarea는 label을 함께 제공해 입력 목적을 명확히 합니다.`,
    category_id: 'cat-curi-ai',
    owner_id: 'user-minjoo',
    status: 'Published',
    visibility: 'COMPANY',
    external_status: 'INTERNAL_ONLY',
    created_by: 'user-minjoo',
    updated_by: 'user-minjoo',
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-03T09:00:00Z',
    published_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'doc-wame-overview',
    title: 'WAME 운영 메모',
    slug: 'wame-ops-note',
    summary: 'WAME 운영 중 반복적으로 확인해야 하는 체크리스트',
    content_markdown: `# WAME 운영 메모

## 매일 확인

- 신규 문의 유입 상태
- 캠페인별 응답률
- 예약 발송 실패 여부
- 고객사별 요청사항 누락 여부

## 장애 공유

장애가 확인되면 ISSUE에 먼저 등록하고, 재현 조건과 영향 범위를 함께 남깁니다.`,
    category_id: 'cat-wame',
    owner_id: 'user-ceo',
    status: 'Published',
    visibility: 'COMPANY',
    external_status: 'INTERNAL_ONLY',
    created_by: 'user-ceo',
    updated_by: 'user-ceo',
    created_at: '2026-08-29T10:00:00Z',
    updated_at: '2026-09-02T08:30:00Z',
    published_at: '2026-08-29T10:00:00Z',
  },
];

export const demoTags: Tag[] = [
  { id: 'tag-ai', name: 'AI', slug: 'ai' },
  { id: 'tag-guide', name: '가이드', slug: 'guide' },
  { id: 'tag-design', name: '디자인', slug: 'design' },
  { id: 'tag-ops', name: '운영', slug: 'ops' },
];

export const demoDocumentTags: DocumentTag[] = [
  { document_id: 'doc-design-guide', tag_id: 'tag-design' },
  { document_id: 'doc-wiki-guide', tag_id: 'tag-guide' },
  { document_id: 'doc-issue-guide', tag_id: 'tag-guide' },
  { document_id: 'doc-wame-overview', tag_id: 'tag-ops' },
];

export const demoDocumentAccess: DocumentAccess[] = [];

export const demoAuditLogs: AuditLog[] = [];

export const demoIssues: Issue[] = [
  {
    id: 'ISSUE-001',
    title: 'AI Survey 설정 Modal에서 저장 버튼 접근 불가',
    description: 'AI Survey 설정 화면의 Modal에서 저장 버튼이 화면 하단에 가려져 클릭할 수 없습니다. 특히 해상도가 낮은 모니터에서 재현됩니다.',
    project: 'Admin',
    status: '해결 중',
    priority: '즉시 수정 필요',
    reporter_id: 'user-minjoo',
    assignee_id: 'user-dev1',
    attachments: [],
    created_at: '2026-09-01T09:00:00Z',
    updated_at: '2026-09-01T11:15:00Z',
  },
  {
    id: 'ISSUE-002',
    title: 'YouTube 링크 연결 기능이 정상적으로 동작하지 않음',
    description: 'Admin 콘텐츠 관리에서 YouTube 링크 입력 시 임베드 미리보기가 표시되지 않고, 저장 후에도 링크가 정상적으로 연결되지 않습니다.',
    project: 'Admin',
    status: '이슈 등록',
    priority: '차차 수정 필요',
    reporter_id: 'user-minjoo',
    assignee_id: null,
    attachments: [],
    created_at: '2026-09-02T10:00:00Z',
    updated_at: '2026-09-02T10:00:00Z',
  },
  {
    id: 'ISSUE-003',
    title: '특정 Mobile 화면에서 Layout 깨짐',
    description: 'Galaxy S21 기준 Dashboard 메인 화면에서 카드 컴포넌트가 화면 밖으로 넘어가는 현상이 발생합니다. iOS에서는 재현되지 않습니다.',
    project: 'Dashboard',
    status: '이슈 해결',
    priority: '차차 수정 필요',
    reporter_id: 'user-designer',
    assignee_id: 'user-dev2',
    attachments: [],
    created_at: '2026-08-28T14:00:00Z',
    updated_at: '2026-08-30T16:40:00Z',
  },
  {
    id: 'ISSUE-004',
    title: '설문 완료 이후 잘못된 후속 메시지가 표시됨',
    description: '설문 완료 후 다음 단계 안내 대신 이전 설문의 안내 메시지가 다시 표시됩니다. 설문 ID가 꼬이는 것으로 추정됩니다.',
    project: 'Healthcare',
    status: '이슈 등록',
    priority: '개선 사항',
    reporter_id: 'user-ceo',
    assignee_id: null,
    attachments: [],
    created_at: '2026-09-03T08:30:00Z',
    updated_at: '2026-09-03T08:30:00Z',
  },
];

export const demoIssueActivities: IssueActivity[] = [
  {
    id: 'act-seed-001',
    issue_id: 'ISSUE-001',
    actor_id: 'user-minjoo',
    type: 'created',
    detail: '이슈를 등록했습니다.',
    metadata: {},
    created_at: '2026-09-01T09:00:00Z',
  },
  {
    id: 'act-seed-002',
    issue_id: 'ISSUE-001',
    actor_id: 'user-dev1',
    type: 'status_changed',
    detail: '이슈 등록 -> 해결 중으로 변경했습니다.',
    metadata: { from: '이슈 등록', to: '해결 중' },
    created_at: '2026-09-01T11:15:00Z',
  },
  {
    id: 'act-seed-003',
    issue_id: 'ISSUE-002',
    actor_id: 'user-minjoo',
    type: 'created',
    detail: '이슈를 등록했습니다.',
    metadata: {},
    created_at: '2026-09-02T10:00:00Z',
  },
  {
    id: 'act-seed-004',
    issue_id: 'ISSUE-003',
    actor_id: 'user-designer',
    type: 'created',
    detail: '이슈를 등록했습니다.',
    metadata: {},
    created_at: '2026-08-28T14:00:00Z',
  },
  {
    id: 'act-seed-005',
    issue_id: 'ISSUE-003',
    actor_id: 'user-dev2',
    type: 'status_changed',
    detail: '이슈 등록 -> 해결 중으로 변경했습니다.',
    metadata: { from: '이슈 등록', to: '해결 중' },
    created_at: '2026-08-29T10:00:00Z',
  },
  {
    id: 'act-seed-006',
    issue_id: 'ISSUE-003',
    actor_id: 'user-dev2',
    type: 'status_changed',
    detail: '해결 중 -> 이슈 해결로 변경했습니다.',
    metadata: { from: '해결 중', to: '이슈 해결' },
    created_at: '2026-08-30T16:40:00Z',
  },
  {
    id: 'act-seed-007',
    issue_id: 'ISSUE-004',
    actor_id: 'user-ceo',
    type: 'created',
    detail: '이슈를 등록했습니다.',
    metadata: {},
    created_at: '2026-09-03T08:30:00Z',
  },
];
