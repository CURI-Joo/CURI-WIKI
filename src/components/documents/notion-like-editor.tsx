'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Columns2, Highlighter, ImagePlus, Link2, Loader2, Paperclip } from 'lucide-react';
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_TYPES,
  MAX_IMAGE_SIZE,
  maxSizeFor,
} from '@/lib/upload-constraints';
import { formatFileSize } from '@/lib/utils';

type ImageLayout = 'left' | 'center' | 'right';
type ImageSizeLevel = 1 | 2 | 3 | 4;
type ImageResizeMode = 'e' | 'w' | 'n' | 's' | 'ne' | 'nw' | 'se' | 'sw';

const IMAGE_WIDTH_BY_LEVEL: Record<ImageSizeLevel, number> = {
  1: 180,
  2: 320,
  3: 520,
  4: 900,
};

const DEFAULT_IMAGE_SIZE_LEVEL: ImageSizeLevel = 4;
const IMAGE_OFFSET_LIMIT = 280;
const IMAGE_MIN_WIDTH = 120;
const IMAGE_MAX_WIDTH = 1100;
const IMAGE_RESIZE_EDGE_THRESHOLD = 24;
const IMAGE_WRAP_DEFAULT_WIDTH = 360;

function clampImageOffset(value: number) {
  return Math.max(-IMAGE_OFFSET_LIMIT, Math.min(IMAGE_OFFSET_LIMIT, value));
}

function clampImageWidth(value: number) {
  return Math.max(IMAGE_MIN_WIDTH, Math.min(IMAGE_MAX_WIDTH, value));
}

function normalizeImageSize(value: number): ImageSizeLevel {
  if (value >= 1 && value <= 4) {
    return value as ImageSizeLevel;
  }
  return DEFAULT_IMAGE_SIZE_LEVEL;
}

function parseImageWidthOption(options: string[]) {
  const widthOption = options.find((option) => /^w\d+$/i.test(option));
  if (!widthOption) return null;
  const parsed = Number(widthOption.slice(1));
  if (!Number.isFinite(parsed)) return null;
  return clampImageWidth(parsed);
}

function getResizeModeFromPointer(rect: DOMRect, clientX: number, clientY: number): ImageResizeMode | null {
  const nearLeft = Math.abs(clientX - rect.left) <= IMAGE_RESIZE_EDGE_THRESHOLD;
  const nearRight = Math.abs(clientX - rect.right) <= IMAGE_RESIZE_EDGE_THRESHOLD;
  const nearTop = Math.abs(clientY - rect.top) <= IMAGE_RESIZE_EDGE_THRESHOLD;
  const nearBottom = Math.abs(clientY - rect.bottom) <= IMAGE_RESIZE_EDGE_THRESHOLD;

  if (nearTop && nearLeft) return 'nw';
  if (nearTop && nearRight) return 'ne';
  if (nearBottom && nearLeft) return 'sw';
  if (nearBottom && nearRight) return 'se';
  if (nearLeft) return 'w';
  if (nearRight) return 'e';
  if (nearTop) return 'n';
  if (nearBottom) return 's';
  return null;
}

function getResizeCursor(mode: ImageResizeMode) {
  switch (mode) {
    case 'e':
    case 'w':
      return 'ew-resize';
    case 'n':
    case 's':
      return 'ns-resize';
    case 'nw':
    case 'se':
      return 'nwse-resize';
    case 'ne':
    case 'sw':
      return 'nesw-resize';
    default:
      return 'grab';
  }
}

function getResizeDelta(mode: ImageResizeMode, deltaX: number, deltaY: number) {
  if (mode.length === 2) {
    const horizontal = mode.includes('e') ? deltaX : -deltaX;
    const vertical = mode.includes('s') ? deltaY : -deltaY;
    return (horizontal + vertical) / 2;
  }
  if (mode === 'e') return deltaX;
  if (mode === 'w') return -deltaX;
  if (mode === 's') return deltaY;
  return -deltaY;
}

type NotionLikeEditorProps = {
  value: string;
  onChange: (nextMarkdown: string) => void;
  documentId?: string;
  disabled?: boolean;
  placeholder?: string;
};

