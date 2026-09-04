'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocumentAlbumGrid } from '@/components/documents/document-album-grid';
import { seedCategories } from '@/data/seed-categories';
import { useAuth } from '@/lib/auth-context';
import { useDocumentStore } from '@/lib/document-store';
import { useProfiles } from '@/lib/profiles-store';

export default function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { profile } = useAuth();
  const { documents, loading } = useDocumentStore();
  const profiles = useProfiles();

  if (!profile) return null;

  const category = seedCategories.find((c) => c.slug === slug);

  if (!category) {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center">
        <p className="text-text-muted">카테고리를 찾을 수 없습니다.</p>
        <Link href="/home">
          <Button variant="ghost" size="sm" className="mt-4">홈으로 돌아가기</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl py-16 text-center">
        <p className="text-sm text-text-muted">로딩 중...</p>
      </div>
    );
  }

  const docs = documents
    .filter((doc) => doc.category_id === category.id)
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/home">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <p className="text-xs text-text-muted">HOME</p>
            <h1 className="text-xl font-bold text-text-primary">{category.name}</h1>
          </div>
        </div>
        <Link
          href="/documents/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-curi-pink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-curi-pink-hover"
        >
          <Plus className="h-4 w-4" />
          새 문서
        </Link>
      </div>

      {docs.length === 0 ? (
        <div className="py-16 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-text-muted" />
          <p className="text-sm text-text-secondary">이 카테고리에 글이 없습니다</p>
        </div>
      ) : (
        <DocumentAlbumGrid
          documents={docs}
          categories={seedCategories}
          profiles={profiles}
        />
      )}
    </div>
  );
}
