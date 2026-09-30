import { describe, expect, it } from 'vitest';
import { getDocumentHeadings, renderDocumentMarkdown } from '@/lib/document-markdown';

describe('document table of contents', () => {
  it('shows rendered labels without escaped punctuation, highlight or font-color markers', () => {
    const source = '# 1\\. 검토 개요\n\n## ==2\\. **지원사업별** 검토 결과=={pink}\n\n### {{color:blue}}==2-1. [서울 AI 허브](https://example.com)=={yellow}{{/color}}\n\n## 제안 *및* `확인` &amp; &#xAC80;토 ###';
    const headings = getDocumentHeadings(source);
    expect(headings.map(heading => heading.text)).toEqual(['1. 검토 개요', '2. 지원사업별 검토 결과', '2-1. 서울 AI 허브', '제안 및 확인 & 검토']);
    const reader = document.createElement('div');
    reader.innerHTML = renderDocumentMarkdown(source);
    expect(Array.from(reader.querySelectorAll('h1,h2,h3'), heading => ({ id: heading.id, text: heading.textContent })))
      .toEqual(headings.map(({ id, text }) => ({ id, text })));
  });

  it('excludes code headings and recognizes setext headings using the same parser as the reader', () => {
    const source = '소개\n====\n\n```markdown\n# 코드 안 제목\n```\n\n    ## 들여쓴 코드\n\n## 실제 제목\n\n#### 작은 제목';
    expect(getDocumentHeadings(source).map(({ text }) => text)).toEqual(['소개', '실제 제목']);
  });

  it('keeps intentional literal punctuation inside inline code', () => {
    expect(getDocumentHeadings('## `==문자==`와 `a\\.b` 설명')[0].text).toBe('==문자==와 a\\.b 설명');
    expect(getDocumentHeadings('## `&amp;` &amp; \\&amp;')[0].text).toBe('&amp; & &amp;');
  });
});