function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeMarkdown(input: string) {
  return input.replace(/([\\`*_[\]{}()#+\-.!>])/g, '\\$1');
}

function isSafeUrl(src: string) {
  return /^https?:\/\//i.test(src) || src.startsWith('/');
}

function isSafeImageUrl(src: string) {
  return isSafeUrl(src) || src.startsWith('data:image/');
}

function getImageAlt(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim() || 'image';
}

function getAttachmentLabel(fileName: string, fileSize: number) {
  const name = fileName
    .replace(/[\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const safeName = name || '첨부파일';

  return `${safeName} · ${formatFileSize(fileSize)}`;
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

function parseImageAlt(alt: string) {
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

function applyImageFigureStyle(figure: HTMLElement) {
  const align = (figure.dataset.align as ImageLayout | undefined) ?? 'center';
  const sizeValue = Number(figure.dataset.size ?? `${DEFAULT_IMAGE_SIZE_LEVEL}`);
  const size = normalizeImageSize(sizeValue);
  const rawWidth = Number(figure.dataset.width ?? '');
  const widthPx = Number.isFinite(rawWidth) && rawWidth > 0
    ? clampImageWidth(rawWidth)
    : IMAGE_WIDTH_BY_LEVEL[size];
  figure.dataset.width = `${widthPx}`;
  const offset = clampImageOffset(Number(figure.dataset.offset ?? '0') || 0);
  const selected = figure.dataset.selected === 'true';
  const resizing = figure.dataset.resizing === 'true';
  const resizeMode = (figure.dataset.resizeMode as ImageResizeMode | undefined) ?? null;
  const wrap = figure.dataset.wrap === 'true';

  figure.style.display = 'block';
  figure.style.position = 'relative';
  figure.style.width = `min(100%, ${widthPx}px)`;
  figure.style.maxWidth = '100%';
  figure.style.marginTop = '12px';
  figure.style.marginBottom = '12px';
  figure.style.transform = wrap ? '' : (offset === 0 ? '' : `translateX(${offset}px)`);
  figure.style.transition = figure.dataset.dragging === 'true' || resizing ? 'none' : 'transform 120ms ease';
  if (figure.dataset.dragging === 'true') {
    figure.style.cursor = 'grabbing';
  } else if ((resizing || resizeMode) && resizeMode) {
    figure.style.cursor = getResizeCursor(resizeMode);
  } else {
    figure.style.cursor = 'grab';
  }

  if (wrap && align !== 'center') {
    figure.style.float = align;
    figure.style.marginLeft = align === 'left' ? '0' : '12px';
    figure.style.marginRight = align === 'right' ? '0' : '12px';
  } else {
    figure.style.float = 'none';
    figure.style.clear = 'none';
  }

  if (!wrap && align === 'left') {
    figure.style.marginLeft = '0';
    figure.style.marginRight = 'auto';
  } else if (!wrap && align === 'right') {
    figure.style.marginLeft = 'auto';
    figure.style.marginRight = '0';
  } else if (!wrap) {
    figure.style.marginLeft = 'auto';
    figure.style.marginRight = 'auto';
  }

  const img = figure.querySelector('img');
  if (img) {
    img.style.display = 'block';
    img.style.borderRadius = '12px';
    img.style.background = '#f8f9fc';
    img.style.maxHeight = '560px';
    img.style.maxWidth = '100%';
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.objectFit = 'contain';
    img.style.border = selected ? '2px solid #f251a8' : '1px solid #e8ebf2';
    if (figure.dataset.dragging === 'true') {
      img.style.cursor = 'grabbing';
    } else if (resizing && resizeMode) {
      img.style.cursor = getResizeCursor(resizeMode);
    } else if (resizeMode) {
      img.style.cursor = getResizeCursor(resizeMode);
    } else {
      img.style.cursor = 'grab';
    }
    img.setAttribute('draggable', 'false');
  }

  Array.from(figure.querySelectorAll('[data-resize-handle]')).forEach((node) => node.remove());

  const figcaption = figure.querySelector('figcaption');
  if (figcaption) {
    (figcaption as HTMLElement).style.marginTop = '6px';
    (figcaption as HTMLElement).style.fontSize = '12px';
    (figcaption as HTMLElement).style.color = '#8f94a6';
    (figcaption as HTMLElement).style.textAlign = 'center';
  }
}

function markdownInlineToHtml(input: string) {
  let html = escapeHtml(input);

  html = html.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, (_m, bold: string) => `<strong>${bold}</strong>`);
  html = html.replace(/==([^=]+)==/g, (_m, marked: string) => `<mark>${marked}</mark>`);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => {
    const safeHref = href.trim();
    const safeLabel = label.trim() || safeHref;

    if (!isSafeUrl(safeHref)) {
      return escapeHtml(safeLabel);
    }

    if (safeLabel.startsWith('📎')) {
      return `<a data-attachment="true" href="${escapeHtml(safeHref)}">${escapeHtml(safeLabel)}</a>`;
    }

    return `<a href="${escapeHtml(safeHref)}">${escapeHtml(safeLabel)}</a>`;
  });

  return html;
}

function markdownToEditorHtml(markdown: string) {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const blocks = normalized.split(/\n{2,}/);

  if (!normalized.trim()) {
    return '<p><br></p>';
  }

  const htmlBlocks = blocks.map((rawBlock) => {
    const block = rawBlock.trim();
    if (!block) return '<p><br></p>';

    const imageMatch = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      const src = imageMatch[2].trim();
      if (!isSafeImageUrl(src)) {
        return '<p><br></p>';
      }

      const parsedAlt = parseImageAlt(imageMatch[1] ?? '');
      const label = parsedAlt.label || '이미지';
      const width = parsedAlt.width ?? IMAGE_WIDTH_BY_LEVEL[parsedAlt.size];
      return `<figure data-kind="image" data-align="${parsedAlt.layout}" data-size="${parsedAlt.size}" data-width="${width}" data-offset="${parsedAlt.offset}" data-wrap="${parsedAlt.wrap ? 'true' : 'false'}"><img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" /><figcaption>${escapeHtml(label)}</figcaption></figure>`;
    }

    const attachmentMatch = block.match(/^\[📎\s+([^\]]+)\]\(([^)]+)\)$/);
    if (attachmentMatch) {
      const href = attachmentMatch[2].trim();
      if (!isSafeUrl(href)) {
        return '<p><br></p>';
      }
      const label = attachmentMatch[1].trim() || '첨부파일';
      return `<p><a data-attachment="true" href="${escapeHtml(href)}">📎 ${escapeHtml(label)}</a></p>`;
    }

    const headingMatch = block.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const tag = `h${Math.min(level, 3)}`;
      return `<${tag}>${markdownInlineToHtml(headingMatch[2].trim())}</${tag}>`;
    }

    const lines = block.split('\n').map((line) => markdownInlineToHtml(line));
    return `<p>${lines.join('<br>')}</p>`;
  });

  return htmlBlocks.join('');
}

function serializeInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdown(node.textContent ?? '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (tag === 'br') return '\n';

  if (tag === 'mark') {
    return `==${serializeChildren(element)}==`;
  }

  if (tag === 'strong' || tag === 'b') {
    return `**${serializeChildren(element)}**`;
  }

  if (tag === 'code') {
    return `\`${serializeChildren(element)}\``;
  }

  if (tag === 'a') {
    const href = element.getAttribute('href')?.trim() ?? '';
    const label = serializeChildren(element).trim() || href;
    if (!href || !isSafeUrl(href)) return label;

    if (element.dataset.attachment === 'true' || label.startsWith('📎')) {
      const normalized = label.replace(/^📎\s*/, '').trim() || '첨부파일';
      return `[📎 ${normalized}](${href})`;
    }

    return `[${label}](${href})`;
  }

  return serializeChildren(element);
}

function serializeChildren(element: HTMLElement) {
  return Array.from(element.childNodes)
    .map((child) => serializeInline(child))
    .join('');
}

function serializeBlock(element: HTMLElement) {
  const tag = element.tagName.toLowerCase();

  if (tag === 'figure' && element.dataset.kind === 'image') {
    const image = element.querySelector('img');
    const src = image?.getAttribute('src')?.trim();
    if (!src || !isSafeImageUrl(src)) return '';

    const caption = element.querySelector('figcaption')?.textContent?.trim() ?? '';
    const align = (element.dataset.align as ImageLayout | undefined) ?? 'center';
    const sizeValue = Number(element.dataset.size ?? `${DEFAULT_IMAGE_SIZE_LEVEL}`);
    const size = normalizeImageSize(sizeValue);
    const rawWidth = Number(element.dataset.width ?? '');
    const widthPx = Number.isFinite(rawWidth) && rawWidth > 0
      ? clampImageWidth(rawWidth)
      : IMAGE_WIDTH_BY_LEVEL[size];
    const offset = clampImageOffset(Number(element.dataset.offset ?? '0') || 0);
    const wrap = element.dataset.wrap === 'true';
    const options: string[] = [];

    if (align !== 'center') {
      options.push(align);
    }
    if (widthPx !== IMAGE_WIDTH_BY_LEVEL[DEFAULT_IMAGE_SIZE_LEVEL]) {
      options.push(`w${widthPx}`);
    }
    if (wrap) {
      options.push('wrap');
    }
    if (offset !== 0) {
      options.push(`x${offset}`);
    }

    const altText = [caption || 'image', ...options].join('|');
    return `![${altText}](${src})`;
  }

  if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
    const level = Number(tag.replace('h', ''));
    const hashes = '#'.repeat(level);
    return `${hashes} ${serializeChildren(element).trim()}`;
  }

  const text = Array.from(element.childNodes)
    .map((child) => serializeInline(child))
    .join('')
    .trim();

  return text;
}

