'use client';

import { Button } from '@/components/ui/button';
import type { Issue, IssueStatus } from '@/types';
import { Play, CheckCircle } from 'lucide-react';

interface IssueActionButtonsProps {
  issue: Issue;
  onTransition: (newStatus: IssueStatus) => void;
}

export function IssueActionButtons({ issue, onTransition }: IssueActionButtonsProps) {
  if (issue.status === '이슈 등록') {
    return (
      <Button
        onClick={() => onTransition('해결 중')}
        variant="default"
        size="sm"
        className="gap-1.5"
      >
        <Play className="h-3.5 w-3.5" />
        해결 시작
      </Button>
    );
  }

  if (issue.status === '해결 중') {
    return (
      <Button
        onClick={() => onTransition('이슈 해결')}
        variant="default"
        size="sm"
        className="gap-1.5"
      >
        <CheckCircle className="h-3.5 w-3.5" />
        이슈 해결
      </Button>
    );
  }

  return null;
}
