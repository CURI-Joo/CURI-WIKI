import { canEditDocument } from '../../permissions';
import type { WikiUser } from './types';

/** Service-role writes bypass RLS, so check the live account and document owner. */
export function requireDocumentEditor(
  user: WikiUser | null,
  document: { owner_id: string | null; category_id: string },
  nextCategoryId = document.category_id,
): void {
  const profile = user ? {
    id: user.id,
    role: user.role === 'admin' ? 'admin' as const : 'member' as const,
    status: user.approved ? 'approved' as const : 'pending' as const,
  } : null;
  if (!canEditDocument(profile, document)
    || !canEditDocument(profile, { ...document, category_id: nextCategoryId })) {
    throw new Error('문서 작성자 또는 승인된 관리자만 수정할 수 있습니다. Secret 문서는 관리자만 수정할 수 있습니다.');
  }
}
