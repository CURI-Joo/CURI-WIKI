'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react';
import { ImagePlus, Video, Link2, Loader2, Paperclip } from 'lucide-react';
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_TYPES,
  MAX_IMAGE_SIZE,
  maxSizeFor,
} from '@/lib/upload-constraints';
import { HighlightColorPicker } from '@/components/documents/highlight-color-picker';
import { TextColorPicker } from '@/components/documents/text-color-picker';
import { textColorMarkdown, type TextColor } from '@/lib/text-colors';
import { highlightedMarkdown, type HighlightColor } from '@/lib/highlight-colors';
import { formatFileSize } from '@/lib/utils';
import { uploadVideo } from '@/lib/upload-video';
import { videoMarkdown } from '@/lib/document-video';

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
  onUploadingChange?: (uploading: boolean) => void;
}

export function MarkdownImageUploadButton({
  textareaRef,
  content,
  onContentChange,
  documentId,
  disabled,
  onUploadingChange,
}: MarkdownImageUploadButtonProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingKind, setUploadingKind] = useState<'image' | 'video' | 'file' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
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

  const insertAsset = useCallback(async (file: File, kind: 'image' | 'video' | 'file') => {
    if (disabled || uploadingKind) return;
    if (file.type.startsWith('video/')) kind = 'video';
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
    setUploadProgress(0);
    onUploadingChange?.(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (documentId) {
        formData.append('document_id', documentId);
      }

      const response = kind === 'video' ? null : await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const payload = kind === 'video' ? await uploadVideo(file, documentId, setUploadProgress) : await response!.json();

      if (response && !response.ok) {
        throw new Error(payload.error || '이미지 업로드에 실패했습니다.');
      }

      let markdown = '';

      if (kind === 'video') {
        markdown = videoMarkdown(file.name, payload.markdown_url);
      } else if (kind === 'image') {
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
      onUploadingChange?.(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = '';
      }
    }
  }, [content.length, disabled, documentId, onContentChange, onUploadingChange, textareaRef, uploadingKind]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handlePaste = (event: ClipboardEvent) => {
      if (uploadingKind) return;

      const items = Array.from(event.clipboardData?.items ?? []);
      const imageItem = items.find((item) => /^(image|video)\//.test(item.type));
      const file = imageItem?.getAsFile();

      if (!file) return;

      event.preventDefault();
      void insertAsset(file, file.type.startsWith('video/') ? 'video' : 'image');
    };

    const handleDrop = (event: DragEvent) => {
      if (uploadingKind) return;

      const files = Array.from(event.dataTransfer?.files ?? []);
      const image = files.find((file) => /^(image|video)\//.test(file.type));

      if (!image) return;

      event.preventDefault();

      const nextCursor = textarea.selectionStart ?? content.length;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
      void insertAsset(image, image.type.startsWith('video/') ? 'video' : 'image');
    };

    const handleDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes('Files')) {
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

  const handleInsertTextColor = (color: TextColor) => {
    setError(null);
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = content.slice(start, end) || '글자색 텍스트';
    const colored = textColorMarkdown(text, color);
    onContentChange(current => current.slice(0, start) + colored + current.slice(end));
    requestAnimationFrame(() => {
      textarea.focus();
      const innerStart = start + `{{color:${color}}}`.length;
      textarea.setSelectionRange(innerStart, innerStart + text.length);
    });
  };

  const handleInsertHighlight = (color: HighlightColor) => {
    setError(null);

    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectionStart = textarea.selectionStart ?? content.length;
    const selectionEnd = textarea.selectionEnd ?? content.length;
    const hasSelection = selectionEnd > selectionStart;

    const highlighted = highlightedMarkdown(hasSelection ? content.slice(selectionStart, selectionEnd) : '형광펜 텍스트', color);

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
    <div className="flex min-w-0 flex-wrap items-center gap-2 [&>button]:shrink-0 [&>button]:whitespace-nowrap">
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
      <button type="button" onClick={() => videoInputRef.current?.click()} disabled={disabled || uploadingKind !== null}
        aria-label="영상 삽입" title="MP4·WebM·MOV · 최대 50MB"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50">
        {uploadingKind === 'video' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />} 영상
      </button>
      <HighlightColorPicker
        onSelect={handleInsertHighlight}
        disabled={disabled || uploadingKind !== null}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
      />
      <TextColorPicker
        onSelect={handleInsertTextColor}
        disabled={disabled || uploadingKind !== null}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
      />
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
      {uploadingKind === 'video' && <span role="status" className="text-xs text-text-secondary">영상 업로드 중 {uploadProgress}%</span>}
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
