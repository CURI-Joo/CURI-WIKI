import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createIssue,
  transitionIssueStatus,
  getAllIssues,
  getIssueById,
  getActivitiesForIssue,
} from '@/lib/issue-store';

const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
  get length() { return Object.keys(store).length; },
  key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
};

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.clearAllMocks();
});

describe('issue-store', () => {
  describe('createIssue', () => {
    it('이슈를 생성하면 ISSUE-XXX 형식의 ID가 부여된다', () => {
      const issue = createIssue({
        title: '테스트 이슈',
        description: '테스트 이슈 상세 내용입니다.',
        project: 'Dashboard',
        priority: '즉시 수정 필요',
        reporter_id: 'user-minjoo',
      });

      expect(issue.id).toMatch(/^ISSUE-\d{3}$/);
    });

    it('이슈 생성 시 기본 상태는 이슈 등록이다', () => {
      const issue = createIssue({
        title: '테스트 이슈',
        description: '테스트 이슈 상세 내용입니다.',
        project: 'Admin',
        priority: '차차 수정 필요',
        reporter_id: 'user-minjoo',
      });

      expect(issue.status).toBe('이슈 등록');
    });

    it('이슈 생성 시 created activity가 생성된다', () => {
      const issue = createIssue({
        title: '테스트 이슈',
        description: '테스트 이슈 상세 내용입니다.',
        project: 'Healthcare',
        priority: '개선 사항',
        reporter_id: 'user-minjoo',
      });

      const activities = getActivitiesForIssue(issue.id);
      expect(activities.length).toBeGreaterThanOrEqual(1);
      const createdActivity = activities.find((a) => a.type === 'created');
      expect(createdActivity).toBeDefined();
      expect(createdActivity!.actor_id).toBe('user-minjoo');
    });

    it('첨부파일이 5개 이상이면 에러를 던진다', () => {
      expect(() =>
        createIssue({
          title: '테스트',
          description: '테스트 내용',
          project: 'Dashboard',
          priority: '즉시 수정 필요',
          reporter_id: 'user-minjoo',
          attachments: ['a', 'b', 'c', 'd', 'e'],
        })
      ).toThrow('첨부파일은 최대 4개까지 가능합니다.');
    });

    it('첨부파일 4개는 허용된다', () => {
      const issue = createIssue({
        title: '테스트',
        description: '테스트 내용',
        project: 'Dashboard',
        priority: '즉시 수정 필요',
        reporter_id: 'user-minjoo',
        attachments: ['a', 'b', 'c', 'd'],
      });

      expect(issue.attachments).toHaveLength(4);
    });

    it('assignee 없이도 생성 가능하다', () => {
      const issue = createIssue({
        title: '담당자 없는 이슈',
        description: '담당자 없는 이슈의 상세 내용입니다.',
        project: 'Admin',
        priority: '개선 사항',
        reporter_id: 'user-minjoo',
      });

      expect(issue.assignee_id).toBeNull();
    });

    it('제목이 비어있으면 에러를 던진다', () => {
      expect(() =>
        createIssue({
          title: '  ',
          description: '내용 있음',
          project: 'Admin',
          priority: '개선 사항',
          reporter_id: 'user-minjoo',
        })
      ).toThrow('이슈 제목은 필수입니다.');
    });

    it('내용이 비어있으면 에러를 던진다', () => {
      expect(() =>
        createIssue({
          title: '제목 있음',
          description: '  ',
          project: 'Admin',
          priority: '개선 사항',
          reporter_id: 'user-minjoo',
        })
      ).toThrow('이슈 내용은 필수입니다.');
    });
  });

  describe('transitionIssueStatus', () => {
    it('이슈 등록 → 해결 중 전환이 성공한다', () => {
      const issue = createIssue({
        title: '전환 테스트',
        description: '전환 테스트 내용',
        project: 'Dashboard',
        priority: '즉시 수정 필요',
        reporter_id: 'user-minjoo',
      });

      const updated = transitionIssueStatus(issue.id, '해결 중', 'user-dev1');
      expect(updated.status).toBe('해결 중');
    });

    it('해결 중 → 이슈 해결 전환이 성공한다', () => {
      const issue = createIssue({
        title: '전환 테스트 2',
        description: '전환 테스트 2 내용',
        project: 'Admin',
        priority: '차차 수정 필요',
        reporter_id: 'user-minjoo',
      });

      transitionIssueStatus(issue.id, '해결 중', 'user-dev1');
      const resolved = transitionIssueStatus(issue.id, '이슈 해결', 'user-dev1');
      expect(resolved.status).toBe('이슈 해결');
    });

    it('이슈 등록 → 이슈 해결 직접 전환은 실패한다', () => {
      const issue = createIssue({
        title: '건너뛰기 테스트',
        description: '건너뛰기 테스트 내용',
        project: 'Dashboard',
        priority: '즉시 수정 필요',
        reporter_id: 'user-minjoo',
      });

      expect(() =>
        transitionIssueStatus(issue.id, '이슈 해결', 'user-dev1')
      ).toThrow('상태 전환이 허용되지 않습니다');
    });

    it('이슈 해결 → 해결 중 역방향 전환은 실패한다', () => {
      const issue = createIssue({
        title: '역방향 테스트',
        description: '역방향 테스트 내용',
        project: 'Healthcare',
        priority: '개선 사항',
        reporter_id: 'user-minjoo',
      });

      transitionIssueStatus(issue.id, '해결 중', 'user-dev1');
      transitionIssueStatus(issue.id, '이슈 해결', 'user-dev1');

      expect(() =>
        transitionIssueStatus(issue.id, '해결 중', 'user-dev1')
      ).toThrow('상태 전환이 허용되지 않습니다');
    });

    it('이슈 해결 → 이슈 등록 역방향 전환은 실패한다', () => {
      const issue = createIssue({
        title: '역방향 테스트 2',
        description: '역방향 테스트 2 내용',
        project: 'Admin',
        priority: '즉시 수정 필요',
        reporter_id: 'user-minjoo',
      });

      transitionIssueStatus(issue.id, '해결 중', 'user-dev1');
      transitionIssueStatus(issue.id, '이슈 해결', 'user-dev1');

      expect(() =>
        transitionIssueStatus(issue.id, '이슈 등록', 'user-dev1')
      ).toThrow('상태 전환이 허용되지 않습니다');
    });

    it('상태 전환 시 activity가 기록된다', () => {
      const issue = createIssue({
        title: 'activity 테스트',
        description: 'activity 테스트 내용',
        project: 'Dashboard',
        priority: '차차 수정 필요',
        reporter_id: 'user-minjoo',
      });

      transitionIssueStatus(issue.id, '해결 중', 'user-dev1');

      const activities = getActivitiesForIssue(issue.id);
      const statusChange = activities.find((a) => a.type === 'status_changed');
      expect(statusChange).toBeDefined();
      expect(statusChange!.metadata).toEqual({ from: '이슈 등록', to: '해결 중' });
    });
  });

  describe('필터링', () => {
    beforeEach(() => {
      createIssue({ title: 'Dashboard 이슈 1', description: 'Dashboard 이슈 내용', project: 'Dashboard', priority: '즉시 수정 필요', reporter_id: 'user-minjoo' });
      createIssue({ title: 'Admin 이슈 1', description: 'Admin 이슈 내용', project: 'Admin', priority: '차차 수정 필요', reporter_id: 'user-minjoo' });
      createIssue({ title: 'HC 이슈 1', description: 'Healthcare 이슈 내용', project: 'Healthcare', priority: '개선 사항', reporter_id: 'user-minjoo' });
    });

    it('프로젝트별 필터링이 가능하다', () => {
      const all = getAllIssues();
      const dashboard = all.filter((i) => i.project === 'Dashboard');
      expect(dashboard.length).toBeGreaterThanOrEqual(1);
      expect(dashboard.every((i) => i.project === 'Dashboard')).toBe(true);
    });

    it('상태별 필터링이 가능하다', () => {
      const all = getAllIssues();
      const open = all.filter((i) => i.status === '이슈 등록');
      expect(open.length).toBeGreaterThanOrEqual(1);
      expect(open.every((i) => i.status === '이슈 등록')).toBe(true);
    });

    it('중요도별 필터링이 가능하다', () => {
      const all = getAllIssues();
      const critical = all.filter((i) => i.priority === '즉시 수정 필요');
      expect(critical.length).toBeGreaterThanOrEqual(1);
      expect(critical.every((i) => i.priority === '즉시 수정 필요')).toBe(true);
    });

    it('검색이 가능하다', () => {
      const all = getAllIssues();
      const results = all.filter((i) =>
        i.title.toLowerCase().includes('dashboard')
      );
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });
});
