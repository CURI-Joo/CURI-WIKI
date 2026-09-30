'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { isSafeImageUrl, renderDocumentMarkdown } from '@/lib/document-markdown';
import { originalImageUrl } from '@/lib/image-preview';
import { showVideoError } from '@/lib/document-video';
import { ImageViewer, type ViewedImage } from '@/components/documents/image-viewer';

export function MarkdownRenderer({ content }: { content: string }) {
  const html = useMemo(() => renderDocumentMarkdown(content), [content]);
  const root = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<ViewedImage | null>(null);
  useEffect(() => {
    root.current?.querySelectorAll<HTMLImageElement>('figure img').forEach(img => {
      if (img.closest('a')) return;
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', `${img.alt || '사진'} 크게 보기`);
      img.style.cursor = 'zoom-in';
    });
  }, [html]);
  const openImage = (target: EventTarget | null) => {
    if (!(target instanceof HTMLImageElement) || target.closest('a')) return;
    const src = originalImageUrl(target);
    if (isSafeImageUrl(src)) setImage({ src, preview: target.currentSrc || target.src, alt: target.alt, trigger: target });
  };
  return <>
    <div ref={root} className="prose-curi" dangerouslySetInnerHTML={{ __html: html }}
      onErrorCapture={event => showVideoError(event.target)}
      onClick={event => openImage(event.target)}
      onKeyDown={event => {
        if (event.target instanceof HTMLImageElement && ['Enter', ' '].includes(event.key)) {
          event.preventDefault(); openImage(event.target);
        }
      }} />
    {image && <ImageViewer key={image.src} image={image} onClose={() => setImage(null)} />}
  </>;
}
