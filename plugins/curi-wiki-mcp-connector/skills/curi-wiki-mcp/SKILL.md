---
name: curi-wiki-mcp
description: "When the user asks to write or update CURI Wiki content, use the configured MCP server. If authentication is required, complete OAuth in browser and continue."
---

# CURI Wiki MCP

설정된 `curi-wiki` MCP 서버를 사용해 사용자가 요청한 문서를 검색·작성·수정한다. 아래 이름은 서버가 노출하는 실제 도구 이름이다. 호스트가 접두어를 붙이면 연결된 `curi-wiki` 서버의 해당 도구를 사용한다.

## 연결과 인증

- 서버: `https://curi-wiki-six.vercel.app/api/mcp` — HTTP 전송의 POST 요청을 사용하는 상태 비저장 MCP 서버다. SSE 주소를 별도로 만들지 않는다. 주소를 브라우저에서 GET으로 열었을 때의 `405`는 정상이다.
- 인증: OAuth 2.1 Authorization Code + PKCE(S256). 공개 OAuth 클라이언트는 고정 client secret 없이 연결하며, 읽기·쓰기에 필요한 scope는 `wiki.read`, `wiki.write`다.
- 인증이 필요하면 호스트의 연결/인증 기능으로 브라우저 OAuth를 시작한다. 사용자가 위키 로그인과 접근 허용을 완료하면 `whoami`부터 다시 확인하고 원래 작업을 계속한다. 토큰을 대화에 붙여 넣게 하거나 `.mcp.json`에 저장하지 않는다.
- 서버의 401 응답은 `WWW-Authenticate`로 `/.well-known/oauth-protected-resource`를 안내한다. `/.well-known/oauth-authorization-server`에는 `/oauth/authorize`, `/api/oauth/token`, `/api/oauth/register`, `/api/oauth/revoke`가 등록되어 있다. 이 검색·토큰 교환은 MCP 클라이언트에 맡긴다.

## 권장 작성 순서

1. **`whoami`**로 연결된 계정의 `email`, `display_name`, `approved`, `scopes`를 확인한다. 문서는 이 계정 명의로 저장된다. `approved`가 false이면 쓰기를 진행하지 말고 관리자 승인이 필요함을 알린다. 계정이 의도한 계정과 다르면 재연결하고 다시 확인한다.
2. **`list_categories`**로 현재 카테고리의 `slug`와 `name`을 읽고 적합한 `category_slug`를 고른다. 표시 이름이나 카테고리 ID를 slug 대신 넘기지 않는다.
3. **`search_documents`**로 제목의 핵심 단어를 검색해 중복을 확인한다. 필요하면 `category_slug`로 범위를 좁힌다. 이 구현은 **제목 부분 일치 검색**이므로 본문이나 원문 URL 전체를 검색한다고 가정하지 않는다.
4. 기존 문서를 수정한다면 **`get_document`**로 전체 본문과 현재 메타정보를 먼저 읽는다. 참고 URL이 있으면 **`fetch_source`**로 읽고 출처를 반영한다. 가져오지 못한 자료의 내용을 추측해 쓰지 않는다.
5. 새 문서는 **`create_document`**, 기존 문서는 **`update_document`**를 사용한다. 요청된 상태를 `Draft` 또는 `Published`로 명시한다. 새 문서의 발행 여부가 정해지지 않았다면 `Draft`로 저장한다. 기존 문서의 상태 변경을 요청받지 않았다면 `status`를 생략해 유지한다.
6. 이미지가 있으면 아래 업로드 순서를 따른다. 저장 후 **`get_document`**로 결과를 확인하고 반환된 문서 `url`과 초안/게시 상태를 사용자에게 전달한다.

## 실제 도구 8개

| 도구 | 언제 사용하는가 | 인자와 결과 |
| --- | --- | --- |
| `whoami` | 작성 전 연결 계정·승인·권한 확인 | 인자 `{}`. `user_id`, `email`, `display_name`, `approved`, `scopes`를 반환한다. 별도 scope 요구는 없지만 OAuth 인증은 필요하다. |
| `list_categories` | 유효한 카테고리 선택 | 인자 `{}`, `wiki.read` 필요. `categories` 배열의 `slug`, `name`을 사용한다. |
| `search_documents` | 중복 확인, 수정할 문서 찾기 | 선택 인자 `query`, `category_slug`, `limit`. `limit` 기본 5, 최대 20. `wiki.read` 필요. `results`에서 대상 문서를 찾는다. |
| `get_document` | 기존 문서 읽기, 저장 결과 확인 | 필수 `id_or_slug`: 문서 UUID 또는 정확한 slug. `wiki.read` 필요. `document`와 `url`을 반환한다. |
| `fetch_source` | 사용자가 제공한 공개 웹 자료 읽기 | 필수 `url`, 선택 `max_chars`(기본 12000). `url`, `title`, `description`, `text`, `links`, `truncated` 등을 반환한다. 별도 scope 요구는 없지만 OAuth 인증은 필요하다. 로그인 세션을 전달하는 브라우저 도구가 아니며 내부 네트워크 URL은 차단된다. |
| `create_document` | 새 문서 생성 | 필수 `title`, `content_markdown`. 선택 `category_slug`, `summary`, `slug`, `tags`, `status`, `source_url`, `drive_url`, `dry_run`. `wiki.write` 필요. 실제 생성에는 승인된 계정이 필요하며 성공 시 `status: "created"`, `document`, `url`을 반환한다. |
| `update_document` | 기존 문서의 내용·메타정보 수정 | 필수 `id_or_slug`와 변경 필드 최소 1개. 변경 가능 필드: `title`, `content_markdown`, `summary`, `category_slug`, `tags`, `status`, `drive_url`. `wiki.write`와 계정 승인 필요. 성공 시 `status: "updated"`, `document`, `url`을 반환한다. `dry_run`, `slug`, `source_url` 변경 인자는 지원하지 않는다. |
| `upload_image` | 원본 이미지 파일을 위키에 저장 | 필수 `document_id_or_slug`, `file_name`. `data_base64` 또는 `file_url` 중 정확히 하나를 추가한다. `wiki.write`와 계정 승인 필요. `status: "uploaded"`, 첨부 `id`, `markdown_url`, `file_name`, `file_size`를 반환한다. Secret 문서 첨부는 관리자만 가능하다. |

