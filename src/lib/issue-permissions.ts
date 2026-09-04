import type { Profile } from '@/types';

export function canCreateIssue(user: Pick<Profile, 'status'>): boolean {
  return user.status === 'active';
}

export function canViewIssues(user: Pick<Profile, 'status'>): boolean {
  return user.status === 'active';
}

export function canTransitionIssue(user: Pick<Profile, 'status'>): boolean {
  return user.status === 'active';
}