function editorHtmlToMarkdown(root: HTMLElement) {
  const blocks = Array.from(root.children)
    .map((child) => serializeBlock(child as HTMLElement))
    .filter((block) => block.length > 0);

  if (blocks.length === 0) {
    return '';
  }

  return blocks.join('\n\n');
}

function ensureTrailingParagraph(root: HTMLElement) {
  const last = root.lastElementChild;
  if (last?.tagName.toLowerCase() === 'p') return;

  const paragraph = document.createElement('p');
  paragraph.append(document.createElement('br'));
  root.append(paragraph);
}

function ensureParagraphAfterFigure(figure: HTMLElement) {
  const next = figure.nextElementSibling;
  if (next && next.tagName.toLowerCase() === 'p') {
    return next as HTMLElement;
  }

  const paragraph = document.createElement('p');
  paragraph.append(document.createElement('br'));
  figure.parentNode?.insertBefore(paragraph, figure.nextSibling);
  return paragraph;
}

export function NotionLikeEditor({
  value,
  onChange,
  documentId,
  disabled,
  placeholder = '내용을 자유롭게 작성하세요...',
}: NotionLikeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const activeImageFigureRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<{ figure: HTMLElement; startX: number; startOffset: number; moved: boolean } | null>(null);
  const resizeStateRef = useRef<{ figure: HTMLElement; mode: ImageResizeMode; startX: number; startY: number; startWidth: number; moved: boolean } | null>(null);
  const markdownRef = useRef('');
  const [uploadingKind, setUploadingKind] = useState<'image' | 'file' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const renderedHtml = useMemo(() => markdownToEditorHtml(value), [value]);

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;

    if (markdownRef.current === value) return;

    root.innerHTML = renderedHtml;
    root.querySelectorAll('figure[data-kind="image"]').forEach((figure) => {
      (figure as HTMLElement).dataset.selected = 'false';
      applyImageFigureStyle(figure as HTMLElement);
    });
    activeImageFigureRef.current = null;
    ensureTrailingParagraph(root);
    markdownRef.current = value;
  }, [renderedHtml, value]);

  useEffect(() => {
    return () => {
      document.body.style.userSelect = '';
    };
  }, []);

  const emitChange = useCallback(() => {
    const root = editorRef.current;
    if (!root) return;

    ensureTrailingParagraph(root);
    const nextMarkdown = editorHtmlToMarkdown(root);
    markdownRef.current = nextMarkdown;
    onChange(nextMarkdown);
  }, [onChange]);

  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      selectionRef.current = null;
      return;
    }

    const range = selection.getRangeAt(0);
    const root = editorRef.current;
    if (!root) return;

    if (!root.contains(range.commonAncestorContainer)) {
      selectionRef.current = null;
      return;
    }

    selectionRef.current = range.cloneRange();
  }, []);

  const restoreSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection) return;

    selection.removeAllRanges();

    if (selectionRef.current) {
      selection.addRange(selectionRef.current);
      return;
    }

    const root = editorRef.current;
    if (!root) return;

    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);
    selection.addRange(range);
  }, []);

  const placeCaretAfter = useCallback((node: Node) => {
    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    saveSelection();
  }, [saveSelection]);

  const placeCaretAtParagraphStart = useCallback((paragraph: HTMLElement) => {
    const selection = window.getSelection();
    if (!selection) return;

    let targetNode: Node = paragraph;
    let offset = 0;

    if (paragraph.firstChild && paragraph.firstChild.nodeName !== 'BR') {
      targetNode = paragraph.firstChild;
      offset = 0;
    }

    const range = document.createRange();
    range.setStart(targetNode, offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    saveSelection();
  }, [saveSelection]);

  const findActiveImageFigure = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      let target: Node | null = selection.getRangeAt(0).commonAncestorContainer;
      while (target && target !== editorRef.current) {
        if (target instanceof HTMLElement && target.tagName.toLowerCase() === 'figure' && target.dataset.kind === 'image') {
          activeImageFigureRef.current = target;
          return target;
        }
        target = target.parentNode;
      }
    }

    const fallbackFigure = activeImageFigureRef.current;
    if (fallbackFigure && editorRef.current?.contains(fallbackFigure)) {
      return fallbackFigure;
    }

    return null;
  }, []);

  const setActiveImageFigure = useCallback((figure: HTMLElement | null) => {
    const previous = activeImageFigureRef.current;
    if (previous && previous !== figure && editorRef.current?.contains(previous)) {
      previous.dataset.selected = 'false';
      previous.dataset.resizeMode = '';
      applyImageFigureStyle(previous);
    }

    if (figure && editorRef.current?.contains(figure)) {
      activeImageFigureRef.current = figure;
      figure.dataset.selected = 'true';
      applyImageFigureStyle(figure);
      return;
    }

    activeImageFigureRef.current = null;
  }, []);

  const getCurrentImageFigure = useCallback(() => {
    const active = activeImageFigureRef.current;
    if (active && editorRef.current?.contains(active)) {
      return active;
    }
    return findActiveImageFigure();
  }, [findActiveImageFigure]);

  const stopImagePointerAction = useCallback((shouldEmit = true) => {
    const dragState = dragStateRef.current;
    const resizeState = resizeStateRef.current;
    let moved = false;

    if (dragState) {
      dragState.figure.dataset.dragging = 'false';
      dragState.figure.dataset.resizeMode = '';
      applyImageFigureStyle(dragState.figure);
      moved = moved || dragState.moved;
      dragStateRef.current = null;
    }

    if (resizeState) {
      resizeState.figure.dataset.resizing = 'false';
      resizeState.figure.dataset.resizeMode = '';
      applyImageFigureStyle(resizeState.figure);
      moved = moved || resizeState.moved;
      resizeStateRef.current = null;
    }

    document.body.style.userSelect = '';

    if (shouldEmit && moved) {
      emitChange();
    }
  }, [emitChange]);

  useEffect(() => {
    const handleWindowMouseMove = (event: MouseEvent) => {
      const resizeState = resizeStateRef.current;
      if (resizeState) {
        const deltaX = event.clientX - resizeState.startX;
        const deltaY = event.clientY - resizeState.startY;
        const resizeDelta = getResizeDelta(resizeState.mode, deltaX, deltaY);
        const nextWidth = clampImageWidth(resizeState.startWidth + resizeDelta);

        if (nextWidth !== Number(resizeState.figure.dataset.width ?? '0')) {
          resizeState.figure.dataset.width = `${Math.round(nextWidth)}`;
          resizeState.moved = true;
          applyImageFigureStyle(resizeState.figure);
        }
        return;
      }

      const dragState = dragStateRef.current;
      if (!dragState) return;

      const deltaX = event.clientX - dragState.startX;
      const nextOffset = clampImageOffset(dragState.startOffset + deltaX);
      if (nextOffset !== (Number(dragState.figure.dataset.offset ?? '0') || 0)) {
        dragState.figure.dataset.offset = `${nextOffset}`;
        dragState.moved = true;
        applyImageFigureStyle(dragState.figure);
      }
    };

    const handleWindowMouseUp = () => {
      stopImagePointerAction(true);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [stopImagePointerAction]);

  const insertNodeAtCursor = useCallback((node: Node, insertTrailingParagraph = false) => {
    const root = editorRef.current;
    if (!root) return;

    root.focus();
    restoreSelection();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      root.append(node);
      if (insertTrailingParagraph) {
        const paragraph = document.createElement('p');
        paragraph.append(document.createElement('br'));
        root.append(paragraph);
        placeCaretAfter(paragraph);
      } else {
        placeCaretAfter(node);
      }
      emitChange();
      return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(node);

    if (insertTrailingParagraph) {
      const paragraph = document.createElement('p');
      paragraph.append(document.createElement('br'));
      node.parentNode?.insertBefore(paragraph, node.nextSibling);
      placeCaretAfter(paragraph);
    } else {
      placeCaretAfter(node);
    }

    emitChange();
  }, [emitChange, placeCaretAfter, restoreSelection]);

  const insertLink = useCallback(() => {
    const root = editorRef.current;
    if (!root) return;

    root.focus();
    restoreSelection();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    const label = selectedText || '링크 텍스트';
    const prompted = window.prompt('링크 URL을 입력하세요');

    if (!prompted) return;

    const href = prompted.trim();
    if (!isSafeUrl(href)) {
      setError('http(s):// 또는 / 로 시작하는 링크를 입력해 주세요.');
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.textContent = label;

    if (range.collapsed) {
      range.insertNode(anchor);
      placeCaretAfter(anchor);
    } else {
      range.deleteContents();
      range.insertNode(anchor);
      placeCaretAfter(anchor);
    }

    emitChange();
  }, [emitChange, placeCaretAfter, restoreSelection]);

  const insertHighlight = useCallback(() => {
    const root = editorRef.current;
    if (!root) return;

    root.focus();
    restoreSelection();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setError('형광펜을 적용할 텍스트를 먼저 선택해 주세요.');
      return;
    }

    const range = selection.getRangeAt(0);
    const mark = document.createElement('mark');

    try {
      range.surroundContents(mark);
      placeCaretAfter(mark);
      emitChange();
    } catch {
      const selectedText = selection.toString();
      mark.textContent = selectedText;
      range.deleteContents();
      range.insertNode(mark);
      placeCaretAfter(mark);
      emitChange();
    }
  }, [emitChange, placeCaretAfter, restoreSelection]);

  const toggleImageLayout = useCallback(() => {
    const figure = getCurrentImageFigure();
    if (!figure) {
      setError('정렬을 바꿀 이미지를 먼저 선택해 주세요.');
      return;
    }

    const current = (figure.dataset.align as ImageLayout | undefined) ?? 'center';
    const next: ImageLayout = current === 'center' ? 'left' : current === 'left' ? 'right' : 'center';
    figure.dataset.align = next;
    applyImageFigureStyle(figure);
    emitChange();
  }, [emitChange, getCurrentImageFigure]);

  const toggleImageWrap = useCallback(() => {
    const figure = getCurrentImageFigure();
    if (!figure) {
      setError('옆글 배치할 이미지를 먼저 선택해 주세요.');
      return;
    }

    const current = figure.dataset.wrap === 'true';
    figure.dataset.wrap = current ? 'false' : 'true';

    if (!current) {
      const align = (figure.dataset.align as ImageLayout | undefined) ?? 'center';
      if (align === 'center') {
        figure.dataset.align = 'left';
      }

      const currentWidth = clampImageWidth(Number(figure.dataset.width ?? `${IMAGE_WIDTH_BY_LEVEL[DEFAULT_IMAGE_SIZE_LEVEL]}`));
      if (currentWidth > IMAGE_WRAP_DEFAULT_WIDTH) {
        figure.dataset.width = `${IMAGE_WRAP_DEFAULT_WIDTH}`;
      }

      const paragraph = ensureParagraphAfterFigure(figure);
      placeCaretAtParagraphStart(paragraph);
    }

    applyImageFigureStyle(figure);
    emitChange();
  }, [emitChange, getCurrentImageFigure, placeCaretAtParagraphStart]);

  const insertAsset = useCallback(async (file: File, kind: 'image' | 'file') => {
    setError(null);

    if (kind === 'image' && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('png, jpg, webp, gif 이미지만 가능합니다.');
      return;
    }

    if (kind === 'file' && !ALLOWED_TYPES.includes(file.type)) {
      setError('허용되지 않은 파일 형식입니다.');
      return;
    }

    const maxSize = kind === 'image' ? MAX_IMAGE_SIZE : maxSizeFor(file.type);
    if (file.size > maxSize) {
      setError(`${kind === 'image' ? '이미지' : '파일'}는 ${formatFileSize(maxSize)} 이하만 가능합니다.`);
      return;
    }

    setUploadingKind(kind);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (documentId) {
        formData.append('document_id', documentId);
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || '업로드에 실패했습니다.');
      }

      if (kind === 'image') {
        const src = payload.markdown_url || (payload.attachment?.id ? `/api/upload/${payload.attachment.id}/file` : '');
        if (!src || !isSafeImageUrl(src)) {
          throw new Error('이미지 URL을 생성하지 못했습니다.');
        }

        const figure = document.createElement('figure');
        figure.dataset.kind = 'image';
        figure.dataset.align = 'center';
        figure.dataset.size = `${DEFAULT_IMAGE_SIZE_LEVEL}`;
        figure.dataset.width = `${IMAGE_WIDTH_BY_LEVEL[DEFAULT_IMAGE_SIZE_LEVEL]}`;
        figure.dataset.offset = '0';
        figure.dataset.wrap = 'false';

        const image = document.createElement('img');
        image.src = src;
        image.alt = getImageAlt(file.name);
        image.setAttribute('loading', 'lazy');

        const caption = document.createElement('figcaption');
        caption.textContent = getImageAlt(file.name);

        figure.append(image, caption);
        figure.dataset.selected = 'false';
        applyImageFigureStyle(figure);
        insertNodeAtCursor(figure, true);
        setActiveImageFigure(figure);
      } else {
        const attachmentId = payload.attachment?.id;
        if (!attachmentId) {
          throw new Error('첨부파일 식별자를 찾을 수 없습니다.');
        }

        const href = `/api/upload/${attachmentId}/file`;
        const paragraph = document.createElement('p');
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.dataset.attachment = 'true';
        anchor.textContent = `📎 ${getAttachmentLabel(file.name, file.size)}`;
        paragraph.append(anchor);
        insertNodeAtCursor(paragraph, true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다.');
    } finally {
      setUploadingKind(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  }, [documentId, insertNodeAtCursor, setActiveImageFigure]);

  const handleImageChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void insertAsset(file, 'image');
  }, [insertAsset]);

  const handleAttachmentChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void insertAsset(file, 'file');
  }, [insertAsset]);

  const handleInput = useCallback(() => {
    emitChange();
  }, [emitChange]);

  const handleEditorMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const figure = target.closest('figure[data-kind="image"]') as HTMLElement | null;
    if (!figure) {
      setActiveImageFigure(null);
      return;
    }

    setActiveImageFigure(figure);

    const image = figure.querySelector('img');
    if (!(image instanceof HTMLImageElement) || disabled) return;

    const resizeMode = getResizeModeFromPointer(image.getBoundingClientRect(), event.clientX, event.clientY);
    event.preventDefault();

    if (resizeMode) {
      const currentWidth = clampImageWidth(
        Number(figure.dataset.width ?? '0') || Math.round(image.getBoundingClientRect().width)
      );
      figure.dataset.width = `${currentWidth}`;
      figure.dataset.resizeMode = resizeMode;
      figure.dataset.resizing = 'true';
      resizeStateRef.current = {
        figure,
        mode: resizeMode,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: currentWidth,
        moved: false,
      };
      applyImageFigureStyle(figure);
      document.body.style.userSelect = 'none';
      return;
    }

    figure.dataset.resizeMode = '';
    const currentOffset = clampImageOffset(Number(figure.dataset.offset ?? '0') || 0);
    dragStateRef.current = {
      figure,
      startX: event.clientX,
      startOffset: currentOffset,
      moved: false,
    };

    figure.dataset.dragging = 'true';
    applyImageFigureStyle(figure);
    document.body.style.userSelect = 'none';
  }, [disabled, setActiveImageFigure]);

  const handleEditorMouseMove = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (dragStateRef.current || resizeStateRef.current) return;

    const target = event.target as HTMLElement;
    const figure = target.closest('figure[data-kind="image"]') as HTMLElement | null;

    if (!figure) {
      const active = activeImageFigureRef.current;
      if (active && active.dataset.resizeMode) {
        active.dataset.resizeMode = '';
        applyImageFigureStyle(active);
      }
      return;
    }

    const image = figure.querySelector('img');
    if (!(image instanceof HTMLImageElement)) return;

    const nextMode = getResizeModeFromPointer(image.getBoundingClientRect(), event.clientX, event.clientY);
    const currentMode = figure.dataset.resizeMode ?? '';
    const nextModeValue = nextMode ?? '';

    if (currentMode !== nextModeValue) {
      figure.dataset.resizeMode = nextModeValue;
      applyImageFigureStyle(figure);
    }
  }, []);

  const handleEditorMouseUp = useCallback(() => {
    stopImagePointerAction(true);
  }, [stopImagePointerAction]);

  const handleToolbarMouseDown = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    saveSelection();
  }, [saveSelection]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onMouseDown={handleToolbarMouseDown}
          onClick={() => {
            imageInputRef.current?.click();
          }}
          disabled={disabled || uploadingKind !== null}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
        >
          {uploadingKind === 'image' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          이미지
        </button>
        <button
          type="button"
          onMouseDown={handleToolbarMouseDown}
          onClick={toggleImageLayout}
          disabled={disabled}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
        >
          <Columns2 className="h-4 w-4" />
          좌우
        </button>
        <button
          type="button"
          onMouseDown={handleToolbarMouseDown}
          onClick={toggleImageWrap}
          disabled={disabled}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
        >
          옆글 배치
        </button>
        <button
          type="button"
          onMouseDown={handleToolbarMouseDown}
          onClick={insertHighlight}
          disabled={disabled}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
        >
          <Highlighter className="h-4 w-4" />
          형광펜
        </button>
        <button
          type="button"
          onMouseDown={handleToolbarMouseDown}
          onClick={insertLink}
          disabled={disabled}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
        >
          <Link2 className="h-4 w-4" />
          링크
        </button>
        <button
          type="button"
          onMouseDown={handleToolbarMouseDown}
          onClick={() => {
            attachmentInputRef.current?.click();
          }}
          disabled={disabled || uploadingKind !== null}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
        >
          {uploadingKind === 'file' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          파일
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onMouseDown={handleEditorMouseDown}
        onMouseMove={handleEditorMouseMove}
        onMouseUp={() => {
          handleEditorMouseUp();
          saveSelection();
        }}
        onKeyUp={saveSelection}
        onFocus={saveSelection}
        data-placeholder={placeholder}
        className="notion-like-editor min-h-[360px] rounded-xl border border-border bg-surface px-5 py-4 text-base leading-relaxed text-text-primary focus:outline-none focus:border-curi-pink/50"
      />

      {error && <p className="text-xs text-error">{error}</p>}

      <style jsx>{`
        .notion-like-editor:empty:before {
          content: attr(data-placeholder);
          color: #9aa0b2;
          pointer-events: none;
        }

        .notion-like-editor :global(p) {
          margin: 0;
          min-height: 1.6em;
        }

        .notion-like-editor :global(h1),
        .notion-like-editor :global(h2),
        .notion-like-editor :global(h3) {
          margin: 0.2em 0;
          font-weight: 700;
        }

        .notion-like-editor :global(a) {
          color: #4f5bcb;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        .notion-like-editor :global(mark) {
          background: #fff4a8;
          border-radius: 4px;
          padding: 0 2px;
        }

        .notion-like-editor :global(code) {
          background: #f2f4f8;
          border-radius: 4px;
          padding: 1px 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 0.9em;
        }
      `}</style>

      <input
        ref={imageInputRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        onChange={handleImageChange}
        className="hidden"
      />
      <input
        ref={attachmentInputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        onChange={handleAttachmentChange}
        className="hidden"
      />
    </div>
  );
}
