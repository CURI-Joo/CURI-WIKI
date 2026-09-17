'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react';
import { Columns2, Highlighter, ImagePlus, Link2, Loader2, Paperclip } from 'lucide-react';
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_TYPES,
  MAX_IMAGE_SIZE,
  maxSizeFor,
} from '@/lib/upload-constraints';
import { formatFileSize } from '@/lib/utils';

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

function insertAtCursor(
  content: string,
  start: number,
  end: number,
  markdown: string
) {
  const safeStart = Math.min(start, content.length);
  const safeEnd = Math.min(end, content.length);
  const before = content.slice(0, safeStart);
  const after = content.slice(safeEnd);
  const leadingNewline = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
  const trailingNewline = after.startsWith('\n') ? '' : '\n';
  const insertion = `${leadingNewline}${markdown}${trailingNewline}`;

  return {
    nextContent: `${before}${insertion}${after}`,
    nextCursor: before.length + insertion.length,
  };
}

function buildMediaLayoutTemplate() {
  return [
    '| 미디어 | 설명 |',
    '| --- | --- |',
    '| ![회사 아이콘|small|left](/curi-logo.png) | [회사 아이콘 파일 다운로드](/curi-logo.png) |',
  ].join('\n');
}

interface MarkdownImageUploadButtonProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  content: string;
  onContentChange: Dispatch<SetStateAction<string>>;
  documentId?: string;
  disabled?: boolean;
}

