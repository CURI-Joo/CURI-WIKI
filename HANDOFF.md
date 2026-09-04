# CURI Wiki — Supabase 전환 인수인계 문서

## 완료된 Phase (1~6)

### Phase 1: 인프라 설정
- `firebase` 제거, `@supabase/supabase-js` + `@supabase/ssr` 설치
- `.env.example` 생성
- `supabase/migrations/001_initial_schema.sql` — 전체 DB 스키마, RLS, 트리거, 스토리지 버킷
- `supabase/migrations/002_seed_data.sql` — categories 3개(curiai, wame, etc), tags 10개 시드

### Phase 2: Supabase 클라이언트 설정
- `src/lib/supabase/client.ts` — 브라우저 싱글턴 클라이언트
- `src/lib/supabase/server.ts` — 서버 클라이언트 (쿠키 기반)
- `src/lib/supabase/admin.ts` — Service Role 클라이언트 (API route 전용)
- `middleware.ts` — 세션 쿠키 갱신 미들웨어

### Phase 3: Auth 마이그레이션
- `src/lib/auth-context.tsx` — Firebase → Supabase Auth 전면 재작성
- `src/app/(auth)/login/page.tsx` — Google OAuth redirect 방식
- `src/app/auth/callback/route.ts` — OAuth 콜백, ADMIN_EMAIL 자동 승인
- `src/app/(auth)/pending/page.tsx` — 승인 대기 화면
- `src/app/(auth)/rejected/page.tsx` — 접근 거부 화면
- `src/app/(dashboard)/layout.tsx` — pending/rejected 리다이렉트 가드
- `src/app/page.tsx` — 루트 리다이렉트 업데이트
- `src/lib/firebase.ts` 삭제

### Phase 4: 데이터 레이어 마이그레이션
- `src/lib/document-store.ts` — localStorage → Supabase 전면 재작성
- `src/lib/issue-store.ts` — localStorage → Supabase 전면 재작성
- `src/lib/repository.ts` — mockRepository → Supabase 쿼리
- `src/lib/profiles-store.ts` — 프로필 캐시 훅 (신규)
- `src/lib/permissions.ts` — ADMIN/CEO → admin, active → approved
- `src/lib/issue-permissions.ts` — active → approved
- `src/types/index.ts` — Role, ProfileStatus, Profile(title 제거), Document(project_id 제거) 변경
- `src/data/seed-categories.ts` — 13개 → 3개(curiai, wame, etc)
- 문서 생성/수정 UI에서 상태·공개범위·외부활용 선택 UI 제거 (값은 DB 기본값 고정)
- 약 15개 컴포넌트에서 `user` → `profile`, seedProfiles → useProfiles 전환
- 삭제: seed-profiles.ts, seed-documents.ts, seed-issues.ts, seed-tags.ts, seed-projects.ts, mock-repository.ts, document-access-selector.tsx

### Phase 5: 파일 업로드 (Supabase Storage)
- `src/app/api/upload/route.ts` — POST: 파일 업로드 → wiki-media 버킷 + attachments 테이블
- `src/app/api/upload/[id]/route.ts` — GET: Signed URL 발급 (1시간)
- 이슈 생성 폼에서 첨부파일 → `/api/upload`로 업로드
- 이슈 상세에서 attachments 테이블 조회 → Signed URL로 렌더링

### Phase 6: Admin 사용자 관리
- `src/app/api/admin/users/route.ts` — GET: 전체 사용자 목록 / PATCH: 상태·역할 변경
- `src/app/(dashboard)/admin/users/page.tsx` — 관리자 전용 사용자 관리 페이지
- `src/components/layout/sidebar.tsx` — admin 사용자에게만 "관리" 메뉴 표시

---

## 변경 파일 요약

### 신규 파일 (17개)
| 파일 | 설명 |
|------|------|
| `.env.example` | 환경변수 템플릿 |
| `middleware.ts` | Supabase 세션 쿠키 갱신 |
| `supabase/migrations/001_initial_schema.sql` | DB 스키마 + RLS + 트리거 |
| `supabase/migrations/002_seed_data.sql` | 시드 데이터 |
| `src/lib/supabase/client.ts` | 브라우저 클라이언트 |
| `src/lib/supabase/server.ts` | 서버 클라이언트 |
| `src/lib/supabase/admin.ts` | Admin 클라이언트 |
| `src/lib/profiles-store.ts` | 프로필 캐시 훅 |
| `src/app/auth/callback/route.ts` | OAuth 콜백 |
| `src/app/(auth)/pending/page.tsx` | 승인 대기 화면 |
| `src/app/(auth)/rejected/page.tsx` | 접근 거부 화면 |
| `src/app/api/upload/route.ts` | 파일 업로드 API |
| `src/app/api/upload/[id]/route.ts` | Signed URL API |
| `src/app/api/admin/users/route.ts` | 사용자 관리 API |
| `src/app/(dashboard)/admin/users/page.tsx` | 사용자 관리 화면 |
| `src/lib/demo-mode.ts`, `src/data/demo-data.ts` | Supabase 장애/미설정 시 데모 모드 |

