'use client';

import { useAuth } from '@/lib/auth-context';
import { useSearchParams } from 'next/navigation';
import { seedCategories } from '@/data/seed-categories';
import { DocumentAlbumGrid } from '@/components/documents/document-album-grid';
import { useDocumentStore } from '@/lib/document-store';
import Link from 'next/link';
import { useState, Suspense } from 'react';
import { FileText, Plus, Search } from 'lucide-react';

function DocumentsContent() {
  const { profile } = useAuth();
  const { documents, loading } = useDocumentStore();
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get('category');
  const [search, setSearch] = useState('');

  if (!profile) return null;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center">
        <p className="text-sm text-text-muted">로딩 중...</p>
      </div>
    );
  }

  let docs = [...documents];

  const category = categorySlug
    ? seedCategories.find((c) => c.slug === categorySlug)
    : null;

  if (category) {
    docs = docs.filter((d) => d.category_id === category.id);
  }

  if (search) {
    const q = search.toLowerCase();
    docs = docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.summary.toLowerCase().includes(q)
    );
  }

  docs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">
            {category ? category.name : '전체 글'}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {docs.length}개의 글
          </p>
        </div>
        <Link
          href="/documents/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-curi-pink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-curi-pink-hover"
        >
          <Plus className="h-4 w-4" />
          새 문서
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="글 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:border-curi-pink/50 focus:outline-none"
        />
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary text-sm">글이 없습니다</p>
        </div>
      ) : (
        <DocumentAlbumGrid
          documents={docs}
          categories={seedCategories}
          profiles={[]}
        />
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="text-text-muted text-sm">로딩 중...</div>}>
      <DocumentsContent />
    </Suspense>
  );
}
