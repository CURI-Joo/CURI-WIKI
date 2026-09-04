'use client';

import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { seedCategories } from '@/data/seed-categories';
import { useDocumentStore } from '@/lib/document-store';
import { useProfiles, getProfileName } from '@/lib/profiles-store';
import { formatDate } from '@/lib/utils';
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

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent = '';
  let codeBlockIndex = 0;
  let inTable = false;
  let tableRows: string[][] = [];
  let tableIndex = 0;

  const processInline = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      const codeMatch = remaining.match(/`([^`]+)`/);
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

      const matches = [
        codeMatch ? { type: 'code', match: codeMatch } : null,
        boldMatch ? { type: 'bold', match: boldMatch } : null,
        linkMatch ? { type: 'link', match: linkMatch } : null,
      ].filter(Boolean).sort((a, b) => (a!.match!.index || 0) - (b!.match!.index || 0));

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      const first = matches[0]!;
      const idx = first.match!.index || 0;
      if (idx > 0) parts.push(remaining.slice(0, idx));

      if (first.type === 'code') {
        parts.push(<code key={key++} className="px-1.5 py-0.5 rounded bg-surface-elevated text-curi-pink text-[13px] font-mono">{first.match![1]}</code>);
      } else if (first.type === 'bold') {
        parts.push(<strong key={key++} className="font-semibold text-text-primary">{first.match![1]}</strong>);
      } else if (first.type === 'link') {
        const href = first.match![2];
        const isInternal = href.startsWith('/');
        parts.push(
          <a key={key++} href={href} className="text-curi-pink hover:underline" {...(!isInternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {first.match![1]}
          </a>
        );
      }

      remaining = remaining.slice(idx + first.match![0].length);
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeContent = '';
        continue;
      } else {
        inCodeBlock = false;
        elements.push(
          <pre key={`code-${codeBlockIndex++}`} className="p-4 rounded-lg bg-background border border-border overflow-x-auto text-sm font-mono text-text-secondary my-4">
            <code>{codeContent}</code>
          </pre>
        );
        continue;
      }
    }
    if (inCodeBlock) {
      codeContent += (codeContent ? '\n' : '') + line;
      continue;
    }

    if (line.includes('|') && line.trim().startsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
        tableIndex++;
      }
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (!cells.every((c) => /^[-:]+$/.test(c))) {
        tableRows.push(cells);
      }
      if (i + 1 >= lines.length || !lines[i + 1].trim().startsWith('|')) {
        inTable = false;
        const [header, ...body] = tableRows;
        elements.push(
          <div key={`table-${tableIndex}`} className="overflow-x-auto my-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {header?.map((h, j) => (
                    <th key={j} className="text-left px-3 py-2 border-b border-border text-text-secondary font-medium text-xs">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 border-b border-border/50 text-text-primary text-sm">
                        {processInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    if (line.trim() === '') continue;

    const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const id = text.toLowerCase().replace(/\s+/g, '-');
      if (level === 1) {
        elements.push(<h1 key={i} id={id} className="text-2xl font-bold text-text-primary mt-8 mb-4 first:mt-0">{processInline(text)}</h1>);
      } else if (level === 2) {
        elements.push(<h2 key={i} id={id} className="text-lg font-semibold text-text-primary mt-6 mb-3">{processInline(text)}</h2>);
      } else {
        elements.push(<h3 key={i} id={id} className="text-base font-semibold text-text-primary mt-4 mb-2">{processInline(text)}</h3>);
      }
      continue;
    }

    if (line.startsWith('>')) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-curi-pink pl-4 py-1 my-3 text-sm text-text-secondary italic">
          {processInline(line.replace(/^>\s*/, ''))}
        </blockquote>
      );
      continue;
    }

    if (/^[-*]\s/.test(line.trim())) {
      elements.push(
        <li key={i} className="text-sm text-text-primary ml-4 list-disc mb-1">
          {processInline(line.replace(/^[-*]\s*/, '').trim())}
        </li>
      );
      continue;
    }

    if (/^\d+\.\s/.test(line.trim())) {
      elements.push(
        <li key={i} className="text-sm text-text-primary ml-4 list-decimal mb-1">
          {processInline(line.replace(/^\d+\.\s*/, '').trim())}
        </li>
      );
      continue;
    }

    if (/^- \[[ x]\]/.test(line.trim())) {
      const checked = line.includes('[x]');
      elements.push(
        <div key={i} className="flex items-center gap-2 text-sm text-text-primary ml-2 mb-1">
          <input type="checkbox" checked={checked} readOnly className="rounded" />
          <span className={checked ? 'line-through text-text-muted' : ''}>{processInline(line.replace(/^- \[[ x]\]\s*/, '').trim())}</span>
        </div>
      );
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={i} className="border-border my-6" />);
      continue;
    }

    elements.push(
      <p key={i} className="text-sm text-text-primary leading-relaxed mb-2">
        {processInline(line)}
      </p>
    );
  }

  return <div className="prose-curi">{elements}</div>;
}