## 작성·수정 시 주의할 서버 동작

- `create_document`에서 `status`를 생략하면 서버 기본값은 **`Published`**다. 의도하지 않은 발행을 피하도록 상태를 명시한다. `category_slug`도 서버 기본 카테고리에 의존하지 말고 조회한 값으로 전달한다.
- `create_document`의 `slug` 생략 시 제목에서 생성된다. 동일 slug가 있으면 생성이 거부된다. 오류 후 임의로 중복 문서를 만들지 말고 기존 문서를 조회해 수정 대상인지 판단한다.
- `dry_run: true`는 `create_document`만 지원하며, 저장 없이 `payload`를 반환한다. 이 미리보기는 계정 승인·이미지 검증·중복 검사까지 수행한 실제 저장 성공을 의미하지 않는다.
- `update_document`는 전달한 필드만 바꾸지만, **`content_markdown`은 본문 전체를 교체**한다. 먼저 읽은 본문에 요청된 변경을 반영해 전체 Markdown을 보내고, 관련 없는 본문·이미지·서식은 보존한다. `tags`도 전달하면 배열 전체가 교체된다.
- `drive_url`에는 `https://drive.google.com/…` 또는 `https://docs.google.com/…` 공유 링크를 넣는다. 수정 시 생략하면 기존 바로가기가 유지되고, `null`이면 제거된다. 본문만 수정할 때 링크 필드를 비워 보내지 않는다.
- 도구 응답의 `isError`와 메시지를 확인한다. scope 부족이면 필요한 권한으로 OAuth를 재연결한다. 네트워크 오류로 쓰기 결과가 불명확하면 `get_document`/`search_documents`로 저장 여부를 확인한 뒤 재시도한다.

## 이미지가 있는 문서

1. 새 문서는 이미지 없이 `create_document(status: "Draft")`로 먼저 만들고 반환된 `document.id`를 보관한다. 기존 문서는 `get_document`로 읽은 ID 또는 slug를 사용한다.
2. 각 원본 파일을 `upload_image`로 올린다. `data_base64`에는 실제 파일 전체를 base64로 인코딩한 값만 전달하며 `data:` 접두어를 제외한다. 바이트를 만들어 내거나 도구 출력의 생략된 문자열을 재사용하지 않는다.
3. 직접 다운로드 가능한 **이미지 파일 URL**이 있다면 `file_url`을 대신 쓸 수 있다. 서버가 원본을 내려받아 위키 저장소에 복사하므로 단순 외부 이미지 링크 삽입과 다르다. 로그인 페이지·공유 페이지 URL은 원본 파일 URL이 아니다.
4. 지원 형식은 PNG, JPEG, WebP, GIF이며 최대 10MB, 최대 4천만 픽셀이다. 원본을 읽을 수 없다면 사용 가능한 원본 파일을 요청한다.
5. 반환된 `markdown_url`을 그대로 `![설명](반환된 markdown_url)`에 넣고, `update_document`로 전체 본문을 갱신한다. 새 외부 이미지 URL, `data:`, `blob:`, `file:`, 임시 주소를 본문에 직접 넣지 않는다. 발행을 요청받았다면 완성된 본문과 함께 `status: "Published"`를 전달한다.

## 구현 근거

저장소 기준으로 도구 정의는 `src/lib/mcp/wiki/tools.ts`, 실제 문서 저장·제목 검색은 `src/lib/mcp/supabase-store.ts`, 이미지 검증은 `src/lib/mcp/wiki/images.ts`에 있다. 전송 경로는 `src/app/api/mcp/route.ts`와 `src/lib/mcp/server.ts`, OAuth 동작은 `src/lib/mcp/oauth/metadata.ts`, `flow.ts`, `types.ts`에서 확인할 수 있다. 설치 후에는 위 안내와 연결된 서버의 도구 스키마를 사용한다.
