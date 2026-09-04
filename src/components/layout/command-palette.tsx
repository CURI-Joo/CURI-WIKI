'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { getRepository } from '@/lib/repository';
import type { SearchResult } from '@/types';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const RECENT_SEARCHES_KEY = 'curi-wiki-recent-searches';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  if (!query.trim()) return;
  const recent = getRecentSearches().filter((s) => s !== query);
  recent.unshift(query);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { profile } = useAuth();

  // Load recent searches when opened
  useEffect(() => {
    if (!open) return;

    const resetTimer = window.setTimeout(() => {
      setRecentSearches(getRecentSearches());
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setIsSearching(false);
    }, 0);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 50);

    return () => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  // Search as user types
  useEffect(() => {
    if (!query.trim() || !profile) {
      const resetTimer = window.setTimeout(() => {
        setResults([]);
        setSelectedIndex(0);
        setIsSearching(false);
      }, 0);

      return () => window.clearTimeout(resetTimer);
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const repo = getRepository();
        const searchResults = await repo.search(query, profile.id);
        if (!cancelled) {
          setResults(searchResults);
          setSelectedIndex(0);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, profile]);

  // Group results by type
  const hasQuery = query.trim().length > 0;
  const documentResults = hasQuery ? results.filter((r) => r.type === 'document') : [];

  // Flat list of all selectable items for keyboard nav
  const allItems = useMemo(
    (): { type: 'recent' | 'result'; value: string; result?: SearchResult }[] => {
      if (!hasQuery) {
        return recentSearches.map((search) => ({ type: 'recent', value: search }));
      }

      return results.map((result) => ({
        type: 'result',
        value: result.id,
        result,
      }));
    },
    [hasQuery, recentSearches, results]
  );

  const navigateToResult = useCallback(
    (result: SearchResult) => {
      saveRecentSearch(query);
      onClose();
      router.push(`/documents/${result.slug}`);
    },
    [query, onClose, router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, allItems.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (allItems[selectedIndex]) {
            const item = allItems[selectedIndex];
            if (item.type === 'recent') {
              setQuery(item.value);
            } else if (item.result) {
              navigateToResult(item.result);
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [allItems, selectedIndex, navigateToResult, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Global Cmd+K / Ctrl+K listener is handled by parent; we just handle Escape here
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  let runningIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-xl rounded-xl border border-border bg-surface-elevated shadow-2xl">
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-5 w-5 shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="글 검색..."
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-text-muted hover:text-text-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {/* No user logged in */}
          {!profile && (
            <p className="px-3 py-6 text-center text-sm text-text-muted">
              검색하려면 로그인이 필요합니다
            </p>
          )}

          {/* Recent searches (when no query) */}
          {profile && !query.trim() && recentSearches.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-text-muted">
                최근 검색
              </p>
              {recentSearches.map((search, idx) => {
                const itemIdx = idx;
                return (
                  <button
                    key={search}
                    data-selected={selectedIndex === itemIdx}
                    onClick={() => setQuery(search)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      selectedIndex === itemIdx
                        ? 'bg-curi-pink-soft text-text-primary'
                        : 'text-text-secondary hover:bg-surface'
                    )}
                  >
                    <Clock className="h-4 w-4 shrink-0 text-text-muted" />
                    {search}
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty state when no query */}
          {profile && !query.trim() && recentSearches.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-text-muted">
              검색어를 입력하세요
            </p>
          )}

          {/* Loading */}
          {isSearching && (
            <p className="px-3 py-6 text-center text-sm text-text-muted">검색 중...</p>
          )}

          {/* No results */}
          {profile && query.trim() && !isSearching && results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-text-muted">
              &quot;{query}&quot;에 대한 검색 결과가 없습니다
            </p>
          )}

          {/* Document results */}
          {documentResults.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-text-muted">
                문서
              </p>
              {documentResults.map((result) => {
                const itemIdx = runningIndex++;
                return (
                  <button
                    key={result.id}
                    data-selected={selectedIndex === itemIdx}
                    onClick={() => navigateToResult(result)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      selectedIndex === itemIdx
                        ? 'bg-curi-pink-soft text-text-primary'
                        : 'text-text-secondary hover:bg-surface'
                    )}
                  >
                    <FileText className="h-4 w-4 shrink-0 text-text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-text-primary">{result.title}</p>
                      {result.category && (
                        <p className="truncate text-xs text-text-muted">{result.category}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[10px] text-text-muted">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1 py-0.5">↑↓</kbd> 이동
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1 py-0.5">↵</kbd> 선택
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border px-1 py-0.5">esc</kbd> 닫기
          </span>
        </div>
      </div>
    </div>
  );
}
