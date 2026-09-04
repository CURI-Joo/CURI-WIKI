'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { seedCategories } from '@/data/seed-categories';
import { createStoredDocument } from '@/lib/document-store';
import { MarkdownImageUploadButton } from '@/components/documents/markdown-image-upload-button';
import { MarkdownRenderer } from '@/components/documents/markdown-renderer';
import { ArrowLeft, Save, Eye } from 'lucide-react';
import Link from 'next/link';

export default function NewDocumentPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [categoryId, setCategoryId] = useState(seedCategories[0]?.id ?? '');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  if (!profile) return null;

  const handleSave = async () => {
    if (!title.trim()) return;
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
          {seedCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Editor toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(false)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !showPreview ? 'bg-curi-pink-soft text-curi-pink' : 'text-text-muted hover:text-text-secondary'
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
        {!showPreview && (
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