export function MarkdownImageUploadButton({
  textareaRef,
  content,
  onContentChange,
  documentId,
  disabled,
}: MarkdownImageUploadButtonProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingKind, setUploadingKind] = useState<'image' | 'file' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const insertLink = useCallback((rawUrl?: string | null) => {
    setError(null);

    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectionStart = textarea.selectionStart ?? content.length;
    const selectionEnd = textarea.selectionEnd ?? content.length;
    const selectedText = content.slice(selectionStart, selectionEnd).trim();
    const label = selectedText || '링크 텍스트';

    const prompted = rawUrl ?? window.prompt('링크 URL을 입력하세요');
    if (!prompted) return;

    const href = prompted.trim();
    if (!/^https?:\/\//i.test(href) && !href.startsWith('/')) {
      setError('http(s):// 또는 / 로 시작하는 링크를 입력해 주세요.');
      return;
    }

    const markdown = `[${label}](${href})`;
    const nextCursor = selectionStart + markdown.length;

    onContentChange((currentContent) => {
      const before = currentContent.slice(0, selectionStart);
      const after = currentContent.slice(selectionEnd);
      return `${before}${markdown}${after}`;
    });

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }, [content, onContentChange, textareaRef]);

  const insertAsset = useCallback(async (file: File, kind: 'image' | 'file') => {
    setError(null);
    const selectionStart = textareaRef.current?.selectionStart ?? content.length;
    const selectionEnd = textareaRef.current?.selectionEnd ?? content.length;

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
      const sizeLabel = formatFileSize(maxSize);
      setError(`${kind === 'image' ? '이미지' : '파일'}는 ${sizeLabel} 이하만 가능합니다.`);
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
        throw new Error(payload.error || '이미지 업로드에 실패했습니다.');
      }

      let markdown = '';

      if (kind === 'image') {
        const imageUrl =
          payload.markdown_url ||
          (payload.attachment?.id ? `/api/upload/${payload.attachment.id}/file` : null);

        if (!imageUrl) {
          throw new Error('이미지 주소를 만들 수 없습니다.');
        }

        markdown = `![${getImageAlt(file.name)}](${imageUrl})`;
      } else {
        if (!payload.attachment?.id) {
          throw new Error('첨부파일 식별자를 찾을 수 없습니다.');
        }

        const attachmentUrl = `/api/upload/${payload.attachment.id}/file`;
        const label = getAttachmentLabel(file.name, file.size);
        markdown = `[📎 ${label}](${attachmentUrl})`;
      }

      let nextCursor = selectionStart + markdown.length + 1;
      onContentChange((currentContent) => {
        const result = insertAtCursor(
          currentContent,
          selectionStart,
          selectionEnd,
          markdown
        );
        nextCursor = result.nextCursor;
        return result.nextContent;
      });

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 업로드에 실패했습니다.');
    } finally {
      setUploadingKind(null);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = '';
      }
    }
  }, [content.length, documentId, onContentChange, textareaRef]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handlePaste = (event: ClipboardEvent) => {
      if (uploadingKind) return;

      const items = Array.from(event.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith('image/'));
      const file = imageItem?.getAsFile();

      if (!file) return;

      event.preventDefault();
      void insertAsset(file, 'image');
    };

    const handleDrop = (event: DragEvent) => {
      if (uploadingKind) return;

      const files = Array.from(event.dataTransfer?.files ?? []);
      const image = files.find((file) => file.type.startsWith('image/'));

      if (!image) return;

      event.preventDefault();

      const nextCursor = textarea.selectionStart ?? content.length;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
      void insertAsset(image, 'image');
    };

    const handleDragOver = (event: DragEvent) => {
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (!files.some((file) => file.type.startsWith('image/'))) {
        return;
      }
      event.preventDefault();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const isLinkShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isLinkShortcut) return;

      event.preventDefault();
      insertLink();
    };

    textarea.addEventListener('paste', handlePaste);
    textarea.addEventListener('drop', handleDrop);
    textarea.addEventListener('dragover', handleDragOver);
    textarea.addEventListener('keydown', handleKeyDown);

    return () => {
      textarea.removeEventListener('paste', handlePaste);
      textarea.removeEventListener('drop', handleDrop);
      textarea.removeEventListener('dragover', handleDragOver);
      textarea.removeEventListener('keydown', handleKeyDown);
    };
  }, [content.length, insertAsset, insertLink, textareaRef, uploadingKind]);

  const handleInsertLayoutTemplate = () => {
    setError(null);

    const selectionStart = textareaRef.current?.selectionStart ?? content.length;
    const selectionEnd = textareaRef.current?.selectionEnd ?? content.length;
    const markdown = buildMediaLayoutTemplate();

    let nextCursor = selectionStart + markdown.length + 1;
    onContentChange((currentContent) => {
      const result = insertAtCursor(
        currentContent,
        selectionStart,
        selectionEnd,
        markdown
      );
      nextCursor = result.nextCursor;
      return result.nextContent;
    });

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void insertAsset(file, 'image');
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void insertAsset(file, 'file');
  };

  const handleInsertHighlight = () => {
    setError(null);

    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectionStart = textarea.selectionStart ?? content.length;
    const selectionEnd = textarea.selectionEnd ?? content.length;
    const hasSelection = selectionEnd > selectionStart;

    const highlighted = hasSelection
      ? `==${content.slice(selectionStart, selectionEnd)}==`
      : '==형광펜 텍스트==';

    const nextCursor = selectionStart + highlighted.length;
    onContentChange((currentContent) => {
      const before = currentContent.slice(0, selectionStart);
      const after = currentContent.slice(selectionEnd);
      return `${before}${highlighted}${after}`;
    });

    requestAnimationFrame(() => {
      textarea.focus();
      if (hasSelection) {
        textarea.setSelectionRange(nextCursor, nextCursor);
        return;
      }

      const innerStart = selectionStart + 2;
      const innerEnd = innerStart + '형광펜 텍스트'.length;
      textarea.setSelectionRange(innerStart, innerEnd);
    });
  };

  const handleInsertLink = () => {
    insertLink();
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={() => imageInputRef.current?.click()}
        disabled={disabled || uploadingKind !== null}
        title="이미지 삽입"
        aria-label="이미지 삽입"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
      >
        {uploadingKind === 'image' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ImagePlus className="h-3.5 w-3.5" />
        )}
        이미지
      </button>
      <button
        type="button"
        onClick={handleInsertLayoutTemplate}
        disabled={disabled || uploadingKind !== null}
        title="좌우 배치 템플릿 삽입"
        aria-label="좌우 배치 템플릿 삽입"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
      >
        <Columns2 className="h-3.5 w-3.5" />
        좌우
      </button>
      <button
        type="button"
        onClick={handleInsertHighlight}
        disabled={disabled || uploadingKind !== null}
        title="형광펜 강조"
        aria-label="형광펜 강조"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
      >
        <Highlighter className="h-3.5 w-3.5" />
        형광펜
      </button>
      <button
        type="button"
        onClick={handleInsertLink}
        disabled={disabled || uploadingKind !== null}
        title="하이퍼링크 삽입 (⌘/Ctrl + K)"
        aria-label="하이퍼링크 삽입"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
      >
        <Link2 className="h-3.5 w-3.5" />
        링크
      </button>
      <button
        type="button"
        onClick={() => attachmentInputRef.current?.click()}
        disabled={disabled || uploadingKind !== null}
        title="첨부파일 삽입"
        aria-label="첨부파일 삽입"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
      >
        {uploadingKind === 'file' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Paperclip className="h-3.5 w-3.5" />
        )}
        파일
      </button>
      {error && (
        <span className="truncate text-xs text-error" title={error}>
          {error}
        </span>
      )}
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
