'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { seedCategories } from '@/data/seed-categories';
import { updateStoredDocument, useDocumentStore } from '@/lib/document-store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MarkdownImageUploadButton } from '@/components/documents/markdown-image-upload-button';
import { buildSummaryFromMarkdown } from '@/lib/plain-editor';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { Document } from '@/types';
import { isSecretCategoryId } from '@/lib/permissions';
import { normalizeCategoryId } from '@/lib/category-migration';
import { createClient } from '@/lib/supabase/client';
import { slugify } from '@/lib/utils';
import {
  CategoryIcon,
  CATEGORY_ICON_OPTIONS,
  type CategoryIconName,
} from '@/lib/category-icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotionLikeEditor } from '@/components/documents/notion-like-editor';
import { DocumentDriveField } from '@/components/documents/document-drive-link';
import { readDriveMetadata } from '@/lib/document-drive';

type CategoryOption = {
  id: string;
  databaseId: string;
  name: string;
  icon: string;
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
      databaseId: category.id,
      name: category.name,
      icon: category.icon,
      sort_order: category.sort_order,
    }))
  );
}

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

  if (isSecretCategoryId(doc.category_id) && profile.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-text-secondary text-lg mb-2">접근 권한이 없습니다</p>
        <p className="text-sm text-text-muted">Secret 문서는 관리자만 수정할 수 있습니다.</p>
      </div>
    );
  }

  return <EditForm doc={doc} userId={profile.id} isAdmin={profile.role === 'admin'} />;
}

