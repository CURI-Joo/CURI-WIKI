import { describe, expect, it } from 'vitest';
import { renderDocumentMarkdown } from '@/lib/document-markdown';
import { videoMarkdown } from '@/lib/document-video';
import { editorHtmlToMarkdown } from '@/lib/editor-markdown';
import { isPublicDocumentMedia } from '@/lib/public-document-image';
import { imageAtDeletePosition } from '@/lib/editor-image-deletion';

const src = '/api/upload/clip/file';
function render(value: string) {
  const root = document.createElement('div');
  root.innerHTML = renderDocumentMarkdown(value);
  return root;
}

describe('embedded document videos', () => {
  it('preserves the video and surrounding content across editing, including temporary local playback', () => {
    let root = render(`앞 문단\n\n${videoMarkdown('시연 [최종].mp4', src)}\n\n## 다음 문단`);
    const video = root.querySelector('video')!;
    expect(video.controls).toBe(true);
    expect(video.preload).toBe('metadata');
    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(video.hasAttribute('playsinline')).toBe(true);
    video.dataset.originalSrc = src;
    video.src = 'blob:https://wiki.example/temporary';
    for (let i = 0; i < 3; i++) {
      const saved = editorHtmlToMarkdown(root);
      expect(saved).not.toContain('blob:');
      expect(saved).not.toContain('원본 열기');
      expect(saved).not.toContain('재생할 수 없습니다');
      root = render(saved);
      expect(root.querySelectorAll('video')).toHaveLength(1);
      expect(root.querySelector('video')?.getAttribute('src')).toBe(src);
      expect(root.querySelector('[data-video-caption]')?.textContent).toBe('시연 [최종].mp4');
      expect(root.querySelector('h2')?.textContent).toBe('다음 문단');
    }
  });

  it('keeps code examples, normal attachment links and unsafe URLs from becoming video players', () => {
    for (const source of ['`' + videoMarkdown('clip', src) + '`', `[파일](${src})`,
      '[영상](javascript:alert "curi:video")', '<video src=x onerror=alert(1)></video>']) {
      expect(render(source).querySelector('video')).toBeNull();
    }
  });

  it('starts a full-width block below a legacy image and its adjacent description', () => {
    const root = render(`![사진|left|wrap](/image.png)\n\n사진 설명\n\n${videoMarkdown('영상', src)}`);
    expect(root.querySelector('[data-kind="image-text"] video')).toBeNull();
    expect(root.querySelector(':scope > figure[data-kind="video"]')).not.toBeNull();
  });

  it('grants public access only to an actual video embed in a published non-Secret document', () => {
    const doc = { status: 'Published', category_id: 'cat-company', content_markdown: videoMarkdown('시연', src) };
    const allowed = (change = {}) => isPublicDocumentMedia({ ...doc, ...change }, 'clip', 'https://wiki.example', 'video');
    expect(allowed()).toBe(true);
    for (const change of [{ status: 'Draft' }, { category_id: 'cat-secret' }, { category_id: null },
      { content_markdown: `[파일](${src})` }, { content_markdown: '```md\n' + doc.content_markdown + '\n```' },
      { content_markdown: videoMarkdown('영상', 'https://other.example' + src) }, { content_markdown: videoMarkdown('영상', src + '-other') }]) {
      expect(allowed(change)).toBe(false);
    }
  });

  it('deletes a video at the Backspace boundary or as a selected block', () => {
    const root = render(`${videoMarkdown('영상', src)}\n\n다음`);
    document.body.append(root);
    const range = document.createRange();
    range.setStart(root.lastElementChild!, 0);
    range.collapse(true);
    expect(imageAtDeletePosition(root, range, true)).toBe(root.querySelector('figure'));
    range.selectNode(root.querySelector('figure')!);
    expect(imageAtDeletePosition(root, range, false)).toBe(root.querySelector('figure'));
    root.remove();
  });
});
