# Published 문서 공개 조회 수정

애플리케이션은 SQL 적용 전에도 필터를 적용한 공개 API로 Published 문서를 표시합니다. Supabase 직접 조회에도 공개 권한을 적용하려면 아래 SQL을 실행해야 합니다.

## 변경 파일

| 파일 | 이유 |
| --- | --- |
| `supabase/migrations/20260928000000_public_document_read.sql` | 공개 SELECT 정책과 작성자 ID·이름 조회 함수 추가. 기존 승인 사용자 정책 유지 |
| `src/app/api/wiki/public-documents/route.ts` | Published·비밀 카테고리 제외 조건, 작성자 ID·이름만 결합, 응답 캐시 금지 추가 |
| `src/lib/document-store.ts` | RLS 조회 우선. 승인되지 않은 공개 독자만 빈 결과·오류 시 필터된 공개 API로 대비 조회. 인증 변경 시 재조회와 이전 요청 무효화 |
| `src/lib/profiles-store.ts` | 공개 API에 포함된 이름 또는 제한된 SQL 함수로 작성자 조회. 승인 사용자는 기존 profiles RLS 사용 |
| `src/app/(dashboard)/documents/[slug]/page.tsx` | 공개 문서 작성자 이름 표시 |
| `src/app/(dashboard)/search/page.tsx` | 현재 조회할 수 없는 문서의 이전 검색 결과 숨김 |
| `src/components/layout/command-palette.tsx` | 로그아웃 후 이전 검색 결과와 키보드 선택 숨김 |
| `src/lib/mcp/wiki/tools.ts` | 생성·수정·조회 URL을 `/documents/{slug}`로 통일 |
| `src/__tests__/mcp/run-suite.ts`, `src/__tests__/mcp/mcp.test.ts` | MCP 생성·수정·조회 URL 회귀 검증 |
| `src/__tests__/api/public-documents.test.ts` | API가 Draft·Archived·cat-secret을 반환하지 않는지 검증 |
| `src/__tests__/lib/document-store.test.tsx` | 빈 결과·오류·재조회·인증 변경·늦게 도착한 응답 검증 |
| `src/__tests__/lib/profiles-store.test.tsx` | 공개 작성자 조회와 승인 사용자 조회 분리 검증 |
| `src/__tests__/lib/document-search.test.tsx` | 접근 권한 변경 후 이전 검색 결과 제거 검증 |
| `docs/public-document-access.md` | 적용 SQL과 확인 절차 |

상세 화면은 tags/document_tags를 조회하지 않고 카테고리는 정적 데이터를 사용하므로 해당 테이블의 RLS는 변경하지 않습니다. profiles 전체 행을 공개하면 이메일까지 노출되므로, 공개 문서의 작성자 ID·이름만 반환하는 함수를 사용합니다. 기존 파일의 migration은 수정하지 않습니다.

SQL 적용이 별도로 필요하므로 배포 호환성을 위해 공개 API 대비 조회를 유지합니다. 빈 배열도 처리하며, 승인 사용자의 조회에는 이 경로를 사용하지 않아 Draft 조회 범위를 줄이지 않습니다. SQL 적용 후 공개 행이 정상 조회되면 대비 API는 호출하지 않습니다.

## Supabase 적용

Supabase Dashboard에서 CURI-WIKI 프로젝트(`jpjyzbwibstkvhopidiv`) → SQL Editor → New query를 열고 아래 SQL을 한 번 실행합니다. 내용은 새 migration 파일과 같습니다. 기존 migration 전체를 다시 실행할 필요는 없습니다.

```sql
begin;

create policy "Anyone can read published non-secret documents"
  on public.documents for select
  to anon, authenticated
  using (status = 'Published' and category_id <> 'cat-secret');

create or replace function public.get_public_document_author(document_id text)
returns table (id uuid, name text)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.name
  from public.documents d
  join public.profiles p on p.id = d.owner_id
  where d.id = document_id
    and d.status = 'Published'
    and d.category_id <> 'cat-secret';
$$;

revoke all on function public.get_public_document_author(text) from public;
grant execute on function public.get_public_document_author(text) to anon, authenticated;

commit;
```

이미 성공적으로 실행했다면 다시 실행하지 않습니다. 아래 조회로 기존 정책과 새 정책이 함께 있는지 확인할 수 있습니다.

```sql
select policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'documents' and cmd = 'SELECT';
```

기존 `Approved users can read documents` 정책은 삭제하거나 변경하지 않습니다. 두 정책은 OR로 결합됩니다.

## 브라우저 확인 순서

1. 승인 계정으로 일반 카테고리의 Published 문서와 Draft 문서 URL을 준비합니다. 관리자 계정으로 cat-secret의 Published·Draft 문서 URL도 준비합니다.
2. 새 시크릿 창에서 로그인하지 않고 `https://curi-wiki-six.vercel.app/documents/{published-slug}`에 접속합니다. 제목·본문·작성자 이름이 보이는지 확인합니다.
3. 같은 창에서 Draft와 cat-secret 문서 URL에 각각 접속합니다. 모두 `글을 찾을 수 없습니다`가 나와야 합니다. Archived도 공개되지 않습니다.
4. `/api/wiki/public-documents`에 직접 접속합니다. 응답의 모든 문서가 `status: Published`이고 `category_id`가 `cat-secret`이 아닌지 확인합니다. 공개 목록·검색에도 비공개 제목이나 본문이 없어야 합니다.
5. 일반 승인 계정으로 로그인해 기존 Draft가 보이는지 확인합니다. 관리자로 로그인해 기존 cat-secret 문서도 보이는지 확인합니다. cat-secret은 기존 정책에 따라 승인 관리자만 조회할 수 있습니다.
6. 관리자 상태에서 비밀 문서를 열거나 검색한 뒤 로그아웃합니다. 이전 문서 본문과 검색 결과가 남지 않는지 확인합니다.
7. MCP 문서 생성·수정·조회 응답의 URL이 `/documents/{slug}`인지 확인합니다. 카테고리를 바꿔도 같은 상세 URL을 사용합니다.

첨부파일 API와 Storage는 기존 인증 정책을 유지합니다. 로그인 전에는 기존 보호된 첨부파일·내부 이미지 다운로드가 차단될 수 있습니다.

## 자동 검증

```sh
npm test
npm run build
```

포트 생성이 제한된 로컬 실행 환경에서는 `npm run build -- --webpack`으로도 빌드할 수 있습니다. 기본 배포 빌드 설정은 변경하지 않습니다.
