'use client';

import { Badge } from '@/components/ui/badge';
import type { IssueStatus } from '@/types';

const statusConfig: Record<IssueStatus, { variant: 'info' | 'warning' | 'success' }> = {
  '이슈 등록': { variant: 'info' },
  '해결 중': { variant: 'warning' },
  '이슈 해결': { variant: 'success' },
};

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{status}</Badge>;
}
