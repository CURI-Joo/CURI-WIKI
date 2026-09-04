import { describe, it, expect } from 'vitest';
import { canCreateIssue, canViewIssues, canTransitionIssue, canDeleteIssue } from '@/lib/issue-permissions';

describe('issue-permissions', () => {
  describe('canCreateIssue', () => {
    it('approved 유저는 이슈를 생성할 수 있다', () => {
      expect(canCreateIssue({ status: 'approved' })).toBe(true);
    });

    it('pending 유저는 이슈를 생성할 수 없다', () => {
      expect(canCreateIssue({ status: 'pending' })).toBe(false);
    });

    it('rejected 유저는 이슈를 생성할 수 없다', () => {
      expect(canCreateIssue({ status: 'rejected' })).toBe(false);
    });
  });

  describe('canViewIssues', () => {
    it('approved 유저는 이슈를 조회할 수 있다', () => {
      expect(canViewIssues({ status: 'approved' })).toBe(true);
    });

    it('pending 유저는 이슈를 조회할 수 없다', () => {
      expect(canViewIssues({ status: 'pending' })).toBe(false);
    });
  });

  describe('canTransitionIssue', () => {
    it('approved 유저는 상태를 변경할 수 있다', () => {
      expect(canTransitionIssue({ status: 'approved' })).toBe(true);
    });

    it('pending 유저는 상태를 변경할 수 없다', () => {
      expect(canTransitionIssue({ status: 'pending' })).toBe(false);
    });
  });

  describe('canDeleteIssue', () => {
    it('approved 유저는 이슈를 삭제할 수 있다', () => {
      expect(canDeleteIssue({ status: 'approved' })).toBe(true);
    });

    it('pending 유저는 이슈를 삭제할 수 없다', () => {
      expect(canDeleteIssue({ status: 'pending' })).toBe(false);
    });
  });
});
