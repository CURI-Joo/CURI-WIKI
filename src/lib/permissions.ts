import type { Profile, Document, ExternalStatus } from '@/types';

/**
 * Pure functions for permission checks.
 * These are testable and used both on server and client.
 */

export function canReadDocument(
  user: Pick<Profile, 'id' | 'role' | 'status'>,
  doc: Pick<Document, 'visibility' | 'owner_id'>,
  accessibleDocIds: string[],
  docId: string
): boolean {
  if (user.status !== 'active') return false;
  if (canViewAllDocuments(user)) return true;
  if (doc.visibility === 'COMPANY') return true;
  if (doc.visibility === 'RESTRICTED') {
    return doc.owner_id === user.id || accessibleDocIds.includes(docId);
  }
  return false;
}

export function canEditDocument(
  user: Pick<Profile, 'id' | 'role' | 'status'>,
  doc: Pick<Document, 'owner_id'>,
  editableDocIds: string[]
): boolean {
  if (user.status !== 'active') return false;
  if (canViewAllDocuments(user)) return true;
  if (doc.owner_id === user.id) return true;
  return editableDocIds.includes(doc.owner_id);
}

export function canViewAllDocuments(
  user: Pick<Profile, 'role' | 'status'>
): boolean {
  return user.status === 'active' && (user.role === 'ADMIN' || user.role === 'CEO');
}

export function canManageDocument(
  user: Pick<Profile, 'role' | 'status'>
): boolean {
  return canViewAllDocuments(user);
}

export function canUseForExternalContent(
  externalStatus: ExternalStatus
): { allowed: boolean; warning?: string } {
  switch (externalStatus) {
    case 'EXTERNAL_OK':
      return { allowed: true };
    case 'REVIEW_REQUIRED':
      return { allowed: false, warning: '외부 콘텐츠로 사용하려면 승인이 필요합니다.' };
    case 'INTERNAL_ONLY':
      return { allowed: false, warning: '내부 전용 문서입니다. 외부 콘텐츠로 사용할 수 없습니다.' };
  }
}

export function isActiveUser(user: Pick<Profile, 'status'>): boolean {
  return user.status === 'active';
}

export function filterDocumentsForUser(
  documents: Document[],
  user: Pick<Profile, 'id' | 'role' | 'status'>,
  accessibleDocIds: string[]
): Document[] {
  return documents.filter((doc) =>
    canReadDocument(user, doc, accessibleDocIds, doc.id)
  );
}
