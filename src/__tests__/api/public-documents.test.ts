// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  error: null as { message: string } | null,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      let rows = db.rows;
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          rows = rows.filter((row) => row[key] === value);
          return query;
        },
        neq: (key: string, value: unknown) => {
          rows = rows.filter((row) => row[key] !== value);
          return query;
        },
        order: async () => ({ data: rows, error: db.error }),
      };
      return query;
    },
  }),
}));

import { GET } from '@/app/api/wiki/public-documents/route';

describe('public documents API', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role');
    db.error = null;
    db.rows = [
      { id: 'public', status: 'Published', category_id: 'cat-company' },
      { id: 'draft', status: 'Draft', category_id: 'cat-company' },
      { id: 'archived', status: 'Archived', category_id: 'cat-company' },
      { id: 'secret-published', status: 'Published', category_id: 'cat-secret' },
      { id: 'secret-draft', status: 'Draft', category_id: 'cat-secret' },
    ];
  });

  afterEach(() => vi.unstubAllEnvs());

  it('returns only published, non-secret documents without requiring a session', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ documents: [db.rows[0]] });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('returns an empty list when no public documents exist', async () => {
    db.rows = db.rows.slice(1);
    expect(await (await GET()).json()).toEqual({ documents: [] });
  });

  it('does not return data when Supabase reports an error', async () => {
    db.error = { message: 'database unavailable' };
    const response = await GET();
    expect(response.status).toBe(500);
    expect(await response.json()).not.toHaveProperty('documents');
  });

  it('fails closed when the service role is not configured', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect((await GET()).status).toBe(500);
  });
});
