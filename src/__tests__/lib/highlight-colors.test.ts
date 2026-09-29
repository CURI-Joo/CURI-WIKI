import { describe, expect, it } from 'vitest';
import { renderDocumentMarkdown } from '@/lib/document-markdown';
import { editorHtmlToMarkdown } from '@/lib/editor-markdown';
import { prepareEditorHighlights } from '@/lib/editor-highlights';
import { HIGHLIGHT_COLORS, highlightedMarkdown } from '@/lib/highlight-colors';
import { buildSummaryFromMarkdown } from '@/lib/plain-editor';

function root(html: string) {
  const element = document.createElement('div');
  element.innerHTML = html;
  return element;
}

describe('five highlight colors', () => {
  it.each(HIGHLIGHT_COLORS)('preserves $label in editing, saving and reopening', (color) => {
    const source = highlightedMarkdown('강조 **굵게** 끝', color.id);
    expect(buildSummaryFromMarkdown(source)).toBe('강조 굵게 끝');
    const editor = root(renderDocumentMarkdown(source));
    prepareEditorHighlights(editor);
    expect(editor.querySelector('span')!.style.backgroundColor).toBe(color.rgb);
    const before = editor.innerHTML;
    const saved = editorHtmlToMarkdown(editor);
    expect(saved).toBe(source);
    expect(editor.innerHTML).toBe(before);
    const reopened = root(renderDocumentMarkdown(saved));
    expect(reopened.querySelector('mark')!.dataset.highlightColor).toBe(color.id);
    expect(reopened.querySelector('mark strong')!.textContent).toBe('굵게');
  });

  it('retains partial recoloring inside bold text without nested delimiters', () => {
    const editor = root('<p><span style="background-color:#fef08a">앞 <strong>굵게 <span style="background-color:#fbcfe8">다른 색</span> 끝</strong> 뒤</span></p>');
    const reopened = root(renderDocumentMarkdown(editorHtmlToMarkdown(editor)));
    expect(reopened.textContent?.trim()).toBe('앞 굵게 다른 색 끝 뒤');
    expect(reopened.querySelector('[data-highlight-color="pink"]')!.textContent).toBe('다른 색');
    expect(reopened.textContent).not.toContain('==');
  });

  it('preserves separate highlights across paragraph and table boundaries', () => {
    const source = '==첫 문단=={green}\n\n==둘째 문단=={blue}\n\n| 제목 |\n| --- |\n| ==표 안=={purple} |';
    const editor = root(renderDocumentMarkdown(source));
    prepareEditorHighlights(editor);
    const reopened = root(renderDocumentMarkdown(editorHtmlToMarkdown(editor)));
    expect(Array.from(reopened.querySelectorAll('mark'), (mark) => mark.dataset.highlightColor)).toEqual(['green', 'blue', 'purple']);
    expect(reopened.querySelector('td mark')!.textContent).toBe('표 안');
  });
});
