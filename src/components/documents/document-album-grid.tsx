'use client';

import Link from 'next/link';
import {
  BookOpen,
  Calendar,
  ExternalLink,
  FileText,
  Lock,
  User,
} from 'lucide-react';
import type { Category, Document, Profile } from '@/types';
import { cn, formatRelativeDate } from '@/lib/utils';

interface DocumentAlbumGridProps {
  documents: Document[];
  categories: Category[];
  profiles: Profile[];
}

const coverStyles = [
  'from-curi-pink/35 via-fuchsia-500/20 to-sky-500/20',
  'from-sky-500/30 via-cyan-500/15 to-emerald-500/20',
  'from-emerald-500/30 via-teal-500/15 to-curi-pink/15',
  'from-amber-500/30 via-orange-500/15 to-curi-pink/20',
  'from-violet-500/30 via-indigo-500/15 to-sky-500/20',
  'from-rose-500/30 via-curi-pink/20 to-amber-500/20',
];

function getCoverStyle(categoryId: string) {
  const seed = categoryId
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return coverStyles[seed % coverStyles.length];
}

function getStatusClass(status: Document['status']) {
  if (status === 'Published') return 'bg-success/10 text-success';
  if (status === 'Draft') return 'bg-warning/10 text-warning';
  return 'bg-text-muted/10 text-text-muted';
}

function getVisibilityLabel(visibility: Document['visibility']) {
  return visibility === 'RESTRICTED' ? '제한 공개' : '전체 공개';
}

export function DocumentAlbumGrid({
  documents,
  categories,
  profiles,
}: DocumentAlbumGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {documents.map((doc) => {
        const category = categories.find((item) => item.id === doc.category_id);
        const owner = profiles.find((profile) => profile.id === doc.owner_id);

        return (
          <Link
            key={doc.id}
            href={`/documents/${doc.slug}`}
            className="group flex min-h-[264px] flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-curi-pink/40"
          >
            <div
              className={cn(
                'relative aspect-[16/9] overflow-hidden bg-gradient-to-br',
                getCoverStyle(doc.category_id)
              )}
            >
              <div className="absolute inset-x-0 bottom-0 h-px bg-white/10" />
              <div className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-background/55 text-white shadow-sm backdrop-blur">
                <BookOpen className="h-5 w-5" />
              </div>
              {category && (
                <span className="absolute bottom-3 left-4 max-w-[calc(100%-2rem)] truncate rounded-md border border-white/10 bg-background/55 px-2 py-1 text-xs font-medium text-text-primary backdrop-blur">
                  {category.name}
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-start gap-2">
                <h2 className="min-w-0 flex-1 text-base font-semibold leading-snug text-text-primary transition-colors group-hover:text-curi-pink">
                  {doc.title}
                </h2>
                <div className="flex shrink-0 items-center gap-1 pt-0.5">
                  {doc.visibility === 'RESTRICTED' && (
                    <Lock className="h-3.5 w-3.5 text-warning" />
                  )}
                  {doc.external_status === 'EXTERNAL_OK' && (
                    <ExternalLink className="h-3.5 w-3.5 text-success" />
                  )}
                </div>
              </div>

              <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-secondary">
                {doc.summary}
              </p>

              <div className="mt-auto pt-4">
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      getStatusClass(doc.status)
                    )}
                  >
                    {doc.status}
                  </span>
                  <span className="flex min-w-0 items-center gap-1 text-xs text-text-muted">
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{getVisibilityLabel(doc.visibility)}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-text-muted">
                  <span className="flex min-w-0 items-center gap-1">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{owner?.name ?? '미지정'}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatRelativeDate(doc.updated_at)}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
