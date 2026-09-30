// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  profile: { status: 'approved', role: 'member' },
  attachment: { storage_key: 'user/photo.png', document_id: 'doc-1', mime_type: 'image/png' } as Record<string, unknown> | null,
  document: { category_id: 'cat-company', status: 'Draft' } as Record<string, unknown> | null,
  documentError: null as unknown,
  candidates: [] as Record<string, unknown>[],
  preview: vi.fn(), signed: vi.fn(), after: vi.fn(),
}));
vi.mock('next/server', async importOriginal => ({ ...await importOriginal<typeof import('next/server')>(), after: mocks.after }));
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => false }));
vi.mock('@/lib/image-preview-server', () => ({ loadImagePreview: mocks.preview, PRIVATE_IMAGE_CACHE: 'private, max-age=300' }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: mocks.profile }) }) }) }),
}) }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => ({
  from: (table: string) => {
    const query = {
      select: () => query, eq: () => query, neq: () => query, ilike: () => query,
      single: async () => ({ data: table === 'attachments' ? mocks.attachment : mocks.document, error: table === 'documents' ? mocks.documentError : null }),
      limit: async () => ({ data: mocks.candidates, error: mocks.documentError }),
    };
    return query;
  },
  storage: { from: () => ({ createSignedUrl: mocks.signed }) },
}) }));
import { GET } from '@/app/api/upload/[id]/file/route';

const request = (preview = true) => GET(new NextRequest(`https://wiki.example/api/upload/photo/file${preview ? '?preview=1' : ''}`), { params: Promise.resolve({ id: 'photo' }) });

describe('image preview delivery', () => {
  beforeEach(() => {
    mocks.user = { id: 'u1' };
    mocks.profile = { status: 'approved', role: 'member' };
    mocks.attachment = { storage_key: 'user/photo.png', document_id: 'doc-1', mime_type: 'image/png' };
    mocks.document = { category_id: 'cat-company', status: 'Draft' };
    mocks.documentError = null;
    mocks.candidates = [];
    mocks.preview.mockReset().mockResolvedValue({ bytes: Buffer.from('preview'), contentType: 'image/webp', persist: null });
    mocks.signed.mockReset().mockResolvedValue({ data: { signedUrl: 'https://storage.example/original' }, error: null });
    mocks.after.mockReset();
  });

  it('returns preview bytes directly with a browser-only, per-session cache', async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(response.headers.get('cache-control')).toBe('private, max-age=300');
    expect(response.headers.get('vary')).toBe('Cookie, Authorization');
    expect(await response.text()).toBe('preview');
    expect(mocks.signed).not.toHaveBeenCalled();
  });

  it('allows anonymous access to an image embedded in a published non-Secret document', async () => {
    mocks.user = null;
    mocks.document = { category_id: 'cat-company', status: 'Published', content_markdown: '![배치도](/api/upload/photo/file)' };
    expect((await request()).status).toBe(200);
    expect((await request(false)).status).toBe(307);
    mocks.document.content_markdown = '이미지 삭제됨';
    expect((await request()).status).toBe(401);
    mocks.document.content_markdown = '![배치도](/api/upload/photo/file)';
    mocks.document.category_id = 'cat-secret';
    expect((await request()).status).toBe(401);
  });

  it('finds images uploaded before a new document was saved, without exposing unattached files', async () => {
    mocks.user = null;
    mocks.attachment!.document_id = null;
    expect((await request()).status).toBe(401);
    mocks.candidates = [{ category_id: 'cat-company', status: 'Published', content_markdown: '![배치도](/api/upload/photo/file)' }];
    expect((await request()).status).toBe(200);
    mocks.documentError = { message: 'lookup failed' };
    expect((await request()).status).toBe(401);
    mocks.documentError = null;
    mocks.attachment!.mime_type = 'application/pdf';
    expect((await request()).status).toBe(401);
  });

  it('persists new previews after responding and keeps original-file links unchanged', async () => {
    const persist = vi.fn();
    mocks.preview.mockResolvedValue({ bytes: Buffer.from('preview'), contentType: 'image/webp', persist });
    await request();
    expect(mocks.after).toHaveBeenCalledWith(persist);
    expect(persist).not.toHaveBeenCalled();
    mocks.preview.mockClear();
    const original = await request(false);
    expect(original.status).toBe(307);
    expect(original.headers.get('location')).toBe('https://storage.example/original');
    expect(mocks.preview).not.toHaveBeenCalled();
  });

  it('falls back to the original when optimization fails', async () => {
    mocks.preview.mockRejectedValue(new Error('unsupported format'));
    expect((await request()).headers.get('location')).toBe('https://storage.example/original');
  });

  it('never serves cached images to anonymous or unapproved users', async () => {
    mocks.user = null;
    expect((await request()).status).toBe(401);
    mocks.user = { id: 'u1' };
    mocks.profile.status = 'pending';
    expect((await request()).status).toBe(403);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.signed).not.toHaveBeenCalled();
  });

  it('checks Secret permission even when a preview already exists', async () => {
    mocks.document = { category_id: 'cat-secret' };
    expect((await request()).status).toBe(403);
    expect(mocks.preview).not.toHaveBeenCalled();
    mocks.profile.role = 'admin';
    expect((await request()).status).toBe(200);
  });

  it('fails closed if the image or its parent document cannot be found', async () => {
    mocks.attachment = null;
    expect((await request()).status).toBe(404);
    mocks.attachment = { storage_key: 'user/photo.png', document_id: 'deleted', mime_type: 'image/png' };
    mocks.document = null;
    expect((await request()).status).toBe(404);
    mocks.document = { category_id: 'cat-company' };
    mocks.documentError = { message: 'offline' };
    expect((await request()).status).toBe(404);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.signed).not.toHaveBeenCalled();
  });
});
