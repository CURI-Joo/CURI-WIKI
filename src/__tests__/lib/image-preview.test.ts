// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { createImagePreview, imagePreviewKey, loadImagePreview } from '@/lib/image-preview-server';
import { imagePreviewUrl } from '@/lib/image-preview';

async function sample() {
  return sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#c93678' } }).png().toBuffer();
}

describe('private image previews', () => {
  it('reduces large images within 1600px without changing original bytes', async () => {
    const original = await sample();
    const copy = Buffer.from(original);
    const preview = await createImagePreview(original);
    const metadata = await sharp(preview.bytes).metadata();
    expect(preview.bytes.length).toBeLessThan(original.length);
    expect(preview.contentType).toBe('image/webp');
    expect(metadata).toMatchObject({ width: 1600, height: 1200 });
    expect(original).toEqual(copy);
  });

  it('does not enlarge small images and rejects unreadable or oversized files', async () => {
    const small = await sharp({ create: { width: 80, height: 60, channels: 3, background: 'white' } }).png().toBuffer();
    expect(await sharp((await createImagePreview(small)).bytes).metadata()).toMatchObject({ width: 80, height: 60 });
    await expect(createImagePreview(Buffer.from('not an image'))).rejects.toThrow();
    await expect(createImagePreview(Buffer.alloc(10 * 1024 * 1024 + 1))).rejects.toThrow('size');
    await expect(createImagePreview(Buffer.from('<svg width="10" height="10"></svg>'))).rejects.toThrow('format');
  });

  it('reuses a stored preview without downloading or processing the original', async () => {
    const preview = await createImagePreview(await sample());
    const bucket = { download: vi.fn().mockResolvedValue({ data: new Blob([new Uint8Array(preview.bytes)], { type: preview.contentType }), error: null }), upload: vi.fn() };
    const result = await loadImagePreview(bucket, 'user/source.png');
    expect(result.bytes).toEqual(preview.bytes);
    expect(result.persist).toBeNull();
    expect(bucket.download).toHaveBeenCalledTimes(1);
    expect(bucket.download).toHaveBeenCalledWith(imagePreviewKey('user/source.png'));
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  it('creates a missing preview and persists it separately after the response', async () => {
    const original = await sample();
    const bucket = {
      download: vi.fn().mockResolvedValueOnce({ data: null, error: 'not found' })
        .mockResolvedValueOnce({ data: new Blob([new Uint8Array(original)], { type: 'image/png' }), error: null }),
      upload: vi.fn().mockResolvedValue({ error: null }),
    };
    const result = await loadImagePreview(bucket, 'user/source.png');
    expect(bucket.upload).not.toHaveBeenCalled();
    await result.persist?.();
    expect(bucket.upload).toHaveBeenCalledWith(imagePreviewKey('user/source.png'), result.bytes,
      { contentType: result.contentType, upsert: false, cacheControl: '31536000' });
    expect(bucket.download).toHaveBeenNthCalledWith(2, 'user/source.png');
  });

  it('only rewrites permanent local image addresses', () => {
    expect(imagePreviewUrl('/api/upload/photo-1/file')).toBe('/api/upload/photo-1/file?preview=1');
    for (const url of ['/photo.png', 'https://example.com/photo.png', '/api/upload/photo/file?preview=1', 'data:image/png;base64,AAA=']) {
      expect(imagePreviewUrl(url)).toBe(url);
    }
  });
});
