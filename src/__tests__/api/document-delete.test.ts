// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  user: { id: 'owner' } as { id: string } | null,
  profile: { role: 'member', status: 'approved' } as { role: string; status: string } | null,
  document: { id: 'doc-1', owner_id: 'owner' } as { id: string; owner_id: string } | null,
  deleteDocument: vi.fn(), deleteAttachments: vi.fn(), removeFiles: vi.fn(),
}));
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => false }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.user } }) },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: state.profile }) }) }) }),
}) }));
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => ({
  from: (table: string) => table === 'documents' ? {
    select: () => ({ eq: () => ({ single: async () => ({ data: state.document, error: null }) }) }),
    delete: () => ({ eq: state.deleteDocument }),
  } : {
    select: () => ({ eq: async () => ({ data: [{ id: 'photo', storage_key: 'owner/photo.png' }] }) }),
    delete: () => ({ eq: state.deleteAttachments }),
  },
  storage: { from: () => ({ remove: state.removeFiles }) },
}) }));
import { DELETE } from '@/app/api/documents/[id]/route';

const remove = () => DELETE(new NextRequest('https://wiki.example/api/documents/doc-1', { method: 'DELETE' }),
  { params: Promise.resolve({ id: 'doc-1' }) });

describe('document deletion authorization', () => {
  beforeEach(() => {
    state.user = { id: 'owner' };
    state.profile = { role: 'member', status: 'approved' };
    state.document = { id: 'doc-1', owner_id: 'owner' };
    for (const fn of [state.deleteDocument, state.deleteAttachments, state.removeFiles]) fn.mockReset().mockResolvedValue({ error: null });
  });

  it.each(['owner', 'admin'])('allows an approved %s', async id => {
    state.user = { id };
    state.profile!.role = id === 'admin' ? 'admin' : 'member';
    expect((await remove()).status).toBe(200);
    expect(state.deleteDocument).toHaveBeenCalledExactlyOnceWith('id', 'doc-1');
  });

  it.each(['anonymous', 'other', 'pending-owner', 'pending-admin', 'missing-profile'])(
    'blocks %s before deleting documents, attachments or files', async mode => {
      if (mode === 'anonymous') state.user = null;
      if (mode === 'other') state.user = { id: 'other' };
      if (mode.startsWith('pending-')) {
        state.profile!.status = 'pending';
        state.profile!.role = mode.endsWith('admin') ? 'admin' : 'member';
      }
      if (mode === 'missing-profile') state.profile = null;
      expect((await remove()).status).toBe(mode === 'anonymous' ? 401 : 403);
      expect(state.deleteDocument).not.toHaveBeenCalled();
      expect(state.deleteAttachments).not.toHaveBeenCalled();
      expect(state.removeFiles).not.toHaveBeenCalled();
    },
  );
});
