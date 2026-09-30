import { describe, expect, it } from 'vitest';
import { renderDocumentMarkdown } from '@/lib/document-markdown';
import { editorHtmlToMarkdown } from '@/lib/editor-markdown';
import { prepareEditorHighlights } from '@/lib/editor-highlights';
import { prepareEditorTextColors } from '@/lib/editor-text-colors';
import { TEXT_COLORS, textColorMarkdown } from '@/lib/text-colors';
import { buildSummaryFromMarkdown } from '@/lib/plain-editor';

function root(html: string) {
  const element = document.createElement('div');
  element.innerHTML = html;
  return element;
}

function roundTrip(source: string) {
  const editor = root(renderDocumentMarkdown(source));
  prepareEditorHighlights(editor);
  prepareEditorTextColors(editor);
  const before = editor.innerHTML;
  const saved = editorHtmlToMarkdown(editor);
  expect(editor.innerHTML).toBe(before);
  return { saved, reopened: root(renderDocumentMarkdown(saved)) };
}

describe('text colors', () => {
  it.each(TEXT_COLORS)('preserves $label together with bold text and highlights', color => {
    const source = textColorMarkdown('앞 **굵게** ==강조=={pink} 뒤', color.id);
    expect(buildSummaryFromMarkdown(source)).toBe('앞 굵게 강조 뒤');
    let saved = source;
    for (let index = 0; index < 3; index++) {
      const result = roundTrip(saved);
      expect(result.reopened.querySelector('[data-text-color]')!.getAttribute('data-text-color')).toBe(color.id);
      expect(result.reopened.querySelector('[data-text-color] strong')!.textContent).toBe('굵게');
      expect(result.reopened.querySelector('[data-text-color] mark')!.getAttribute('data-highlight-color')).toBe('pink');
      expect(result.reopened.textContent?.trim()).toBe('앞 굵게 강조 뒤');
      saved = result.saved;
    }
  });

  it('flattens partial recoloring inside highlighted bold text and legacy font elements', () => {
    const editor = root('<p><span style="color:#245bbb;background-color:#fef08a">앞 <strong>굵게 <font color="#be252c">다른 색</font> 끝</strong> 뒤</span></p>');
    const reopened = root(renderDocumentMarkdown(editorHtmlToMarkdown(editor)));
    expect(reopened.textContent?.trim()).toBe('앞 굵게 다른 색 끝 뒤');
    expect(reopened.querySelector('[data-text-color="red"]')!.textContent).toBe('다른 색');
    const red = reopened.querySelector('[data-text-color="red"]')!;
    expect(red.closest('strong') || red.querySelector('strong')).not.toBeNull();
    expect(Array.from(reopened.querySelectorAll('mark')).every(mark => mark.dataset.highlightColor === 'yellow')).toBe(true);
  });

  it('preserves separate colors across paragraphs, lists and table cells', () => {
    const editor = root('<div style="color:#287346"><p>문단 하나</p><p>문단 둘</p><ul><li>목록</li></ul><table><tr><th>표 제목</th></tr><tr><td>표 내용</td></tr></table></div>');
    const saved = editorHtmlToMarkdown(editor);
    const reopened = root(renderDocumentMarkdown(saved));
    expect(reopened.querySelector('li [data-text-color="green"]')!.textContent).toBe('목록');
    expect(reopened.querySelector('td [data-text-color="green"]')!.textContent).toBe('표 내용');
    expect(reopened.querySelectorAll('p [data-text-color="green"]')).toHaveLength(2);
    expect(reopened.textContent).not.toContain('{{');
  });

  it('keeps code literal and rejects arbitrary CSS or HTML in color markers', () => {
    const source = '`{{color:blue}}소스{{/color}}`\n\n```\n{{color:red}}코드{{/color}}\n```\n\n{{color:blue}}<img src=x onerror=alert(1)> [링크](javascript:alert){{/color}}\n\n{{color:url(evil)}}잘못된 색{{/color}}';
    const reopened = roundTrip(source).reopened;
    expect(reopened.querySelector('code')!.textContent).toBe('{{color:blue}}소스{{/color}}');
    expect(reopened.querySelector('pre code')!.textContent).toContain('{{color:red}}코드{{/color}}');
    expect(reopened.querySelector('img, a[href^="javascript:"]')).toBeNull();
    expect(reopened.querySelectorAll('[data-text-color]')).toHaveLength(1);
  });

  it('removes stale color metadata after native Undo without changing nodes', () => {
    const editor = root('<p><span data-text-color="red" style="color:#245bbb">내용</span></p>');
    const span = editor.querySelector('span')!;
    prepareEditorTextColors(editor);
    expect(span.dataset.textColor).toBe('blue');
    span.style.removeProperty('color');
    prepareEditorTextColors(editor);
    expect(span.dataset.textColor).toBeUndefined();
    expect(editor.querySelector('span')).toBe(span);
  });

  it('supports repeated recoloring in Markdown and ignores delimiters in inline code', () => {
    const source = '{{color:blue}}앞 {{color:red}}다른 색{{/color}} `{{/color}}` 뒤{{/color}}';
    const { saved, reopened } = roundTrip(source);
    expect(reopened.textContent?.trim()).toBe('앞 다른 색 {{/color}} 뒤');
    expect(reopened.querySelector('[data-text-color="red"]')!.textContent).toBe('다른 색');
    expect(reopened.querySelector('[data-text-color="blue"] code')!.textContent).toBe('{{/color}}');
    expect(roundTrip(saved).reopened.textContent).toBe(reopened.textContent);
  });
});
