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

  const small = options.some((option) => option === 'small' || option === 'tiny' || option === '작게');

  return {
    label: labelPart.trim(),
    layout,
    small,
  };
}

function applyImageFigureStyle(figure: HTMLElement) {
  const align = (figure.dataset.align as ImageLayout | undefined) ?? 'center';
  const small = figure.dataset.small === 'true';

  figure.style.display = 'block';
  figure.style.width = small ? 'fit-content' : '100%';
  figure.style.maxWidth = '100%';
  figure.style.marginTop = '12px';
  figure.style.marginBottom = '12px';

  if (align === 'left') {
    figure.style.marginLeft = '0';
    figure.style.marginRight = 'auto';
  } else if (align === 'right') {
    figure.style.marginLeft = 'auto';
    figure.style.marginRight = '0';
  } else {
    figure.style.marginLeft = 'auto';
    figure.style.marginRight = 'auto';
  }

  const img = figure.querySelector('img');
  if (img) {
    img.style.display = 'block';
    img.style.borderRadius = '12px';
    img.style.background = '#f8f9fc';
    img.style.maxHeight = small ? '160px' : '560px';
    img.style.maxWidth = small ? '180px' : '100%';
    img.style.width = small ? 'auto' : '100%';
    img.style.height = 'auto';
    img.style.objectFit = 'contain';
    img.style.border = '1px solid #e8ebf2';
  }

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
      if (!isSafeUrl(src)) {
        return '<p><br></p>';
      }

      const parsedAlt = parseImageAlt(imageMatch[1] ?? '');
      const label = parsedAlt.label || '이미지';
      return `<figure data-kind="image" data-align="${parsedAlt.layout}" data-small="${parsedAlt.small ? 'true' : 'false'}"><img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" /><figcaption>${escapeHtml(label)}</figcaption></figure>`;
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
    if (!src || !isSafeUrl(src)) return '';

    const caption = element.querySelector('figcaption')?.textContent?.trim() ?? '';
    const align = (element.dataset.align as ImageLayout | undefined) ?? 'center';
    const small = element.dataset.small === 'true';
    const options: string[] = [];

    if (align !== 'center') {
      options.push(align);
    }
    if (small) {
      options.push('small');
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
      applyImageFigureStyle(figure as HTMLElement);
    });
    ensureTrailingParagraph(root);
    markdownRef.current = value;
  }, [renderedHtml, value]);

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

  const findActiveImageFigure = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    let target: Node | null = selection.getRangeAt(0).commonAncestorContainer;
    while (target && target !== editorRef.current) {
      if (target instanceof HTMLElement && target.tagName.toLowerCase() === 'figure' && target.dataset.kind === 'image') {
        return target;
      }
      target = target.parentNode;
    }

    return null;
  }, []);

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
    const figure = findActiveImageFigure();
    if (!figure) {
      setError('정렬을 바꿀 이미지를 먼저 선택해 주세요.');
      return;
    }

    const current = (figure.dataset.align as ImageLayout | undefined) ?? 'center';
    const next: ImageLayout = current === 'center' ? 'left' : current === 'left' ? 'right' : 'center';
    figure.dataset.align = next;
    applyImageFigureStyle(figure);
    emitChange();
  }, [emitChange, findActiveImageFigure]);

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
        if (!src || !isSafeUrl(src)) {
          throw new Error('이미지 URL을 생성하지 못했습니다.');
        }

        const figure = document.createElement('figure');
        figure.dataset.kind = 'image';
        figure.dataset.align = 'center';
        figure.dataset.small = 'false';

        const image = document.createElement('img');
        image.src = src;
        image.alt = getImageAlt(file.name);
        image.setAttribute('loading', 'lazy');

        const caption = document.createElement('figcaption');
        caption.textContent = getImageAlt(file.name);

        figure.append(image, caption);
        applyImageFigureStyle(figure);
        insertNodeAtCursor(figure, true);
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
  }, [documentId, insertNodeAtCursor]);

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
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
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
