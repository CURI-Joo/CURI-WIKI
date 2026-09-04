import type { IssuePriority } from '@/types';

export const issuePriorityLabels: Record<IssuePriority, string> = {
  '즉시 수정 필요': 'Critical',
  '차차 수정 필요': 'Normal',
  '개선 사항': 'Improvement',
};

export function getIssuePriorityLabel(priority: IssuePriority) {
  return issuePriorityLabels[priority];
}
