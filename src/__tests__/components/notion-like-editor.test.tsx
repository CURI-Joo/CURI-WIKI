import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NotionLikeEditor } from '@/components/documents/notion-like-editor';
import { imageAtDeletePosition } from '@/lib/editor-image-deletion';

const markdown = '# 제목\n\n> 인용\n\n| 이름 | 역할 |\n| --- | --- |\n| Claude | 글쓰기 |\n\n---\n\n- [ ] 검토';

describe('NotionLikeEditor', () => {
  it('opens existing Markdown as formatted editable content without changing the saved source', () => {
    const onChange = vi.fn();
    render(<NotionLikeEditor value={markdown} onChange={onChange} />);
    const editor = screen.getByRole('textbox', { name: '문서 본문' });
    expect(editor.querySelector('table')).not.toBeNull();
    expect(editor.querySelector('blockquote')?.textContent).toContain('인용');
    expect(editor.querySelector('hr')).not.toBeNull();
    expect(editor.querySelector('input')).not.toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('retains the live table DOM and its surrounding formatting while typing', () => {
    function Editor() {
      const [value, setValue] = useState(markdown);
      return <><NotionLikeEditor value={value} onChange={setValue} /><output>{value}</output></>;
    }
    render(<Editor />);
    const editor = screen.getByRole('textbox', { name: '문서 본문' });
    const cell = editor.querySelector('td')!;
    cell.textContent = '수정한 내용';
    fireEvent.input(editor);
    expect(editor.querySelector('td')).toBe(cell);
    expect(screen.getByRole('status').textContent).toContain('| 수정한 내용 | 글쓰기 |');
    expect(editor.querySelector('blockquote, hr')).not.toBeNull();
  });

  it('prevents checkbox changes while the document is saving', () => {
    const { rerender } = render(<NotionLikeEditor value={markdown} onChange={vi.fn()} />);
    rerender(<NotionLikeEditor value={markdown} onChange={vi.fn()} disabled />);
    expect(screen.getByRole('textbox')).toHaveAttribute('contenteditable', 'false');
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('resizes from the visible image width and stops at the padded editor boundary', () => {
    const onChange = vi.fn();
    render(<NotionLikeEditor value={'![사진|w1100|x280](/image.png)'} onChange={onChange} />);
    const editor = screen.getByRole('textbox');
    const image = editor.querySelector('img')!;
    const figure = editor.querySelector('figure')!;
    editor.style.padding = '32px';
    Object.defineProperty(editor, 'clientWidth', { value: 864 });
    vi.spyOn(image, 'getBoundingClientRect').mockImplementation(() => ({
      x: 32, y: 32, left: 32, top: 32, width: 800, height: 300, right: 832, bottom: 332, toJSON: () => ({}),
    }));

    fireEvent.mouseDown(image, { clientX: 831, clientY: 182 });
    fireEvent.mouseMove(window, { clientX: 751, clientY: 182 });
    expect(figure.dataset.width).toBe('720');
    fireEvent.mouseMove(window, { clientX: 1600, clientY: 182 });
    fireEvent.mouseUp(window);
    expect(figure.dataset.width).toBe('800');
    expect(Number(figure.dataset.offset)).toBe(0);
    expect(onChange).toHaveBeenLastCalledWith('![사진|w800](/image.png)');
  });

  it('focuses the editor and selects the whole image when clicking its body', () => {
    render(<NotionLikeEditor value={'![사진 설명](/image.png)'} onChange={vi.fn()} />);
    const editor = screen.getByRole('textbox');
    const image = editor.querySelector('img')!;
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, width: 300, height: 200, right: 300, bottom: 200, toJSON: () => ({}),
    });
    fireEvent.mouseDown(image, { clientX: 150, clientY: 100 });
    fireEvent.mouseUp(window);
    expect(document.activeElement).toBe(editor);
    expect(imageAtDeletePosition(editor, window.getSelection()!.getRangeAt(0), true)).toBe(editor.querySelector('figure'));
  });

  it('offers image deletion on right-click while keeping the caption editable', () => {
    render(<NotionLikeEditor value={'![사진 설명](/image.png)'} onChange={vi.fn()} />);
    const editor = screen.getByRole('textbox');
    fireEvent.contextMenu(editor.querySelector('figcaption')!, { clientX: 100, clientY: 100 });
    expect(screen.queryByRole('menuitem', { name: '이미지 삭제' })).toBeNull();
    fireEvent.contextMenu(editor.querySelector('img')!, { clientX: 100, clientY: 100 });
    expect(screen.getByRole('menuitem', { name: '이미지 삭제' })).toBeVisible();
  });

  it('turns off side writing to continue below while preserving the existing column on reopening', () => {
    const onChange = vi.fn();
    const { rerender } = render(<NotionLikeEditor value={'![사진|wrap](/a.png)\n\n옆글'} onChange={onChange} />);
    const editor = screen.getByRole('textbox');
    const text = editor.querySelector('[data-kind="image-text-body"] p')!.firstChild!;
    editor.focus();
    const range = document.createRange();
    range.setStart(text, text.textContent!.length);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.mouseUp(editor);
    expect(screen.getByRole('button', { name: '옆글쓰기' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '옆글쓰기' }));
    expect(screen.getByRole('button', { name: '옆글쓰기' })).toHaveAttribute('aria-pressed', 'false');
    const below = editor.querySelector('[data-kind="image-text"]')!.nextElementSibling!;
    expect(below.tagName).toBe('P');
    below.textContent = '아래 본문';
    fireEvent.input(editor);
    const saved = onChange.mock.lastCall![0];
    expect(saved).toContain(':::image-text-end\n\n아래 본문');
    rerender(<NotionLikeEditor value={saved + '\n\n끝'} onChange={onChange} />);
    expect(editor.querySelector('[data-kind="image-text"]')!.nextElementSibling?.textContent).toBe('아래 본문');
  });

  it('turns side writing back on from below without creating another group or moving below text', () => {
    render(<NotionLikeEditor value={':::image-text\n\n![사진|wrap](/a.png)\n\n기존 옆글\n\n:::image-text-end\n\n아래 본문'} onChange={vi.fn()} />);
    const editor = screen.getByRole('textbox');
    const range = document.createRange();
    range.selectNodeContents(editor.lastElementChild!);
    range.collapse(false);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.mouseUp(editor);
    const toggle = screen.getByRole('button', { name: '옆글쓰기' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(editor.querySelectorAll('[data-kind="image-text"]')).toHaveLength(1);
    expect(editor.lastElementChild?.textContent).toBe('아래 본문');
    expect(editor.querySelector('[data-kind="image-text-body"]')?.textContent?.trim()).toBe('기존 옆글');
  });

  it('exits the side column on Enter in its last empty paragraph', () => {
    render(<NotionLikeEditor value={'![사진|wrap](/a.png)'} onChange={vi.fn()} />);
    const editor = screen.getByRole('textbox');
    const paragraph = editor.querySelector('[data-kind="image-text-body"] p')!;
    const range = document.createRange();
    range.setStart(paragraph, 0);
    range.collapse(true);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.keyDown(editor, { key: 'Enter' });
    const anchor = window.getSelection()!.anchorNode as HTMLElement;
    expect(anchor.closest('[data-kind="image-text"]')).toBeNull();
    expect(editor.contains(anchor)).toBe(true);
  });
});
