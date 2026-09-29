import { describe, expect, it } from 'vitest';
import { mergeDriveMetadata, normalizeDriveUrl, readDriveMetadata, writeDriveMetadata } from '@/lib/document-drive';
import { renderDocumentMarkdown } from '@/lib/document-markdown';
import { buildSummaryFromMarkdown } from '@/lib/plain-editor';

const folder = 'https://drive.google.com/drive/folders/qa-folder?usp=drive_link';
const file = 'https://drive.google.com/file/d/qa-file/view?usp=sharing';
const body = '\n## 자료\n\n==검토=={pink}\n\n:::image-text\n\n![배치|left|w320|wrap](/image.png)\n\n옆 설명\n\n:::image-text-end\n\n## 참고\n\n[공식 사이트](https://example.com)\n';

describe('optional document Drive links', () => {
  it('accepts shared folders, files and Docs; trims input and treats empty as no link', () => {
    for (const url of [folder, file, 'https://docs.google.com/document/d/qa-doc/edit']) {
      expect(normalizeDriveUrl(`  ${url}  `)).toBe(url);
    }
    for (const value of [undefined, null, '', '   ']) expect(normalizeDriveUrl(value)).toBeNull();
  });

  it('rejects unsafe URLs and unrelated websites', () => {
    for (const value of [false, {}, 'javascript:alert(1)', 'http://drive.google.com/file',
      'https://drive.google.com.example.org/file', 'https://drive.google.com@evil.test/file',
      'https://user:password@drive.google.com/file', 'https://drive.google.com:3000/file',
      'https://drive.google.com/<img>', 'https://drive.google.com/a\\b',
      'https://drive.google.com/a\nb', 'https://drive.google.com/' + 'a'.repeat(2050)]) {
      expect(() => normalizeDriveUrl(value)).toThrow('공유 링크');
    }
  });

  it('adds, changes and removes the shortcut without changing any body characters', () => {
    const first = writeDriveMetadata(body, folder);
    expect(readDriveMetadata(first)).toEqual({ driveUrl: folder, body });
    const second = writeDriveMetadata(first, file);
    expect(readDriveMetadata(second)).toEqual({ driveUrl: file, body });
    expect(second.match(/curi:drive-url/g)).toHaveLength(1);
    expect(writeDriveMetadata(second, '')).toBe(body);
    expect(writeDriveMetadata(body, null)).toBe(body);
  });

  it('keeps a saved link during body-only updates, but supports explicit removal', () => {
    const previous = writeDriveMetadata(body, folder);
    expect(readDriveMetadata(mergeDriveMetadata('새 본문', previous))).toEqual({ driveUrl: folder, body: '새 본문' });
    expect(readDriveMetadata(mergeDriveMetadata(writeDriveMetadata('새 본문', file), previous)).driveUrl).toBe(file);
    expect(mergeDriveMetadata('새 본문', previous, null)).toBe('새 본문');
    expect(mergeDriveMetadata(previous, previous, '')).toBe(body);
  });

  it('does not show the storage header in rendered content or summaries', () => {
    const stored = writeDriveMetadata(body, folder);
    expect(renderDocumentMarkdown(stored)).toBe(renderDocumentMarkdown(body));
    expect(buildSummaryFromMarkdown(stored)).toBe(buildSummaryFromMarkdown(body));
  });

  it('does not interpret ordinary text, code samples or invalid headers as metadata', () => {
    for (const text of [body, '<!-- notes -->\n\n본문',
      '```markdown\n<!-- curi:drive-url ' + folder + ' -->\n\n```',
      '<!-- curi:drive-url javascript:alert(1) -->\n\n본문']) {
      expect(readDriveMetadata(text)).toEqual({ driveUrl: null, body: text });
    }
  });
});
