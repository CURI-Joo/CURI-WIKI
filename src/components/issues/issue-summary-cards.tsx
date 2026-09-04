'use client';

import type { Issue } from '@/types';
import { cn } from '@/lib/utils';

interface IssueSummaryCardsProps {
  issues: Issue[];
}

export function IssueSummaryCards({ issues }: IssueSummaryCardsProps) {
  const counts = {
    '이슈 등록': issues.filter((i) => i.status === '이슈 등록').length,
    '해결 중': issues.filter((i) => i.status === '해결 중').length,
    '이슈 해결': issues.filter((i) => i.status === '이슈 해결').length,
  };

  const cards = [
    { label: '이슈 등록', count: counts['이슈 등록'] },
    { label: '해결 중', count: counts['해결 중'] },
    { label: '이슈 해결', count: counts['이슈 해결'] },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={cn(
            'rounded-xl border border-curi-pink/10 bg-curi-pink/8 px-4 py-3 text-curi-pink'
          )}
        >
          <p className="text-xs font-medium opacity-80">{card.label}</p>
          <p className="mt-1 text-2xl font-bold">{card.count}</p>
        </div>
      ))}
    </div>
  );
}
