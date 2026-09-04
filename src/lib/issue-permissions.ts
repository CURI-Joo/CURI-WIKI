import type { Profile } from '@/types';

export function canCreateIssue(user: Pick<Profile, 'status'>): boolean {
  return user.status === 'approved';
}

export function canViewIssues(user: Pick<Profile, 'status'>): boolean {
  return user.status === 'approved';
}

export function canTransitionIssue(user: Pick<Profile, 'status'>): boolean {
  return user.status === 'approved';
}

export function canDeleteIssue(user: Pick<Profile, 'status'>): boolean {
  return user.status === 'approved';
}
