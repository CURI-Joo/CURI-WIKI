// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  profile: { status: 'approved', role: 'member' },
  document: { category_id: 'cat-company', owner_id: 'u1' } as Record<string, unknown> | null,
  attachment: null as Record<string, unknown> | null,
  inserted: null as Record<string, unknown> | null,
  lookupError: null as unknown,
  info: vi.fn(), sign: vi.fn(), remove: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.user } }) },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: state.profile }) }) }) }),
}) }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => ({
  storage: { from: () => ({ createSignedUploadUrl: state.sign, info: state.info, remove: state.remove }) },
  from: (table: string) => {
    const query = {
      select: () => query, eq: () => query,
      upsert: (value: Record<string, unknown>) => { state.inserted = value; return query; },
      maybeSingle: async () => ({ data: state.attachment, error: state.lookupError }),
      single: async () => ({ data: table === 'documents' ? state.document : state.inserted }),
    };
    return query;
  },
}) }));
import { POST } from '@/app/api/upload/video/route';
import { readVideoUpload, signVideoUpload } from '@/lib/video-upload-ticket';

const input = { action: 'init', file_name: '시연.mp4', mime_type: 'video/mp4', file_size: 6 * 1024 * 1024, document_id: 'doc1' };
const call = (body: Record<string, unknown>) => POST(new NextRequest('https://wiki.example/api/upload/video', { method: 'POST', body: JSON.stringify(body) }));

describe('direct video upload', () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-video-signing-key';
    state.user = { id: 'u1' };
    state.profile = { status: 'approved', role: 'member' };
    state.document = { category_id: 'cat-company', owner_id: 'u1' };
    state.attachment = state.inserted = null;
    state.lookupError = null;
    state.sign.mockReset().mockResolvedValue({ data: { signedUrl: 'https://storage.example/upload' } });
    state.info.mockReset().mockResolvedValue({ data: { size: input.file_size, contentType: input.mime_type } });
    state.remove.mockReset().mockResolvedValue({ error: null });
  });

  it('authorizes a file above the app request limit and only records it after Storage verifies completion', async () => {
    const initial = await call(input);
    expect(initial.status).toBe(200);
    expect(state.inserted).toBeNull();
    const { ticket } = await initial.json();
    const complete = await call({ action: 'complete', ticket });
    expect(complete.status).toBe(200);
    expect(state.inserted).toMatchObject({ file_size: input.file_size, mime_type: 'video/mp4', document_id: 'doc1', uploaded_by: 'u1' });
    const result = await complete.json();
    expect(result.markdown_url).toBe(`/api/upload/${state.inserted!.id}/file`);
    expect(state.sign).toHaveBeenCalledWith(expect.stringMatching(/^u1\/videos\/.+\.mp4$/), { upsert: false });
    state.attachment = state.inserted;
    expect((await call({ action: 'complete', ticket })).status).toBe(200);
    await call({ action: 'cancel', ticket });
    expect(state.remove).not.toHaveBeenCalled();
  });

  it('rejects unsupported, empty and oversized files before issuing a token', async () => {
    for (const change of [{ mime_type: 'text/html' }, { file_size: 0 }, { file_size: 50 * 1024 * 1024 + 1 }]) {
      expect((await call({ ...input, ...change })).status).toBe(400);
    }
    expect(state.sign).not.toHaveBeenCalled();
  });

  it('checks sign-in, approval, missing documents and Secret permissions before uploading', async () => {
    state.user = null;
    expect((await call(input)).status).toBe(401);
    state.user = { id: 'u1' };
    state.profile.status = 'pending';
    expect((await call(input)).status).toBe(403);
    state.profile.status = 'approved';
    state.document = null;
    expect((await call(input)).status).toBe(404);
    state.document = { category_id: 'cat-secret' };
    expect((await call(input)).status).toBe(403);
    expect(state.sign).not.toHaveBeenCalled();
    state.profile.role = 'admin';
    expect((await call(input)).status).toBe(200);
  });

  it('rejects forged, expired and another user’s tickets', async () => {
    const { ticket } = await (await call(input)).json();
    const decoded = readVideoUpload(ticket, 'u1')!;
    const tampered = Buffer.from(JSON.stringify({ ...decoded, file_size: 1 })).toString('base64url') + '.' + ticket.split('.')[1];
    for (const invalid of [tampered, signVideoUpload({ ...decoded, expires: 1 })]) {
      expect((await call({ action: 'complete', ticket: invalid })).status).toBe(400);
    }
    state.user = { id: 'u2' };
    expect((await call({ action: 'complete', ticket })).status).toBe(400);
    expect(state.info).not.toHaveBeenCalled();
    expect(state.inserted).toBeNull();
  });

  it('rejects partial or mismatched uploads and rechecks Secret access at completion', async () => {
    const { ticket } = await (await call(input)).json();
    state.info.mockResolvedValueOnce({ data: null, error: {} });
    expect((await call({ action: 'complete', ticket })).status).toBe(400);
    state.info.mockResolvedValueOnce({ data: { size: 10, contentType: 'video/mp4' } });
    expect((await call({ action: 'complete', ticket })).status).toBe(400);
    expect(state.remove).toHaveBeenCalledTimes(1);
    state.document = { category_id: 'cat-secret' };
    expect((await call({ action: 'complete', ticket })).status).toBe(403);
    expect(state.inserted).toBeNull();
  });

  it('never deletes a possibly completed upload when the record lookup fails', async () => {
    const { ticket } = await (await call(input)).json();
    state.lookupError = { message: 'offline' };
    expect((await call({ action: 'cancel', ticket })).status).toBe(500);
    expect(state.remove).not.toHaveBeenCalled();
    state.lookupError = null;
    state.document = null;
    expect((await call({ action: 'cancel', ticket })).status).toBe(200);
    expect(state.remove).toHaveBeenCalledTimes(1);
  });

  it('requires ownership both when preparing and completing a video upload', async () => {
    state.document!.owner_id = 'other';
    expect((await call(input)).status).toBe(403);
    expect(state.sign).not.toHaveBeenCalled();
    state.document!.owner_id = 'u1';
    const { ticket } = await (await call(input)).json();
    state.document!.owner_id = 'other';
    expect((await call({ action: 'complete', ticket })).status).toBe(403);
    expect(state.inserted).toBeNull();
    expect(state.info).not.toHaveBeenCalled();
  });
});
