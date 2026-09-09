# AI Writer Workflow (개발자용)

> 작업이 끝난 뒤 AI와 함께 1~2분 안에 위키 초안을 만드는 표준 흐름

## 목적

개발자가 직접 긴 문서를 처음부터 쓰지 않아도,
작업 내용을 짧게 정리해 넣으면 CURI Wiki에 표준 템플릿 Draft 문서를 자동 생성합니다.

- 작성자 계정: 로그인한 본인 계정
- 저장 상태: 기본 `Draft`
- 위치: `HOME > AI Writer` (`/ai-writer`)

## 언제 쓰면 좋은가

- 오늘 기능 개선 작업을 여러 건 진행했을 때
- PR/커밋/테스트 내역이 이미 있고 문서화만 남았을 때
- 팀 공유용 작업 로그를 빠르게 남겨야 할 때

## 사용 방법

1. CURI Wiki에 구글 계정으로 로그인합니다.
2. 좌측 메뉴 `HOME > AI Writer`로 이동합니다.
3. 아래 항목을 채웁니다.
   - 작업 요약(필수)
   - 주요 변경 사항
   - 테스트 내역
   - 영향 범위
   - 롤백 계획
   - 후속 작업
   - 참고 링크(PR/커밋/이슈)
4. `Draft 생성` 버튼을 누릅니다.
5. 생성된 문서를 열어 팀 컨텍스트에 맞게 1차 수정 후 발행합니다.

## AI 세션에서 사용하는 추천 프롬프트

아래처럼 요청하면, AI가 브라우저 자동화로 작성 도구를 채우고 Draft 생성까지 진행할 수 있습니다.

```text
이 링크로 접속해서 내 계정으로 위키 작업 로그 Draft를 작성해줘: https://<your-domain>/ai-writer
오늘 작업 내용은 아래와 같아:
- 작업 요약: ...
- 주요 변경: ...
- 테스트: ...
- 영향 범위: ...
- 롤백: ...
- 후속 작업: ...
- 참고 링크: ...
Draft 생성 후 문서 수정 링크까지 알려줘.
```

## API 직접 연동이 필요한 경우

엔드포인트: `POST /api/wiki/ai-draft`

요청 예시:

```json
{
  "title": "[Dev Log] 2026-09-09 작업 정리",
  "workSummary": "문서 자동화 기능을 추가하고 가이드를 작성함",
  "keyChanges": [
    "/api/wiki/ai-draft 라우트 추가",
    "/ai-writer 페이지 추가"
  ],
  "tests": [
    "next build --webpack"
  ],
  "impact": [
    "문서 작성 플로우"
  ],
  "rollbackPlan": "문제 시 기능 커밋 revert",
  "followUps": [
    "텔레그램 기반 확장"
  ],
  "references": [
    "https://github.com/org/repo/pull/123"
  ]
}
```

응답 예시:

```json
{
  "ok": true,
  "document": {
    "id": "doc-...",
    "slug": "dev-log-2026-09-09",
    "title": "[Dev Log] 2026. 09. 09. 작업 정리",
    "status": "Draft",
    "category_id": "cat-curi-ai"
  },
  "edit_url": "/documents/dev-log-2026-09-09/edit",
  "view_url": "/documents/dev-log-2026-09-09"
}
```

## 운영 원칙

- 기본은 `Draft` 생성 후 사람이 검토합니다.
- 민감정보(토큰/개인정보/고객정보)는 본문에 포함하지 않습니다.
- 참고 링크(PR/커밋/이슈)를 반드시 남겨 출처를 추적합니다.
- 생성 문서는 배포/장애 대응 문서와 동일하게 최신 상태를 유지합니다.
