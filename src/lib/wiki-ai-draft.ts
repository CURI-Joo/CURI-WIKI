export interface WikiDraftInput {
  title?: string;
  workSummary: string;
  keyChanges: string[];
  tests: string[];
  impact: string[];
  rollbackPlan?: string;
  followUps: string[];
  references: string[];
  categoryId?: string;
}

const DEFAULT_CATEGORY_ID = 'cat-curi-ai';

function cleanLine(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeLines(values: string[] | undefined, limit = 10) {
  if (!values || values.length === 0) return [];

  return values
    .map(cleanLine)
    .filter(Boolean)
    .slice(0, limit);
}

function toBulletLines(values: string[], emptyMessage: string) {
  if (values.length === 0) return `- ${emptyMessage}`;
  return values.map((value) => `- ${value}`).join('\n');
}

function todayKst() {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function createDefaultTitle() {
  return `[Dev Log] ${todayKst()} 작업 정리`;
}

export function buildWikiDraftMarkdown(input: WikiDraftInput) {
  const summary = cleanLine(input.workSummary);
  const keyChanges = normalizeLines(input.keyChanges, 20);
  const tests = normalizeLines(input.tests, 20);
  const impact = normalizeLines(input.impact, 20);
  const followUps = normalizeLines(input.followUps, 20);
  const references = normalizeLines(input.references, 20);
  const rollbackPlan = cleanLine(input.rollbackPlan ?? '');

  return [
    '# 작업 요약',
    '',
    summary || '요약 내용이 제공되지 않았습니다.',
    '',
    '# 변경 사항',
    '',
    toBulletLines(keyChanges, '주요 변경 사항을 추가하세요.'),
    '',
    '# 테스트',
    '',
    toBulletLines(tests, '실행한 테스트를 추가하세요.'),
    '',
    '# 영향 범위',
    '',
    toBulletLines(impact, '영향 받은 화면/기능/API를 추가하세요.'),
    '',
    '# 롤백 계획',
    '',
    rollbackPlan || '- 롤백 절차를 추가하세요.',
    '',
    '# 후속 작업',
    '',
    toBulletLines(followUps, '남은 TODO를 추가하세요.'),
    '',
    '# 참고 링크',
    '',
    toBulletLines(references, '관련 PR/이슈/커밋 링크를 추가하세요.'),
  ].join('\n');
}

export function normalizeWikiDraftInput(payload: Partial<WikiDraftInput>) {
  return {
    title: cleanLine(payload.title ?? ''),
    workSummary: cleanLine(payload.workSummary ?? ''),
    keyChanges: normalizeLines(payload.keyChanges),
    tests: normalizeLines(payload.tests),
    impact: normalizeLines(payload.impact),
    rollbackPlan: cleanLine(payload.rollbackPlan ?? ''),
    followUps: normalizeLines(payload.followUps),
    references: normalizeLines(payload.references),
    categoryId: cleanLine(payload.categoryId ?? '') || DEFAULT_CATEGORY_ID,
  };
}
