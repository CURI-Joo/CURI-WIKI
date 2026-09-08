'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import {
  Download,
  FileArchive,
  FileText,
  Film,
  Image as ImageIcon,
  Loader2,
  Music,
  Paperclip,
  Trash2,
  Upload,
} from 'lucide-react';
import type { Attachment } from '@/types';
import { formatDate, formatFileSize } from '@/lib/utils';
import { getProfileName, useProfiles } from '@/lib/profiles-store';
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_TYPES,
  MAX_FILE_SIZE,
  MAX_IMAGE_SIZE,
  maxSizeFor,
} from '@/lib/upload-constraints';

function FileIcon({ mimeType }: { mimeType: string }) {
  const className = 'h-4 w-4 shrink-0 text-text-muted';

  if (mimeType.startsWith('image/')) return <ImageIcon className={className} />;
  if (mimeType.startsWith('video/')) return <Film className={className} />;
  if (mimeType.startsWith('audio/')) return <Music className={className} />;
  if (mimeType.includes('zip')) return <FileArchive className={className} />;
  return <FileText className={className} />;
}

interface DocumentAttachmentsProps {
  documentId: string;
  /** 현재 사용자 ID (업로드/삭제 권한 판단) */
  userId: string;
  /** 관리자는 모든 첨부파일을 삭제할 수 있습니다. */
  isAdmin?: boolean;
  /** 읽기 전용으로 목록만 표시합니다. */
  readOnly?: boolean;
}

export function DocumentAttachments({
  documentId,
  userId,
  isAdmin = false,
  readOnly = false,
}: DocumentAttachmentsProps) {
  const profiles = useProfiles();
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // reloadKey를 올리면 목록을 다시 불러옵니다.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/documents/${documentId}/attachments`, { credentials: 'include' })
      .then(async (response) => {
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || '첨부파일을 불러오지 못했습니다.');
        }

        return payload.attachments ?? [];
      })
      .then((list: Attachment[]) => {
        if (cancelled) return;
        setAttachments(list);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '첨부파일을 불러오지 못했습니다.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [documentId, reloadKey]);

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      for (const file of files) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          throw new Error(`${file.name}: 허용되지 않은 파일 형식입니다.`);
        }

        const maxSize = maxSizeFor(file.type);
        if (file.size > maxSize) {
          const limit = maxSize === MAX_IMAGE_SIZE ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
          throw new Error(`${file.name}: ${formatFileSize(limit)}를 초과합니다.`);
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_id', documentId);

        const response = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || `${file.name} 업로드에 실패했습니다.`);
        }
      }

      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void uploadFiles(Array.from(event.target.files ?? []));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (readOnly) return;
    void uploadFiles(Array.from(event.dataTransfer.files));
  };

  const handleDownload = async (attachment: Attachment) => {
    setError(null);

    try {
      const response = await fetch(`/api/upload/${attachment.id}`, {
        credentials: 'include',
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || '다운로드 주소를 만들지 못했습니다.');
      }

      window.open(payload.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : '다운로드에 실패했습니다.');
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    if (!window.confirm(`'${attachment.file_name}'을(를) 삭제할까요?`)) return;

    setError(null);

    try {
      const response = await fetch(`/api/upload/${attachment.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || '삭제에 실패했습니다.');
      }

      setAttachments((prev) => prev.filter((a) => a.id !== attachment.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    }
  };

  const canDelete = (attachment: Attachment) =>
    !readOnly && (isAdmin || attachment.uploaded_by === userId);

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Paperclip className="h-4 w-4 text-text-muted" />
          첨부파일
          {attachments.length > 0 && (
            <span className="text-xs font-normal text-text-muted">{attachments.length}개</span>
          )}
        </h2>

        {!readOnly && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            파일 추가
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-xs text-error">{error}</p>}

      {loading ? (
        <p className="text-xs text-text-muted">불러오는 중...</p>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!readOnly) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-lg transition-colors ${
            dragOver ? 'bg-curi-pink-soft ring-1 ring-curi-pink/40' : ''
          }`}
        >
          {attachments.length === 0 ? (
            <p className="py-6 text-center text-xs text-text-muted">
              {readOnly
                ? '첨부된 파일이 없습니다.'
                : '첨부된 파일이 없습니다. 파일을 끌어다 놓거나 «파일 추가»를 눌러 업로드하세요.'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {attachments.map((attachment) => (
                <li key={attachment.id} className="flex items-center gap-3 py-2.5">
                  {attachment.mime_type.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/upload/${attachment.id}/file`}
                      alt={attachment.file_name}
                      className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface-elevated">
                      <FileIcon mimeType={attachment.mime_type} />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary" title={attachment.file_name}>
                      {attachment.file_name}
                    </p>
                    <p className="text-xs text-text-muted">
                      {formatFileSize(attachment.file_size)} · {getProfileName(profiles, attachment.uploaded_by)} ·{' '}
                      {formatDate(attachment.created_at)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownload(attachment)}
                    title="다운로드"
                    aria-label={`${attachment.file_name} 다운로드`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-elevated hover:text-text-primary"
                  >
                    <Download className="h-4 w-4" />
                  </button>

                  {canDelete(attachment) && (
                    <button
                      type="button"
                      onClick={() => handleDelete(attachment)}
                      title="삭제"
                      aria-label={`${attachment.file_name} 삭제`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-elevated hover:text-error"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        onChange={handleFileChange}
        className="hidden"
      />
    </section>
  );
}
