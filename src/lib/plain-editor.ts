/**
 * Markdown을 모르는 사용자도 편하게 작성할 수 있도록
 * 간단한 양방향 변환을 제공합니다.
 */

export function markdownToPlainText(markdown: string): string {
  if (!markdown) return '';

  return markdown
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt: string) => `🖼️ ${alt || '이미지'}`)
    .replace(/\[📎\s+([^\]]+)\]\(([^)]+)\)/g, (_, label: string) => `📎 ${label}`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^-\s\[(x| )\]\s+/gim, (_m, checked: string) => (checked.toLowerCase() === 'x' ? '☑ ' : '☐ '))
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function plainTextToMarkdown(plainText: string): string {
  if (!plainText) return '';

  return plainText
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

