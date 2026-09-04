'use client';

import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { DocumentAlbumGrid } from '@/components/documents/document-album-grid';
import { seedCategories } from '@/data/seed-categories';
import { seedProfiles } from '@/data/seed-profiles';
import { useAuth } from '@/lib/auth-context';
import { useDocumentStore } from '@/lib/document-store';
import { canReadDocument } from '@/lib/permissions';

export default function HomePage() {
  const { user } = useAuth();
  const { documents, access } = useDocumentStore();
  if (!user) return null;

  const accessibleDocIds = access
    .filter((access) => access.user_id === user.id)
    .map((access) => access.document_id);

  const docs = documents
    .filter((doc) => canReadDocument(user, doc, accessibleDocIds, doc.id))
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">전체 글</h1>
          <p className="mt-1 text-sm text-text-secondary">
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

      {docs.length === 0 ? (
        <div className="py-16 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-text-muted" />
          <p className="text-sm text-text-secondary">글이 없습니다</p>
        </div>
      ) : (
        <DocumentAlbumGrid
          documents={docs}
          categories={seedCategories}
          profiles={seedProfiles}
        />
      )}
    </div>
  );
}
