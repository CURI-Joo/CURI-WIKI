import { Marked, type Token, type Tokens } from 'marked';
import { getHighlightColor, HIGHLIGHT_COLOR_PATTERN } from '@/lib/highlight-colors';
import { getImageLayoutStyles, type ImageLayout } from '@/lib/image-layout';
import { readDriveMetadata } from '@/lib/document-drive';
import { imagePreviewUrl } from '@/lib/image-preview';
import { isSafeVideoUrl, VIDEO_LINK_TITLE } from '@/lib/document-video';

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
  return `<figure data-kind="image" data-align="${parsed.layout}" data-size="${parsed.size}" data-width="${width}" data-offset="${parsed.offset}" data-wrap="${parsed.wrap}" style="width:${style.width};float:${style.float};clear:${style.clear};margin-left:${style.marginLeft};margin-right:${style.marginRight};transform:${style.transform}"><img src="${escapeHtml(imagePreviewUrl(src))}" data-original-src="${escapeHtml(src)}" alt="${escapeHtml(parsed.label)}"${title ? ` title="${escapeHtml(title)}"` : ''} loading="lazy" decoding="async" draggable="false"><figcaption>${escapeHtml(parsed.label)}</figcaption></figure>`;
}

const highlightPattern = new RegExp(`^==([^=\\n]+)==(?:\\{(${HIGHLIGHT_COLOR_PATTERN})\\})?`);

function standaloneImage(token: Token): Tokens.Image | undefined {
  if (token.type !== 'paragraph') return;
  const inline = token.tokens?.filter((part: Token) => part.type !== 'text' || part.text.trim());
  if (inline?.length === 1 && inline[0].type === 'image') return inline[0] as Tokens.Image;
}

/** Group block tokens after lexing, so layout markers inside code stay literal code. */
function groupImageText(tokens: Token[]): Token[] {
  const result: Token[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.type === 'blockquote') token.tokens = groupImageText(token.tokens ?? []);
    if (token.type === 'list') {
      for (const item of token.items) item.tokens = groupImageText(item.tokens);
    }

    if (token.type === 'imageTextBoundary' && token.edge === 'start') {
      let end = index + 1;
      let depth = 1;
      for (; end < tokens.length; end++) {
        const boundary = tokens[end];
        if (boundary.type !== 'imageTextBoundary') continue;
        depth += boundary.edge === 'start' ? 1 : -1;
        if (!depth) break;
      }
      const first = tokens.findIndex((part, i) => i > index && i < end && part.type !== 'space');
      const image = first >= 0 ? standaloneImage(tokens[first]) : undefined;
      if (end < tokens.length && image && isSafeImageUrl(image.href)) {
        result.push({ type: 'imageText', raw: tokens.slice(index, end + 1).map(part => part.raw).join(''),
          image, tokens: groupImageText(tokens.slice(first + 1, end)) });
        index = end;
        continue;
      }
    }

    const image = standaloneImage(token);
    if (image && parseImageAlt(image.text).wrap && isSafeImageUrl(image.href)) {
      let end = index + 1;
      // Legacy wrap has no boundary. Stop at the next section, media, table or group.
      while (end < tokens.length) {
        const next = tokens[end];
        if (!['space', 'paragraph', 'list', 'blockquote'].includes(next.type)
          || 'tokens' in next && next.tokens?.some((part: Token) => part.type === 'image'
            || part.type === 'link' && part.title === VIDEO_LINK_TITLE)) break;
        end++;
      }
      result.push({ type: 'imageText', raw: tokens.slice(index, end).map(part => part.raw).join(''),
        image, tokens: groupImageText(tokens.slice(index + 1, end)) });
      index = end - 1;
      continue;
    }
    result.push(token);
  }
  return result;
}

// Both reading and editing use this parser. Raw HTML is text, never executable markup.
const markdown = new Marked({
  gfm: true,
  breaks: true,
  hooks: {
    processAllTokens(tokens) {
      // Preserve the token list's link definitions.
      tokens.splice(0, tokens.length, ...groupImageText(tokens));
      return tokens;
    },
  },
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
      if (title === VIDEO_LINK_TITLE && isSafeVideoUrl(href)) {
        const src = escapeHtml(href);
        const caption = escapeHtml(text);
        return `<figure data-kind="video" contenteditable="false"><video src="${src}" controls playsinline preload="metadata" aria-label="${caption}"></video><figcaption><span data-video-caption>${caption}</span> · <a href="${src}" target="_blank" rel="noopener noreferrer">원본 열기</a></figcaption><p data-video-error hidden>영상을 재생할 수 없습니다. 원본을 열어 확인하거나 MP4로 다시 업로드해 주세요.</p></figure>`;
      }
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
    name: 'imageTextBoundary',
    level: 'block',
    start: source => source.search(/^ {0,3}:::image-text(?:-end)?[ \t]*$/m),
    tokenizer(source) {
      const match = /^ {0,3}:::image-text(-end)?[ \t]*(?:\n|$)/.exec(source);
      if (match) return { type: 'imageTextBoundary', raw: match[0], edge: match[1] ? 'end' : 'start' };
    },
    // Invalid/incomplete groups stay visible instead of silently discarding content.
    renderer: token => `<p>${escapeHtml(token.raw.trim())}</p>\n`,
  }, {
    name: 'imageText',
    renderer(token) {
      const image = token.image as Tokens.Image;
      const parsed = parseImageAlt(image.text);
      const align = parsed.layout === 'right' ? 'right' : 'left';
      const width = parsed.width ?? IMAGE_WIDTH_BY_LEVEL[parsed.size];
      const figure = renderImage(`${image.text}|wrap`, image.href, image.title);
      return `<div data-kind="image-text" data-align="${align}" style="--image-width:${width}px">${figure}<div data-kind="image-text-body">${this.parser.parse(token.tokens ?? []) || '<p><br></p>'}</div></div>\n`;
    },
    childTokens: ['tokens'],
  }, {
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
  const html = markdown.parse(readDriveMetadata(content).body, { async: false });
  return html.replace(/(<img\b[^>]*?) loading="lazy"/, '$1 loading="eager" fetchpriority="high"');
}
