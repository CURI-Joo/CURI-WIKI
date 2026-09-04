'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getRepository } from '@/lib/repository';
import Link from 'next/link';
import { Search, FileText } from 'lucide-react';
import type { SearchResult } from '@/types';

export default function SearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  if (!user) return null;

  const handleSearch = async () => {
    if (!query.trim()) return;
    const repo = getRepository();
    const res = await repo.search(query, user.id);
    setResults(res);
    setSearched(true);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      <h1 className="text-xl font-bold text-text-primary">검색</h1>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="글 검색..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-surface text-sm text-text-primary placeholder:text-text-muted focus:border-curi-pink/50 focus:outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-5 py-2.5 rounded-xl bg-curi-pink hover:bg-curi-pink-hover text-white text-sm font-medium transition-colors"
        >
          검색
        </button>
      </div>

      {searched && results.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary text-sm">
            &quot;{query}&quot;에 대한 검색 결과가 없습니다
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-text-muted">{results.length}개의 결과</p>
          {results.map((r) => (
            <Link
              key={r.id}
              href={`/documents/${r.slug}`}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface hover:border-curi-pink/30 transition-all"
            >
              <FileText className="w-4 h-4 text-text-muted shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{r.title}</p>
                <p className="text-xs text-text-muted truncate">{r.summary}</p>
              </div>
              {r.category && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-elevated text-text-muted shrink-0">
                  {r.category}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
