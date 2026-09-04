'use client';

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { seedCategories } from '@/data/seed-categories';
import { useDocumentStore } from '@/lib/document-store';
import { useProfiles, getProfileName } from '@/lib/profiles-store';
import { formatDate } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/documents/markdown-renderer';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Check,
  Edit3,
  Link2,
  User,
} from 'lucide-react';

export default function DocumentDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { profile } = useAuth();
  const { documents, loading } = useDocumentStore();
  const profiles = useProfiles();
  const [linkCopied, setLinkCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }
    };
  }, []);

  if (!profile) return null;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-text-muted text-sm">로딩 중...</p>
      </div>
    );
  }

  const doc = documents.find((d) => d.slug === decodeURIComponent(slug));

  if (!doc) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-text-secondary text-lg mb-2">글을 찾을 수 없습니다</p>
        <Link href="/documents" className="text-curi-pink text-sm hover:underline">
          전체 글로
        </Link>
      </div>
    );
  }

  const category = seedCategories.find((c) => c.id === doc.category_id);

  // Generate TOC from markdown headings
  const headings = doc.content_markdown
    .split('\n')
    .filter((line) => /^#{1,3}\s/.test(line))
    .map((line) => {
      const level = (line.match(/^#+/) || [''])[0].length;
      const text = line.replace(/^#+\s*/, '');
      return { level, text, id: text.toLowerCase().replace(/\s+/g, '-') };
    });

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/documents/${doc.slug}`;

    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);

      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current);
      }

      copiedTimeoutRef.current = setTimeout(() => {
        setLinkCopied(false);
      }, 1800);
    } catch {
      window.prompt('아래 링크를 복사해 공유하세요.', url);
    }
  };

  return (
    <div className="max-w-6xl mx-auto flex gap-8">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Link href="/documents" className="hover:text-curi-pink transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            전체 글
          </Link>
          {category && (
            <>
              <span>/</span>
              <Link
                href={`/documents?category=${category.slug}`}
                className="hover:text-curi-pink transition-colors"
              >
                {category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-text-secondary truncate">{doc.title}</span>
        </div>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{doc.title}</h1>
          <p className="text-text-secondary mt-1">{doc.summary}</p>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {getProfileName(profiles, doc.owner_id)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(doc.updated_at)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link
            href={`/documents/${doc.slug}/edit`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-curi-pink hover:bg-curi-pink-hover text-white text-sm font-medium transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            내용 수정
          </Link>
          <button
            type="button"
            onClick={handleCopyLink}
            aria-label={linkCopied ? '링크가 복사되었습니다' : '링크 복사'}
            title={linkCopied ? '링크가 복사되었습니다' : '링크 복사'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
          >
            {linkCopied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="rounded-xl border border-border bg-surface p-6 md:p-8">
          <MarkdownRenderer content={doc.content_markdown} />
        </div>
      </div>

      {/* Table of Contents - desktop */}
      {headings.length > 2 && (
        <aside className="hidden xl:block w-56 shrink-0">
          <div className="sticky top-24">
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
              목차
            </h3>
            <nav className="space-y-1">
              {headings.map((h, i) => (
                <a
                  key={i}
                  href={`#${h.id}`}
                  className="block text-xs text-text-muted hover:text-text-primary transition-colors truncate"
                  style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
                >
                  {h.text}
                </a>
              ))}
            </nav>
          </div>
        </aside>
      )}
    </div>
  );
}
