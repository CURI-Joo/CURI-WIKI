import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Document } from '@/types';

const mocks = vi.hoisted(() => ({
  auth: {
    session: null as { user: { id: string } } | null,
    profile: null as { status: string; role: string } | null,
    loading: false,
  },
  query: vi.fn(),
}));

vi.mock('@/lib/auth-context', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/lib/demo-mode', () => ({ isDemoMode: () => false }));
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ order: mocks.query }) }),
  }),
}));

import { useDocumentStore } from '@/lib/document-store';

function document(id: string, status: Document['status'] = 'Published', category = 'cat-company'): Document {
  return {
    id, title: id, slug: id, summary: '', content_markdown: id,
    category_id: category, status, owner_id: 'owner', created_by: 'owner', updated_by: 'owner',
    visibility: 'COMPANY', external_status: 'INTERNAL_ONLY',
    created_at: '', updated_at: '', published_at: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('document store uses session RLS results', () => {
  beforeEach(() => {
    mocks.auth.session = null;
    mocks.auth.profile = null;
    mocks.auth.loading = false;
    mocks.query.mockReset().mockResolvedValue({ data: [], error: null });
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('accepts an empty RLS result without calling the public API', async () => {
    const { result } = renderHook(() => useDocumentStore());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.documents).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('loads public documents and refreshes through the same RLS query', async () => {
    const published = document('published');
    mocks.query.mockResolvedValueOnce({ data: [published], error: null });
    const { result } = renderHook(() => useDocumentStore());
    await waitFor(() => expect(result.current.documents).toEqual([published]));
    await act(() => result.current.refresh());
    expect(result.current.documents).toEqual([]);
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves drafts and secret documents returned for an approved admin', async () => {
    mocks.auth.session = { user: { id: 'admin' } };
    mocks.auth.profile = { status: 'approved', role: 'admin' };
    const documents = [document('draft', 'Draft'), document('secret', 'Published', 'cat-secret')];
    mocks.query.mockResolvedValue({ data: documents, error: null });
    const { result } = renderHook(() => useDocumentStore());
    await waitFor(() => expect(result.current.documents).toEqual(documents));
  });

  it('hides private documents immediately on logout and discards a late authenticated response', async () => {
    mocks.auth.session = { user: { id: 'admin' } };
    mocks.auth.profile = { status: 'approved', role: 'admin' };
    const secret = document('secret', 'Draft', 'cat-secret');
    mocks.query.mockResolvedValueOnce({ data: [secret], error: null });
    const { result, rerender } = renderHook(() => useDocumentStore());
    await waitFor(() => expect(result.current.documents).toEqual([secret]));

    const stale = deferred<{ data: Document[]; error: null }>();
    const anonymous = deferred<{ data: Document[]; error: null }>();
    mocks.query.mockReturnValueOnce(stale.promise).mockReturnValueOnce(anonymous.promise);
    let refresh!: Promise<void>;
    act(() => { refresh = result.current.refresh(); });
    mocks.auth.session = null;
    mocks.auth.profile = null;
    rerender();
    expect(result.current.documents).toEqual([]);
    expect(result.current.loading).toBe(true);
    await act(async () => { stale.resolve({ data: [secret], error: null }); await refresh; });
    expect(result.current.documents).toEqual([]);
    await act(async () => { anonymous.resolve({ data: [], error: null }); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.documents).toEqual([]);
  });

  it('refetches when a user signs in and becomes approved', async () => {
    const { result, rerender } = renderHook(() => useDocumentStore());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const draft = document('draft', 'Draft');
    mocks.query.mockResolvedValue({ data: [draft], error: null });
    mocks.auth.session = { user: { id: 'member' } };
    mocks.auth.profile = { status: 'approved', role: 'member' };
    rerender();
    await waitFor(() => expect(result.current.documents).toEqual([draft]));
  });

  it.each(['error', 'rejection'])('clears stale data on a query %s without a service-role fallback', async (failure) => {
    mocks.query.mockResolvedValueOnce({ data: [document('published')], error: null });
    const { result } = renderHook(() => useDocumentStore());
    await waitFor(() => expect(result.current.documents).toHaveLength(1));
    if (failure === 'error') mocks.query.mockResolvedValueOnce({ data: null, error: { message: 'failed' } });
    else mocks.query.mockRejectedValueOnce(new Error('offline'));
    await act(() => result.current.refresh());
    expect(result.current.documents).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('waits for initial authentication before querying', async () => {
    mocks.auth.loading = true;
    const { result, rerender } = renderHook(() => useDocumentStore());
    expect(mocks.query).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
    mocks.auth.loading = false;
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
});
