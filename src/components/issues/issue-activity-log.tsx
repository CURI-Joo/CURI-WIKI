'use client';

import type { IssueActivity } from '@/types';
import { seedProfiles } from '@/data/seed-profiles';
import { formatRelativeDate } from '@/lib/utils';
import { PlusCircle, ArrowRight } from 'lucide-react';

function getActorName(actorId: string): string {
  const profile = seedProfiles.find((p) => p.id === actorId);
  return profile?.name ?? actorId;
}

export function IssueActivityLog({ activities }: { activities: IssueActivity[] }) {
  if (activities.length === 0) return null;

  return (
    <div className="space-y-0">
      {activities.map((activity) => {
        const actorName = getActorName(activity.actor_id);
        const Icon = activity.type === 'created' ? PlusCircle : ArrowRight;

        return (
          <div
            key={activity.id}
            className="flex items-start gap-3 border-l-2 border-border py-3 pl-4"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-text-primary">
                <span className="font-medium">{actorName}</span>
                {activity.type === 'created'
                  ? '이 이슈를 등록했습니다.'
                  : `이 ${activity.detail}`}
              </p>
              <p className="mt-0.5 text-[11px] text-text-muted">
                {formatRelativeDate(activity.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
