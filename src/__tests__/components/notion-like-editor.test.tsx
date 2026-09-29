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
});
