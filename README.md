# CURI Wiki

CURI 팀의 제품 지식과 이슈를 한 곳에서 관리하기 위한 사내 Wiki.

> Knowledge stays shared. Issues stay visible.

## Quick Start

```bash
npm install
npm run dev
```

`http://localhost:3000`에서 확인할 수 있습니다.

## Documentation

상세 문서는 [`docs/`](./docs) 폴더를 참고하세요.

| 문서 | 설명 |
| --- | --- |
| [Architecture](./docs/architecture.md) | 정보 구조, 라우팅, 프로젝트 구조 |
| [Issue Tracking](./docs/issue-tracking.md) | Issue 워크플로우, 상태, 첨부파일 정책 |
| [Tech Stack](./docs/tech-stack.md) | 기술 스택 및 환경 설정 |
| [Contributing](./docs/contributing.md) | 개발 가이드, 테스트, 컨벤션 |
| [Telegram Setup](./docs/telegram-setup.md) | Telegram Bot 알림 설정 및 테스트 방법 |

## Features

### HOME — Knowledge

제품 및 사내 지식을 Category별로 관리합니다.

```
HOME
├─ CURI AI
└─ WAME
```

### ISSUE — Issue Tracking

프로젝트별 개발 이슈를 관리합니다.

```
ISSUE
├─ Admin
├─ Healthcare
└─ Dashboard
```

`이슈 등록 → 해결 중 → 이슈 해결` 워크플로우를 사용합니다.

## License

Private — CURI 내부 사용 전용
