'use client';

import { Input } from '@/components/ui/input';
import type { IssueStatus, IssuePriority } from '@/types';
import { Search } from 'lucide-react';

interface IssueFiltersProps {
  status: IssueStatus | 'all';
  priority: IssuePriority | 'all';
  search: string;
  onStatusChange: (v: IssueStatus | 'all') => void;
  onPriorityChange: (v: IssuePriority | 'all') => void;
  onSearchChange: (v: string) => void;
}

const statuses: (IssueStatus | 'all')[] = ['all', '이슈 등록', '해결 중', '이슈 해결'];
const priorities: (IssuePriority | 'all')[] = ['all', '즉시 수정 필요', '차차 수정 필요', '개선 사항'];

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-10 rounded-lg border-none bg-surface-elevated px-3 text-[13px] text-text-primary outline-none focus:ring-2 focus:ring-curi-pink/20"
      aria-label={label}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt === 'all' ? `${label} 전체` : opt}
        </option>
      ))}
    </select>
  );
}

export function IssueFilters({
  status,
  priority,
  search,
  onStatusChange,
  onPriorityChange,
  onSearchChange,
}: IssueFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect label="상태" value={status} options={statuses} onChange={onStatusChange} />
      <FilterSelect label="중요도" value={priority} options={priorities} onChange={onPriorityChange} />
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          placeholder="이슈 검색..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 border-none bg-surface-elevated pl-9 text-[13px] focus:ring-2 focus:ring-curi-pink/20"
        />
      </div>
    </div>
  );
}
