---
name: wiki-from-link
description: Create a wiki-ready document when the user provides one or more links and asks to summarize, document, or register content in CURI Wiki. Also use when the user says "링크만 줄게 위키 글 써줘", "이 링크로 위키 문서 만들어줘", or "부스 운영 내용 위키화해줘".
argument-hint: <url> [category] [title]
---

# Wiki From Link

When invoked, follow this workflow.

## 0) Hard constraints

- Do not attempt to read local filesystem paths such as `/mnt/*`, `/skills/*`, or plugin installation directories.
- Use only the URL provided in `$ARGUMENTS` (or the current conversation text) as the source.
- If no URL is provided, ask the user for one short URL first and stop.

## 1) Input normalization

- Extract the primary source URL from `$ARGUMENTS`.
- If `$ARGUMENTS` has no URL, check the most recent user message for a URL.
- If category is omitted, default to `company`.
- If title is omitted, infer a concise Korean title from the source.

## 1.5) Style alignment with existing wiki docs

- If the source is a CURI Wiki URL, first inspect nearby existing docs in the same category (at least 2 if accessible).
- Mirror the existing writing style:
  - heading depth and section naming pattern
  - sentence tone (존댓말/평서문), level of detail, bullet/list density
  - common labels (예: "개요", "체크리스트", "운영 가이드")
- Keep factual content from the new source, but match formatting and voice to existing docs.
- If existing docs are not readable, state that briefly and use the default template.

## 2) Content drafting requirements

Write in Korean, practical tone, with clear sections.

Use this structure exactly:

1. 개요
2. 배경 및 목적
3. 핵심 내용 요약
4. 실행/운영 가이드
5. 체크리스트
6. 리스크 및 대응
7. 참고 링크

## 3) Output format

Always produce:

- `제목:` (one line)
- `카테고리:` (one line)
- `슬러그 제안:` (one line, kebab-case)
- `본문 (Markdown):` (full markdown body)

## 4) CURI Wiki registration mode

If user asks to register immediately, output an additional JSON payload block compatible with common wiki APIs:

```json
{
  "title": "...",
  "slug": "...",
  "content_markdown": "...",
  "tags": ["행사", "부스", "운영"]
}
```

For CURI Wiki native API, use this flow:

1. Check login/auth first with `GET /api/wiki/me`.
2. If 401, ask user to login at `/login` and retry.
3. If authenticated and approved, call `POST /api/wiki/documents` with:

```json
{
  "title": "...",
  "category_slug": "company",
  "content_markdown": "...",
  "summary": "...",
  "status": "Published",
  "tags": ["행사", "부스", "운영"]
}
```

4. Return created document URL from API response `url`.

If API details are missing, ask for:

- endpoint URL
- auth header format
- required body fields

Then provide a ready-to-run curl command.

## 5) Quality bar

- Avoid vague summaries; include concrete operational details.
- Keep checklist action-oriented.
- Preserve factual claims from source; clearly label assumptions.
- Prioritize consistency with existing CURI Wiki documents over generic blog style.
