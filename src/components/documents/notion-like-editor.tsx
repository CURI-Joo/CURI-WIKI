'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Bold, Italic, List, ListOrdered, Quote, Minus, Columns2, ImagePlus, Link2, Loader2, Paperclip } from 'lucide-react';
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_TYPES,
  MAX_IMAGE_SIZE,
  maxSizeFor,
} from '@/lib/upload-constraints';
import { formatFileSize } from '@/lib/utils';
import {
  renderDocumentMarkdown as markdownToEditorHtml,
  isSafeUrl, isSafeImageUrl, clampImageOffset, clampImageWidth, normalizeImageSize,
  IMAGE_WIDTH_BY_LEVEL, DEFAULT_IMAGE_SIZE_LEVEL,
  type ImageLayout,
} from '@/lib/document-markdown';
import { HighlightColorPicker } from '@/components/documents/highlight-color-picker';
import { getHighlightColor, type HighlightColor } from '@/lib/highlight-colors';
import { prepareEditorHighlights } from '@/lib/editor-highlights';
import { editorHtmlToMarkdown } from '@/lib/editor-markdown';
import { constrainImageOffset, getImageLayoutStyles, IMAGE_WRAP_GAP } from '@/lib/image-layout';

type ImageResizeMode = 'e' | 'w' | 'n' | 's' | 'ne' | 'nw' | 'se' | 'sw';

const IMAGE_RESIZE_EDGE_THRESHOLD = 24;
const IMAGE_WRAP_DEFAULT_WIDTH = 360;

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

