'use client';

import { useId } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { normalizeDriveUrl, DRIVE_LINK_ERROR } from '@/lib/document-drive';

function GoogleDriveIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path fill="#0F9D58" d="M8 1 0 15l4 7 8-14z" />
      <path fill="#F4B400" d="M8 1h8l8 14h-8z" />
      <path fill="#4285F4" d="m4 22 4-7h16l-4 7z" />
    </svg>
  );
}

export function DocumentDriveLink({ url }: { url: string | null }) {
  if (!url) return null;
  let safeUrl: string | null;
  try { safeUrl = normalizeDriveUrl(url); } catch { return null; }
  if (!safeUrl) return null;
  return (
    <a href={safeUrl} target="_blank" rel="noopener noreferrer" data-document-drive-link
      aria-label="Google Drive 바로가기 (새 탭)"
      className="inline-flex max-w-full items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-curi-pink/40 hover:text-curi-pink focus-visible:outline-2 focus-visible:outline-curi-pink">
      <GoogleDriveIcon className="h-3.5 w-3.5 shrink-0" />
      <span>Google Drive 바로가기</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
    </a>
  );
}

export function DocumentDriveField({ value, onChange, disabled }: {
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const id = useId();
  let invalid = false;
  try { normalizeDriveUrl(value); } catch { invalid = true; }
  return (
    <div className="max-w-xl space-y-2">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-text-secondary">
        <GoogleDriveIcon className="h-4 w-4 shrink-0" />
        Google Drive 링크 <span className="text-xs font-normal text-text-muted">선택</span>
      </label>
      <input id={id} type="url" value={value} onChange={event => onChange(event.target.value)} disabled={disabled}
        aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined}
        placeholder="드라이브 폴더 또는 파일의 공유 링크를 붙여넣으세요"
        className="h-10 w-full min-w-0 rounded-lg border border-border bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-curi-pink/50 focus:outline-none disabled:opacity-50" />
      {invalid && <p id={`${id}-error`} role="alert" className="text-xs text-error">{DRIVE_LINK_ERROR}</p>}
    </div>
  );
}
