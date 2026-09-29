import { describe, expect, it } from 'vitest';
import { renderDocumentMarkdown } from '@/lib/document-markdown';
import { editorHtmlToMarkdown } from '@/lib/editor-markdown';
import { continueBelowImageText, createImageTextGroup, imageWritingContext } from '@/lib/editor-image-text';
import { markdownToPlainText } from '@/lib/plain-editor';

function render(source: string) {
  const root = document.createElement('div');
  root.innerHTML = renderDocumentMarkdown(source);
  return root;
}
const legacy = '## 배치도\n\n![부스 배치|left|w320|wrap](/booth.png)\n\n- 참가 형태: **공동관**\n- 부스 번호: D49\n\n추가 설명\n\n## 8. 참고 링크\n\n[참고 사이트](https://example.com)';

describe('bounded image and text layout', () => {
  it('keeps legacy descriptions beside the image and the next heading outside the group', () => {
    const root = render(legacy);
    const group = root.querySelector('[data-kind="image-text"]')!;
    expect(group.querySelectorAll('li')).toHaveLength(2);
    expect(group.querySelector('strong')?.textContent).toBe('공동관');
    expect(group.textContent).toContain('추가 설명');
    expect(group.querySelector('h2')).toBeNull();
    expect(group.nextElementSibling?.textContent).toBe('8. 참고 링크');
    expect(root.querySelector('figure')?.style.cssFloat).toBe('none');
  });

  it('preserves the explicit boundary before an ordinary paragraph across repeated saves', () => {
    let root = render(':::image-text\n\n![사진|right|w320|wrap](/a.png)\n\n## 옆글 제목\n\n- 설명\n\n:::image-text-end\n\n아래 본문\n\n![다음 사진](/b.png)');
    for (let i = 0; i < 4; i++) root = render(editorHtmlToMarkdown(root));
    const group = root.querySelector('[data-kind="image-text"]')!;
    expect(group.getAttribute('data-align')).toBe('right');
    expect(group.querySelector('h2')?.textContent).toBe('옆글 제목');
    expect(group.nextElementSibling?.textContent).toBe('아래 본문');
    expect(root.querySelectorAll('figure')).toHaveLength(2);
    expect(group.querySelectorAll('figure')).toHaveLength(1);
    expect(markdownToPlainText(editorHtmlToMarkdown(root))).not.toContain(':::');
  });

  it('leaves layout-like syntax in code literal and retains reference links', () => {
    const root = render(':::image-text\n\n![사진|wrap](/a.png)\n\n```md\n:::image-text-end\n```\n\n[참고][site]\n\n:::image-text-end\n\n아래\n\n[site]: https://example.com');
    expect(root.querySelector('code')?.textContent).toBe(':::image-text-end\n');
    expect(root.querySelector('[data-kind="image-text-body"] a')?.getAttribute('href')).toBe('https://example.com');
    expect(root.lastElementChild?.textContent).toBe('아래');
  });

  it('stops legacy groups at another image and at tables without losing content', () => {
    const root = render('![첫째|wrap](/a.png)\n\n설명 A\n\n![둘째|right|wrap](/b.png)\n\n설명 B\n\n| 표 |\n| --- |\n| 내용 |');
    expect(root.querySelectorAll('[data-kind="image-text"]')).toHaveLength(2);
    expect(root.querySelector('table')?.closest('[data-kind="image-text"]')).toBeNull();
    expect(render(editorHtmlToMarkdown(root)).querySelectorAll('img')).toHaveLength(2);
  });

  it('keeps incomplete groups and unsafe image captions visible without executing HTML', () => {
    const root = render(':::image-text\n\n![위험](javascript:alert)\n\n<script>alert(1)</script>\n\n:::image-text-end\n\n끝');
    expect(root.querySelector('img, script')).toBeNull();
    expect(root.textContent).toContain('위험');
    expect(root.textContent).toContain('끝');
    expect(render(':::image-text\n\n![사진|wrap](/a.png)\n\n남은 글').textContent).toContain('남은 글');
  });

  it('moves a heading and everything after the caret below the image, retaining formatting', () => {
    const root = render(':::image-text\n\n![사진|wrap](/a.png)\n\n옆글\n\n## 8. 참고 링크\n\n- [사이트](https://example.com)\n\n:::image-text-end');
    const group = root.querySelector<HTMLElement>('[data-kind="image-text"]')!;
    const range = document.createRange();
    range.setStart(group.querySelector('h2')!.firstChild!, 0);
    range.collapse(true);
    const target = continueBelowImageText(group, range);
    expect(target.tagName).toBe('H2');
    const reopened = render(editorHtmlToMarkdown(root));
    expect(reopened.querySelector('[data-kind="image-text-body"]')?.textContent?.trim()).toBe('옆글');
    expect(reopened.querySelector('h2')?.parentElement).toBe(reopened);
    expect(reopened.querySelector('ul a')?.textContent).toBe('사이트');
  });

  it('splits at a text caret and preserves both sides instead of dropping the tail', () => {
    const root = render('![사진|wrap](/a.png)\n\n옆글아래글');
    const group = root.querySelector<HTMLElement>('[data-kind="image-text"]')!;
    const range = document.createRange();
    range.setStart(group.querySelector('[data-kind="image-text-body"] p')!.firstChild!, 2);
    range.collapse(true);
    expect(continueBelowImageText(group, range).textContent).toBe('아래글');
    const reopened = render(editorHtmlToMarkdown(root));
    expect(reopened.querySelector('[data-kind="image-text-body"]')?.textContent?.trim()).toBe('옆글');
    expect(reopened.lastElementChild?.textContent).toBe('아래글');
  });

  it('starts side writing without pulling existing below-image content into the column', () => {
    const root = render(legacy.replace('|wrap', ''));
    const before = root.textContent?.replace(/\s/g, '');
    const { group, body } = createImageTextGroup(root.querySelector('figure')!);
    expect(body.textContent?.trim()).toBe('');
    expect(group.nextElementSibling?.tagName).toBe('UL');
    expect(root.querySelector('figure')?.dataset.wrap).toBe('true');
    expect(root.textContent?.replace(/\s/g, '')).toBe(before);
  });

  it('tracks side-writing state at the caret and finds the image again from the paragraph below', () => {
    const root = render(':::image-text\n\n![사진|wrap](/a.png)\n\n옆글\n\n:::image-text-end\n\n아래글');
    const range = document.createRange();
    range.selectNodeContents(root.querySelector('[data-kind="image-text-body"] p')!);
    range.collapse(false);
    expect(imageWritingContext(root, range)).toEqual({ figure: root.querySelector('figure'), beside: true });
    range.selectNodeContents(root.lastElementChild!);
    range.collapse(false);
    expect(imageWritingContext(root, range)).toEqual({ figure: root.querySelector('figure'), beside: false });
    range.selectNode(root.querySelector('figure')!);
    expect(imageWritingContext(root, range).beside).toBe(true);
  });

  it('starts a plain paragraph below when continuing from the end of a list', () => {
    const root = render('![사진|wrap](/a.png)\n\n- 마지막 설명');
    const group = root.querySelector<HTMLElement>('[data-kind="image-text"]')!;
    const range = document.createRange();
    const text = group.querySelector('li')!.firstChild!;
    range.setStart(text, text.textContent!.length);
    range.collapse(true);
    const target = continueBelowImageText(group, range);
    expect(target.tagName).toBe('P');
    expect(target.parentElement).toBe(root);
    expect(group.querySelector('li')?.textContent).toBe('마지막 설명');
  });

  it('saves descriptions normally after image deletion, including empty groups', () => {
    const root = render('![사진|wrap](/a.png)\n\n설명');
    root.querySelector('figure')!.remove();
    const source = editorHtmlToMarkdown(root);
    expect(source).toBe('설명');
    expect(render(source).querySelector('[data-kind="image-text"]')).toBeNull();
    expect(render(editorHtmlToMarkdown(render('![사진|wrap](/a.png)'))).querySelector('figure')).not.toBeNull();
  });
});
