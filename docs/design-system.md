# CURI Wiki Design System Notes

문서 작성/수정 화면에서 사용하는 최신 UI 규칙입니다.

## Document Editor (2026-09 업데이트)

- 편집 탭은 `간편 편집`, `Markdown` 2개만 유지합니다.
- `미리보기` 탭은 제거되었고, `간편 편집`이 읽기 중심 화면 역할을 겸합니다.
- 영상 임베드 버튼/렌더링은 제거합니다.

## Highlight Palette

- 형광펜은 `src/lib/highlight-colors.ts`의 10색을 5열 × 2행으로 표시합니다.
- 색상 원과 선택 표시만 노출하고, 색 이름은 접근성용 `aria-label`에 제공합니다.
- CURI 핑크·빨강·주황·민트·회색은 현재 `globals.css`의 브랜드/상태/중립 색상을 흰색 위에 옅게 적용한 톤입니다.
- 기존 5색의 값과 저장 형식을 유지하며, 새 색도 읽기·간편 편집·Markdown 모드에서 동일하게 표시합니다.

## Category Row

- 카테고리 라벨은 영어 `Category`를 사용합니다.
- 카테고리 선택은 브라우저 기본 `<select>` 대신 `src/components/ui/select.tsx`를 사용합니다.
- 라벨과 선택 토글은 한 줄 정렬을 유지합니다.
- 라벨은 별도 작은 박스 형태로 표시합니다.

## Category Actions (Admin)

- 카테고리 추가/삭제 버튼은 정사각형(`h-10 w-10`)을 유지합니다.
- 버튼 테두리는 사용하지 않습니다.
- 배경은 `bg-surface-elevated`, hover는 `bg-surface`를 사용합니다.

## Border/Shape Preference

- 문서 작성 화면에서는 불필요한 외곽선 사용을 줄입니다.
- 입력 컨트롤은 라운드 스타일을 유지하되, 액션 버튼은 과한 둥근 모서리를 피합니다.

## Category Source of Truth

- 좌측 사이드바 기준 카테고리 체계(`Company`, `Projects`, `Guides`, `Secret`)와
  문서 작성 화면의 카테고리 목록은 동일해야 합니다.
- 레거시 카테고리(`cat-curi-ai`, `cat-wame`)는 정규화 매핑으로 처리합니다.
