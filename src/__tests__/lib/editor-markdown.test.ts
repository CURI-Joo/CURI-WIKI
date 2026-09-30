import { describe, expect, it } from 'vitest';
import { renderDocumentMarkdown } from '@/lib/document-markdown';
import { editorHtmlToMarkdown } from '@/lib/editor-markdown';
import { demoDocuments } from '@/data/demo-data';

function render(markdown: string) {
  const root = document.createElement('div');
  root.innerHTML = renderDocumentMarkdown(markdown);
  return root;
}

function roundTrip(markdown: string) {
  return render(editorHtmlToMarkdown(render(markdown)));
}

const guide = `# Claude로 CURI Wiki 글쓰기 가이드
> Claude에 **CURI Wiki** 플러그인을 연결하면 수정할 수 있습니다.

---

## 한눈에 보기

| 구성 요소 | 역할 |
| :--- | ---: |
| **Claude** | 요청 이해 |
| 플러그인 | [가이드](/documents/wiki-guide) |

1. 연결하기
2. 작성하기
   - 메모 정리
   - ==중요한 내용==

- [ ] 검토
- [x] 발행

\`\`\`javascript
const sample = "**그대로** _유지_ [링크] | 표";
\`\`\`

![연결 구조|left|w320|wrap|x-20](/guide.png)

[📎 문서.pdf · 2 KB](/api/upload/test/file)
`;

