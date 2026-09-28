import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: {
    session: null as { user: { id: string } } | null,
    profile: null as { status: string; role: string } | null,
    loading: false,
  },
  from: vi.fn(), rpc: vi.fn(), select: vi.fn(), eq: vi.fn(), result: vi.fn(),
}));

vi.mock('@/lib/auth-context', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => false }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => mocks }));

import { useDocumentAuthor } from '@/lib/profiles-store';

describe('document author display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.session = null;
    mocks.auth.profile = null;
    mocks.auth.loading = false;
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.result });
    mocks.rpc.mockReturnValue({ maybeSingle: mocks.result });
    mocks.result.mockResolvedValue({ data: { id: 'owner', name: 'Author' }, error: null });
  });
  afterEach(cleanup);

  it('uses the restricted RPC for anonymous readers without querying profiles', async () => {
    const { result } = renderHook(() => useDocumentAuthor({ id: 'public', owner_id: 'owner' }));
    await waitFor(() => expect(result.current?.name).toBe('Author'));
    expect(mocks.rpc).toHaveBeenCalledWith('get_public_document_author', { document_id: 'public' });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('keeps approved users on the existing profile RLS path for private documents', async () => {
    mocks.auth.session = { user: { id: 'admin' } };
    mocks.auth.profile = { status: 'approved', role: 'admin' };
    const { result } = renderHook(() => useDocumentAuthor({ id: 'secret', owner_id: 'owner' }));
    await waitFor(() => expect(result.current?.name).toBe('Author'));
    expect(mocks.select).toHaveBeenCalledWith('id, name');
    expect(mocks.eq).toHaveBeenCalledWith('id', 'owner');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('does not keep a private author name after logout', async () => {
    mocks.auth.session = { user: { id: 'admin' } };
    mocks.auth.profile = { status: 'approved', role: 'admin' };
    const { result, rerender } = renderHook(() => useDocumentAuthor({ id: 'secret', owner_id: 'owner' }));
    await waitFor(() => expect(result.current?.name).toBe('Author'));
    mocks.result.mockResolvedValue({ data: null, error: null });
    mocks.auth.session = null;
    mocks.auth.profile = null;
    rerender();
    expect(result.current).toBeNull();
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('does not query authors of documents the store did not return', () => {
    const { result } = renderHook(() => useDocumentAuthor(undefined));
    expect(result.current).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('handles an unavailable author without breaking the document view', async () => {
    mocks.result.mockResolvedValue({ data: null, error: { message: 'unavailable' } });
    const { result } = renderHook(() => useDocumentAuthor({ id: 'public', owner_id: 'owner' }));
    await waitFor(() => expect(mocks.result).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
