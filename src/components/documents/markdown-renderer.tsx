/* eslint-disable @next/next/no-img-element */

import type { ReactNode } from 'react';
import { Download, Paperclip } from 'lucide-react';

type InlineMatch = {
  type: 'image' | 'code' | 'bold' | 'link';
  match: RegExpMatchArray;
};

type ImageLayout = 'left' | 'center' | 'right';

type ParsedImageAlt = {
  label: string;
  small: boolean;
  layout: ImageLayout;
};

function isSafeImageSrc(src: string) {
  if (src.startsWith('/') || src.startsWith('data:image/')) return true;

  try {
    const url = new URL(src);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseImageAlt(alt: string): ParsedImageAlt {
  const raw = alt.trim();
  if (!raw) {
    return { label: '', small: false, layout: 'center' };
  }

  const [labelPart, ...optionParts] = raw.split('|');
  const options = optionParts.map((option) => option.trim().toLowerCase());

  let layout: ImageLayout = 'center';
  if (options.includes('left') || options.includes('좌')) {
    layout = 'left';
  } else if (options.includes('right') || options.includes('우')) {
    layout = 'right';
  }

  const small = options.some((option) => option === 'small' || option === 'tiny' || option === '작게');

  return {
    label: labelPart.trim(),
    small,
    layout,
  };
}

function MarkdownImage({ alt, src }: { alt: string; src: string }) {
  const safeSrc = src.trim();
  const parsedAlt = parseImageAlt(alt);

  const wrapperAlignClass = parsedAlt.layout === 'left'
    ? 'mr-auto'
    : parsedAlt.layout === 'right'
      ? 'ml-auto'
      : 'mx-auto';

  const imageClass = parsedAlt.small
    ? 'max-h-[120px] w-auto max-w-[120px] object-contain'
    : 'max-h-[560px] w-full object-contain';

  if (!isSafeImageSrc(safeSrc)) {
    return (
      <span className="text-sm text-text-muted">
        {parsedAlt.label || '이미지'}
      </span>
    );
  }

  return (
    <span className={`my-4 block w-fit max-w-full overflow-hidden rounded-lg border border-border bg-background ${wrapperAlignClass}`}>
      <img
        src={safeSrc}
        alt={parsedAlt.label}
        loading="lazy"
        className={imageClass}
      />
    </span>
  );
}

function isInlineAttachmentUrl(href: string) {
  return /^\/api\/upload\/[^/]+\/file(\?.*)?$/.test(href);
}

function MarkdownAttachment({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="my-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-elevated"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Paperclip className="h-4 w-4 shrink-0 text-text-muted" />
        <span className="truncate" title={label}>{label}</span>
      </span>
      <Download className="h-4 w-4 shrink-0 text-text-muted" />
    </a>
  );
}

export function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent = '';
  let codeBlockIndex = 0;
  let inTable = false;
  let tableRows: string[][] = [];
  let tableIndex = 0;

  const processInline = (text: string): ReactNode => {
    const parts: ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      const imageMatch = remaining.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      const codeMatch = remaining.match(/`([^`]+)`/);
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

      const matches = [
        imageMatch ? { type: 'image', match: imageMatch } : null,
        codeMatch ? { type: 'code', match: codeMatch } : null,
        boldMatch ? { type: 'bold', match: boldMatch } : null,
        linkMatch ? { type: 'link', match: linkMatch } : null,
      ]
        .filter((match): match is InlineMatch => match !== null)
        .sort((a, b) => (a.match.index ?? 0) - (b.match.index ?? 0));

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      const first = matches[0];
      const idx = first.match.index ?? 0;
      if (idx > 0) parts.push(remaining.slice(0, idx));

      if (first.type === 'image') {
        parts.push(
          <MarkdownImage
            key={key++}
            alt={first.match[1]}
            src={first.match[2]}
          />
        );
      } else if (first.type === 'code') {
        parts.push(
          <code key={key++} className="px-1.5 py-0.5 rounded bg-surface-elevated text-curi-pink text-[13px] font-mono">
            {first.match[1]}
          </code>
        );
      } else if (first.type === 'bold') {
        parts.push(
          <strong key={key++} className="font-semibold text-text-primary">
            {first.match[1]}
          </strong>
        );
      } else if (first.type === 'link') {
        const href = first.match[2];

        if (first.match[1].startsWith('📎 ') && isInlineAttachmentUrl(href)) {
          parts.push(
            <MarkdownAttachment
              key={key++}
              label={first.match[1].replace(/^📎\s+/, '').trim()}
              href={href}
            />
          );
          remaining = remaining.slice(idx + first.match[0].length);
          continue;
        }

        const isInternal = href.startsWith('/');
        parts.push(
          <a key={key++} href={href} className="text-curi-pink hover:underline" {...(!isInternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {first.match[1]}
          </a>
        );
      }

      remaining = remaining.slice(idx + first.match[0].length);
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

    const attachmentOnlyMatch = line
      .trim()
      .match(/^\[📎\s+([^\]]+)\]\((\/api\/upload\/[^)\s]+\/file(?:\?[^)\s]*)?)\)$/);
    if (attachmentOnlyMatch) {
      elements.push(
        <MarkdownAttachment
          key={`attachment-${i}`}
          label={attachmentOnlyMatch[1].trim()}
          href={attachmentOnlyMatch[2]}
        />
      );
      continue;
    }

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
