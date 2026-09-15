# wiki-link-writer

Claude upload plugin for fast wiki drafting from a link.

## What it adds

- Slash command: `/wiki-from-link`
- Purpose: turn a shared URL into a structured, wiki-ready markdown document

## Example usage

```text
/wiki-from-link https://curi-wiki-six.vercel.app/category/company company 행사-부스-운영-가이드
```

or

```text
/wiki-from-link https://some-link
```

Then ask:

```text
이걸 CURI Wiki에 바로 등록 가능한 JSON payload도 같이 줘.
```

## CURI Wiki API (account-based)

When CURI Wiki API is available, use:

- `GET /api/wiki/me` for login/approval check
- `POST /api/wiki/documents` for creation

Document writes are saved as the authenticated user account
(session cookie or bearer token owner).
