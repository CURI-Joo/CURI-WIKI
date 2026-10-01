// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  user: { id: 'owner' } as { id: string } | null,
  profile: { status: 'approved', role: 'member' },
  document: { owner_id: 'owner', category_id: 'cat-company' } as { owner_id: string; category_id: string } | null,
  attachment: { id: 'file', document_id: 'doc', uploaded_by: 'uploader', storage_key: 'uploader/file.pdf' } as Record<string, unknown>,
  upload: vi.fn(), remove: vi.fn(), insert: vi.fn(), deleteFile: vi.fn(),
}));
vi.mock('next/server', async importOriginal => ({ ...await importOriginal<typeof import('next/server')>(), after: vi.fn() }));
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => false }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.user } }) },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: state.profile }) }) }) }),
}) }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => ({
  storage: { from: () => ({ upload: state.upload, remove: state.remove }) },
  from: (table: string) => ({
    select: () => ({ eq: () => ({ single: async () => ({ data: table === 'documents' ? state.document : state.attachment }) }) }),
    insert: (value: Record<string, unknown>) => {
      state.insert(value);
      return { select: () => ({ single: async () => ({ data: { id: 'file', ...value }, error: null }) }) };
    },
    delete: () => ({ eq: state.deleteFile }),
  }),
}) }));

import { POST } from '@/app/api/upload/route';
import { DELETE } from '@/app/api/upload/[id]/route';

const upload = (documentId: string | null = 'doc') => {
  const form = new FormData();
  form.set('file', new Blob(['file contents'], { type: 'application/pdf' }), 'file.pdf');
  if (documentId) form.set('document_id', documentId);
  return POST(new NextRequest('https://wiki.example/api/upload', { method: 'POST', body: form }));
};
const remove = () => DELETE(new NextRequest('https://wiki.example/api/upload/file', { method: 'DELETE' }),
  { params: Promise.resolve({ id: 'file' }) });

describe('document attachment permissions', () => {
  beforeEach(() => {
    state.user = { id: 'owner' };
    state.profile = { status: 'approved', role: 'member' };
    state.document = { owner_id: 'owner', category_id: 'cat-company' };
    state.attachment = { id: 'file', document_id: 'doc', uploaded_by: 'uploader', storage_key: 'uploader/file.pdf' };
    for (const fn of [state.upload, state.remove, state.insert, state.deleteFile]) fn.mockReset().mockResolvedValue({ error: null });
  });

  it.each(['owner', 'admin'])('allows the approved %s to attach and remove document files', async id => {
    state.user = { id };
    state.profile.role = id === 'admin' ? 'admin' : 'member';
    expect((await upload()).status).toBe(200);
    expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({ document_id: 'doc', uploaded_by: id }));
    expect((await remove()).status).toBe(200);
    expect(state.deleteFile).toHaveBeenCalled();
  });

  it.each(['other', 'uploader', 'pending-owner', 'pending-admin', 'anonymous'])(
    'denies %s before touching files or attachment records', async mode => {
      state.user = mode === 'anonymous' ? null : { id: mode.replace('pending-', '') };
      if (mode.startsWith('pending')) state.profile.status = 'pending';
      if (mode.endsWith('admin')) state.profile.role = 'admin';
      const status = mode === 'anonymous' ? 401 : 403;
      expect((await upload()).status).toBe(status);
      expect((await remove()).status).toBe(status);
      for (const fn of [state.upload, state.insert, state.remove, state.deleteFile]) expect(fn).not.toHaveBeenCalled();
    },
  );

  it('denies a non-admin owner access to Secret attachments', async () => {
    state.document!.category_id = 'cat-secret';
    expect((await upload()).status).toBe(403);
    expect((await remove()).status).toBe(403);
    expect(state.upload).not.toHaveBeenCalled();
    expect(state.remove).not.toHaveBeenCalled();
  });

  it('rejects a missing parent document', async () => {
    state.document = null;
    expect((await upload()).status).toBe(404);
    expect((await remove()).status).toBe(404);
    expect(state.upload).not.toHaveBeenCalled();
    expect(state.remove).not.toHaveBeenCalled();
  });

  it('allows uploads before a new document exists and keeps unattached-file ownership checks', async () => {
    expect((await upload(null)).status).toBe(200);
    state.attachment.document_id = null;
    expect((await remove()).status).toBe(403);
    state.user = { id: 'uploader' };
    expect((await remove()).status).toBe(200);
  });
});
