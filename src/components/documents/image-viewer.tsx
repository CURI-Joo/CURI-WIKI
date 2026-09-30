'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ExternalLink, Loader2, X, ZoomIn, ZoomOut } from 'lucide-react';

export type ViewedImage = { src: string; preview: string; alt: string; trigger: HTMLImageElement };

export function ImageViewer({ image, onClose }: { image: ViewedImage; onClose: () => void }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [naturalWidth, setNaturalWidth] = useState(1600);
  const buttonClass = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-sm text-text-secondary hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-curi-pink disabled:opacity-40';

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
        <Dialog.Content aria-describedby={undefined}
          onCloseAutoFocus={event => { event.preventDefault(); image.trigger.focus({ preventScroll: true }); }}
          className="fixed left-1/2 top-1/2 z-50 flex h-[92dvh] w-[96vw] max-w-[1600px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl focus:outline-none">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
            <Dialog.Title className="min-w-0 truncate text-sm font-medium text-text-primary">{image.alt || '사진 크게 보기'}</Dialog.Title>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" className={buttonClass} disabled={!loaded} aria-label={zoomed ? '화면에 맞추기' : '사진 더 확대'}
                onClick={() => setZoomed(value => !value)}>
                {zoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
              </button>
              <a href={image.src} target="_blank" rel="noopener noreferrer" className={buttonClass} aria-label="원본 새 탭에서 열기">
                <ExternalLink className="h-4 w-4" /><span className="hidden sm:inline">원본</span>
              </a>
              <Dialog.Close className={buttonClass} aria-label="사진 닫기"><X className="h-5 w-5" /></Dialog.Close>
            </div>
          </div>
          <div className="relative min-h-0 flex-1 overflow-auto bg-surface-elevated" data-image-viewer>
            {/* Keep the already-loaded preview visible while the original downloads. */}
            {!loaded && <img src={image.preview} alt="" className="absolute inset-0 h-full w-full object-contain" /> /* eslint-disable-line @next/next/no-img-element */}
            {/* The original stays out of the page's network requests until the viewer opens. */}
            <img src={image.src} alt={image.alt} decoding="async" fetchPriority="high" /* eslint-disable-line @next/next/no-img-element */
              onLoad={async event => {
                const original = event.currentTarget;
                try {
                  await original.decode();
                  setNaturalWidth(original.naturalWidth);
                  setLoaded(true);
                } catch { setFailed(true); }
              }}
              onError={() => setFailed(true)}
              className={zoomed ? 'block max-w-none' : 'h-full w-full object-contain'}
              style={{ opacity: loaded ? 1 : 0, ...(zoomed ? { width: Math.max(naturalWidth, 1800), height: 'auto' } : {}) }} />
            {!loaded && <div role="status" className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-lg bg-background/90 px-3 py-2 text-xs text-text-secondary shadow-sm">
              {failed ? '원본을 불러오지 못했습니다.' : <><Loader2 className="h-3.5 w-3.5 animate-spin" />원본 불러오는 중</>}
            </div>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
