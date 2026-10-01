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
  owner_id?: string | null;
  updated_at?: string;
};

function makeDb(seed: { docs: Row[]; profiles?: Array<{ id: string; status: string; role: string }>; beforeUpdate?: () => void }) {
  const calls: Array<{ table: string; column: string; value: string; op: 'select' | 'update' }> = [];
  const categories = [
    { id: 'cat-company', slug: 'company', name: 'Company' },
    { id: 'cat-secret', slug: 'secret', name: 'Secret' },
  ];
  const docs = [...seed.docs];
  const profiles = seed.profiles ?? ['u1', 'user-1'].map(id => ({ id, status: 'approved', role: 'member' }));
  const db: SupabaseLike = {
    from(table: string) {
      const rows: Record<string, unknown>[] = table === 'categories' ? categories : table === 'profiles' ? profiles : docs;
      const filters: Array<[string, string]> = [];
      let payload: Record<string, unknown> | undefined;
      const matching = () => rows.filter(row => filters.every(([key, value]) => row[key] === value));
      const query = {
        select: () => query,
        eq(column: string, value: string) {
          calls.push({ table, column, value, op: payload ? 'update' : 'select' });
          filters.push([column, value]);
          return query;
        },
        update(value: Record<string, unknown>) { seed.beforeUpdate?.(); payload = value; return query; },
        maybeSingle: async () => ({ data: matching()[0] ? { ...matching()[0] } : null, error: null }),
        single: async () => {
          const row = matching()[0];
          if (!row) return { data: null, error: { message: 'not found' } };
          if (payload) Object.assign(row, payload);
          return { data: { ...row }, error: null };
        },
        then: (resolve: (result: { data: Record<string, unknown>[]; error: null }) => unknown) =>
          Promise.resolve({ data: matching(), error: null }).then(resolve),
      };
      return query;
    },
    auth: { admin: {
      getUserById: async id => ({ data: profiles.some(profile => profile.id === id) ? { user: { id } } : null, error: null }),
    } },
    rpc: async () => ({ data: null, error: null }),
  };
  return { db, calls };
}

describe('createSupabaseWikiStore id/slug lookup', () => {
  it('getDocument uses slug branch for non-uuid input', async () => {
    const { db, calls } = makeDb({
      docs: [
        { id: 'doc-1', slug: 'hello-world', title: 'Hello', category_id: 'cat-company', created_by: 'u1', owner_id: 'u1' },
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
      docs: [{ id, slug: 'hello-world', title: 'Hello', category_id: 'cat-company', created_by: 'u1', owner_id: 'u1' }],
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
        { id: 'doc-1', slug: 'hello-world', title: 'Hello', category_id: 'cat-company', created_by: 'u1', owner_id: 'u1' },
      ],
    });
    const store = createSupabaseWikiStore(db);

    const updated = await store.updateDocument('hello-world', { title: 'Updated' }, 'u1');

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
    const documentId = 'doc-123e4567-e89b-02d3-a456-426614174000';
    const db = makeDb({ docs: [{ id: documentId, slug: 'photos', title: 'Photos', category_id: 'cat-company', owner_id: 'user-1' }] }).db;
    db.storage = { from: vi.fn(() => ({ upload, remove })) };
    const originalFrom = db.from;
    db.from = vi.fn(table => table === 'attachments' ? { insert } : originalFrom(table));
    const store = createSupabaseWikiStore(db);
    const bytes = new Uint8Array([1, 2, 3]);
    const result = store.uploadImage({ bytes, file_name: 'photo.png', mime_type: 'image/png', document_id: documentId }, 'user-1');
    if (failRecord) {
      await expect(result).rejects.toThrow('database failed');
      expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]]);
    } else {
      await expect(result).resolves.toEqual({ id: 'image-1', markdown_url: '/api/upload/image-1/file' });
      expect(remove).not.toHaveBeenCalled();
    }
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^user-1\/.+\.png$/), bytes, { contentType: 'image/png', upsert: false });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ document_id: documentId, uploaded_by: 'user-1', file_size: 3 }));
  });
});

