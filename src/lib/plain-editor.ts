import { HIGHLIGHT_COLOR_PATTERN } from '@/lib/highlight-colors';

const highlightPattern = new RegExp(`==([^=\\n]+)==(?:\\{(?:${HIGHLIGHT_COLOR_PATTERN})\\})?`, 'g');

/**
 * Markdown을 모르는 사용자도 편하게 작성할 수 있도록
 * 간단한 양방향 변환을 제공합니다.
 */

export function markdownToPlainText(markdown: string): string {
  if (!markdown) return '';

  return markdown
    .replace(/^ {0,3}:::image-text(?:-end)?[ \t]*$/gm, '')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '')
    .replace(/\[📎\s+([^\]]+)\]\(([^)]+)\)/g, (_, label: string) => `📎 ${label}`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(highlightPattern, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^-\s\[(x| )\]\s+/gim, (_m, checked: string) => (checked.toLowerCase() === 'x' ? '☑ ' : '☐ '))
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n');
}

export function extractMarkdownImages(markdown: string) {
  const matches = Array.from(markdown.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g));
  return matches
    .map((match) => ({
      alt: (match[1] ?? '').trim() || '이미지',
      src: (match[2] ?? '').trim(),
    }))
    .filter((item) => item.src.length > 0);
}

export function plainTextToMarkdown(plainText: string): string {
  if (!plainText) return '';

  return plainText
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

export function buildSummaryFromMarkdown(markdown: string): string {
  const plainText = markdownToPlainText(markdown)
    .replace(/\s+/g, ' ')
    .trim();

  if (!plainText) return '요약 없음';
  return plainText.slice(0, 160);
}