### 수정 파일 (약 20개)
| 파일 | 변경 |
|------|------|
| `package.json` | firebase 제거, supabase 추가 |
| `src/types/index.ts` | Role, ProfileStatus, Profile, Document 타입 변경 |
| `src/lib/auth-context.tsx` | Firebase → Supabase Auth |
| `src/lib/document-store.ts` | localStorage → Supabase |
| `src/lib/issue-store.ts` | localStorage → Supabase |
| `src/lib/repository.ts` | mock → Supabase |
| `src/lib/permissions.ts` | ADMIN/CEO → admin |
| `src/lib/issue-permissions.ts` | active → approved |
| `src/data/seed-categories.ts` | 3개 카테고리만 유지 |
| `src/app/(auth)/login/page.tsx` | Supabase OAuth redirect |
| `src/app/(dashboard)/layout.tsx` | 상태별 리다이렉트 |
| `src/app/page.tsx` | 루트 리다이렉트 |
| `src/app/(dashboard)/home/page.tsx` | 새 store 인터페이스 |
| `src/app/(dashboard)/documents/*` | store + UI 변경 |
| `src/app/(dashboard)/issues/*` | async API + profiles 전환 |
| `src/app/(dashboard)/search/page.tsx` | Supabase 검색 |
| `src/components/layout/command-palette.tsx` | Supabase 검색 |
| `src/components/layout/sidebar.tsx` | profile 참조 변경 |
| `src/components/issues/issue-list-item.tsx` | profiles prop |
| `src/components/issues/issue-activity-log.tsx` | profiles prop |

### 삭제 파일 (9개)
| 파일 | 이유 |
|------|------|
| `src/lib/firebase.ts` | Supabase로 대체 |
| `src/data/mock-repository.ts` | Supabase로 대체 |
| `src/data/seed-profiles.ts` | auth trigger가 프로필 생성 |
| `src/data/seed-documents.ts` | DB에서 직접 관리 |
| `src/data/seed-issues.ts` | DB에서 직접 관리 |
| `src/data/seed-tags.ts` | SQL 시드로 이전 |
| `src/data/seed-projects.ts` | 미사용 |
| `src/components/documents/document-access-selector.tsx` | RESTRICTED UI 제거 |
| `src/__tests__/lib/issue-store.test.ts` | sync → async API 변경으로 무효화 |

---

## 남은 Phase (7)

### Phase 7: 마무리 및 배포
- Supabase 프로젝트 환경변수 설정
- Supabase SQL 마이그레이션 실행
- Google OAuth 설정
- Vercel 배포 + 환경변수 등록

---

## 배포 전 필요한 환경변수

```env
# Supabase (프로젝트 생성 후 Settings > API에서 확인)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# App URL (Vercel 배포 후 도메인)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Admin 자동 승인 이메일
ADMIN_EMAIL=joo@askcuri.com

# Telegram (기존 설정 유지)
TELEGRAM_BOT_TOKEN=기존_값
TELEGRAM_CHAT_MAP=기존_값
```

## 배포 전 체크리스트

1. Supabase 프로젝트 생성
2. Supabase > Authentication > Providers > Google 활성화 (Client ID/Secret 설정)
3. Supabase > SQL Editor에서 `001_initial_schema.sql` 실행
4. Supabase > SQL Editor에서 `002_seed_data.sql` 실행
5. `.env.local`에 환경변수 설정
6. `next.config.ts`에 이미지 도메인 추가 (Phase 7)
7. Vercel 배포 + 환경변수 등록

## 검증 시나리오

1. Google 로그인 → profiles 테이블에 pending 행 생성
2. ADMIN_EMAIL(joo@askcuri.com) 로그인 → 자동 approved + admin
3. pending 사용자 → 대기 화면만 표시
4. 승인된 사용자 → Wiki/Issue 정상 접근
5. 문서 CRUD 동작 확인
6. 이슈 생성 + 첨부파일 업로드 → Supabase Storage 저장
7. 이슈 상세에서 첨부파일 Signed URL로 표시
8. 이슈 상태 전환 (이슈 등록 → 해결 중 → 이슈 해결)
9. 검색 (Cmd+K, /search) 동작
