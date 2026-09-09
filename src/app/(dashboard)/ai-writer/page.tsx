'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';

interface DraftResponse {
  ok?: boolean;
  error?: string;
  message?: string;
  edit_url?: string;
  view_url?: string;
  document?: {
    slug: string;
    title: string;
    status: 'Draft' | 'Published';
  };
}

function splitLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function AiWriterPage() {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [changes, setChanges] = useState('');
  const [tests, setTests] = useState('');
  const [impact, setImpact] = useState('');
  const [rollbackPlan, setRollbackPlan] = useState('');
  const [followUps, setFollowUps] = useState('');
  const [references, setReferences] = useState('');
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<DraftResponse | null>(null);

  const canSubmit = useMemo(() => summary.trim().length > 0, [summary]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || creating) return;

    setCreating(true);
    setResult(null);

    try {
      const response = await fetch('/api/wiki/ai-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          workSummary: summary,
          keyChanges: splitLines(changes),
          tests: splitLines(tests),
          impact: splitLines(impact),
          rollbackPlan,
          followUps: splitLines(followUps),
          references: splitLines(references),
        }),
      });

      const payload = (await response.json()) as DraftResponse;
      setResult(payload);
    } catch {
      setResult({ error: 'network_error', message: '네트워크 오류가 발생했습니다.' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link href="/home" className="hover:text-curi-pink transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          HOME
        </Link>
        <span>/</span>
        <span className="text-text-secondary">AI 작업 위키 작성</span>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">AI 작업 위키 작성</h1>
            <p className="mt-1 text-sm text-text-secondary">
              오늘 작업 내용을 넣으면 표준 템플릿으로 Draft 문서를 자동 생성합니다.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-curi-pink/30 bg-curi-pink-soft px-2.5 py-1 text-xs font-medium text-curi-pink">
            <Sparkles className="h-3.5 w-3.5" />
            Draft Only
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs text-text-muted">문서 제목 (선택)</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="비워두면 오늘 날짜 기준 제목이 자동 생성됩니다."
              className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-curi-pink/50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-muted">작업 요약 (필수)</label>
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="예) 위키 작성 자동화 API와 UI를 추가하고 문서 가이드를 작성함"
              className="min-h-[80px] w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-curi-pink/50"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-text-muted">주요 변경 사항 (줄바꿈으로 구분)</label>
              <textarea
                value={changes}
                onChange={(event) => setChanges(event.target.value)}
                placeholder={'/api/wiki/ai-draft 엔드포인트 추가\n/ai-writer 페이지 추가'}
                className="min-h-[120px] w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-curi-pink/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">테스트 내역 (줄바꿈으로 구분)</label>
              <textarea
                value={tests}
                onChange={(event) => setTests(event.target.value)}
                placeholder={'next build --webpack\n수동 QA: 문서 생성/수정 흐름'}
                className="min-h-[120px] w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-curi-pink/50"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-text-muted">영향 범위 (줄바꿈으로 구분)</label>
              <textarea
                value={impact}
                onChange={(event) => setImpact(event.target.value)}
                placeholder={'문서 작성 흐름\n개발자 위키 가이드'}
                className="min-h-[120px] w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-curi-pink/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">후속 작업 (줄바꿈으로 구분)</label>
              <textarea
                value={followUps}
                onChange={(event) => setFollowUps(event.target.value)}
                placeholder={'텔레그램 연동\n승인 워크플로우 추가'}
                className="min-h-[120px] w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-curi-pink/50"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-muted">롤백 계획</label>
            <textarea
              value={rollbackPlan}
              onChange={(event) => setRollbackPlan(event.target.value)}
              placeholder="문제 발생 시 관련 커밋 revert 후 이전 배포 버전으로 롤백"
              className="min-h-[80px] w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-curi-pink/50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-text-muted">참고 링크 (줄바꿈으로 구분)</label>
            <textarea
              value={references}
              onChange={(event) => setReferences(event.target.value)}
              placeholder={'https://github.com/org/repo/pull/123\nhttps://github.com/org/repo/commit/abcdef'}
              className="min-h-[80px] w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-curi-pink/50"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit || creating}
              className="rounded-lg bg-curi-pink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? 'Draft 생성 중...' : 'Draft 생성'}
            </button>
            <p className="text-xs text-text-muted">로그인된 내 계정으로 Draft 문서가 생성됩니다.</p>
          </div>
        </form>

        {result && (
          <div className="mt-5 rounded-xl border border-border bg-surface-elevated p-4 text-sm">
            {result.ok && result.document ? (
              <div className="space-y-2">
                <p className="font-medium text-text-primary">✅ Draft 생성 완료: {result.document.title}</p>
                <div className="flex flex-wrap items-center gap-3">
                  {result.edit_url && (
                    <Link href={result.edit_url} className="text-curi-pink hover:underline">
                      문서 수정하기
                    </Link>
                  )}
                  {result.view_url && (
                    <Link href={result.view_url} className="text-text-secondary hover:underline">
                      문서 보기
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-red-500">❌ {result.message ?? result.error ?? 'Draft 생성에 실패했습니다.'}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
