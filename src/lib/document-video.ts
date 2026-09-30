/** A normal Markdown link remains usable by clients without the video renderer. */
export const VIDEO_LINK_TITLE = 'curi:video';

export function videoMarkdown(label: string, src: string) {
  const safeLabel = label.replace(/[\\\[\]]/g, '\\$&').replace(/[\r\n]/g, ' ');
  const destination = src.replace(/</g, '%3C').replace(/>/g, '%3E');
  return `[${safeLabel}](<${destination}> "${VIDEO_LINK_TITLE}")`;
}

export function isSafeVideoUrl(src: string) {
  return !/[\u0000-\u0020\\]/.test(src)
    && (/^https?:\/\//i.test(src) || /^\/(?!\/)/.test(src)
      || /^data:video\/(?:mp4|webm|quicktime);base64,[a-z0-9+/=]+$/i.test(src));
}

export function showVideoError(target: EventTarget | null) {
  if (!(target instanceof HTMLVideoElement)) return;
  const message = target.closest('figure')?.querySelector<HTMLElement>('[data-video-error]');
  if (message) message.hidden = false;
}
