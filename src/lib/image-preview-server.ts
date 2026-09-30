import { createHash } from 'node:crypto';
import sharp from 'sharp';

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
export const PRIVATE_IMAGE_CACHE = 'private, max-age=300';

export function imagePreviewKey(storageKey: string) {
  return `image-previews/v1/${createHash('sha256').update(storageKey).digest('hex')}.webp`;
}

export async function createImagePreview(bytes: Buffer) {
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('Invalid image size');
  const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'warning' });
  const metadata = await image.metadata();
  const originalType = TYPES[metadata.format ?? ''];
  if (!originalType) throw new Error('Unsupported preview format');
  // Preserve animation. SVGs and other formats use the original-file fallback.
  if ((metadata.pages ?? 1) > 1) return { bytes, contentType: originalType };
  const preview = await image.rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 }).toBuffer();
  return preview.length < bytes.length
    ? { bytes: preview, contentType: 'image/webp' }
    : { bytes, contentType: originalType };
}

type Bucket = {
  download(path: string): Promise<{ data: Blob | null; error: unknown }>;
  upload(path: string, body: Uint8Array, options: { contentType: string; upsert: boolean; cacheControl: string }): Promise<{ error: unknown }>;
};

/** Stored in the same private bucket as the original, never in a public CDN cache. */
export async function loadImagePreview(bucket: Bucket, storageKey: string) {
  const key = imagePreviewKey(storageKey);
  const cached = await bucket.download(key);
  if (!cached.error && cached.data && Object.values(TYPES).includes(cached.data.type) && cached.data.size <= MAX_BYTES) {
    return { bytes: Buffer.from(await cached.data.arrayBuffer()), contentType: cached.data.type, persist: null };
  }
  const original = await bucket.download(storageKey);
  if (original.error || !original.data) throw new Error('Image download failed');
  const preview = await createImagePreview(Buffer.from(await original.data.arrayBuffer()));
  return {
    ...preview,
    persist: async () => {
      // A racing request may already have created the immutable preview.
      await bucket.upload(key, preview.bytes, { contentType: preview.contentType, upsert: false, cacheControl: '31536000' });
    },
  };
}
