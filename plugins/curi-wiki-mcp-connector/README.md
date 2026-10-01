# CURI Wiki MCP Connector

Claude에서 CURI Wiki를 검색하고 문서를 작성·수정하는 플러그인입니다. 마켓플레이스 이름은 `curi-plugins`, 플러그인 이름은 `curi-wiki-mcp-connector`입니다.

## claude.ai에 등록

이 파일들이 GitHub 저장소에 푸시된 후 등록하세요.

1. **설정 → 플러그인 → 마켓플레이스 추가 → 저장소에서 추가**를 엽니다.
2. 저장소 URL `https://github.com/CURI-Joo/CURI-WIKI`를 입력합니다.
3. `curi-plugins`에서 **curi-wiki-mcp-connector**를 설치하고 활성화합니다.
4. CURI Wiki 연결에 인증이 필요하면 브라우저에서 위키 로그인과 OAuth 접근 허용을 완료합니다. 작성에는 승인된 위키 계정이 필요합니다.

## Claude Code에 등록

Claude Code 대화창에서 실행합니다.

```text
/plugin marketplace add https://github.com/CURI-Joo/CURI-WIKI.git
/plugin install curi-wiki-mcp-connector@curi-plugins
```

`/mcp`에서 `curi-wiki` 연결 상태를 확인하고, 인증 안내에 따라 브라우저 OAuth를 완료합니다. 이 플러그인을 통해 문서를 작성하면 연결한 위키 계정이 작성자로 기록됩니다.

## 서버와 사용 흐름

- MCP 서버: `https://curi-wiki-six.vercel.app/api/mcp` (`http`, POST).
- 인증: OAuth 2.1 Authorization Code + PKCE(S256), `wiki.read` / `wiki.write` scope.
- 고정 비밀키나 토큰 입력은 필요하지 않습니다. 호스트가 OAuth 인증 정보를 관리합니다.
- 권장 순서: `whoami` → `list_categories` → `search_documents` → 필요 시 `get_document` / `fetch_source` → `create_document` / `update_document` → 결과 확인.
- 이미지가 있는 새 글: 이미지 없이 Draft 생성 → `upload_image` → 반환된 `markdown_url`로 본문 갱신. 생성 시 `status`를 생략하면 서버가 Published로 저장하므로 초안은 `Draft`를 명시합니다.

도구별 인자와 수정·이미지 업로드 방법은 [스킬 사용 가이드](skills/curi-wiki-mcp/SKILL.md)에 있습니다. `.mcp.json`은 플러그인 루트에서 자동으로 읽힙니다. 엔드포인트를 브라우저에서 직접 열 때의 `405`는 GET을 제공하지 않아 생기는 정상 응답입니다.

## 로컬 검증

저장소 루트에서 실행합니다.

```sh
claude plugin validate .
claude plugin validate ./plugins/curi-wiki-mcp-connector
```

매니페스트 검증은 실제 claude.ai 설치·OAuth 로그인·문서 저장 검증과 별개입니다. 원격 도구 사용은 설치 후 OAuth 연결을 완료해야 가능합니다.
