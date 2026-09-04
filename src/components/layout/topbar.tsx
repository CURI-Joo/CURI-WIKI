'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Plus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

interface TopbarProps {
  onOpenCommandPalette?: () => void;
}

const pathLabels: Record<string, string> = {
  '/': '홈',
  '/home': '홈',
  '/search': '검색',
  '/documents': '전체 글',
  '/documents/new': '새 글',
  '/design-system': '디자인 시스템',
};

function getBreadcrumb(pathname: string): { label: string; href: string }[] {
  const crumbs: { label: string; href: string }[] = [{ label: '홈', href: '/' }];

  if (pathname === '/') return crumbs;

  // Build breadcrumb from path segments
  const segments = pathname.split('/').filter(Boolean);
  let currentPath = '';

  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = pathLabels[currentPath] || decodeURIComponent(segment);
    crumbs.push({ label, href: currentPath });
  }

  return crumbs;
}

export function Topbar({ onOpenCommandPalette }: TopbarProps) {
  const pathname = usePathname();
  const breadcrumb = getBreadcrumb(pathname);
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsMac(navigator.platform.toUpperCase().includes('MAC'));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      {/* Breadcrumb - left side (add left padding on mobile for hamburger) */}
      <nav className="flex items-center gap-1 pl-10 text-sm md:pl-0">
        {breadcrumb.map((crumb, idx) => (
          <span key={crumb.href} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-text-muted" />}
            {idx === breadcrumb.length - 1 ? (
              <span className="font-medium text-text-primary">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                className="text-text-secondary transition-colors hover:text-text-primary"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right side: Search + New Document */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenCommandPalette}
          className={cn(
            'flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-text-muted hover:text-text-secondary'
          )}
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">검색</span>
          <kbd className="hidden rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-muted sm:inline">
            {isMac ? '⌘' : 'Ctrl+'}K
          </kbd>
        </button>

        <Link
          href="/documents/new"
          className="flex items-center gap-1.5 rounded-lg bg-curi-pink px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-curi-pink-hover"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">새 글</span>
        </Link>
      </div>
    </header>
  );
}
