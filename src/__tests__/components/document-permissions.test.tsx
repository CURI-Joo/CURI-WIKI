import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/types';

const state = vi.hoisted(() => ({
  profile: null as Pick<Profile, 'id' | 'status' | 'role'> | null,
  doc: { id: 'doc-1', slug: 'article', title: 'Article', owner_id: 'owner', created_by: 'creator',
    category_id: 'cat-company', content_markdown: '본문', updated_at: '2026-10-01T00:00:00Z' },
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ slug: 'article' }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ profile: state.profile }) }));
vi.mock('@/lib/document-store', () => ({ useDocumentStore: () => ({ documents: [state.doc], loading: false }),
  updateStoredDocument: vi.fn(), deleteStoredDocument: vi.fn() }));
vi.mock('@/lib/profiles-store', () => ({ useDocumentAuthor: () => ({ name: 'Author' }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({
  from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }),
}) }));
vi.mock('@/components/documents/markdown-renderer', () => ({ MarkdownRenderer: () => <div>본문</div> }));
vi.mock('@/components/documents/notion-like-editor', () => ({ NotionLikeEditor: () => <div>Editor</div> }));
vi.mock('@/components/documents/markdown-image-upload-button', () => ({ MarkdownImageUploadButton: () => null }));

import DetailPage from '@/app/(dashboard)/documents/[slug]/page';
import EditPage from '@/app/(dashboard)/documents/[slug]/edit/page';

afterEach(() => { cleanup(); state.doc.category_id = 'cat-company'; });

describe('document editing controls', () => {
  it.each(['owner', 'admin'])('shows edit/delete controls to an approved %s', id => {
    state.profile = { id, status: 'approved', role: id === 'admin' ? 'admin' : 'member' };
    render(<DetailPage />);
    expect(screen.getByRole('link', { name: '내용 수정' })).toHaveAttribute('href', '/documents/article/edit');
    expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
  });

  it.each([null, 'other', 'pending-owner', 'pending-admin'])('hides edit/delete controls for %s', user => {
    state.profile = user === null ? null : { id: user.replace('pending-', ''),
      status: user.startsWith('pending-') ? 'pending' : 'approved', role: user.endsWith('admin') ? 'admin' : 'member' };
    render(<DetailPage />);
    expect(screen.queryByRole('link', { name: /수정/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
    expect(screen.getByText('본문')).toBeInTheDocument();
  });

  it.each(['other', 'creator'])('blocks opening the edit URL as %s', id => {
    state.profile = { id, status: 'approved', role: 'member' };
    render(<EditPage />);
    expect(screen.getByText('접근 권한이 없습니다')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Title')).not.toBeInTheDocument();
  });

  it.each(['owner', 'admin'])('opens the editor for an approved %s', async id => {
    state.profile = { id, status: 'approved', role: id === 'admin' ? 'admin' : 'member' };
    render(<EditPage />);
    expect(await screen.findByPlaceholderText('Title')).toHaveValue('Article');
  });

  it('blocks the edit URL for an unapproved admin and a non-admin Secret owner', () => {
    state.profile = { id: 'admin', status: 'pending', role: 'admin' };
    const { rerender } = render(<EditPage />);
    expect(screen.queryByPlaceholderText('Title')).not.toBeInTheDocument();
    state.profile = { id: 'owner', status: 'approved', role: 'member' };
    state.doc.category_id = 'cat-secret';
    rerender(<EditPage />);
    expect(screen.getByText('Secret 문서는 승인된 관리자만 수정할 수 있습니다.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Title')).not.toBeInTheDocument();
  });
});
