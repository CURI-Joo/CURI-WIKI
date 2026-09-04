# Contributing

CURI Wiki 개발에 참여하기 위한 가이드입니다.

---

## Getting Started

### 1. 설치

```bash
npm install
```

### 2. 환경 변수

`.env.local` 파일을 생성하고 Firebase 설정을 추가합니다.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

### 3. 개발 서버

```bash
npm run dev
```

`http://localhost:3000`에서 확인할 수 있습니다.

### 4. 테스트

```bash
npm test
```

---

## Testing

Vitest + jsdom 환경에서 테스트를 실행합니다.

### 테스트 구조

```
src/__tests__/
├── setup.ts                        테스트 셋업 (jest-dom)
└── lib/
    ├── issue-store.test.ts         Issue Store 테스트
    └── issue-permissions.test.ts   Issue 권한 테스트
```

### 테스트 작성 규칙

- 테스트 파일은 `src/__tests__/` 하위에 위치합니다
- 파일명은 `*.test.ts` 또는 `*.test.tsx` 형식입니다
- localStorage는 mock으로 처리합니다 (jsdom 환경 제한)

### localStorage Mock 패턴

```typescript
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
  get length() { return Object.keys(store).length; },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
};

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });
```

---

## Code Conventions

### 파일 구조

- 페이지: `src/app/(dashboard)/[feature]/page.tsx`
- 컴포넌트: `src/components/[feature]/[component-name].tsx`
- 데이터: `src/data/seed-[name].ts`
- 로직: `src/lib/[name].ts`
- 타입: `src/types/index.ts`

### Naming

- 컴포넌트: PascalCase (`IssueListItem`)
- 파일: kebab-case (`issue-list-item.tsx`)
- 함수: camelCase (`createIssue`)
- 타입: PascalCase (`IssueStatus`)
- CSS 변수: kebab-case (`--curi-pink`)

### UI 컴포넌트

- Radix UI primitives를 기반으로 합니다
- CVA (class-variance-authority)로 variant를 관리합니다
- `cn()` 유틸리티로 클래스를 결합합니다
- 디자인 토큰은 CSS 변수를 사용합니다 (`globals.css`)

### Data Store 패턴

Wiki 문서와 Issue 모두 동일한 패턴을 따릅니다.

```
Seed Data (src/data/)
    ↓
localStorage (custom data)
    ↓
getMerged*() — seed + custom 병합
    ↓
useXxxStore() — React hook으로 상태 제공
    ↓
window.dispatchEvent() — 변경 시 동기화
```

새로운 데이터 도메인을 추가할 때 `document-store.ts` 또는 `issue-store.ts`를 참고하세요.

---

## Adding a New Wiki Category

1. `src/types/index.ts`의 `CategorySlug`에 slug 추가
2. `src/data/seed-categories.ts`에 카테고리 추가
3. 필요 시 `src/components/layout/sidebar.tsx`에 메뉴 추가
4. `/category/[slug]` 라우트가 자동으로 해당 카테고리를 처리

---

## Adding a New Issue Project

1. `src/types/index.ts`의 `IssueProject`에 프로젝트명 추가
2. 다음 파일들의 `projectMap`에 slug → name 매핑 추가:
   - `src/app/(dashboard)/issues/page.tsx` (프로젝트 목록)
   - `src/app/(dashboard)/issues/[project]/page.tsx` (Issue 목록)
   - `src/app/(dashboard)/issues/[project]/new/page.tsx` (Issue 생성)
   - `src/app/(dashboard)/issues/[project]/[id]/page.tsx` (Issue 상세)

---

## Build & Deploy

### 빌드 확인

```bash
npm run build
```

빌드 성공 시 static/dynamic 라우트 목록이 출력됩니다.

### 주의사항

- `.env.local`은 git에 커밋하지 않습니다
- `node_modules/`와 `.next/`는 `.gitignore`에 포함되어 있습니다
- `.next` 캐시 문제 발생 시 `rm -rf .next`로 캐시를 삭제하고 재시작합니다
