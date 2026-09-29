import { describe, expect, it } from 'vitest';
import { imageAtDeletePosition } from '@/lib/editor-image-deletion';

function fixture() {
  const root = document.createElement('div');
  root.innerHTML = '<p>앞 문장</p>\n<figure data-kind="image"><img src="/photo.png"><figcaption>사진 설명</figcaption></figure>\n<p><strong>뒤 문장</strong></p>';
  return { root, figure: root.querySelector('figure')!, range: document.createRange() };
}

describe('image deletion boundaries', () => {
  it.each([true, false])('deletes a selected image as a whole for backward=%s', (backward) => {
    const { root, figure, range } = fixture();
    range.selectNode(figure);
    expect(imageAtDeletePosition(root, range, backward)).toBe(figure);
  });

  it('finds the preceding image at the start of nested formatted text', () => {
    const { root, figure, range } = fixture();
    range.setStart(root.querySelector('strong')!.firstChild!, 0);
    range.collapse(true);
    expect(imageAtDeletePosition(root, range, true)).toBe(figure);
  });

  it('finds the following image at the end of a paragraph', () => {
    const { root, figure, range } = fixture();
    const text = root.querySelector('p')!.firstChild!;
    range.setStart(text, text.textContent!.length);
    range.collapse(true);
    expect(imageAtDeletePosition(root, range, false)).toBe(figure);
  });

  it('leaves text and caption deletion to the browser', () => {
    const { root, range } = fixture();
    range.setStart(root.querySelector('strong')!.firstChild!, 1);
    range.collapse(true);
    expect(imageAtDeletePosition(root, range, true)).toBeNull();
    range.setStart(root.querySelector('figcaption')!.firstChild!, 0);
    range.collapse(true);
    expect(imageAtDeletePosition(root, range, true)).toBeNull();
  });

  it('supports an empty paragraph immediately after an image', () => {
    const { root, figure, range } = fixture();
    root.lastElementChild!.innerHTML = '<br>';
    range.setStart(root.lastElementChild!, 1);
    range.collapse(true);
    expect(imageAtDeletePosition(root, range, true)).toBe(figure);
  });

  it('does not replace a larger selection or cross table-cell boundaries', () => {
    const { root, range } = fixture();
    range.selectNodeContents(root);
    expect(imageAtDeletePosition(root, range, true)).toBeNull();
    root.lastElementChild!.outerHTML = '<table><tbody><tr><td><p>표 안</p></td></tr></tbody></table>';
    range.setStart(root.querySelector('td p')!.firstChild!, 0);
    range.collapse(true);
    expect(imageAtDeletePosition(root, range, true)).toBeNull();
  });
});
