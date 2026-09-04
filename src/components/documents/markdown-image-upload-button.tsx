'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getImageAlt(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim() || 'image';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const insertImage = async (file: File) => {
    setError(null);
    const selectionStart = textareaRef.current?.selectionStart ?? content.length;
    const selectionEnd = textareaRef.current?.selectionEnd ?? content.length;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError('png, jpg, webp, gif 이미지만 가능합니다.');
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError(`이미지는 ${formatFileSize(MAX_IMAGE_SIZE)} 이하만 가능합니다.`);
      return;
    }

    setUploading(true);

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

      const imageUrl =
        payload.markdown_url ||
        (payload.attachment?.id ? `/api/upload/${payload.attachment.id}/file` : null);

      if (!imageUrl) {
        throw new Error('이미지 주소를 만들 수 없습니다.');
      }

      const markdown = `![${getImageAlt(file.name)}](${imageUrl})`;
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
      setError(err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void insertImage(file);
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        title="이미지 삽입"
        aria-label="이미지 삽입"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ImagePlus className="h-3.5 w-3.5" />
        )}
        이미지
      </button>
      {error && (
        <span className="truncate text-xs text-error" title={error}>
          {error}
        </span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
