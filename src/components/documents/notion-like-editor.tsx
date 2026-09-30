'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Bold, Italic, List, ListOrdered, Quote, Minus, ImagePlus, Video, Link2, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
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
import { TextColorPicker } from '@/components/documents/text-color-picker';
import { getTextColor, type TextColor } from '@/lib/text-colors';
import { prepareEditorTextColors } from '@/lib/editor-text-colors';
import { getHighlightColor, type HighlightColor } from '@/lib/highlight-colors';
import { prepareEditorHighlights } from '@/lib/editor-highlights';
import { imageAtDeletePosition } from '@/lib/editor-image-deletion';
import { editorHtmlToMarkdown } from '@/lib/editor-markdown';
import { showVideoError, videoMarkdown } from '@/lib/document-video';
import { uploadVideo } from '@/lib/upload-video';
import { constrainImageOffset, getImageLayoutStyles } from '@/lib/image-layout';
import { continueBelowImageText, createImageTextGroup, emptyParagraph, imageWritingContext, IMAGE_TEXT_SELECTOR, IMAGE_TEXT_BODY_SELECTOR } from '@/lib/editor-image-text';

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
  onUploadingChange?: (uploading: boolean) => void;
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
  const width = getImageContainerWidth(figure);
  const group = figure.parentElement?.matches(IMAGE_TEXT_SELECTOR);
  const prose = figure.closest<HTMLElement>('.prose-curi');
  const style = prose && window.getComputedStyle(prose);
  const proseWidth = prose && style
    ? prose.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) : width;
  const stacked = proseWidth <= 560;
  return Math.max(1, Math.floor(group && !stacked ? width / 2 : width));
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
  const group = figure.parentElement?.matches(IMAGE_TEXT_SELECTOR) ? figure.parentElement : null;
  if (group) {
    group.dataset.align = align === 'right' ? 'right' : 'left';
    group.style.setProperty('--image-width', `${widthPx}px`);
  }

  figure.style.display = 'block';
  figure.style.position = 'relative';
  Object.assign(figure.style, getImageLayoutStyles({ layout: align, width: widthPx, offset, wrap }));
  figure.style.maxWidth = '100%';
  figure.style.marginTop = group ? '0px' : '16px';
  figure.style.marginBottom = group ? '0px' : '16px';
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

