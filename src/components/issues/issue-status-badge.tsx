'use client';

import { Badge } from '@/components/ui/badge';
import type { IssueStatus } from '@/types';

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  return (
    <Badge className="border-curi-pink/15 bg-curi-pink/8 text-curi-pink">
      {status}
    </Badge>
  );
}
