import TurndownService from 'turndown';
import { getHighlightColor, highlightedMarkdown } from '@/lib/highlight-colors';
import { normalizeHighlightsForMarkdown } from '@/lib/editor-highlights';
import { normalizeTextColorsForMarkdown } from '@/lib/editor-text-colors';
import { getTextColor, textColorMarkdown } from '@/lib/text-colors';
import { originalImageUrl } from '@/lib/image-preview';
import { isSafeVideoUrl, videoMarkdown } from '@/lib/document-video';
import {
  clampImageOffset, clampImageWidth, DEFAULT_IMAGE_SIZE_LEVEL,
  IMAGE_WIDTH_BY_LEVEL, isSafeImageUrl, isSafeUrl, normalizeImageSize,
} from '@/lib/document-markdown';

function destination(url: string) {
  return /[\s()<>]/.test(url) ? `<${url.replace(/</g, '%3C').replace(/>/g, '%3E')}>` : url;
}

function codeText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node.nodeName === 'BR') return '\n';
  let text = '';
  for (const child of Array.from(node.childNodes)) {
    const block = child.nodeName === 'DIV' || child.nodeName === 'P';
    if (block && text && !text.endsWith('\n')) text += '\n';
    text += codeText(child);
    if (block && child.nextSibling && !text.endsWith('\n')) text += '\n';
  }
  return text;
}

function fencedCode(node: HTMLElement) {
  const code = node.querySelector('code') ?? node;
  // contentEditable inserts BR/DIV elements on Enter, even inside a PRE.
  const text = codeText(code).replace(/\n$/, '');
  const language = code.className.match(/language-(\S+)/)?.[1] ?? '';
  const fenceLength = Math.max(3, ...Array.from(text.matchAll(/`+/g), (match) => match[0].length + 1));
  const fence = '`'.repeat(fenceLength);
  return `\n\n${fence}${language}\n${text}\n${fence}\n\n`;
}

function imageMarkdown(figure: HTMLElement) {
  const image = figure.querySelector('img');
  const src = image ? originalImageUrl(image) : '';
  if (!isSafeImageUrl(src)) return '';
  const caption = figure.querySelector('figcaption')?.textContent ?? image?.alt ?? '';
  const options: string[] = [];
  const align = figure.dataset.align ?? 'center';
  const size = normalizeImageSize(Number(figure.dataset.size));
  const width = clampImageWidth(Number(figure.dataset.width) || IMAGE_WIDTH_BY_LEVEL[size]);
  const offset = clampImageOffset(Number(figure.dataset.offset) || 0);
  if (align === 'left' || align === 'right') options.push(align);
  if (width !== IMAGE_WIDTH_BY_LEVEL[DEFAULT_IMAGE_SIZE_LEVEL]) options.push(`w${width}`);
  if (figure.dataset.wrap === 'true') options.push('wrap');
  if (offset) options.push(`x${offset}`);
  const alt = [caption.replace(/[\\\[\]]/g, '\\$&'), ...options].join('|');
  const title = image?.title ? ` "${image.title.replace(/"/g, '\\"')}"` : '';
  return `\n\n![${alt}](${destination(src)}${title})\n\n`;
}

const converter = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  hr: '---',
  blankReplacement(_content, node) {
    if (node.tagName === 'PRE') return fencedCode(node);
    return (node as HTMLElement & { isBlock: boolean }).isBlock ? '\n\n' : '';
  },
});

converter.addRule('highlight', {
  filter: 'mark',
  replacement: (content, node) => highlightedMarkdown(content, getHighlightColor(node.dataset.highlightColor).id),
});

converter.addRule('textColor', {
  filter: node => node.tagName === 'SPAN' && !!node.dataset.textColor,
  replacement: (content, node) => textColorMarkdown(content, getTextColor(node.dataset.textColor).id),
});

converter.addRule('strikethrough', {
  filter: (node) => ['DEL', 'S', 'STRIKE'].includes(node.tagName),
  replacement: (content) => `~~${content}~~`,
});

converter.addRule('wikiImage', {
  filter: (node) => node.tagName === 'FIGURE' && node.dataset.kind === 'image',
  replacement: (_content, node) => imageMarkdown(node),
});

converter.addRule('wikiVideo', {
  filter: (node) => node.tagName === 'FIGURE' && node.dataset.kind === 'video',
  replacement(_content, node) {
    const video = node.querySelector('video');
    const src = video?.dataset.originalSrc || video?.getAttribute('src') || '';
    if (!isSafeVideoUrl(src)) return '';
    const label = node.querySelector('[data-video-caption]')?.textContent || video?.getAttribute('aria-label') || '영상';
    return `\n\n${videoMarkdown(label, src)}\n\n`;
  },
});

converter.addRule('imageText', {
  filter: (node) => node.dataset.kind === 'image-text',
  replacement(content, node) {
    // Image deletion keeps the description as ordinary text and supports native Undo.
    if (!node.querySelector(':scope > figure[data-kind="image"]')) return `\n\n${content}\n\n`;
    return `\n\n:::image-text\n\n${content.trim()}\n\n:::image-text-end\n\n`;
  },
});

converter.addRule('link', {
  filter: 'a',
  replacement(content, node) {
    const href = node.getAttribute('href') ?? '';
    if (!isSafeUrl(href)) return content;
    const title = node.title && node.title !== href ? ` "${node.title.replace(/"/g, '\\"')}"` : '';
    return `[${content}](${destination(href)}${title})`;
  },
});

converter.addRule('taskCheckbox', {
  filter: (node) => node.tagName === 'INPUT' && node.getAttribute('type') === 'checkbox',
  replacement: (_content, node) => node.hasAttribute('checked') ? '[x] ' : '[ ] ',
});

converter.addRule('fencedCode', {
  filter: (node) => node.tagName === 'PRE' && !!node.querySelector('code'),
  replacement: (_content, node) => fencedCode(node),
});

converter.addRule('table', {
  filter: 'table',
  replacement(_content, node) {
    const rows = Array.from((node as HTMLTableElement).rows);
    if (!rows.length) return '';
    const width = Math.max(...rows.map((row) => row.cells.length));
    const lines = rows.map((row) => {
      const cells = Array.from({ length: width }, (_, index) => {
        const cell = row.cells[index];
        return cell ? converter.turndown(cell.innerHTML).trim()
          .replace(/\|/g, '\\|').replace(/\s*\n\s*/g, '<br>') : '';
      });
      return `| ${cells.join(' | ')} |`;
    });
    const separators = Array.from({ length: width }, (_, index) => {
      const cell = rows[0].cells[index];
      const align = cell?.getAttribute('align') || cell?.style.textAlign;
      return align === 'center' ? ':---:' : align === 'right' ? '---:' : align === 'left' ? ':---' : '---';
    });
    lines.splice(1, 0, `| ${separators.join(' | ')} |`);
    return `\n\n${lines.join('\n')}\n\n`;
  },
});

export function editorHtmlToMarkdown(root: HTMLElement): string {
  // Work on a clone so serializing cannot move the user's caret or rewrite the editor.
  const clone = root.cloneNode(true) as HTMLElement;
  normalizeHighlightsForMarkdown(clone);
  normalizeTextColorsForMarkdown(clone);
  const checkboxes = root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  clone.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((input, index) => {
    input.toggleAttribute('checked', checkboxes[index].checked);
  });
  return converter.turndown(clone);
}
