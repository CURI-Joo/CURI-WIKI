import { describe, expect, it, vi } from 'vitest';
import { createSupabaseWikiStore, type SupabaseLike } from '@/lib/mcp/supabase-store';
import { readDriveMetadata, writeDriveMetadata } from '@/lib/document-drive';

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

  it('resolves document IDs returned by the live wiki, including the doc- prefix', async () => {
    const id = 'doc-123e4567-e89b-02d3-a456-426614174000';
    const { db, calls } = makeDb({ docs: [{ id, slug: 'photos', title: 'Photos', category_id: 'cat-company' }] });
    const store = createSupabaseWikiStore(db);
    expect((await store.getDocument(id))?.id).toBe(id);
    expect(calls.at(-1)).toMatchObject({ column: 'id', value: id });
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

describe('MCP image storage', () => {
  it.each([false, true])('stores original bytes and cleans up on metadata failure: %s', async (failRecord) => {
    const upload = vi.fn(async (..._args: unknown[]) => ({ error: null }));
    const remove = vi.fn(async () => ({}));
    const insert = vi.fn(() => ({ select: () => ({ single: async () => failRecord
      ? { data: null, error: { message: 'database failed' } }
      : { data: { id: 'image-1' }, error: null } }) }));
    const db = makeDb({ docs: [] }).db;
    db.storage = { from: vi.fn(() => ({ upload, remove })) };
    db.from = vi.fn(() => ({ insert }));
    const store = createSupabaseWikiStore(db);
    const bytes = new Uint8Array([1, 2, 3]);
    const result = store.uploadImage({ bytes, file_name: 'photo.png', mime_type: 'image/png', document_id: 'doc-1' }, 'user-1');
    if (failRecord) {
      await expect(result).rejects.toThrow('database failed');
      expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
    } else {
      await expect(result).resolves.toEqual({ id: 'image-1', markdown_url: '/api/upload/image-1/file' });
      expect(remove).not.toHaveBeenCalled();
    }
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^user-1\/.+\.png$/), bytes, { contentType: 'image/png', upsert: false });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ document_id: 'doc-1', uploaded_by: 'user-1', file_size: 3 }));
  });
});

describe('MCP Drive shortcut persistence', () => {
  const driveUrl = 'https://drive.google.com/drive/folders/qa-folder';
  const makeRow = (): Row => ({ id: 'doc-1', slug: 'drive', title: '자료', category_id: 'cat-company',
    source_url: 'https://example.com/original', content_markdown: '## 기존 본문\n\n내용' });

  it('stores a Drive link on creation without requiring a new database column', async () => {
    const { db } = makeDb({ docs: [] });
    const insert = vi.fn((payload: Record<string, unknown>) => ({ select: () => ({
      single: async () => ({ data: { ...makeRow(), ...payload }, error: null }),
    }) }));
    db.from = table => table === 'documents' ? { insert } : {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'cat-company' }, error: null }) }) }),
    };
    const created = await createSupabaseWikiStore(db).createDocument({
      title: '자료', slug: 'drive', category_slug: 'company', summary: '', status: 'Published', tags: [],
      source_url: 'https://example.com/original', content_markdown: '## 본문', drive_url: driveUrl,
    }, 'user-1');
    expect(created).toMatchObject({ drive_url: driveUrl, content_markdown: '## 본문', source_url: 'https://example.com/original' });
    expect(insert.mock.calls[0][0]).not.toHaveProperty('drive_url');
    expect(readDriveMetadata(insert.mock.calls[0][0].content_markdown as string).driveUrl).toBe(driveUrl);
  });

  it('exposes a separate link and keeps it when a plugin replaces only the body', async () => {
    const row = makeRow();
    row.content_markdown = writeDriveMetadata(row.content_markdown!, driveUrl);
    const store = createSupabaseWikiStore(makeDb({ docs: [row] }).db);
    expect(await store.getDocument('drive')).toMatchObject({ drive_url: driveUrl, content_markdown: '## 기존 본문\n\n내용' });
    const updated = await store.updateDocument('drive', { content_markdown: '## 수정 본문' }, 'user-1');
    expect(updated).toMatchObject({ drive_url: driveUrl, content_markdown: '## 수정 본문', source_url: 'https://example.com/original' });
    expect(readDriveMetadata(row.content_markdown!)).toEqual({ driveUrl, body: '## 수정 본문' });
  });

  it('adds, replaces and clears just the link while preserving the body and original source', async () => {
    const row = makeRow();
    const originalBody = row.content_markdown;
    const store = createSupabaseWikiStore(makeDb({ docs: [row] }).db);
    for (const link of [driveUrl, 'https://docs.google.com/document/d/qa/edit', null]) {
      const updated = await store.updateDocument('drive', { drive_url: link }, 'user-1');
      expect(updated).toMatchObject({ drive_url: link, content_markdown: originalBody, source_url: 'https://example.com/original' });
      expect(row).not.toHaveProperty('drive_url');
    }
    expect(row.content_markdown).toBe(originalBody);
  });

  it('does not write an invalid link or update a missing document', async () => {
    const row = makeRow();
    const { db, calls } = makeDb({ docs: [row] });
    const store = createSupabaseWikiStore(db);
    await expect(store.updateDocument('drive', { drive_url: 'https://example.com' }, 'user-1')).rejects.toThrow('공유 링크');
    await expect(store.updateDocument('missing', { drive_url: driveUrl }, 'user-1')).rejects.toThrow('문서를 찾을 수 없습니다');
    expect(calls.filter(call => call.op === 'update')).toEqual([]);
  });
});
