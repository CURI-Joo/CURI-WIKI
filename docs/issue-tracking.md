# Issue Tracking

CURI Wiki의 Issue Tracking 시스템을 설명합니다.

---

## Overview

프로젝트별 개발 이슈를 등록하고 해결 상태를 추적합니다.

```
ISSUE
├── Admin         서비스 관련 이슈
├── Healthcare    서비스 관련 이슈
└── Dashboard     관련 이슈
```

---

## Status Workflow

```
이슈 등록 → 해결 중 → 이슈 해결
```

### 전환 규칙

- `이슈 등록` → `해결 중` (허용)
- `해결 중` → `이슈 해결` (허용)
- 역방향 전환 불가 (예: `해결 중` → `이슈 등록`)
- 상태 건너뛰기 불가 (예: `이슈 등록` → `이슈 해결`)

### 권한

- 모든 active 사용자가 상태 변경 가능
- role (ADMIN, CEO, MEMBER) 구분 없이 동일한 권한

### 구현

상태 전환은 `src/lib/issue-store.ts`의 `VALID_TRANSITIONS` 맵으로 관리됩니다.

```typescript
const VALID_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  '이슈 등록': ['해결 중'],
  '해결 중': ['이슈 해결'],
  '이슈 해결': [],
};
```

---

## Priority

| 중요도 | Badge 색상 | 설명 |
| --- | --- | --- |
| 즉시 수정 필요 | error (빨간색) | 긴급 수정이 필요한 이슈 |
| 차차 수정 필요 | warning (노란색) | 일반적인 수정 필요 이슈 |
| 개선 사항 | default (회색) | 기능 개선 제안 |

---

## Issue Data Model

```typescript
interface Issue {
  id: string;            // ISSUE-001 형태
  title: string;         // 이슈 제목
  description: string;   // 이슈 상세 내용
  project: IssueProject; // 'Admin' | 'Healthcare' | 'Dashboard'
  status: IssueStatus;   // '이슈 등록' | '해결 중' | '이슈 해결'
  priority: IssuePriority;
  reporter_id: string;
  assignee_id: string | null;
  attachments: string[];
  created_at: string;
  updated_at: string;
}
```

---

## Attachments

### 제한

- 최대 **4개** 파일
- 이미지: 최대 **10MB** (`image/*`)
- 영상: 최대 **50MB** (`video/*`)
- 전체 합계: 최대 **100MB**

### 업로드 방식

- 클릭하여 파일 선택
- 드래그 앤 드롭
- 클립보드 붙여넣기 (Cmd+V)

### DEMO_MODE 제한

- 첨부파일은 `URL.createObjectURL()`로 처리됩니다
- `blob:` URL이므로 새로고침 시 유지되지 않습니다
- localStorage에 base64를 저장하지 않습니다

---

## Activity Log

이슈의 생성 및 상태 변경 이력이 자동으로 기록됩니다.

### Event Types

| Type | 설명 |
| --- | --- |
| `created` | 이슈 등록 |
| `status_changed` | 상태 변경 (from → to 기록) |

Activity는 Issue 상세 페이지 하단에 타임라인으로 표시됩니다.

---

## Issue Events (Telegram 연동 준비)

향후 Telegram Bot 연동을 위한 이벤트 시스템이 준비되어 있습니다.

### Event Types

- `issue_created` — 이슈 생성 시
- `issue_assigned` — 담당자 지정 시
- `issue_status_changed` — 상태 변경 시 (해결 중)
- `issue_resolved` — 이슈 해결 시

### 구현 위치

- `src/lib/issue-events.ts` — 이벤트 타입, 리스너, 디스패처
- `src/lib/issue-store.ts` — 이슈 생성/전환 시 이벤트 발행

### 향후 확장 구조

```
Issue 생성 / 상태 변경
        ↓
Issue Event (dispatchIssueEvent)
        ↓
POST /api/notifications (향후)
        ↓
Telegram Bot
        ↓
CURI Telegram 채팅방
```

현재 DEMO_MODE에서는 등록된 listener에만 전달되며, 실제 Telegram 호출은 하지 않습니다.

---

## Seed Data

4개의 샘플 Issue가 포함되어 있습니다.

| ID | Project | 제목 | 상태 | 중요도 |
| --- | --- | --- | --- | --- |
| ISSUE-001 | Admin | AI Survey 설정 Modal에서 저장 버튼 접근 불가 | 해결 중 | 즉시 수정 필요 |
| ISSUE-002 | Admin | YouTube 링크 연결 기능이 정상적으로 동작하지 않음 | 이슈 등록 | 차차 수정 필요 |
| ISSUE-003 | Dashboard | 특정 Mobile 화면에서 Layout 깨짐 | 이슈 해결 | 차차 수정 필요 |
| ISSUE-004 | Healthcare | 설문 완료 이후 잘못된 후속 메시지가 표시됨 | 이슈 등록 | 개선 사항 |
