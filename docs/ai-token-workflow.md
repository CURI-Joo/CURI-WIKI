# AI Session → Wiki API Token Workflow

개발자가 로컬 AI 세션에서 "오늘 작업 위키로 기록해줘"를 실행할 때 사용할 내부 토큰 방식입니다.

## 1) 토큰 발급

로그인된 상태에서 아래 API를 호출해 개인 토큰을 발급합니다.

```bash
curl -X POST "https://curi-wiki-six.vercel.app/api/auth/personal-token" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SUPABASE_USER_JWT>" \
  -d '{"name":"Codex Local Session","expiresInDays":30}'
```

응답의 `token`은 **한 번만 노출**됩니다. 안전하게 보관하세요.

## 2) AI 세션에서 Draft 생성

```bash
curl -X POST "https://curi-wiki-six.vercel.app/api/wiki/ai-draft" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <cw_pat_...>" \
  -d '{
    "workSummary":"오늘 작업 요약",
    "keyChanges":["변경 1","변경 2"],
    "tests":["테스트 1"],
    "impact":["영향 1"],
    "rollbackPlan":"롤백 절차",
    "followUps":["후속 1"],
    "references":["PR 링크"]
  }'
```

## 3) 토큰 폐기

```bash
curl -X DELETE "https://curi-wiki-six.vercel.app/api/auth/personal-token" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SUPABASE_USER_JWT>" \
  -d '{"tokenId":"pat-..."}'
```

## 보안 원칙

- 토큰은 개인 단위로 발급/관리합니다.
- 기본 저장 상태는 `Draft`입니다.
- 민감정보는 본문에서 제거합니다.
- 모든 자동 작성은 `ai_write_logs`에 감사 로그로 남깁니다.
