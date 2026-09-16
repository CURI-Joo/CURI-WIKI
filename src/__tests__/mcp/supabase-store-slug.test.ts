import { describe, expect, it } from 'vitest';
import { createSupabaseWikiStore, type SupabaseLike } from '@/lib/mcp/supabase-store';

type Row = {
  id: string;
  slug: string;
  title: string;
  category_id: string;
  summary?: string | null;
  content_markdown?: string;
  status?: string;
  tags?: string[];
  source_url?: string | null;
  created_by?: string;
  updated_at?: string;
};

function makeDb(seed: { docs: Row[] }) {
  const calls: Array<{ table: string; column: string; value: string; op: 'select' | 'update' }> = [];

  const categories = [{ id: 'cat-company', slug: 'company', name: 'Company' }];
  const docs = [...seed.docs];

  const db: SupabaseLike = {
    from(table: string) {
      return {
        select(_fields: string) {
          if (table === 'categories') {
            return Promise.resolve({ data: categories, error: null });
          }

          return {
            eq(column: string, value: string) {
              calls.push({ table, column, value, op: 'select' });
              return {
                maybeSingle: async () => ({
                  data: docs.find((row) => (row as Record<string, unknown>)[column] === value) ?? null,
                  error: null,
                }),
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          return {
            eq(column: string, value: string) {
              calls.push({ table, column, value, op: 'update' });
              return {
                or() {
                  throw new Error('or() should not be called');
                },
                select() {
                  return {
                    single: async () => {
                      const found = docs.find(
                        (row) => (row as Record<string, unknown>)[column] === value,
                      );
                      if (!found) return { data: null, error: { message: 'not found' } };
                      Object.assign(found, payload);
                      return { data: found, error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    auth: {
      admin: {
        getUserById: async () => ({ data: null, error: null }),
      },
    },
    rpc: async () => ({ data: null, error: null }),
  };

  return { db, calls };
}

describe('createSupabaseWikiStore id/slug lookup', () => {
  it('getDocument uses slug branch for non-uuid input', async () => {
    const { db, calls } = makeDb({
      docs: [
        { id: 'doc-1', slug: 'hello-world', title: 'Hello', category_id: 'cat-company', created_by: 'u1' },
      ],
    });
    const store = createSupabaseWikiStore(db);

    const result = await store.getDocument('hello-world');

    expect(result?.slug).toBe('hello-world');
    expect(calls.some((c) => c.op === 'select' && c.column === 'slug' && c.value === 'hello-world')).toBe(true);
    expect(calls.some((c) => c.op === 'select' && c.column === 'id' && c.value === 'hello-world')).toBe(false);
  });

  it('getDocument uses id branch for generic uuid-pattern input', async () => {
    const id = '123e4567-e89b-02d3-a456-426614174000';
    const { db, calls } = makeDb({
      docs: [{ id, slug: 'hello-world', title: 'Hello', category_id: 'cat-company', created_by: 'u1' }],
    });
    const store = createSupabaseWikiStore(db);

    await store.getDocument(id);

    expect(calls.some((c) => c.op === 'select' && c.column === 'id' && c.value === id)).toBe(true);
    expect(calls.some((c) => c.op === 'select' && c.column === 'slug' && c.value === id)).toBe(false);
  });

  it('updateDocument uses slug branch for non-uuid input', async () => {
    const { db, calls } = makeDb({
      docs: [
        { id: 'doc-1', slug: 'hello-world', title: 'Hello', category_id: 'cat-company', created_by: 'u1' },
      ],
    });
    const store = createSupabaseWikiStore(db);

    const updated = await store.updateDocument('hello-world', { title: 'Updated' }, 'u2');

    expect(updated.title).toBe('Updated');
    expect(calls.some((c) => c.op === 'update' && c.column === 'slug' && c.value === 'hello-world')).toBe(true);
    expect(calls.some((c) => c.op === 'update' && c.column === 'id' && c.value === 'hello-world')).toBe(false);
  });
});
