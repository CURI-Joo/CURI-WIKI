'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, ExternalLink, Wrench } from 'lucide-react';
import { internalTools } from '@/data/internal-tools';

function isExternalUrl(url: string) {
  return /^https?:\/\//.test(url);
}

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">내부 툴 허브</h1>
        <p className="mt-1 text-sm text-text-secondary">
          팀원이 자주 사용하는 내부 서비스 링크를 한 곳에서 관리합니다.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {internalTools.map((tool) => {
          const external = isExternalUrl(tool.url);
          const openInNewTab = tool.openInNewTab ?? external;

          const IconLinkContent = tool.iconSrc ? (
            <Image
              src={tool.iconSrc}
              alt={tool.iconAlt ?? tool.name}
              width={80}
              height={80}
              className="h-20 w-20 object-contain"
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center text-curi-pink">
              <Wrench className="h-10 w-10" />
            </span>
          );

          return (
            <article
              key={tool.id}
              className="group rounded-2xl border border-border bg-surface p-5 text-center transition-colors hover:bg-surface-elevated"
            >
              <div className="relative flex items-center justify-center">
                {openInNewTab ? (
                  <a href={tool.url} target="_blank" rel="noopener noreferrer" aria-label={`${tool.name} 열기`}>
                    {IconLinkContent}
                  </a>
                ) : (
                  <Link href={tool.url} aria-label={`${tool.name} 열기`}>
                    {IconLinkContent}
                  </Link>
                )}
                <ExternalLink className="absolute right-0 top-0 h-4 w-4 text-text-muted" />
              </div>

              <h2 className="mt-4 text-base font-semibold text-text-primary group-hover:text-curi-pink">
                {tool.name}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">{tool.description}</p>

              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {(tool.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {openInNewTab ? (
                <a
                  href={tool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center justify-center gap-1 text-xs font-medium text-curi-pink"
                >
                  툴 열기
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              ) : (
                <Link href={tool.url} className="mt-4 inline-flex items-center justify-center gap-1 text-xs font-medium text-curi-pink">
                  툴 열기
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </article>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 text-xs text-text-muted">
        툴 추가/수정 요청은
        {' '}
        <Link href="/documents/new" className="text-curi-pink hover:underline">
          문서로 제안
        </Link>
        {' '}
        해주세요.
      </div>
    </div>
  );
}
