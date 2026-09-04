import { describe, it, expect } from 'vitest';
import { canCreateIssue, canViewIssues, canTransitionIssue } from '@/lib/issue-permissions';

describe('issue-permissions', () => {
  describe('canCreateIssue', () => {
    it('active 유저는 이슈를 생성할 수 있다', () => {
      expect(canCreateIssue({ status: 'active' })).toBe(true);
    });

    it('inactive 유저는 이슈를 생성할 수 없다', () => {
      expect(canCreateIssue({ status: 'inactive' })).toBe(false);
    });
  });

  describe('canViewIssues', () => {
    it('active 유저는 이슈를 조회할 수 있다', () => {
      expect(canViewIssues({ status: 'active' })).toBe(true);
    });

    it('inactive 유저는 이슈를 조회할 수 없다', () => {
      expect(canViewIssues({ status: 'inactive' })).toBe(false);
    });
  });

  describe('canTransitionIssue', () => {
    it('active ADMIN은 상태를 변경할 수 있다', () => {
      expect(canTransitionIssue({ status: 'active' })).toBe(true);
    });

    it('active MEMBER도 상태를 변경할 수 있다', () => {
      expect(canTransitionIssue({ status: 'active' })).toBe(true);
    });

    it('inactive 유저는 상태를 변경할 수 없다', () => {
      expect(canTransitionIssue({ status: 'inactive' })).toBe(false);
    });
  });
});