function EditForm({
  doc,
  userId,
  isAdmin,
}: {
  doc: Document;
  userId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(doc.title);
  const [categoryId, setCategoryId] = useState(normalizeCategoryId(doc.category_id));
  const [content, setContent] = useState(() => readDriveMetadata(doc.content_markdown).body);
  const [driveUrl, setDriveUrl] = useState(() => readDriveMetadata(doc.content_markdown).driveUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editorMode, setEditorMode] = useState<'simple' | 'markdown'>('simple');
  const [categories, setCategories] = useState<CategoryOption[]>(() => seedCategoryOptions());
  const [categoryLoading, setCategoryLoading] = useState(false);

  const categoryOptions = useMemo(() => {
    const source = categories.length > 0 ? categories : seedCategoryOptions();
    if (isAdmin) return source;
    return source.filter((categoryItem) => !isSecretCategoryId(categoryItem.id));
  }, [categories, isAdmin]);

  const selectedCategory = categoryOptions.find((category) => category.id === categoryId);
  const hasTableOfContents = doc.content_markdown.split('\n').filter((line) => /^#{1,3}\s/.test(line)).length > 2;

  useEffect(() => {
    let mounted = true;

    const loadCategories = async () => {
      setCategoryLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('categories')
          .select('id, name, icon, sort_order')
          .order('sort_order', { ascending: true });

        if (error || !data || data.length === 0) {
          if (mounted) {
            setCategories(seedCategoryOptions());
          }
          return;
        }

        const deduped = new Map<string, CategoryOption>();

        for (const category of data as Array<{ id: string; name: string; icon: string | null; sort_order: number | null }>) {
          const databaseId = String(category.id);
          const normalizedId = normalizeCategoryId(databaseId);
          const seed = seedCategories.find((seedCategory) => seedCategory.id === normalizedId);

          if (deduped.has(normalizedId)) continue;

          deduped.set(normalizedId, {
            id: normalizedId,
            databaseId,
            name: seed?.name ?? String(category.name),
            icon: seed?.icon ?? String(category.icon ?? 'Building2'),
            sort_order: seed?.sort_order ?? Number(category.sort_order ?? 0),
          });
        }

        const seedMap = new Map(
          seedCategoryOptions().map((category) => [category.id, category])
        );

        for (const [normalizedId, category] of deduped.entries()) {
          seedMap.set(normalizedId, {
            ...seedMap.get(normalizedId),
            ...category,
          });
        }

        const loaded = normalizeCategoryOptions(Array.from(seedMap.values()));

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
  }, [categoryId]);

  const handleSave = async () => {
    if (!isAdmin && isSecretCategoryId(categoryId)) {
      alert('Secret 카테고리는 관리자만 선택할 수 있습니다.');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateStoredDocument(doc.id, {
        title,
        summary: buildSummaryFromMarkdown(content),
        categoryId,
        content,
        driveUrl,
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
      { id, databaseId: id, name, icon: 'FolderKanban', sort_order: nextSortOrder },
    ]);
    setCategories(nextCategories);
    setCategoryId(id);
  };

  const handleUpdateCategoryIcon = async (nextIcon: CategoryIconName) => {
    if (!isAdmin) return;
    const target = categoryOptions.find((category) => category.id === categoryId);
    if (!target) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('categories')
      .update({ icon: nextIcon })
      .eq('id', target.databaseId);

    if (error) {
      alert(`카테고리 아이콘 변경 실패: ${error.message}`);
      return;
    }

    setCategories((current) => current.map((category) => (
      category.id === categoryId ? { ...category, icon: nextIcon } : category
    )));
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
      .eq('category_id', target.databaseId);

    if (countError) {
      alert(`카테고리 사용 여부 확인 실패: ${countError.message}`);
      return;
    }

    if ((count ?? 0) > 0) {
      alert('해당 카테고리를 사용하는 문서가 있어 삭제할 수 없습니다.');
      return;
    }

    const { error } = await supabase.from('categories').delete().eq('id', target.databaseId);
    if (error) {
      alert(`카테고리 삭제 실패: ${error.message}`);
      return;
    }

    const nextCategories = categoryOptions.filter((category) => category.id !== categoryId);
    setCategories(nextCategories);
    setCategoryId(nextCategories[0]?.id ?? seedCategories[0]?.id ?? '');
  };

  return (
    <div className={`max-w-6xl mx-auto space-y-6 ${hasTableOfContents ? 'xl:pr-64' : ''}`}>
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Link href={`/documents/${doc.slug}`} className="hover:text-curi-pink transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          글로 돌아가기
        </Link>
      </div>

      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-2xl font-bold bg-transparent border-none text-text-primary focus:outline-none"
      />

      <DocumentDriveField value={driveUrl} onChange={setDriveUrl} disabled={saving} />

      <div className="max-w-xl space-y-2">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={!isAdmin}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-text-secondary transition-colors hover:bg-surface hover:text-text-primary disabled:cursor-default disabled:opacity-100"
                title={isAdmin ? '카테고리 아이콘 선택' : '카테고리 아이콘'}
                aria-label="카테고리 아이콘 선택"
              >
                <CategoryIcon iconName={selectedCategory?.icon} className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            {isAdmin && (
              <DropdownMenuContent align="start" className="grid grid-cols-5 gap-1 p-2">
                {CATEGORY_ICON_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const active = selectedCategory?.icon === option.name;
                  return (
                    <DropdownMenuItem
                      key={option.name}
                      onSelect={(event) => {
                        event.preventDefault();
                        void handleUpdateCategoryIcon(option.name);
                      }}
                      className={`flex h-10 w-10 items-center justify-center rounded-md p-0 ${active ? 'bg-surface-elevated text-curi-pink' : ''}`}
                      title={option.label}
                    >
                      <Icon className="h-4 w-4" />
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            )}
          </DropdownMenu>
          <div className="w-full">
            <Select
              value={categoryId}
              onValueChange={setCategoryId}
              disabled={categoryLoading}
            >
              <SelectTrigger className="h-10 border-0 bg-surface-elevated px-4 text-base shadow-none">
                <SelectValue placeholder="카테고리를 선택하세요" />
              </SelectTrigger>
              <SelectContent className="border-0 shadow-2xl">
                {categoryOptions.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={handleCreateCategory}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
                title="카테고리 추가"
                aria-label="카테고리 추가"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleDeleteCategory}
                disabled={PROTECTED_CATEGORY_IDS.has(categoryId)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-elevated text-text-secondary transition-colors hover:bg-surface hover:text-error disabled:pointer-events-none disabled:opacity-40"
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
          <button type="button" onClick={() => setEditorMode('simple')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${editorMode === 'simple' ? 'bg-curi-pink-soft text-curi-pink' : 'text-text-muted hover:text-text-secondary'}`}>
            간편 편집
          </button>
          <button type="button" onClick={() => setEditorMode('markdown')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${editorMode === 'markdown' ? 'bg-curi-pink-soft text-curi-pink' : 'text-text-muted hover:text-text-secondary'}`}>
            Markdown
          </button>
        </div>
        {editorMode === 'markdown' && (
          <MarkdownImageUploadButton
            textareaRef={textareaRef}
            content={content}
            onContentChange={setContent}
            documentId={doc.id}
            disabled={saving}
          />
        )}
      </div>

      {editorMode === 'simple' ? (
        <>
          <p className="text-xs text-text-muted">
            글을 읽을 때의 서식 그대로 수정하세요. 표 안의 글자도 바로 클릭해서 바꿀 수 있어요.
          </p>
          <NotionLikeEditor
            value={content}
            onChange={setContent}
            documentId={doc.id}
            disabled={saving}
            placeholder="내용을 자유롭게 작성하세요..."
          />
        </>
      ) : (
        <>
          <p className="text-xs text-text-muted">
            팁: 이미지 파일을 붙여넣거나 드래그해 바로 삽입할 수 있고, 형광펜은 <code className="font-mono">==텍스트==</code>, 링크는 <code className="font-mono">⌘/Ctrl + K</code>로 빠르게 넣을 수 있어요.
          </p>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full min-h-[400px] p-4 rounded-xl border border-border bg-surface text-sm text-text-primary font-mono resize-y focus:outline-none focus:border-curi-pink/50"
          />
        </>
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
