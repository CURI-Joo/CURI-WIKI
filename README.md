# CURI Wiki

> 업무 지식은 공유될 때 가치가 생기고, 이슈는 기록될 때 해결됩니다.

CURI Wiki는 CURI 팀의 제품 지식, 업무 맥락, 의사결정 기록을 한 곳에 모으고, 제품에서 발견된 문제와 개선사항을 체계적으로 관리하기 위한 **사내 지식공유 및 이슈관리 도구**입니다.

**배포 URL:** [https://curi-wiki-six.vercel.app](https://curi-wiki-six.vercel.app)

---

## 왜 CURI Wiki가 필요한가

회사에서 만들어지는 정보는 생각보다 빠르게 흩어집니다.

누군가는 Telegram에서 공유하고, 누군가는 개인 노션에 정리하고, 누군가는 구두로 설명합니다. 그 순간에는 전달이 되지만, 시간이 지나면 그 정보가 어디에 있는지, 왜 그렇게 결정했는지, 누가 알고 있는지 알기 어려워집니다.

- 같은 질문이 반복되고, 매번 아는 사람을 찾아 물어봐야 합니다.
- 과거에 왜 그런 결정을 했는지 맥락이 사라집니다.
- 특정 사람에게 지식이 쏠리면, 그 사람이 없을 때 업무가 멈춥니다.
- 새로 합류한 구성원이 서비스와 업무를 이해하기까지 불필요하게 오래 걸립니다.

CURI Wiki는 이런 문제를 해결하기 위해 만들어졌습니다.

업무를 하면서 얻은 지식, 기술적 해결 방법, 고객과 서비스에 대한 인사이트를 구성원 누구나 쉽게 기록하고, 필요한 사람이 빠르게 찾을 수 있도록 합니다. 단순한 문서 저장소가 아니라, **회사의 실행 과정과 학습 내용을 축적하는 살아있는 내부 위키**입니다.

---

## 왜 이슈 관리가 필요한가

제품을 빠르게 만들고 반복하는 과정에서 작은 오류, UX 문제, 정책 누락, 개선 아이디어는 생각보다 쉽게 놓칩니다.

이슈를 구두나 메신저로만 공유하면 시간이 지나면서 핵심 정보가 사라집니다.

- 누가 담당하고 있는지 모릅니다.
- 어떤 이슈가 급한지 판단할 근거가 없습니다.
- 해결되었는지 안 되었는지 확인하려면 다시 물어봐야 합니다.
- 재현 방법이나 맥락을 모르면 같은 문제를 다시 조사해야 합니다.

이슈를 한 곳에 기록하고 관리하면 서비스의 안정성을 높이고, 사용자의 불편을 줄이며, 제품을 체계적으로 개선할 수 있습니다.

CURI Wiki의 이슈 관리는 단순한 버그 신고 도구가 아닙니다. 개선 제안, QA 발견사항, 고객 피드백, 운영 중 확인된 문제를 모두 축적합니다. 이슈의 맥락, 재현 방법, 첨부 이미지와 영상, 진행 상태를 함께 남겨 **개발, 기획, 운영이 같은 정보를 보고 협업**할 수 있습니다.

빠르게 만드는 것과 안정적으로 개선하는 것은 따로가 아닙니다. 둘 다 함께 가야 제품이 성장합니다.

---

## 핵심 기능

### Wiki — 지식 공유

팀에서 반복적으로 참고해야 하는 정보를 문서로 남기고 관리합니다.

- **Markdown 문서 작성** — Markdown 방식으로 문서를 작성합니다. 제목, 목록, 표, 코드 블록, 체크리스트 등 구조화된 글을 지원합니다.
- **이미지 업로드** — 문서 작성 시 이미지를 업로드하면 Supabase Storage에 저장되고 Markdown에 자동 삽입됩니다.
- **실시간 미리보기** — 에디터에서 Markdown/미리보기 탭을 전환하며 최종 렌더링 결과를 확인할 수 있습니다.
- **목차 자동 생성** — 문서 본문의 Heading(h1~h3)을 기반으로 우측에 목차가 자동 표시됩니다.
- **카테고리 기반 분류** — CURI AI, WAME, ETC 카테고리로 문서를 분류합니다.
- **문서 검색** — 제목과 요약을 기준으로 문서를 검색합니다.
- **링크 복사** — 문서 상세 페이지에서 공유 링크를 클립보드에 복사할 수 있습니다.

```
HOME
├─ CURI AI    — CURI AI 제품 관련 지식
├─ ETC        — 공통 가이드, 기타 문서
└─ WAME       — WAME 제품 관련 지식
```

### Issue — 이슈 관리

프로젝트별로 이슈를 등록하고, 해결될 때까지 상태를 관리합니다.

- **이슈 등록** — 프로젝트(Admin, Healthcare, Dashboard)를 선택하고, 제목, 내용, 중요도, 담당자를 지정하여 이슈를 등록합니다.
- **이미지·영상 첨부** — 스크린샷이나 영상을 드래그 & 드롭, 클릭, 클립보드 붙여넣기(Cmd+V)로 첨부합니다. 첨부파일은 Supabase Storage에 저장됩니다.
- **상태 워크플로우** — `이슈 등록 → 해결 중 → 이슈 해결` 단계를 순서대로 진행합니다. 상태는 순서대로만 변경 가능하며, 건너뛸 수 없습니다.
- **중요도 구분** — `즉시 수정 필요` / `차차 수정 필요` / `개선 사항`으로 긴급도를 구분합니다.
- **이슈 필터링** — 상태, 중요도, 검색어로 이슈 목록을 필터링합니다.
- **이슈 내용 복사** — 이슈 상세 화면에서 내용을 복사하여 다른 채널에 공유할 수 있습니다.
- **활동 로그** — 이슈의 상태 변경, 담당자 변경 등 모든 활동이 이력으로 기록됩니다.
- **Telegram 그룹 알림** — 이슈 등록 시 Telegram 그룹의 지정된 Topic으로 자동 알림을 발송합니다. 프로젝트명, 제목, 중요도, 담당자, 등록자, 이슈 링크가 포함됩니다.

```
ISSUE
├─ Admin        — Admin 서비스 이슈
├─ Healthcare   — Healthcare 서비스 이슈
└─ Dashboard    — Dashboard 이슈
```

#### 첨부파일 제한

| 항목 | 제한 |
| --- | --- |
| 최대 파일 수 | 4개 |
| 이미지 크기 | 10MB 이하 |
| 영상 크기 | 50MB 이하 |
| 총 용량 | 100MB 이하 |
| 허용 형식 | PNG, JPG, JPEG, WebP, GIF, MP4, WebM, MOV |

### 사용자 관리

- **Google OAuth 로그인** — Google 계정으로 로그인합니다. Supabase Auth를 통해 처리되며, 리다이렉트 방식을 사용합니다.
- **관리자 승인 워크플로우** — 신규 가입 시 `pending` 상태로 생성되며, 관리자가 승인해야 서비스 이용이 가능합니다. `ADMIN_EMAIL`로 설정된 이메일은 최초 로그인 시 자동으로 `approved` + `admin` 권한이 부여됩니다.
- **접근 제어** — `pending` 사용자는 대기 화면(`/pending`), `rejected` 사용자는 거절 화면(`/rejected`)으로 리다이렉트됩니다.
- **관리자 대시보드** — 관리자는 `/admin/users`에서 사용자 목록 조회, 승인/거절, 역할 변경을 할 수 있습니다.

---

## 아키텍처

### 전체 구조

```
Browser (Next.js Client)
    ↕ Supabase Auth (Google OAuth, 쿠키 기반 세션)
    ↕ Supabase Postgres (RLS 적용)
    ↕ Supabase Storage (wiki-media 버킷)
    ↕ Next.js API Routes (/api/telegram, /api/upload, /api/admin)
    ↕ Vercel (배포)
```

### 라우팅 구조

```
/                          → 로그인 상태에 따라 /home 또는 /login으로 리다이렉트
/login                     → Google 로그인 페이지
/auth/callback             → OAuth 콜백 (code exchange, 자동 승인 처리)
/pending                   → 관리자 승인 대기 화면
/rejected                  → 접근 거부 화면

/home                      → 전체 글 목록 (최신순)
/category/[slug]           → 카테고리별 글 목록
/documents                 → 전체 글 목록 + 검색
/documents/new             → 새 문서 작성
/documents/[slug]          → 문서 상세 (본문, 목차, 메타정보)
/documents/[slug]/edit     → 문서 수정

/issues                    → 프로젝트 선택
/issues/[project]          → 프로젝트 이슈 목록 (필터링, 검색)
/issues/[project]/new      → 새 이슈 등록
/issues/[project]/[id]     → 이슈 상세 (상태 변경, 활동 로그, 첨부파일)

/admin/users               → 사용자 관리 (관리자 전용)
/search                    → 전체 검색
/design-system             → 디자인 시스템 참고 페이지
```

### 프로젝트 구조

```
curi-wiki/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # API Routes
│   │   │   ├── admin/users/route.ts  #   사용자 관리 API
│   │   │   ├── telegram/route.ts     #   Telegram 알림 API
│   │   │   └── upload/               #   파일 업로드/조회 API
│   │   │       ├── route.ts          #     POST: 파일 업로드
│   │   │       └── [id]/
│   │   │           ├── route.ts      #     GET: Signed URL 조회
│   │   │           └── file/route.ts #     GET: 파일 직접 제공
│   │   ├── auth/callback/route.ts    # OAuth 콜백 핸들러
│   │   ├── (auth)/                   # 인증 관련 페이지 (로그인, 대기, 거절)
│   │   ├── (dashboard)/              # 인증 후 대시보드 (레이아웃 가드 적용)
│   │   └── layout.tsx                # 루트 레이아웃
│   ├── components/
│   │   ├── ui/                       # shadcn/ui 기반 공통 컴포넌트 (16개)
│   │   ├── layout/                   # 사이드바, 탑바, 커맨드 팔레트
│   │   ├── documents/                # 문서 관련 (앨범 그리드, 마크다운 렌더러, 이미지 업로드)
│   │   └── issues/                   # 이슈 관련 (필터, 목록, 상태 배지, 활동 로그 등)
│   ├── lib/
│   │   ├── supabase/                 # Supabase 클라이언트 (브라우저, 서버, Admin)
│   │   ├── auth-context.tsx          # 인증 컨텍스트 (세션, 프로필, 로그인/로그아웃)
│   │   ├── document-store.ts         # 문서 CRUD (Supabase Postgres)
│   │   ├── issue-store.ts            # 이슈 CRUD (Supabase Postgres)
│   │   ├── profiles-store.ts         # 프로필 조회 (모듈 레벨 캐시)
│   │   ├── permissions.ts            # 권한 체크 (admin 판별)
│   │   └── issue-permissions.ts      # 이슈 권한 체크
│   ├── data/
│   │   ├── seed-categories.ts        # 카테고리 정의 (CURI AI, WAME, ETC)
│   │   ├── issue-projects.ts         # 이슈 프로젝트 매핑 (Admin, Healthcare, Dashboard)
│   │   └── demo-data.ts              # 데모 모드용 시드 데이터
│   └── types/
│       └── index.ts                  # TypeScript 타입 정의
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql    # DB 스키마, RLS 정책, 트리거, 스토리지 설정
│       └── 002_seed_data.sql         # 카테고리, 태그 시드 데이터
├── middleware.ts                     # Supabase 세션 쿠키 갱신 미들웨어
├── next.config.ts                    # Next.js 설정 (이미지 도메인 등)
├── tailwind.config.ts                # Tailwind CSS 설정
└── .env.example                      # 환경변수 템플릿
```

### 데이터베이스 스키마

```
profiles          — 사용자 프로필 (auth.users FK, 역할, 승인 상태)
categories        — 문서 카테고리 (CURI AI, WAME, ETC)
documents         — Wiki 문서 (제목, 본문, 카테고리, 작성자)
document_access   — 문서 접근 권한 (향후 확장용)
issues            — 이슈 (제목, 내용, 프로젝트, 상태, 중요도, 담당자)
issue_activities  — 이슈 활동 로그 (상태 변경, 담당자 변경 등)
attachments       — 첨부파일 메타데이터 (Storage key, 파일명, MIME 타입)
tags              — 태그
document_tags     — 문서-태그 연결
```

모든 테이블에 **Row Level Security (RLS)** 가 적용되어 있으며, `approved` 상태의 사용자만 데이터에 접근할 수 있습니다.

### 인증 흐름

```
1. 사용자가 /login에서 "Google로 로그인" 클릭
2. Supabase Auth → Google OAuth 리다이렉트
3. 인증 완료 → /auth/callback으로 리다이렉트
4. code exchange → 세션 생성
5. ADMIN_EMAIL 일치 시 → 자동으로 approved + admin 설정
6. profiles 테이블에서 status 확인:
   - approved → /home으로 이동
   - pending  → /pending으로 이동
   - rejected → /rejected으로 이동
```

### Telegram 알림 흐름

```
1. 사용자가 이슈 등록 (담당자 유무 관계없이)
2. 클라이언트 → POST /api/telegram
3. 서버에서 인증 확인 (Supabase Auth)
4. Telegram Bot API sendMessage 호출
   - chat_id: TELEGRAM_CHAT_ID (그룹)
   - message_thread_id: TELEGRAM_MESSAGE_THREAD_ID (Topic)
5. 중복 방지 (in-memory dedup)
6. 전송 실패 시에도 이슈 등록은 정상 완료
```

---

## 기대 효과

| 기존 방식 | CURI Wiki 사용 시 |
| --- | --- |
| 정보가 메신저, 노션, 구두 공유에 흩어져 있음 | 한 곳에서 검색하고 참고할 수 있음 |
| 같은 질문이 반복되고 매번 사람을 찾아야 함 | 문서를 보고 스스로 해결할 수 있음 |
| 이슈를 구두로 공유하면 맥락과 진행 상태가 사라짐 | 이슈의 전체 이력과 상태를 누구나 확인 가능 |
| 새 구성원이 업무 맥락을 파악하는 데 시간이 오래 걸림 | Wiki 문서로 빠르게 온보딩 가능 |
| 특정 사람에게 지식이 쏠림 | 팀 전체가 지식을 공유하고 축적 |

---

## 사용 대상

CURI 팀의 모든 구성원이 사용합니다.

- **개발** — 기술적 결정, 구현 방법, 트러블슈팅 기록. 이슈 등록 및 해결 상태 관리.
- **기획** — 제품 정책, 기능 설명, 사용자 흐름 정리. 개선 제안 및 QA 발견사항 등록.
- **운영** — 운영 절차, 고객 피드백, 장애 대응 기록.
- **신규 합류 구성원** — 서비스 구조, 업무 기준, 주요 정책을 Wiki에서 확인하고 빠르게 적응.

---

## 향후 확장 가능성

현재는 초기 버전으로 핵심 기능에 집중하고 있습니다. 아래 항목은 향후 검토 대상입니다.

- 문서 및 이슈에 대한 세분화된 권한 관리
- 검색 고도화 (전문 검색, 태그 기반 필터링)
- 이슈 코멘트 및 스레드
- 문서 버전 히스토리 조회
- 대시보드 및 통계

---

## 기술 스택

| 영역 | 기술 | 버전 |
| --- | --- | --- |
| Framework | Next.js (App Router, Turbopack) | 16.3.4 |
| UI | React | 19.2.8 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS, CSS Variables 기반 디자인 토큰 | 4 |
| UI Components | Radix UI, shadcn/ui, class-variance-authority | - |
| Icons | Lucide React | 1.39.0 |
| Authentication | Supabase Auth (Google OAuth, 쿠키 기반 세션) | - |
| Database | Supabase Postgres + Row Level Security | - |
| Storage | Supabase Storage (`wiki-media` 버킷) | - |
| Supabase Client | @supabase/supabase-js, @supabase/ssr | 2.115.0, 0.12.5 |
| Search | Fuse.js (클라이언트 퍼지 검색) | 7.5.0 |
| Form | React Hook Form, Zod | 7.87.0, 4.5.4 |
| Date | date-fns | 4.4.0 |
| Middleware | Next.js Middleware (세션 쿠키 갱신) | - |
| Notification | Telegram Bot API (Next.js API Route) | - |
| Testing | Vitest, Testing Library, jsdom | 4.1.11 |
| Deployment | Vercel | - |

---

## 로컬 실행 방법

### 사전 준비

- Node.js 18 이상
- npm
- Supabase 프로젝트 (Google OAuth Provider 설정 포함)
- Google Cloud Console에서 OAuth 2.0 Client ID 생성

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

`http://localhost:3000`에서 확인할 수 있습니다.

### 환경 변수

프로젝트 루트에 `.env.local` 파일을 생성합니다. `.env.example`을 참고하세요.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Admin (최초 로그인 시 자동 승인 + admin 권한 부여)
ADMIN_EMAIL=admin@example.com

# Telegram Bot (선택)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=-1002011880068
TELEGRAM_MESSAGE_THREAD_ID=67730
```

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | O | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | O | Supabase 공개 API 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | O | Supabase Service Role 키 (서버 전용, 클라이언트 노출 금지) |
| `NEXT_PUBLIC_APP_URL` | O | 앱 URL (로컬: `http://localhost:3000`, 배포: Vercel URL) |
| `ADMIN_EMAIL` | O | 관리자 이메일 (자동 승인 대상) |
| `TELEGRAM_BOT_TOKEN` | - | Telegram Bot 토큰 |
| `TELEGRAM_CHAT_ID` | - | Telegram 그룹 chat ID |
| `TELEGRAM_MESSAGE_THREAD_ID` | - | Telegram 그룹 내 Topic thread ID |

### Supabase 설정

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 프로젝트 생성
2. Authentication > Providers > Google 활성화 (Google Cloud Console에서 OAuth Client ID/Secret 입력)
3. Authentication > URL Configuration > Site URL을 앱 URL로 설정
4. Authentication > URL Configuration > Redirect URLs에 앱 URL 추가
5. SQL Editor에서 마이그레이션 실행:
   - `supabase/migrations/001_initial_schema.sql` — 테이블, RLS, 트리거, 스토리지
   - `supabase/migrations/002_seed_data.sql` — 카테고리, 태그 시드 데이터

### 빌드

```bash
npm run build
npm start
```

### 테스트

```bash
npm test
```

---

## License

Private — CURI 내부 사용 전용
