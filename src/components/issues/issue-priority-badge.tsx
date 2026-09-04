'use client';

import { Badge } from '@/components/ui/badge';
import type { IssuePriority } from '@/types';

const priorityConfig: Record<IssuePriority, { variant: 'error' | 'warning' | 'default' }> = {
  '즉시 수정 필요': { variant: 'error' },
  '차차 수정 필요': { variant: 'warning' },
  '개선 사항': { variant: 'default' },
};

export function IssuePriorityBadge({ priority }: { priority: IssuePriority }) {
  const config = priorityConfig[priority];
  return <Badge variant={config.variant}>{priority}</Badge>;
}
