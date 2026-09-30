import { describe, expect, it } from 'vitest';
import { isPublicDocumentImage } from '@/lib/public-document-image';

describe('published image access', () => {
  const origin = 'https://wiki.example';
  const doc = { category_id: 'cat-company', status: 'Published', content_markdown: '![사진](/api/upload/photo-1/file)' };
  it('accepts only an exact embedded image URL belonging to this wiki', () => {
    expect(isPublicDocumentImage(doc, 'photo-1', origin)).toBe(true);
    expect(isPublicDocumentImage({ ...doc, content_markdown: `![사진](${origin}/api/upload/photo-1/file)` }, 'photo-1', origin)).toBe(true);
    for (const content_markdown of ['[파일](/api/upload/photo-1/file)', '`![사진](/api/upload/photo-1/file)`',
      '![사진](https://other.example/api/upload/photo-1/file)', '![사진](/api/upload/photo-10/file)', '삭제된 사진']) {
      expect(isPublicDocumentImage({ ...doc, content_markdown }, 'photo-1', origin)).toBe(false);
    }
  });
  it('does not grant public access to drafts, archived documents, Secret or missing categories', () => {
    for (const changed of [{ status: 'Draft' }, { status: 'Archived' }, { category_id: 'cat-secret' }, { category_id: null }]) {
      expect(isPublicDocumentImage({ ...doc, ...changed }, 'photo-1', origin)).toBe(false);
    }
    expect(isPublicDocumentImage(null, 'photo-1', origin)).toBe(false);
  });
});