export function NotionLikeEditor({
  value,
  onChange,
  documentId,
  disabled,
  placeholder = '내용을 자유롭게 작성하세요...',
  onUploadingChange,
}: NotionLikeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const activeImageFigureRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<{ figure: HTMLElement; startX: number; startLeft: number; moved: boolean } | null>(null);
  const resizeStateRef = useRef<{ figure: HTMLElement; mode: ImageResizeMode; startX: number; startY: number; startWidth: number; moved: boolean } | null>(null);
  const markdownRef = useRef<string | null>(null);
  const localImageUrls = useRef(new Set<string>());
  const [uploadingKind, setUploadingKind] = useState<'image' | 'video' | 'file' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageMenu, setImageMenu] = useState<{ figure: HTMLElement; x: number; y: number } | null>(null);
  const [writingBesideImage, setWritingBesideImage] = useState(false);

  const renderedHtml = useMemo(() => markdownToEditorHtml(value), [value]);

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;

    const contentChanged = markdownRef.current !== value;
    if (contentChanged) {
      root.innerHTML = renderedHtml;
      prepareEditorHighlights(root);
      prepareEditorTextColors(root);
      activeImageFigureRef.current = null;
      ensureTrailingParagraph(root);
      markdownRef.current = value;
    }
    root.querySelectorAll('figure[data-kind="image"]').forEach((figure) => {
      if (contentChanged) (figure as HTMLElement).dataset.selected = 'false';
      applyImageFigureStyle(figure as HTMLElement);
    });
    root.querySelectorAll('figure[data-kind="video"]').forEach(figure => {
      if (figure.querySelector('[data-video-delete]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.videoDelete = 'true';
      button.textContent = '영상 삭제';
      figure.append(button);
    });
  }, [renderedHtml, value]);

  useEffect(() => {
    const urls = localImageUrls.current;
    return () => {
      document.body.style.userSelect = '';
      urls.forEach(url => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  useEffect(() => {
    if (!imageMenu) return;
    const close = () => setImageMenu(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [imageMenu]);

  useEffect(() => {
    editorRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((input) => {
      input.disabled = !!disabled;
    });
  }, [disabled, renderedHtml]);

  const emitChange = useCallback(() => {
    const root = editorRef.current;
    if (!root) return;

    ensureTrailingParagraph(root);
    prepareEditorTextColors(root);
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
    setWritingBesideImage(imageWritingContext(root, range).beside);
  }, []);

  useEffect(() => {
    const syncSelection = () => {
      const selection = window.getSelection();
      if (selection?.rangeCount && editorRef.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) saveSelection();
    };
    document.addEventListener('selectionchange', syncSelection);
    return () => document.removeEventListener('selectionchange', syncSelection);
  }, [saveSelection]);

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
        if (target instanceof HTMLElement && target.matches(IMAGE_TEXT_SELECTOR)) {
          return target.querySelector<HTMLElement>(':scope > figure[data-kind="image"]');
        }
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

  const selectImageFigure = useCallback((figure: HTMLElement) => {
    editorRef.current?.focus({ preventScroll: true });
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNode(figure);
    selection?.removeAllRanges();
    selection?.addRange(range);
    saveSelection();
  }, [saveSelection]);

  const deleteImageFigure = useCallback((figure: HTMLElement) => {
    if (disabled || !editorRef.current?.contains(figure)) return;
    stopImagePointerAction(false);
    setActiveImageFigure(null);
    setImageMenu(null);
    selectImageFigure(figure);
    // Keep image + caption deletion in the browser's native Undo history.
    if (!document.execCommand('delete')) window.getSelection()?.getRangeAt(0).deleteContents();
    emitChange();
    saveSelection();
  }, [disabled, emitChange, saveSelection, selectImageFigure, setActiveImageFigure, stopImagePointerAction]);

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
      if (Math.abs(deltaX) < 6 && !dragState.moved) return;
      const figure = dragState.figure;
      const group = figure.closest<HTMLElement>(IMAGE_TEXT_SELECTOR);
      let align: ImageLayout;
      let offset = 0;
      if (group) {
        const rect = group.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        if (Math.abs(event.clientX - center) < 16) return;
        align = event.clientX > center ? 'right' : 'left';
      } else {
        const space = Math.max(0, getImageContainerWidth(figure) - figure.getBoundingClientRect().width);
        const left = Math.max(0, Math.min(space, dragState.startLeft + deltaX));
        // Use the nearest alignment anchor so dragging can reach either edge even
        // when the persisted offset is limited, while following the pointer smoothly.
        align = space === 0 ? 'center' : left < space / 4 ? 'left' : left > space * 3 / 4 ? 'right' : 'center';
        const origin = align === 'left' ? 0 : align === 'right' ? space : space / 2;
        offset = Math.trunc(left - origin);
      }
      if (align !== figure.dataset.align || offset !== (Number(figure.dataset.offset) || 0)) {
        figure.dataset.align = align;
        figure.dataset.offset = `${offset}`;
        dragState.moved = true;
        applyImageFigureStyle(figure);
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

  const insertTextColor = useCallback((color: TextColor) => {
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
      setError('글자색을 바꿀 텍스트를 먼저 선택해 주세요.');
      return;
    }
    setError(null);
    document.execCommand('styleWithCSS', false, 'true');
    try {
      document.execCommand('foreColor', false, getTextColor(color).color);
    } finally {
      document.execCommand('styleWithCSS', false, 'false');
    }
    saveSelection();
    emitChange();
  }, [disabled, emitChange, saveSelection]);

  const continueBelowImage = useCallback(() => {
    const root = editorRef.current;
    if (disabled || !root) return;
    const selection = window.getSelection();
    const range = selection?.rangeCount && root.contains(selection.getRangeAt(0).commonAncestorContainer)
      ? selection.getRangeAt(0) : selectionRef.current;
    const anchor = range?.startContainer;
    const element = anchor instanceof Element ? anchor : anchor?.parentElement;
    const group = element?.closest<HTMLElement>(IMAGE_TEXT_SELECTOR)
      ?? getCurrentImageFigure()?.closest<HTMLElement>(IMAGE_TEXT_SELECTOR);
    if (!group || !editorRef.current?.contains(group)) {
      setError('옆글 영역에 커서를 놓거나 이미지를 선택해 주세요.');
      return;
    }
    const paragraph = continueBelowImageText(group, range);
    setActiveImageFigure(null);
    editorRef.current.focus({ preventScroll: true });
    placeCaretAtParagraphStart(paragraph);
    setError(null);
    emitChange();
  }, [disabled, emitChange, getCurrentImageFigure, placeCaretAtParagraphStart, setActiveImageFigure]);

  const toggleSideWriting = useCallback(() => {
    const root = editorRef.current;
    if (disabled || !root) return;
    const selection = window.getSelection();
    const range = selection?.rangeCount && root.contains(selection.getRangeAt(0).commonAncestorContainer)
      ? selection.getRangeAt(0) : selectionRef.current;
    const context = imageWritingContext(root, range);
    if (context.beside) {
      continueBelowImage();
      return;
    }
    const figure = context.figure ?? getCurrentImageFigure();
    if (!figure) {
      setError('옆에 글을 쓸 이미지를 먼저 선택해 주세요.');
      return;
    }
    let group = figure.closest<HTMLElement>(IMAGE_TEXT_SELECTOR);
    if (!group) {
      if (figure.dataset.align === 'center') figure.dataset.align = 'left';
      figure.dataset.width = `${Math.min(Number(figure.dataset.width) || IMAGE_WRAP_DEFAULT_WIDTH, IMAGE_WRAP_DEFAULT_WIDTH)}`;
      group = createImageTextGroup(figure).group;
    }
    const body = group.querySelector<HTMLElement>(`:scope > ${IMAGE_TEXT_BODY_SELECTOR}`)!;
    let paragraph = body.lastElementChild as HTMLElement | null;
    if (!paragraph || paragraph.tagName !== 'P') {
      paragraph = emptyParagraph();
      body.append(paragraph);
    }
    root.focus({ preventScroll: true });
    const next = document.createRange();
    next.selectNodeContents(paragraph);
    next.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(next);
    setActiveImageFigure(null);
    applyImageFigureStyle(figure);
    saveSelection();
    setError(null);
    emitChange();
  }, [continueBelowImage, disabled, emitChange, getCurrentImageFigure, saveSelection, setActiveImageFigure]);

  const insertAsset = useCallback(async (file: File, kind: 'image' | 'video' | 'file') => {
    if (uploadingKind || disabled) return;
    if (file.type.startsWith('video/')) kind = 'video';
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
    setUploadProgress(0);
    onUploadingChange?.(true);

    try {
      if (kind === 'video') {
        const payload = await uploadVideo(file, documentId, setUploadProgress);
        const container = document.createElement('div');
        container.innerHTML = markdownToEditorHtml(videoMarkdown(file.name, payload.markdown_url));
        const figure = container.querySelector<HTMLElement>('figure[data-kind="video"]');
        if (!figure) throw new Error('영상 재생 화면을 만들지 못했습니다.');
        const video = figure.querySelector('video')!;
        const localUrl = URL.createObjectURL(file);
        localImageUrls.current.add(localUrl);
        video.dataset.originalSrc = payload.markdown_url;
        video.src = localUrl;
        insertNodeAtCursor(figure, true);
        return;
      }
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
        const localUrl = URL.createObjectURL(file);
        localImageUrls.current.add(localUrl);
        image.src = localUrl;
        image.dataset.originalSrc = src;
        image.alt = getImageAlt(file.name);
        image.decoding = 'async';

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
      onUploadingChange?.(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  }, [disabled, documentId, insertNodeAtCursor, onUploadingChange, setActiveImageFigure, uploadingKind]);

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
    const file = Array.from(event.clipboardData.files).find((item) => ALLOWED_IMAGE_TYPES.includes(item.type) || ALLOWED_VIDEO_TYPES.includes(item.type));
    if (file) {
      saveSelection();
      void insertAsset(file, file.type.startsWith('video/') ? 'video' : 'image');
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
    if (event.key === 'Enter' && !event.shiftKey) {
      const selection = window.getSelection();
      const node = selection?.anchorNode;
      const element = node instanceof Element ? node : node?.parentElement;
      const paragraph = element?.closest('p');
      const body = paragraph?.parentElement;
      if (selection?.isCollapsed && paragraph && body?.matches(IMAGE_TEXT_BODY_SELECTOR)
        && paragraph === body.lastElementChild && !paragraph.textContent?.trim()) {
        event.preventDefault();
        continueBelowImage();
        return;
      }
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      const root = editorRef.current;
      const selection = window.getSelection();
      const figure = root && selection?.rangeCount
        ? imageAtDeletePosition(root, selection.getRangeAt(0), event.key === 'Backspace') : null;
      if (figure && selection) {
        event.preventDefault();
        deleteImageFigure(figure);
        return;
      }
    }
    if (/^(Arrow|Home$|End$)/.test(event.key)) setActiveImageFigure(null);
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
  }, [continueBelowImage, deleteImageFigure, disabled, emitChange, insertLink, placeCaretAtParagraphStart, saveSelection, setActiveImageFigure]);

  const handleEditorMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
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
    // Drag handling prevents the browser's default focus/selection, so set both explicitly.
    selectImageFigure(figure);

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
    const parent = figure.parentElement!;
    const parentStyle = window.getComputedStyle(parent);
    const contentLeft = parent.getBoundingClientRect().left + parent.clientLeft + parseFloat(parentStyle.paddingLeft);
    dragStateRef.current = {
      figure,
      startX: event.clientX,
      startLeft: figure.getBoundingClientRect().left - contentLeft,
      moved: false,
    };

    figure.dataset.dragging = 'true';
    applyImageFigureStyle(figure);
    document.body.style.userSelect = 'none';
  }, [disabled, selectImageFigure, setActiveImageFigure]);

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
        <button type="button" onMouseDown={handleToolbarMouseDown} onClick={() => videoInputRef.current?.click()}
          disabled={disabled || uploadingKind !== null} title="MP4·WebM·MOV · 최대 50MB"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50">
          {uploadingKind === 'video' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />} 영상
        </button>
        <button
          type="button"
          onMouseDown={handleToolbarMouseDown}
          onClick={toggleSideWriting}
          aria-pressed={writingBesideImage}
          disabled={disabled}
          className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${writingBesideImage ? 'border-curi-pink bg-curi-pink-soft text-curi-pink' : 'border-border text-text-secondary hover:bg-surface-elevated hover:text-text-primary'}`}
        >
          옆글쓰기
        </button>
        <HighlightColorPicker onBeforeOpen={saveSelection} onSelect={insertHighlight} disabled={disabled} />
        <TextColorPicker onBeforeOpen={saveSelection} onSelect={insertTextColor} disabled={disabled} />
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
        onErrorCapture={event => showVideoError(event.target)}
        onChange={handleInput}
        onPaste={handlePaste}
        onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault(); }}
        onDrop={(event) => {
          const file = Array.from(event.dataTransfer.files).find(file => ALLOWED_IMAGE_TYPES.includes(file.type) || ALLOWED_VIDEO_TYPES.includes(file.type));
          if (!file) return;
          event.preventDefault();
          saveSelection();
          void insertAsset(file, file.type.startsWith('video/') ? 'video' : 'image');
        }}
        onKeyDown={handleKeyDown}
        onClick={(event) => {
          const deleteButton = (event.target as HTMLElement).closest('[data-video-delete]');
          const videoFigure = deleteButton?.closest<HTMLElement>('figure[data-kind="video"]');
          if (videoFigure) { event.preventDefault(); deleteImageFigure(videoFigure); }
          if ((event.target as HTMLElement).closest('a') && !(event.target as HTMLElement).closest('figure[data-kind="video"]')) event.preventDefault();
        }}
        onMouseDown={handleEditorMouseDown}
        onContextMenu={(event) => {
          const figure = (event.target as HTMLElement).closest('figure[data-kind="image"], figure[data-kind="video"]') as HTMLElement | null;
          if (!figure || disabled || (event.target as HTMLElement).closest('figcaption')) return;
          event.preventDefault();
          stopImagePointerAction(false);
          selectImageFigure(figure);
          if (figure.dataset.kind === 'image') setActiveImageFigure(figure);
          setImageMenu({ figure, x: event.clientX, y: event.clientY });
        }}
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

      <DropdownMenu open={imageMenu !== null} onOpenChange={(open) => { if (!open) setImageMenu(null); }} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button" tabIndex={-1} aria-hidden="true"
            className="pointer-events-none fixed h-px w-px opacity-0"
            style={{ left: imageMenu?.x ?? 0, top: imageMenu?.y ?? 0 }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          aria-label={imageMenu?.figure.dataset.kind === 'video' ? '영상 메뉴' : '이미지 메뉴'} align="start" collisionPadding={8}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={() => {
            if (imageMenu && editorRef.current?.contains(imageMenu.figure)) selectImageFigure(imageMenu.figure);
          }}
        >
          <DropdownMenuItem
            disabled={disabled} className="gap-2 text-error focus:text-error"
            onSelect={() => { if (imageMenu) deleteImageFigure(imageMenu.figure); }}
          >
            <Trash2 className="h-4 w-4" /> {imageMenu?.figure.dataset.kind === 'video' ? '영상 삭제' : '이미지 삭제'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {error && <p className="text-xs text-error">{error}</p>}
      {uploadingKind === 'video' && <p role="status" className="text-xs text-text-secondary">영상 업로드 중 {uploadProgress}%</p>}

      <input ref={videoInputRef} type="file" accept={ALLOWED_VIDEO_TYPES.join(',')} className="hidden"
        onChange={event => { const file = event.target.files?.[0]; if (file) void insertAsset(file, 'video'); }} />
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
