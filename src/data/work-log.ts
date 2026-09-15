import type { WorkLogProject, WorkLogStatus } from '@/types';

export const workLogProjects: WorkLogProject[] = [
  'CURI',
  'LG생활건강',
  'LG전자',
  'WAME',
  'Internal',
  'ETC',
];

export const workLogStatuses: WorkLogStatus[] = ['Todo', 'In Progress', 'Done'];

export const workLogProjectStyle: Record<WorkLogProject, { dotClass: string; badgeClass: string }> = {
  CURI: {
    dotClass: 'bg-curi-pink',
    badgeClass: 'border-curi-pink/25 bg-curi-pink/10 text-curi-pink',
  },
  LG생활건강: {
    dotClass: 'bg-violet-500',
    badgeClass: 'border-violet-500/25 bg-violet-500/10 text-violet-700',
  },
  LG전자: {
    dotClass: 'bg-blue-500',
    badgeClass: 'border-blue-500/25 bg-blue-500/10 text-blue-700',
  },
  WAME: {
    dotClass: 'bg-emerald-500',
    badgeClass: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700',
  },
  Internal: {
    dotClass: 'bg-amber-500',
    badgeClass: 'border-amber-500/25 bg-amber-500/10 text-amber-700',
  },
  ETC: {
    dotClass: 'bg-slate-500',
    badgeClass: 'border-slate-500/25 bg-slate-500/10 text-slate-700',
  },
};

export const workLogStatusStyle: Record<WorkLogStatus, { badgeClass: string }> = {
  Todo: { badgeClass: 'border-border bg-surface-elevated text-text-secondary' },
  'In Progress': { badgeClass: 'border-amber-500/25 bg-amber-500/10 text-amber-700' },
  Done: { badgeClass: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700' },
};

