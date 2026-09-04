import type { DocStatus, ExternalStatus } from '@/types';

export const documentStatusLabels: Record<DocStatus, string> = {
  Draft: '임시 저장',
  Published: '게시됨',
  Archived: '보관됨',
};

export const externalStatusLabels: Record<ExternalStatus, string> = {
  INTERNAL_ONLY: '내부 전용',
  REVIEW_REQUIRED: '검토 필요',
  EXTERNAL_OK: '외부 활용 가능',
};

export function getDocumentStatusLabel(status: DocStatus) {
  return documentStatusLabels[status];
}

export function getExternalStatusLabel(status: ExternalStatus) {
  return externalStatusLabels[status];
}
