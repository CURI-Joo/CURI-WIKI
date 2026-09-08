'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { seedCategories } from '@/data/seed-categories';
import { createStoredDocument } from '@/lib/document-store';
import { MarkdownImageUploadButton } from '@/components/documents/markdown-image-upload-button';
import { MarkdownRenderer } from '@/components/documents/markdown-renderer';
import { markdownToPlainText, plainTextToMarkdown } from '@/lib/plain-editor';
import { ArrowLeft, Save, Eye } from 'lucide-react';
import Link from 'next/link';
import { isSecretCategoryId } from '@/lib/permissions';

const PROJECT_TEMPLATE = {
  title: '[Project] 프로젝트명',
  summary: '프로젝트 목적, 성과, 핵심 내용을 한 줄로 정리',
  categorySlug: 'projects',
  content: `# 프로젝트 개요

## 기본 정보

- 프로젝트명:
- 진행 기간:
- 고객/도메인:
- 담당자:

## 배경과 목표

- 왜 시작했는지
- 해결하려는 문제
- 성공 기준(KPI)

## 범위와 주요 기능

1. 핵심 기능 1
2. 핵심 기능 2
3. 핵심 기능 3

## 기술/아키텍처

- 기술 스택:
- 구조 요약:
- 연동 시스템:

## 진행 과정

- 주요 의사결정:
- 이슈와 대응:
- 일정 리스크:

## 결과

- 정량 성과:
- 정성 성과:
- 배운 점:

## 후속 과제

- [ ] 개선 과제 1
- [ ] 개선 과제 2
- [ ] 운영 전환 체크
`,
};

export default function NewDocumentPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [categoryId, setCategoryId] = useState(seedCategories[0]?.id ?? '');
  const [content, setContent] = useState('');
  const [plainContent, setPlainContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editorMode, setEditorMode] = useState<'simple' | 'markdown'>('simple');
  const [showPreview, setShowPreview] = useState(false);

  if (!profile) return null;

  const categoryOptions = profile.role === 'admin'
    ? seedCategories
    : seedCategories.filter((categoryItem) => !isSecretCategoryId(categoryItem.id));

  const handleSave = async () => {
    if (!title.trim()) return;
    if (profile.role !== 'admin' && isSecretCategoryId(categoryId)) {
      alert('Secret 카테고리는 관리자만 선택할 수 있습니다.');
      return;
    }

    setSaving(true);

    try {
      const doc = await createStoredDocument({
        title,
        summary,
        categoryId,
        content,
        userId: profile.id,
      });

      setSaved(true);
      router.push(`/documents/${doc.slug}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyProjectTemplate = () => {
    const projectCategory = seedCategories.find((category) => category.slug === PROJECT_TEMPLATE.categorySlug);

    setTitle((prev) => prev.trim() ? prev : PROJECT_TEMPLATE.title);
    setSummary((prev) => prev.trim() ? prev : PROJECT_TEMPLATE.summary);
    if (projectCategory) {
      setCategoryId(projectCategory.id);
    }
    setContent((prev) => {
      if (prev.trim()) return prev;
      const templateContent = PROJECT_TEMPLATE.content;
      if (editorMode === 'simple') {
        setPlainContent(markdownToPlainText(templateContent));
      }
      return templateContent;
    });
  };

  const handleSwitchToSimple = () => {
    setEditorMode('simple');
    setShowPreview(false);
    setPlainContent(markdownToPlainText(content));
  };

  const handleSwitchToMarkdown = () => {
    const nextMarkdown = plainTextToMarkdown(plainContent);
    setContent(nextMarkdown);
    setEditorMode('markdown');
    setShowPreview(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link href="/documents" className="hover:text-curi-pink transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          전체 글
        </Link>
        <span>/</span>
        <span className="text-text-secondary">새 글</span>
      </div>

      {/* Title */}
      <input
        type="text"
        placeholder="글 제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-2xl font-bold bg-transparent border-none text-text-primary placeholder:text-text-muted focus:outline-none"
      />

      {/* Summary */}
      <input
        type="text"
        placeholder="글 요약 (한 줄 설명)"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        className="w-full text-sm bg-transparent border-none text-text-secondary placeholder:text-text-muted focus:outline-none"
      />

      {/* Category */}
      <div className="max-w-xs">
        <label className="block text-xs text-text-muted mb-1">카테고리</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary focus:outline-none focus:border-curi-pink/50"
        >
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleApplyProjectTemplate}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
        >
          프로젝트 템플릿 채우기
        </button>
      </div>

      {/* Editor toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSwitchToSimple}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !showPreview && editorMode === 'simple' ? 'bg-curi-pink-soft text-curi-pink' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            간편 편집
          </button>
          <button
            onClick={handleSwitchToMarkdown}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !showPreview && editorMode === 'markdown' ? 'bg-curi-pink-soft text-curi-pink' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Markdown
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              showPreview ? 'bg-curi-pink-soft text-curi-pink' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            미리보기
          </button>
        </div>
        {!showPreview && editorMode === 'markdown' && (
          <MarkdownImageUploadButton
            textareaRef={textareaRef}
            content={content}
            onContentChange={setContent}
            disabled={saving}
          />
        )}
      </div>

      {/* Editor */}
      {showPreview ? (
        <div className="rounded-xl border border-border bg-surface p-6 min-h-[400px]">
          {content ? (
            <MarkdownRenderer content={content} />
          ) : (
            <p className="text-sm text-text-muted">내용을 입력하면 미리보기가 표시됩니다.</p>
          )}
        </div>
      ) : editorMode === 'simple' ? (
        <textarea
          value={plainContent}
          onChange={(e) => {
            const nextPlain = e.target.value;
            setPlainContent(nextPlain);
            setContent(plainTextToMarkdown(nextPlain));
          }}
          placeholder="문장 그대로 작성하세요. Markdown 문법 없이도 저장됩니다."
          className="w-full min-h-[400px] p-4 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted resize-y focus:outline-none focus:border-curi-pink/50"
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Markdown으로 글을 작성하세요..."
          className="w-full min-h-[400px] p-4 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted font-mono resize-y focus:outline-none focus:border-curi-pink/50"
        />
      )}

      {/* Save bar */}
      <div className="flex items-center justify-between py-3">
        <div className="text-xs text-text-muted">
          {saving ? '저장 중...' : saved ? '저장 완료' : ''}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm hover:bg-surface-elevated transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-curi-pink hover:bg-curi-pink-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
