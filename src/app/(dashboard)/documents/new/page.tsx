'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { seedCategories } from '@/data/seed-categories';
import { createStoredDocument } from '@/lib/document-store';
import { MarkdownImageUploadButton } from '@/components/documents/markdown-image-upload-button';
import { MarkdownRenderer } from '@/components/documents/markdown-renderer';
import { buildSummaryFromMarkdown } from '@/lib/plain-editor';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/utils';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { isSecretCategoryId } from '@/lib/permissions';

type CategoryOption = {
  id: string;
  name: string;
  sort_order: number;
};

const PROTECTED_CATEGORY_IDS = new Set(['cat-company']);

function normalizeCategoryOptions(input: CategoryOption[]) {
  return [...input].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

function seedCategoryOptions(): CategoryOption[] {
  return normalizeCategoryOptions(
    seedCategories.map((category) => ({
      id: category.id,
      name: category.name,
      sort_order: category.sort_order,
    }))
  );
}

export default function NewDocumentPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(seedCategories[0]?.id ?? '');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editorMode, setEditorMode] = useState<'simple' | 'markdown'>('simple');
  const [categories, setCategories] = useState<CategoryOption[]>(() => seedCategoryOptions());
  const [categoryLoading, setCategoryLoading] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const categoryOptions = useMemo(() => {
    const source = categories.length > 0 ? categories : seedCategoryOptions();
    if (isAdmin) return source;
    return source.filter((categoryItem) => !isSecretCategoryId(categoryItem.id));
  }, [categories, isAdmin]);

  useEffect(() => {
    if (!profile) return;

    let mounted = true;

    const loadCategories = async () => {
      setCategoryLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('categories')
          .select('id, name, sort_order')
          .order('sort_order', { ascending: true });

        if (error || !data || data.length === 0) {
          if (mounted) {
            setCategories(seedCategoryOptions());
          }
          return;
        }

        const loaded = normalizeCategoryOptions(
          data.map((category: { id: string; name: string; sort_order: number | null }) => ({
            id: String(category.id),
            name: String(category.name),
            sort_order: Number(category.sort_order ?? 0),
          }))
        );

        if (!mounted) return;
        setCategories(loaded);

        if (!loaded.some((category) => category.id === categoryId)) {
          setCategoryId(loaded[0]?.id ?? '');
        }
      } finally {
        if (mounted) {
          setCategoryLoading(false);
        }
      }
    };

    void loadCategories();

    return () => {
      mounted = false;
    };
  }, [categoryId, profile]);

  if (!profile) return null;

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
        summary: buildSummaryFromMarkdown(content),
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

  const handleCreateCategory = async () => {
    if (!isAdmin) return;

    const rawName = window.prompt('새 카테고리 이름을 입력하세요.');
    const name = rawName?.trim();
    if (!name) return;

    const alreadyExists = categoryOptions.some(
      (category) => category.name.toLowerCase() === name.toLowerCase()
    );
    if (alreadyExists) {
      alert('이미 같은 이름의 카테고리가 있습니다.');
      return;
    }

    const supabase = createClient();
    const slugBase = slugify(name) || `category-${Date.now()}`;
    const id = `cat-${slugBase}-${Date.now().toString(36).slice(-4)}`;
    const nextSortOrder = (categoryOptions[categoryOptions.length - 1]?.sort_order ?? 0) + 1;

    const { error } = await supabase
      .from('categories')
      .insert({
        id,
        name,
        slug: slugBase,
        icon: 'Folder',
        parent_id: null,
        sort_order: nextSortOrder,
      });

    if (error) {
      alert(`카테고리 추가 실패: ${error.message}`);
      return;
    }

    const nextCategories = normalizeCategoryOptions([
      ...categoryOptions,
      { id, name, sort_order: nextSortOrder },
    ]);
    setCategories(nextCategories);
    setCategoryId(id);
  };

  const handleDeleteCategory = async () => {
    if (!isAdmin) return;
    if (!categoryId) return;
    if (PROTECTED_CATEGORY_IDS.has(categoryId)) {
      alert('기본 카테고리는 삭제할 수 없습니다.');
      return;
    }

    const target = categoryOptions.find((category) => category.id === categoryId);
    if (!target) return;

    const confirmed = window.confirm(`카테고리 '${target.name}'을(를) 삭제할까요?`);
    if (!confirmed) return;

    const supabase = createClient();

    const { count, error: countError } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', categoryId);

    if (countError) {
      alert(`카테고리 사용 여부 확인 실패: ${countError.message}`);
      return;
    }

    if ((count ?? 0) > 0) {
      alert('해당 카테고리를 사용하는 문서가 있어 삭제할 수 없습니다.');
      return;
    }

    const { error } = await supabase.from('categories').delete().eq('id', categoryId);
    if (error) {
      alert(`카테고리 삭제 실패: ${error.message}`);
      return;
    }

    const nextCategories = categoryOptions.filter((category) => category.id !== categoryId);
    setCategories(nextCategories);
    setCategoryId(nextCategories[0]?.id ?? seedCategories[0]?.id ?? '');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link href="/documents" className="hover:text-curi-pink transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          전체 글
        </Link>
        <span>/</span>
        <span className="text-text-secondary">새 글</span>
      </div>

      <input
        type="text"
        placeholder="글 제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-2xl font-bold bg-transparent border-none text-text-primary placeholder:text-text-muted focus:outline-none"
      />

      <div className="max-w-xl space-y-2">
        <label className="block text-xs text-text-muted">카테고리</label>
        <div className="flex items-center gap-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={categoryLoading}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary focus:outline-none focus:border-curi-pink/50 disabled:opacity-60"
          >
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={handleCreateCategory}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
                title="카테고리 추가"
                aria-label="카테고리 추가"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleDeleteCategory}
                disabled={PROTECTED_CATEGORY_IDS.has(categoryId)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-surface-elevated hover:text-error disabled:pointer-events-none disabled:opacity-40"
                title="카테고리 삭제"
                aria-label="카테고리 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditorMode('simple')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              editorMode === 'simple' ? 'bg-curi-pink-soft text-curi-pink' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            간편 편집
          </button>
          <button
            type="button"
            onClick={() => setEditorMode('markdown')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              editorMode === 'markdown' ? 'bg-curi-pink-soft text-curi-pink' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            Markdown
          </button>
        </div>
        {editorMode === 'markdown' && (
          <MarkdownImageUploadButton
            textareaRef={textareaRef}
            content={content}
            onContentChange={setContent}
            disabled={saving}
          />
        )}
      </div>

      {editorMode === 'simple' ? (
        <div className="rounded-xl border border-border bg-surface p-6 min-h-[400px]">
          {content ? (
            <MarkdownRenderer content={content} />
          ) : (
            <p className="text-sm text-text-muted leading-relaxed">내용이 아직 없습니다. Markdown 탭에서 작성한 내용이 여기서 읽기 좋은 형태로 표시됩니다.</p>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-text-muted">
            팁: 이미지 파일을 붙여넣거나 드래그해 바로 삽입할 수 있고, 형광펜은 <code className="font-mono">==텍스트==</code>, 링크는 <code className="font-mono">⌘/Ctrl + K</code>로 빠르게 넣을 수 있어요.
          </p>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Markdown으로 글을 작성하세요..."
            className="w-full min-h-[400px] p-4 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted font-mono resize-y focus:outline-none focus:border-curi-pink/50"
          />
        </>
      )}

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
