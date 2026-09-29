// @vitest-environment node
import sharp from 'sharp';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readImageFile, requireUploadedImages } from '@/lib/mcp/wiki/images';
import { runTool, type ToolContext } from '@/lib/mcp/wiki/tools';
import { memoryWikiStore } from './fakes';

let png: Buffer;
let jpeg: Buffer;
beforeAll(async () => {
  const image = sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } });
  png = await image.png().toBuffer();
  jpeg = await image.jpeg().toBuffer();
});

describe('actual image uploads from MCP', () => {
  it('keeps the original bytes and detects the real file type', async () => {
    const file = await readImageFile({ data_base64: png.toString('base64'), file_name: '../../screenshot.jpeg' });
    expect(file.bytes).toEqual(png);
    expect(file.file_name).toBe('screenshot.png');
    expect(file.mime_type).toBe('image/png');
  });

  it('rejects abbreviated tool output and corrupt files before storage', async () => {
    await expect(readImageFile({ data_base64: '/9j/AAA[... ELLIPSIZATION ...]BBB==' })).rejects.toThrow('잘렸거나');
    await expect(readImageFile({ data_base64: jpeg.subarray(0, jpeg.length - 30).toString('base64') })).rejects.toThrow('열 수 없는');
    await expect(readImageFile({ data_base64: Buffer.from('<html>login</html>').toString('base64') })).rejects.toThrow('열 수 없는');
  });

  it('requires a single original source and rejects local network URLs', async () => {
    await expect(readImageFile({})).rejects.toThrow('하나');
    await expect(readImageFile({ data_base64: 'AAA=', file_url: 'https://example.com/file.png' })).rejects.toThrow('하나');
    await expect(readImageFile({ file_url: 'http://127.0.0.1/file.png' })).rejects.toThrow('내부 네트워크');
  });

  it('uploads bytes with the connected account and links the file to its document', async () => {
    const store = memoryWikiStore([{ id: 'u1', email: null, display_name: null, approved: true }]);
    const upload = vi.spyOn(store, 'uploadImage');
    const ctx: ToolContext = { store, auth: { userId: 'u1', clientId: 'client', scopes: ['wiki.read', 'wiki.write'] }, baseUrl: 'https://wiki.example', defaultCategory: 'company' };
    await runTool('create_document', { title: '사진', slug: 'photos', content_markdown: '본문', status: 'Draft' }, ctx);
    const result = await runTool('upload_image', { document_id_or_slug: 'photos', file_name: 'shot.png', data_base64: png.toString('base64') }, ctx);
    expect(result).toMatchObject({ status: 'uploaded', markdown_url: '/api/upload/test-attachment/file' });
    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ bytes: png, document_id: 'doc_1' }), 'u1');
    await runTool('update_document', { id_or_slug: 'photos', content_markdown: '본문\n\n![사진](/api/upload/test-attachment/file)', status: 'Published' }, ctx);
    expect(store.docs[0].status).toBe('Published');
    await expect(runTool('create_document', { title: '깨진 사진', content_markdown: '![사진](data:image/png;base64,AAA=)' }, ctx)).rejects.toThrow('upload_image');
    await expect(runTool('upload_image', { document_id_or_slug: 'photos', file_name: 'shot.png', data_base64: 'AAA=' }, { ...ctx, auth: { ...ctx.auth, scopes: ['wiki.read'] } })).rejects.toThrow('wiki.write');
    expect(upload).toHaveBeenCalledTimes(1);
  });
});

describe('persisted image references', () => {
  const base = 'https://wiki.example';
  it.each(['data:image/png;base64,AAA=', 'https://temporary.example/photo.png', 'sandbox:/mnt/data/photo.png', 'blob:https://wiki.example/id'])('rejects a new non-uploaded image: %s', (source) => {
    expect(() => requireUploadedImages(`![사진](${source})`, base)).toThrow('upload_image');
  });
  it('accepts stored attachments and leaves existing article images unchanged', () => {
    expect(() => requireUploadedImages('![사진](/api/upload/attachment-1/file)', base)).not.toThrow();
    const previous = '![기존](https://example.com/old.png)';
    expect(() => requireUploadedImages(previous + '\n\n수정한 문장', base, previous)).not.toThrow();
  });
  it('checks reference-style images without treating code examples as images', () => {
    expect(() => requireUploadedImages('![사진][image]\n\n[image]: https://example.com/file.png', base)).toThrow('upload_image');
    expect(() => requireUploadedImages('![사진](data:image/jpeg;base64,AAAA[... ELLIPSIZATION ...]BBBB==)', base)).toThrow('upload_image');
    expect(() => requireUploadedImages('`![예시](https://example.com/file.png)`', base)).not.toThrow();
  });
});