function getImageContainerWidth(figure: HTMLElement) {
  const parent = figure.parentElement;
  if (!parent) return 0;
  const style = window.getComputedStyle(parent);
  return Math.max(0, parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
}

function getImageMaxWidth(figure: HTMLElement) {
  const gap = figure.dataset.wrap === 'true' && figure.dataset.align !== 'center' ? IMAGE_WRAP_GAP : 0;
  return Math.max(1, Math.floor(getImageContainerWidth(figure) - gap));
}

function getConstrainedImageOffset(figure: HTMLElement, offset: number, width = figure.getBoundingClientRect().width) {
  if (figure.dataset.wrap === 'true') return 0;
  // Metadata uses whole pixels; round toward the center to stay within fractional layout bounds.
  return Math.trunc(constrainImageOffset(
    clampImageOffset(offset), getImageContainerWidth(figure), width,
    (figure.dataset.align as ImageLayout | undefined) ?? 'center',
  ));
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
  Object.assign(figure.style, getImageLayoutStyles({ layout: align, width: widthPx, offset, wrap }));
  figure.style.maxWidth = '100%';
  figure.style.marginTop = '16px';
  figure.style.marginBottom = '16px';
  figure.style.transition = 'none';
  if (figure.dataset.dragging === 'true') {
    figure.style.cursor = 'grabbing';
  } else if ((resizing || resizeMode) && resizeMode) {
    figure.style.cursor = getResizeCursor(resizeMode);
  } else {
    figure.style.cursor = 'grab';
  }

  const img = figure.querySelector('img');
  if (img) {
    img.style.display = 'block';
    img.style.borderRadius = '8px';
    img.style.background = 'var(--background)';
    img.style.maxHeight = '560px';
    img.style.maxWidth = '100%';
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.objectFit = 'contain';
    img.style.border = '1px solid var(--border)';
    img.style.outline = selected ? '2px solid var(--curi-pink)' : '';
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
    (figcaption as HTMLElement).style.color = 'var(--text-muted)';
    (figcaption as HTMLElement).style.textAlign = 'center';
  }
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
  const markdownRef = useRef<string | null>(null);
  const [uploadingKind, setUploadingKind] = useState<'image' | 'file' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const renderedHtml = useMemo(() => markdownToEditorHtml(value), [value]);

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;

    const contentChanged = markdownRef.current !== value;
    if (contentChanged) {
      root.innerHTML = renderedHtml;
      prepareEditorHighlights(root);
      activeImageFigureRef.current = null;
      ensureTrailingParagraph(root);
      markdownRef.current = value;
    }
    root.querySelectorAll('figure[data-kind="image"]').forEach((figure) => {
      if (contentChanged) (figure as HTMLElement).dataset.selected = 'false';
      applyImageFigureStyle(figure as HTMLElement);
    });
  }, [renderedHtml, value]);

  useEffect(() => {
    return () => {
      document.body.style.userSelect = '';
    };
  }, []);

  useEffect(() => {
    editorRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((input) => {
      input.disabled = !!disabled;
    });
  }, [disabled, renderedHtml]);

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
        const nextWidth = Math.min(
          Math.round(clampImageWidth(resizeState.startWidth + resizeDelta)),
          getImageMaxWidth(resizeState.figure),
        );

        if (nextWidth !== Number(resizeState.figure.dataset.width ?? '0')) {
          resizeState.figure.dataset.width = `${nextWidth}`;
          resizeState.figure.dataset.offset = `${getConstrainedImageOffset(
            resizeState.figure, Number(resizeState.figure.dataset.offset) || 0, nextWidth,
          )}`;
          resizeState.moved = true;
          applyImageFigureStyle(resizeState.figure);
        }
        return;
      }

      const dragState = dragStateRef.current;
      if (!dragState) return;

      const deltaX = event.clientX - dragState.startX;
      const nextOffset = getConstrainedImageOffset(dragState.figure, dragState.startOffset + deltaX);
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
    if (insertTrailingParagraph) {
      let block: Node = range.startContainer;
      while (block.parentNode && block.parentNode !== root) block = block.parentNode;
      if (block instanceof HTMLElement && block.parentNode === root) {
        // Split a text paragraph at the caret; insert media after other whole blocks.
        if (/^(P|H[1-6])$/.test(block.tagName)) {
          const tail = range.cloneRange();
          tail.setEndAfter(block.lastChild ?? block);
          const paragraph = document.createElement('p');
          paragraph.append(tail.extractContents());
          block.after(node, paragraph);
          placeCaretAtParagraphStart(paragraph);
          emitChange();
          return;
        }
        block.after(node);
      } else {
        range.insertNode(node);
      }
    } else {
      range.insertNode(node);
    }

    if (insertTrailingParagraph) {
      const paragraph = document.createElement('p');
      paragraph.append(document.createElement('br'));
      node.parentNode?.insertBefore(paragraph, node.nextSibling);
      placeCaretAfter(paragraph);
    } else {
      placeCaretAfter(node);
    }

    emitChange();
  }, [emitChange, placeCaretAfter, placeCaretAtParagraphStart, restoreSelection]);

  const formatText = useCallback((command: string, value?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand(command, false, value);
    saveSelection();
    emitChange();
  }, [disabled, emitChange, restoreSelection, saveSelection]);

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

  const insertHighlight = useCallback((color: HighlightColor) => {
    const root = editorRef.current;
    if (!root || disabled) return;
    const savedRange = selectionRef.current?.cloneRange();
    root.focus();
    const selection = window.getSelection();
    if (savedRange && root.contains(savedRange.commonAncestorContainer) && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    }
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setError('형광펜을 적용할 텍스트를 먼저 선택해 주세요.');
      return;
    }
    setError(null);
    document.execCommand('hiliteColor', false, getHighlightColor(color).background);
    saveSelection();
    emitChange();
  }, [disabled, emitChange, saveSelection]);

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

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) return;
    const file = Array.from(event.clipboardData.files).find((item) => ALLOWED_IMAGE_TYPES.includes(item.type));
    if (file) {
      saveSelection();
      void insertAsset(file, 'image');
      return;
    }
    const html = event.clipboardData.getData('text/html');
    if (html) {
      const pasted = new DOMParser().parseFromString(html, 'text/html');
      const markdown = editorHtmlToMarkdown(pasted.body);
      document.execCommand('insertHTML', false, markdownToEditorHtml(markdown));
    } else {
      document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
    }
    saveSelection();
    emitChange();
  }, [disabled, emitChange, insertAsset, saveSelection]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || event.nativeEvent.isComposing) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      saveSelection();
      insertLink();
      return;
    }
    if (event.key !== 'Tab') return;
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    const cell = (node instanceof Element ? node : node?.parentElement)?.closest('td, th');
    const table = cell?.closest('table');
    if (!cell || !table) return;
    const cells = Array.from(table.querySelectorAll('td, th'));
    const index = cells.indexOf(cell);
    let next = cells[index + (event.shiftKey ? -1 : 1)];
    if (!next && !event.shiftKey) {
      const row = table.insertRow();
      const count = (cell.parentElement as HTMLTableRowElement).cells.length;
      for (let i = 0; i < count; i++) row.insertCell().append(document.createElement('br'));
      next = row.cells[0];
      emitChange();
    }
    if (next) {
      event.preventDefault();
      placeCaretAtParagraphStart(next as HTMLElement);
    }
  }, [disabled, emitChange, insertLink, placeCaretAtParagraphStart, saveSelection]);

  const handleEditorMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const figure = target.closest('figure[data-kind="image"]') as HTMLElement | null;
    if (!figure || target.closest('figcaption')) {
      setActiveImageFigure(null);
      return;
    }

    setActiveImageFigure(figure);

    const image = figure.querySelector('img');
    if (!(image instanceof HTMLImageElement) || disabled) return;

    const resizeMode = getResizeModeFromPointer(image.getBoundingClientRect(), event.clientX, event.clientY);
    event.preventDefault();

    if (resizeMode) {
      const currentWidth = Math.min(Math.round(image.getBoundingClientRect().width), getImageMaxWidth(figure));
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
    if (figure.dataset.wrap === 'true') return;
    const currentOffset = getConstrainedImageOffset(figure, Number(figure.dataset.offset ?? '0') || 0);
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
      <div role="toolbar" aria-label="본문 서식" className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        <select
          aria-label="문단 스타일"
          defaultValue=""
          disabled={disabled}
          onFocus={saveSelection}
          onChange={(event) => {
            formatText('formatBlock', event.target.value);
            event.target.value = '';
          }}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-text-secondary"
        >
          <option value="" disabled>문단 스타일</option>
          <option value="p">본문</option>
          <option value="h1">제목 1</option>
          <option value="h2">제목 2</option>
          <option value="h3">제목 3</option>
        </select>
        {[
          { label: '굵게', icon: Bold, command: 'bold' },
          { label: '기울임', icon: Italic, command: 'italic' },
          { label: '글머리 목록', icon: List, command: 'insertUnorderedList' },
          { label: '번호 목록', icon: ListOrdered, command: 'insertOrderedList' },
          { label: '인용문', icon: Quote, command: 'formatBlock', value: 'blockquote' },
          { label: '구분선', icon: Minus, command: 'insertHorizontalRule' },
        ].map(({ label, icon: Icon, command, value }) => (
          <button key={label} type="button" title={label} aria-label={label}
            onMouseDown={handleToolbarMouseDown} onClick={() => formatText(command, value)} disabled={disabled}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border text-text-secondary hover:bg-surface-elevated disabled:opacity-50"
          ><Icon className="h-4 w-4" /></button>
        ))}
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
        <HighlightColorPicker onBeforeOpen={saveSelection} onSelect={insertHighlight} disabled={disabled} />
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
        role="textbox"
        aria-label="문서 본문"
        aria-multiline="true"
        aria-disabled={!!disabled}
        onInput={handleInput}
        onChange={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a')) event.preventDefault();
        }}
        onMouseDown={handleEditorMouseDown}
        onMouseMove={handleEditorMouseMove}
        onMouseUp={() => {
          handleEditorMouseUp();
          saveSelection();
        }}
        onKeyUp={saveSelection}
        onFocus={saveSelection}
        data-placeholder={placeholder}
        className="notion-like-editor prose-curi min-h-[360px] rounded-xl border border-border bg-surface p-6 md:p-8 focus:outline-none focus:border-curi-pink/50"
      />

      {error && <p className="text-xs text-error">{error}</p>}

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
