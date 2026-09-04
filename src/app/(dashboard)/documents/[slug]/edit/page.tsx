'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { seedCategories } from '@/data/seed-categories';
import { updateStoredDocument, useDocumentStore } from '@/lib/document-store';
import { useRef, useState } from 'react';
import { MarkdownImageUploadButton } from '@/components/documents/markdown-image-upload-button';
import { MarkdownRenderer } from '@/components/documents/markdown-renderer';
import { ArrowLeft, Save, Eye } from 'lucide-react';
import Link from 'next/link';
import type { Document } from '@/types';

export default function EditDocumentPage() {
  const { slug } = useParams<{ slug: string }>();
  const { profile } = useAuth();
  const { documents, loading } = useDocumentStore();

  const doc = documents.find((d) => d.slug === decodeURIComponent(slug));

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-text-muted text-sm">로딩 중...</p>
      </div>
    );
  }

  if (!doc || !profile) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-text-secondary">글을 찾을 수 없습니다</p>
      </div>
    );
  }

  return <EditForm doc={doc} userId={profile.id} />;
}

function EditForm({
  doc,
  userId,
}: {
  doc: Document;
  userId: string;
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(doc.title);
  const [summary, setSummary] = useState(doc.summary);
  const [categoryId, setCategoryId] = useState(doc.category_id);
  const [content, setContent] = useState(doc.content_markdown);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateStoredDocument(doc.id, {
        title,
        summary,
        categoryId,
        content,
        userId,
      });
      setSaved(true);
      router.push(`/documents/${updated.slug}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link href={`/documents/${doc.slug}`} className="hover:text-curi-pink transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          글로 돌아가기
        </Link>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-2xl font-bold bg-transparent border-none text-text-primary focus:outline-none"
      />
      <input
        type="text"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        className="w-full text-sm bg-transparent border-none text-text-secondary focus:outline-none"
      />

      <div className="max-w-xs">
        <label className="block text-xs text-text-muted mb-1">카테고리</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary focus:outline-none">
          {seedCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPreview(false)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!showPreview ? 'bg-curi-pink-soft text-curi-pink' : 'text-text-muted hover:text-text-secondary'}`}>
            Markdown
          </button>
          <button onClick={() => setShowPreview(true)} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${showPreview ? 'bg-curi-pink-soft text-curi-pink' : 'text-text-muted hover:text-text-secondary'}`}>
            <Eye className="w-3.5 h-3.5" />미리보기
          </button>
        </div>
        {!showPreview && (
          <MarkdownImageUploadButton
            textareaRef={textareaRef}
            content={content}
            onContentChange={setContent}
            documentId={doc.id}
            disabled={saving}
          />
        )}
      </div>

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
          className="w-full min-h-[400px] p-4 rounded-xl border border-border bg-surface text-sm text-text-primary font-mono resize-y focus:outline-none focus:border-curi-pink/50"
        />
      )}

      <div className="flex items-center justify-between py-3">
        <span className="text-xs text-text-muted">{saving ? '저장 중...' : saved ? '저장 완료' : ''}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => router.back()} className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm hover:bg-surface-elevated transition-colors">취소</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-curi-pink hover:bg-curi-pink-hover text-white text-sm font-medium transition-colors disabled:opacity-50">
            <Save className="w-3.5 h-3.5" />{saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
