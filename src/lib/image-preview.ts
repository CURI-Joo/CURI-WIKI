/** Keep the permanent attachment address in Markdown; preview URLs are display-only. */
export function imagePreviewUrl(src: string): string {
  return /^\/api\/upload\/[a-zA-Z0-9_-]+\/file$/.test(src) ? `${src}?preview=1` : src;
}

export function originalImageUrl(image: HTMLImageElement): string {
  return image.dataset.originalSrc || image.getAttribute('src') || '';
}
