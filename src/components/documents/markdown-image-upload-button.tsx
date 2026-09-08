'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react';
import { ImagePlus, Loader2, Paperclip } from 'lucide-react';
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

  const insertAsset = async (file: File, kind: 'image' | 'file') => {
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
