# Architecture

CURI Wiki의 정보 구조, 라우팅, 프로젝트 구조를 설명합니다.

---

## Information Architecture

CURI Wiki는 **HOME**과 **ISSUE** 두 개의 최상위 영역으로 나뉩니다.

```
HOME
├── CURI AI       → /category/curi-ai
└── WAME          → /category/wame

ISSUE             → /issues
├── Admin         → /issues/admin
├── Healthcare    → /issues/healthcare
└── Dashboard     → /issues/dashboard
```

### HOME

- 전체 Wiki 문서를 관리하는 영역
- 하위에 CURI AI, WAME 카테고리가 위치
- `/home`에서 전체 문서 조회 가능

### ISSUE

- HOME과 독립된 최상위 메뉴
- Project → Issue 계층 구조
- Admin / Healthcare / Dashboard 3개 프로젝트

---

## Routes

### Wiki

```
/home                          홈 (전체 문서)
/category/curi-ai              CURI AI 카테고리 문서 목록
/category/wame                 WAME 카테고리 문서 목록
/documents                     전체 문서 목록 (검색 포함)
/documents/new                 새 문서 작성
/documents/[slug]              문서 상세
/documents/[slug]/edit         문서 편집
/search                        검색
```

### Issue

```
/issues                        Issue 프로젝트 목록
/issues/admin                  Admin 프로젝트 Issue 목록
/issues/healthcare             Healthcare 프로젝트 Issue 목록
/issues/dashboard              Dashboard 프로젝트 Issue 목록
/issues/[project]/new          새 Issue 등록
/issues/[project]/[id]         Issue 상세
```

### Auth

```
/login                         Google 로그인
```

---

## Project Structure

```
src/
├── app/
│   ├── globals.css                     디자인 토큰 (CSS 변수)
│   ├── layout.tsx                      루트 레이아웃 (AuthProvider)
│   ├── page.tsx                        루트 리다이렉트
│   ├── (auth)/
│   │   └── login/page.tsx              Google 로그인 페이지
│   └── (dashboard)/
│       ├── layout.tsx                  대시보드 레이아웃 (Sidebar + Topbar)
│       ├── home/page.tsx               홈 (전체 문서)
│       ├── category/[slug]/page.tsx    카테고리별 문서 목록
│       ├── documents/
│       │   ├── page.tsx                전체 문서 목록
│       │   ├── new/page.tsx            새 문서 작성
│       │   └── [slug]/
│       │       ├── page.tsx            문서 상세 (Markdown 렌더링)
│       │       └── edit/page.tsx       문서 편집
│       ├── issues/
│       │   ├── page.tsx                Issue 프로젝트 목록
│       │   └── [project]/
│       │       ├── page.tsx            프로젝트별 Issue 목록
│       │       ├── new/page.tsx        새 Issue 등록
│       │       └── [id]/page.tsx       Issue 상세
│       └── search/page.tsx             검색
│
├── components/
│   ├── ui/                             공통 UI 컴포넌트
│   │   ├── button.tsx                  Button (default, secondary, ghost, outline, destructive)
│   │   ├── badge.tsx                   Badge (default, success, warning, error, info, pink, outline)
│   │   ├── card.tsx                    Card
│   │   ├── dialog.tsx                  Dialog (Modal)
│   │   ├── input.tsx                   Input
│   │   ├── textarea.tsx                Textarea
│   │   ├── select.tsx                  Select
│   │   ├── tabs.tsx                    Tabs
│   │   ├── avatar.tsx                  Avatar
│   │   ├── tooltip.tsx                 Tooltip
│   │   ├── checkbox.tsx                Checkbox
│   │   ├── label.tsx                   Label
│   │   ├── separator.tsx               Separator
│   │   ├── dropdown-menu.tsx           Dropdown Menu
│   │   └── scroll-area.tsx             Scroll Area
│   ├── layout/
│   │   ├── sidebar.tsx                 사이드바 (HOME / ISSUE 계층)
│   │   ├── topbar.tsx                  상단 바
│   │   └── command-palette.tsx         Command Palette (Cmd+K)
│   ├── documents/
│   │   └── document-album-grid.tsx     문서 카드 그리드
│   └── issues/
│       ├── issue-status-badge.tsx      상태 뱃지
│       ├── issue-priority-badge.tsx    중요도 뱃지
│       ├── issue-summary-cards.tsx     상태별 요약 카드
│       ├── issue-filters.tsx           필터 (상태, 중요도, 검색)
│       ├── issue-list-item.tsx         목록 아이템
│       ├── issue-activity-log.tsx      Activity 타임라인
│       └── issue-action-buttons.tsx    상태 변경 버튼
│
├── data/
│   ├── seed-categories.ts              카테고리 시드 데이터
│   ├── seed-documents.ts               문서 시드 데이터 (CURI Design Guide)
│   ├── seed-issues.ts                  Issue 시드 데이터 (4개 샘플)
│   ├── seed-profiles.ts               사용자 프로필 (5명)
│   ├── seed-projects.ts               프로젝트 시드 데이터
│   ├── seed-tags.ts                   태그 및 문서 접근 권한
│   └── mock-repository.ts             Mock Repository 구현
│
├── lib/
│   ├── auth-context.tsx                인증 컨텍스트 (Firebase Google Auth)
│   ├── firebase.ts                     Firebase 초기화
│   ├── document-store.ts              문서 저장소 (localStorage)
│   ├── issue-store.ts                 Issue 저장소 (localStorage)
│   ├── issue-events.ts                Issue 이벤트 시스템 (Telegram 연동 준비)
│   ├── issue-permissions.ts           Issue 권한 함수
│   ├── permissions.ts                 문서 권한 함수
│   ├── repository.ts                  Repository 팩토리
│   └── utils.ts                       유틸리티 (cn, formatDate, slugify 등)
│
├── __tests__/
│   ├── setup.ts                        테스트 셋업
│   └── lib/
│       ├── issue-store.test.ts         Issue Store 테스트 (25개)
│       └── issue-permissions.test.ts   Issue 권한 테스트
│
└── types/
    └── index.ts                        전체 TypeScript 타입 정의
```

---

## Data Flow

### DEMO_MODE

현재 CURI Wiki는 데모 모드로 동작합니다.

```
Seed Data (src/data/)
        ↓
   localStorage
        ↓
   Merged State (seed + custom)
        ↓
   React Hook (useDocumentStore / useIssueStore)
        ↓
   UI Components
```

- Seed 데이터와 사용자가 추가한 데이터가 병합되어 표시됩니다
- 데이터는 `localStorage`에 저장됩니다 (서버 DB 없음)
- 첨부파일은 `blob:` URL로 처리되며, 새로고침 시 유지되지 않습니다
- `window.dispatchEvent()`를 통해 탭 간 동기화 지원

### 향후 구조

```
Client UI
    ↓
API Routes (Next.js)
    ↓
Server DB (PostgreSQL 등)
    ↓
Cloud Storage (첨부파일)
    ↓
Telegram Bot (알림)
```
