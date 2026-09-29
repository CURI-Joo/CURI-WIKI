import { Marked } from 'marked';
import { getHighlightColor, HIGHLIGHT_COLOR_PATTERN } from '@/lib/highlight-colors';
import { getImageLayoutStyles, type ImageLayout } from '@/lib/image-layout';

export type { ImageLayout } from '@/lib/image-layout';
export type ImageSizeLevel = 1 | 2 | 3 | 4;
export const IMAGE_WIDTH_BY_LEVEL: Record<ImageSizeLevel, number> = { 1: 180, 2: 320, 3: 520, 4: 900 };
export const DEFAULT_IMAGE_SIZE_LEVEL: ImageSizeLevel = 4;
export const clampImageOffset = (value: number) => Math.max(-280, Math.min(280, value));
export const clampImageWidth = (value: number) => Math.max(120, Math.min(1100, value));
export const normalizeImageSize = (value: number): ImageSizeLevel =>
  value >= 1 && value <= 4 ? value as ImageSizeLevel : DEFAULT_IMAGE_SIZE_LEVEL;

function parseImageWidthOption(options: string[]) {
  const option = options.find((value) => /^w\d+$/i.test(value));
  return option ? clampImageWidth(Number(option.slice(1))) : null;
}

export function escapeHtml(input: string) {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function isSafeUrl(src: string) {
  if (/[\u0000-\u0020\\]/.test(src)) return false;
  return /^https?:\/\//i.test(src) || /^\/(?!\/)/.test(src) || src.startsWith('#') || /^mailto:/i.test(src);
}

export function isSafeImageUrl(src: string) {
  return (/^https?:\/\//i.test(src) || /^\/(?!\/)/.test(src)) && isSafeUrl(src)
    || /^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(src);
}

function parseImageSizeOption(options: string[]): ImageSizeLevel {
  const sizeOption = options.find((option) => option.startsWith('size'));
  if (sizeOption) {
    const parsed = Number(sizeOption.replace(/[^0-9]/g, ''));
    if (parsed >= 1 && parsed <= 4) {
      return parsed as ImageSizeLevel;
    }
  }

  if (options.some((option) => option === 'small' || option === 'tiny' || option === '작게')) {
    return 1;
  }

  return DEFAULT_IMAGE_SIZE_LEVEL;
}

function parseImageOffsetOption(options: string[]) {
  const offsetOption = options.find((option) => /^x-?\d+$/i.test(option));
  if (!offsetOption) return 0;
  const parsed = Number(offsetOption.slice(1));
  if (!Number.isFinite(parsed)) return 0;
  return clampImageOffset(parsed);
}

export function parseImageAlt(alt: string) {
  const raw = alt.trim();
  const [labelPart, ...optionParts] = raw.split('|');
  const options = optionParts.map((option) => option.trim().toLowerCase());

  let layout: ImageLayout = 'center';
  if (options.includes('left') || options.includes('좌')) {
    layout = 'left';
  } else if (options.includes('right') || options.includes('우')) {
    layout = 'right';
  }

  const size = parseImageSizeOption(options);
  const width = parseImageWidthOption(options);
  const offset = parseImageOffsetOption(options);
  const wrap = options.some((option) => option === 'wrap' || option === 'flow' || option === '옆글');

  return {
    label: labelPart.trim(),
    layout,
    size,
    width,
    offset,
    wrap,
  };
}

function renderImage(alt: string, src: string, title: string | null) {
  const parsed = parseImageAlt(alt);
  if (!isSafeImageUrl(src)) return escapeHtml(parsed.label);
  const width = parsed.width ?? IMAGE_WIDTH_BY_LEVEL[parsed.size];
  const style = getImageLayoutStyles({ ...parsed, width });
  return `<figure data-kind="image" data-align="${parsed.layout}" data-size="${parsed.size}" data-width="${width}" data-offset="${parsed.offset}" data-wrap="${parsed.wrap}" style="width:${style.width};float:${style.float};clear:${style.clear};margin-left:${style.marginLeft};margin-right:${style.marginRight};transform:${style.transform}"><img src="${escapeHtml(src)}" alt="${escapeHtml(parsed.label)}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy" draggable="false"><figcaption>${escapeHtml(parsed.label)}</figcaption></figure>`;
}

const highlightPattern = new RegExp(`^==([^=\\n]+)==(?:\\{(${HIGHLIGHT_COLOR_PATTERN})\\})?`);

// Both reading and editing use this parser. Raw HTML is text, never executable markup.
const markdown = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) {
      return /^<br\s*\/?\s*>$/i.test(text) ? '<br>' : escapeHtml(text);
    },
    heading({ depth, text, tokens }) {
      const id = escapeHtml(text.toLowerCase().replace(/\s+/g, '-'));
      return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
    image({ text, href, title }) {
      return renderImage(text, href, title);
    },
    paragraph({ tokens }) {
      const content = this.parser.parseInline(tokens);
      // Figures must be siblings of paragraphs, including images embedded in a sentence.
      return `<p>${content.replace(/(<figure\b[\s\S]*?<\/figure>)/g, '</p>$1<p>')}</p>\n`
        .replace(/<p>\s*<\/p>/g, '');
    },
    link({ href, title, tokens, text }) {
      const label = this.parser.parseInline(tokens);
      if (!isSafeUrl(href)) return label;
      const attachment = text.startsWith('📎');
      const external = /^https?:\/\//i.test(href);
      return `<a href="${escapeHtml(href)}"${attachment ? ' data-attachment="true"' : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''} title="${escapeHtml(title || href)}">${label}</a>`;
    },
    checkbox({ checked }) {
      // Disabled in the reader; the editor explicitly enables these after mounting.
      return `<input type="checkbox" contenteditable="false" aria-label="할 일 완료" disabled${checked ? ' checked' : ''}> `;
    },
    table(token) {
      const cell = (value: typeof token.header[number], tag: string) =>
        `<${tag}${value.align ? ` align="${value.align}"` : ''}>${this.parser.parseInline(value.tokens)}</${tag}>`;
      return `<div data-kind="table"><table><thead><tr>${token.header.map((value) => cell(value, 'th')).join('')}</tr></thead><tbody>${token.rows.map((row) => `<tr>${row.map((value) => cell(value, 'td')).join('')}</tr>`).join('')}</tbody></table></div>\n`;
    },
  },
  extensions: [{
    name: 'highlight',
    level: 'inline',
    start: (source) => source.indexOf('=='),
    tokenizer(source) {
      const match = highlightPattern.exec(source);
      if (match) return { type: 'highlight', raw: match[0], color: match[2] ?? 'yellow', tokens: this.lexer.inlineTokens(match[1]) };
    },
    renderer(token) {
      const color = getHighlightColor(token.color);
      return `<mark data-highlight-color="${color.id}" style="background-color:${color.background}">${this.parser.parseInline(token.tokens ?? [])}</mark>`;
    },
  }],
});

export function renderDocumentMarkdown(content: string): string {
  return markdown.parse(content, { async: false });
}