describe('formatted document editing', () => {
  it('displays lightweight previews but saves permanent originals, including local upload previews', () => {
    const source = '![사진|right|w320|wrap](/api/upload/photo-1/file)\n\n설명';
    const root = render(source);
    const image = root.querySelector('img')!;
    expect(image.getAttribute('src')).toBe('/api/upload/photo-1/file?preview=1');
    image.src = 'blob:https://wiki.example/local-preview';
    const saved = editorHtmlToMarkdown(root);
    expect(saved).toContain('](/api/upload/photo-1/file)');
    expect(saved).not.toContain('blob:');
    expect(saved).not.toContain('?preview=');
    expect(roundTrip(saved).querySelector('img')?.dataset.originalSrc).toBe('/api/upload/photo-1/file');
  });
  it('renders the guide as headings, quotes, tables, lists and code', () => {
    const root = render(guide);
    expect(root.querySelector('h1')?.textContent).toBe('Claude로 CURI Wiki 글쓰기 가이드');
    expect(root.querySelector('blockquote strong')?.textContent).toBe('CURI Wiki');
    expect(root.querySelectorAll('hr')).toHaveLength(1);
    expect(root.querySelectorAll('table tr')).toHaveLength(3);
    expect(root.querySelector('td strong')?.textContent).toBe('Claude');
    expect(root.querySelectorAll('ol > li')).toHaveLength(2);
    expect(root.querySelectorAll('ol ul > li')).toHaveLength(2);
    expect(root.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    expect(root.querySelector('pre code')?.className).toBe('language-javascript');
  });

  it('preserves every surrounding block when a table cell is edited and reopened', () => {
    const root = render(guide);
    root.querySelector('td')!.textContent = 'Claude 수정';
    const reopened = roundTrip(editorHtmlToMarkdown(root));
    expect(reopened.querySelector('td')?.textContent).toBe('Claude 수정');
    expect(reopened.querySelector('th')?.getAttribute('align')).toBe('left');
    expect(reopened.querySelectorAll('table tr')).toHaveLength(3);
    expect(reopened.querySelectorAll('blockquote, hr, ol, mark')).toHaveLength(4);
    expect(reopened.querySelector('pre code')?.textContent).toBe(root.querySelector('pre code')?.textContent);
    const checkboxes = reopened.querySelectorAll<HTMLInputElement>('input');
    expect(Array.from(checkboxes, (input) => input.checked)).toEqual([false, true]);
    const figure = reopened.querySelector('figure')!;
    expect({ ...figure.dataset }).toMatchObject({ align: 'left', width: '320', wrap: 'true', offset: '-20' });
    expect(reopened.querySelector('a[data-attachment]')?.getAttribute('href')).toBe('/api/upload/test/file');
  });

  it('keeps escaped punctuation, nested formatting, links and inline code stable across repeated edits', () => {
    const source = '한글 **굵게 *기울임*** ~~삭제~~ ==강조== \\*별표\\* `a_b.*[]` [A & B](https://example.com/a_(b)?a=1&b=2)';
    const initial = render(source);
    let current = initial;
    for (let i = 0; i < 4; i++) current = roundTrip(editorHtmlToMarkdown(current));
    expect(current.innerHTML).toBe(initial.innerHTML);
  });

  it('preserves empty cells, escaped pipes, line breaks and formatted table headers', () => {
    const source = '| **제목** | 빈 칸 |\n| --- | --- |\n| A \\| B<br>다음 줄 | |';
    const root = roundTrip(source);
    expect(root.querySelector('th strong')?.textContent).toBe('제목');
    expect(root.querySelectorAll('td')).toHaveLength(2);
    expect(root.querySelector('td')?.textContent).toBe('A | B다음 줄');
    expect(root.querySelector('td br')).not.toBeNull();
  });

  it('keeps fences inside code blocks and literal Markdown unchanged', () => {
    const source = '````md\n```js\nconst x = "a_b";\n```\n````';
    expect(roundTrip(source).querySelector('code')?.textContent).toBe(render(source).querySelector('code')?.textContent);
  });

  it('retains code line breaks created by Enter in the browser', () => {
    const root = render('```js\nconst first = 1;\n```');
    root.querySelector('code')!.innerHTML = 'const first = 1;<br>const second = 2;<div>const third = 3;</div>';
    expect(roundTrip(editorHtmlToMarkdown(root)).querySelector('code')?.textContent)
      .toBe('const first = 1;\nconst second = 2;\nconst third = 3;\n');
  });

  it('preserves an empty code block when editing other content', () => {
    expect(roundTrip('```js\n\n```\n\n문단').querySelector('code')?.className).toBe('language-js');
  });

  it('serializes root text and nested browser-created blocks without dropping text', () => {
    const root = document.createElement('div');
    root.innerHTML = '직접 입력<div>다음 줄</div><p>문단<br>줄바꿈</p>';
    expect(editorHtmlToMarkdown(root)).toContain('직접 입력');
    expect(roundTrip(editorHtmlToMarkdown(root)).textContent).toContain('다음 줄');
  });

  it('saves the live checkbox state and does not mutate the editor DOM', () => {
    const root = render('- [ ] 검토');
    root.querySelector('input')!.checked = true;
    const html = root.innerHTML;
    expect(roundTrip(editorHtmlToMarkdown(root)).querySelector('input')?.checked).toBe(true);
    expect(root.innerHTML).toBe(html);
  });

  it('renders inline images as valid blocks and retains their caption', () => {
    const root = roundTrip('앞 문장 ![그림](/image.png) 뒷 문장');
    expect(root.querySelectorAll('figure')).toHaveLength(1);
    expect(root.querySelector('figcaption')?.textContent).toBe('그림');
    expect(root.textContent).toContain('앞 문장');
    expect(root.textContent).toContain('뒷 문장');
  });

  it('escapes raw HTML and rejects executable links and images', () => {
    const root = render('<script>alert(1)</script>\n\n[위험](javascript:alert) ![위험](data:text/html,test)\n\n<img src=x onerror=alert(1)>');
    expect(root.querySelector('script, img, a')).toBeNull();
    expect(root.textContent).toContain('<script>');
    expect(render('[안전](/documents/guide?a=1&b=2)').querySelector('a')?.getAttribute('href')).toBe('/documents/guide?a=1&b=2');
  });

  it.each(demoDocuments.map((doc) => [doc.title, doc.content_markdown]))('retains the content of existing document %s', (_title, content) => {
    const before = render(content);
    const after = roundTrip(content);
    const text = (root: HTMLElement) => root.textContent?.replace(/\s+/g, ' ').trim();
    expect(text(after)).toBe(text(before));
    for (const selector of ['h1', 'h2', 'h3', 'table', 'blockquote', 'hr', 'li', 'pre', 'a', 'img']) {
      expect(after.querySelectorAll(selector).length, selector).toBe(before.querySelectorAll(selector).length);
    }
  });
});