describe('service-role document authorization', () => {
  const makeRow = (): Row => ({ id: '123e4567-e89b-02d3-a456-426614174000', slug: 'article', title: 'Original',
    category_id: 'cat-company', owner_id: 'owner', created_by: 'creator', content_markdown: 'Original body' });

  it.each([
    ['owner', 'member', 'approved', true],
    ['other', 'member', 'approved', false],
    ['creator', 'member', 'approved', false],
    ['admin', 'admin', 'approved', true],
    ['owner', 'member', 'pending', false],
    ['admin', 'admin', 'rejected', false],
  ])('checks %s / %s / %s even when called without the MCP handler', async (id, role, status, allowed) => {
    const row = makeRow();
    const { db, calls } = makeDb({ docs: [row], profiles: [{ id: String(id), role: String(role), status: String(status) }] });
    const store = createSupabaseWikiStore(db);
    for (const identifier of [row.id, row.slug]) {
      const result = store.updateDocument(identifier, { title: 'Changed' }, String(id));
      if (allowed) await expect(result).resolves.toMatchObject({ title: 'Changed', owner_id: 'owner', author_id: 'creator' });
      else await expect(result).rejects.toThrow('작성자');
    }
    if (!allowed) {
      expect(calls.filter(call => call.op === 'update')).toEqual([]);
      expect(row.title).toBe('Original');
    }
  });

  it('fails closed for missing users, missing ownership and missing documents', async () => {
    const row = makeRow();
    const { db } = makeDb({ docs: [row] });
    const store = createSupabaseWikiStore(db);
    await expect(store.updateDocument('article', { title: 'Changed' }, 'missing')).rejects.toThrow('작성자');
    row.owner_id = null;
    row.created_by = 'u1';
    await expect(store.updateDocument('article', { title: 'Changed' }, 'u1')).rejects.toThrow('작성자');
    await expect(store.updateDocument('missing', { title: 'Changed' }, 'u1')).rejects.toThrow('찾을 수 없습니다');
    expect(row.title).toBe('Original');
  });

  it('preserves ownership and authorship when unexpected fields are supplied', async () => {
    const row = makeRow();
    row.owner_id = 'u1';
    const store = createSupabaseWikiStore(makeDb({ docs: [row] }).db);
    const patch = { title: 'Changed', owner_id: 'other', created_by: 'other', updated_by: 'other', category_id: 'cat-secret' };
    await store.updateDocument('article', patch, 'u1');
    expect(row).toMatchObject({ title: 'Changed', owner_id: 'u1', created_by: 'creator', updated_by: 'u1', category_id: 'cat-company' });
  });

  it('checks both source and destination Secret permissions', async () => {
    const row = makeRow();
    row.owner_id = 'u1';
    const store = createSupabaseWikiStore(makeDb({ docs: [row], profiles: [
      { id: 'u1', role: 'member', status: 'approved' }, { id: 'admin', role: 'admin', status: 'approved' },
    ] }).db);
    await expect(store.updateDocument('article', { category_slug: 'secret' }, 'u1')).rejects.toThrow('Secret');
    await store.updateDocument('article', { category_slug: 'secret' }, 'admin');
    await expect(store.updateDocument('article', { category_slug: 'company' }, 'u1')).rejects.toThrow('Secret');
    await store.updateDocument('article', { category_slug: 'company' }, 'admin');
    expect(row.category_id).toBe('cat-company');
  });

  it.each(['owner_id', 'category_id'] as const)('rejects a concurrent %s change during a member write', async field => {
    const row = makeRow();
    row.owner_id = 'u1';
    const { db } = makeDb({ docs: [row], beforeUpdate: () => { row[field] = field === 'owner_id' ? 'other' : 'cat-secret'; } });
    await expect(createSupabaseWikiStore(db).updateDocument('article', { title: 'Changed' }, 'u1')).rejects.toThrow();
    expect(row.title).toBe('Original');
  });

  it('blocks unauthorized attachment writes before touching Storage', async () => {
    const row = makeRow();
    const { db } = makeDb({ docs: [row] });
    const upload = vi.fn();
    db.storage = { from: () => ({ upload, remove: vi.fn() }) };
    await expect(createSupabaseWikiStore(db).uploadImage({ document_id: row.id, file_name: 'photo.png',
      bytes: new Uint8Array([1]), mime_type: 'image/png' }, 'u1')).rejects.toThrow('작성자');
    expect(upload).not.toHaveBeenCalled();
  });
});

describe('MCP Drive shortcut persistence', () => {
  const driveUrl = 'https://drive.google.com/drive/folders/qa-folder';
  const makeRow = (): Row => ({ id: 'doc-1', owner_id: 'user-1', slug: 'drive', title: '자료', category_id: 'cat-company',
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
