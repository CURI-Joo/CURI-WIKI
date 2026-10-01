// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { runTool, type ToolContext } from '@/lib/mcp/wiki/tools';
import { memoryWikiStore } from './fakes';

async function fixture(userId = 'owner') {
  const users = [
    { id: 'owner', role: 'member', approved: true },
    { id: 'other', role: 'member', approved: true },
    { id: 'admin', role: 'admin', approved: true },
  ].map(user => ({ ...user, email: null, display_name: null }));
  const store = memoryWikiStore(users);
  const doc = await store.createDocument({ title: 'Original', slug: 'article', content_markdown: 'Original body',
    category_slug: 'company', summary: '', status: 'Published', tags: [] }, 'owner');
  const update = vi.spyOn(store, 'updateDocument');
  const upload = vi.spyOn(store, 'uploadImage');
  const ctx: ToolContext = { store, auth: { userId, clientId: 'test', scopes: ['wiki.read', 'wiki.write'] },
    baseUrl: 'https://wiki.example', defaultCategory: 'company' };
  return { ctx, store, users, doc, update, upload };
}

describe('MCP document write authorization', () => {
  it.each(['title', 'content_markdown', 'summary', 'drive_url', 'tags', 'status', 'category_slug'])(
    'blocks another approved account from changing %s by ID or slug', async field => {
      const { ctx, store, doc, update } = await fixture('other');
      const values: Record<string, unknown> = { title: 'Changed', content_markdown: 'Changed', summary: 'Changed',
        drive_url: 'https://drive.google.com/drive/folders/test', tags: ['changed'], status: 'Draft', category_slug: 'product' };
      for (const id of [doc.id, doc.slug]) {
        await expect(runTool('update_document', { id_or_slug: id, [field]: values[field] }, ctx)).rejects.toThrow('작성자');
      }
      expect(update).not.toHaveBeenCalled();
      expect(store.docs).toEqual([doc]);
    },
  );

  it.each(['owner', 'admin'])('allows the approved %s to edit', async id => {
    const { ctx, store } = await fixture(id);
    await expect(runTool('update_document', { id_or_slug: 'article', title: 'Changed' }, ctx))
      .resolves.toMatchObject({ status: 'updated' });
    expect(store.docs[0]).toMatchObject({ title: 'Changed', owner_id: 'owner', author_id: 'owner' });
  });

  it.each(['owner', 'admin'])('blocks %s after approval is revoked', async id => {
    const { ctx, users, update } = await fixture(id);
    users.find(user => user.id === id)!.approved = false;
    await expect(runTool('update_document', { id_or_slug: 'article', title: 'Changed' }, ctx)).rejects.toThrow('승인');
    expect(update).not.toHaveBeenCalled();
  });

  it('requires an existing account and write scope, including for admins', async () => {
    const { ctx, update } = await fixture('missing');
    await expect(runTool('update_document', { id_or_slug: 'article', title: 'Changed' }, ctx)).rejects.toThrow('계정');
    ctx.auth = { ...ctx.auth, userId: 'admin', scopes: ['wiki.read'] };
    await expect(runTool('update_document', { id_or_slug: 'article', title: 'Changed' }, ctx)).rejects.toThrow('wiki.write');
    expect(update).not.toHaveBeenCalled();
  });

  it('fails for a missing document even when only metadata changes', async () => {
    const { ctx, update } = await fixture();
    await expect(runTool('update_document', { id_or_slug: 'missing', title: 'Changed' }, ctx)).rejects.toThrow('찾을 수 없습니다');
    expect(update).not.toHaveBeenCalled();
  });

  it('uses the current owner, never the original author as a fallback', async () => {
    const { ctx, doc, update } = await fixture();
    const get = vi.spyOn(ctx.store, 'getDocument');
    for (const owner_id of ['other', null]) {
      get.mockResolvedValue({ ...doc, owner_id });
      await expect(runTool('update_document', { id_or_slug: 'article', title: 'Changed' }, ctx)).rejects.toThrow('작성자');
    }
    expect(update).not.toHaveBeenCalled();
  });

  it('does not accept ownership or audit fields from tool arguments', async () => {
    const { ctx, update } = await fixture();
    await runTool('update_document', { id_or_slug: 'article', title: 'Changed', owner_id: 'other', created_by: 'other', updated_by: 'other' }, ctx);
    expect(update).toHaveBeenCalledExactlyOnceWith('article', { title: 'Changed' }, 'owner');
  });

  it('prevents a member from editing or moving documents into or out of Secret', async () => {
    const { ctx, doc, update } = await fixture();
    await expect(runTool('update_document', { id_or_slug: 'article', category_slug: 'secret' }, ctx)).rejects.toThrow('Secret');
    vi.spyOn(ctx.store, 'getDocument').mockResolvedValue({ ...doc, category_slug: 'secret' });
    await expect(runTool('update_document', { id_or_slug: 'article', category_slug: 'company' }, ctx)).rejects.toThrow('Secret');
    expect(update).not.toHaveBeenCalled();
    ctx.auth.userId = 'admin';
    await expect(runTool('update_document', { id_or_slug: 'article', title: 'Admin edit' }, ctx)).resolves.toMatchObject({ status: 'updated' });
  });

  it('rejects image attachment to another account’s document before processing the file', async () => {
    const { ctx, upload } = await fixture('other');
    await expect(runTool('upload_image', { document_id_or_slug: 'article', file_name: 'photo.png', data_base64: 'invalid' }, ctx)).rejects.toThrow('작성자');
    expect(upload).not.toHaveBeenCalled();
  });
});
