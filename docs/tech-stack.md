# Tech Stack

CURI Wiki에서 사용하는 기술 스택과 환경 설정을 설명합니다.

---

## Core

| 기술 | 버전 | 용도 |
| --- | --- | --- |
| Next.js | 16.3.4 | App Router, Turbopack |
| React | 19.2.8 | UI 렌더링 |
| TypeScript | 5.x | 타입 안전성 |

## Styling

| 기술 | 버전 | 용도 |
| --- | --- | --- |
| Tailwind CSS | 4.x | 유틸리티 기반 스타일링 |
| class-variance-authority | 0.7.1 | 컴포넌트 variant 관리 |
| clsx | 2.1.1 | 조건부 클래스 결합 |
| tailwind-merge | 3.6.0 | Tailwind 클래스 충돌 해결 |

## UI Components

| 기술 | 버전 | 용도 |
| --- | --- | --- |
| Radix UI | 1.x–2.x | Accessible UI primitives (Dialog, Select, Tabs 등) |
| Lucide React | 1.39.0 | 아이콘 |
| cmdk | 1.1.1 | Command Palette (Cmd+K) |

## Authentication

| 기술 | 버전 | 용도 |
| --- | --- | --- |
| Firebase | 12.18.0 | Google 계정 인증 (signInWithPopup) |

## Utilities

| 기술 | 버전 | 용도 |
| --- | --- | --- |
| date-fns | 4.4.0 | 날짜 포맷 |
| Fuse.js | 7.5.0 | Fuzzy 검색 |
| Zod | 4.5.4 | 스키마 검증 |
| React Hook Form | 7.87.0 | 폼 관리 |

## Dev / Test

| 기술 | 버전 | 용도 |
| --- | --- | --- |
| Vitest | 4.1.11 | 단위 테스트 |
| Testing Library | — | React 컴포넌트 테스트 유틸 |
| jsdom | 29.1.1 | 테스트 환경 DOM |
| ESLint | 9.x | 린팅 |

---

## Design Tokens

`src/app/globals.css`에 CSS 변수로 정의되어 있습니다.

### Brand

```css
--curi-pink: #D42872;
--curi-pink-hover: #BF2366;
--curi-pink-soft: rgba(212, 40, 114, 0.08);
```

### Background & Surface

```css
--background: #FFFFFF;
--surface: #F5F5F7;
--surface-elevated: #EEEEF0;
```

### Text

```css
--text-primary: #111118;
--text-secondary: #5C5D66;
--text-muted: #9496A1;
```

### Border

```css
--border: #D9D9DE;
```

### Status

```css
--success: #22C55E;
--warning: #F59E0B;
--error: #EF4444;
--info: #3B82F6;
```

Tailwind CSS v4의 `@theme inline` 지시자를 통해 CSS 변수가 Tailwind 클래스로 연결됩니다.

예: `bg-curi-pink`, `text-text-primary`, `border-border`

---

## Font

```css
font-family: "Pretendard", "Inter", system-ui, -apple-system, "Noto Sans KR", sans-serif;
```

Pretendard를 기본 폰트로 사용합니다. 한글과 영문 모두에서 깔끔한 가독성을 제공합니다.

---

## Environment Variables

`.env.local` 파일에 Firebase 설정이 필요합니다.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

해당 값은 Firebase Console > Project Settings에서 확인할 수 있습니다.

Secret (Bot Token, API Key 등)은 클라이언트 코드나 localStorage에 넣지 않습니다.

---

## Scripts

```bash
npm run dev        # 개발 서버 (Turbopack)
npm run build      # 프로덕션 빌드
npm start          # 프로덕션 서버
npm test           # Vitest 테스트 실행
npm run lint       # ESLint 실행
```
