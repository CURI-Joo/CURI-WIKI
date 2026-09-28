import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { Document } from '@/types';

const mocks = vi.hoisted(() => ({ documents: [] as Document[] }));
vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ profile: null }) }));
vi.mock('@/lib/document-store', () => ({
  useDocumentStore: () => ({ documents: mocks.documents, loading: false }),
}));

import SearchPage from '@/app/(dashboard)/search/page';

afterEach(cleanup);

it('removes a previous private search result when the session can no longer read it', () => {
  mocks.documents = [{
    id: 'secret', title: 'Private document', summary: 'Private summary',
    slug: 'private', content_markdown: 'Private text', category_id: 'cat-secret',
  } as Document];
  const { rerender } = render(<SearchPage />);
  fireEvent.change(screen.getByPlaceholderText('글 검색...'), { target: { value: 'Private' } });
  fireEvent.click(screen.getByRole('button', { name: '검색' }));
  expect(screen.getByText('Private document')).toBeInTheDocument();
  mocks.documents = [];
  rerender(<SearchPage />);
  expect(screen.queryByText('Private document')).not.toBeInTheDocument();
  expect(screen.queryByText('Private summary')).not.toBeInTheDocument();
});
