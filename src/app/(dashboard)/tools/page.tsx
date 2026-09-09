'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink, Wrench } from 'lucide-react';
import { internalTools } from '@/data/internal-tools';

function isExternalUrl(url: string) {
  return /^https?:\/\//.test(url);
}

export default function ToolsPage() {
  const teamWorkspaceTools = internalTools.filter((tool) => tool.group === 'team-workspace');
  const publicServiceTools = internalTools.filter((tool) => tool.group === 'public-service-f');

  const renderToolGrid = (tools: typeof internalTools) => (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tools.map((tool) => {
        const external = isExternalUrl(tool.url);
        const openInNewTab = tool.openInNewTab ?? external;

        const cardContent = (
          <div className="relative flex h-full min-h-[248px] flex-col rounded-2xl border border-[#e5e7eb] bg-white px-5 py-5 text-center transition-all duration-200 group-hover:-translate-y-[2px] group-hover:border-[#d5dae1] group-hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
            <ExternalLink className="absolute right-4 top-4 h-4 w-4 text-text-muted" />

            <div className="flex flex-1 flex-col items-center justify-center">
              {tool.iconSrc ? (
                <Image
                  src={tool.iconSrc}
                  alt={tool.iconAlt ?? tool.name}
                  width={64}
                  height={64}
                  className="h-16 w-16 object-contain"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center text-curi-pink">
                  <Wrench className="h-9 w-9" />
                </span>
              )}

              <h2 className="mt-4 text-base font-semibold text-text-primary group-hover:text-curi-pink">
                {tool.name}
              </h2>
              <p className="mt-1 line-clamp-2 min-h-[40px] text-sm leading-5 text-text-secondary">
                {tool.description}
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {(tool.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[#e5e7eb] bg-[#fafafa] px-2 py-0.5 text-xs text-text-secondary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );

        return (
          <article
            key={tool.id}
            className="group"
          >
            {openInNewTab ? (
              <a
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${tool.name} 열기`}
                className="block"
              >
                {cardContent}
              </a>
            ) : (
              <Link href={tool.url} aria-label={`${tool.name} 열기`} className="block">
                {cardContent}
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Team Workspace</h1>
        <p className="mt-1 text-sm text-text-secondary">
          팀원이 자주 사용하는 내부 서비스 링크를 한 곳에서 관리합니다.
        </p>
      </div>

      {renderToolGrid(teamWorkspaceTools)}

      <div>
        <h2 className="text-lg font-semibold text-text-primary">Public Service f</h2>
        <p className="mt-1 text-sm text-text-secondary">
          외부 서비스 운영 화면 바로가기를 모아둔 공간입니다.
        </p>
      </div>

      {renderToolGrid(publicServiceTools)}

      <div className="rounded-xl border border-border bg-surface p-4 text-xs text-text-muted">
        툴 추가/수정 요청은
        {' '}
        <a
          href="https://t.me/minjoo0921"
          target="_blank"
          rel="noopener noreferrer"
          className="text-curi-pink hover:underline"
        >
          joo
        </a>
        에게 문의주세요.
      </div>
    </div>
  );
}
