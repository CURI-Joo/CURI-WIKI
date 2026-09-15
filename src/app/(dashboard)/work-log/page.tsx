'use client';

import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import {
  createWorkLog,
  deleteWorkLog,
  updateWorkLog,
  useWorkLogStore,
  type CreateWorkLogInput,
  type UpdateWorkLogInput,
} from '@/lib/work-log-store';
import {
  workLogProjects,
  workLogProjectStyle,
  workLogStatuses,
  workLogStatusStyle,
} from '@/data/work-log';
import type { WorkLog, WorkLogProject, WorkLogStatus } from '@/types';
import { cn } from '@/lib/utils';

const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type PanelMode = 'day' | 'create' | 'edit';

interface WorkLogFormState {
  work_date: string;
  project: WorkLogProject;
  title: string;
  description: string;
  status: WorkLogStatus;
  related_link: string;
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
}

function formatDayTitle(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function toDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function emptyForm(date: string): WorkLogFormState {
  return {
    work_date: date,
    project: 'Internal',
    title: '',
    description: '',
    status: 'In Progress',
    related_link: '',
  };
}

export default function WorkLogPage() {
  const { profile } = useAuth();
  const { logs, loading, refresh } = useWorkLogStore(profile?.id);

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [view, setView] = useState<'calendar' | 'my-logs'>('calendar');
  const [projectFilter, setProjectFilter] = useState<WorkLogProject | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<WorkLogStatus | 'all'>('all');

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('day');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [formState, setFormState] = useState<WorkLogFormState>(emptyForm(toDateKey(today)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return logs
      .filter((log) => projectFilter === 'all' || log.project === projectFilter)
      .filter((log) => statusFilter === 'all' || log.status === statusFilter)
      .sort((a, b) => {
        const byDate = b.work_date.localeCompare(a.work_date);
        if (byDate !== 0) return byDate;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [logs, projectFilter, statusFilter]);

  const logsByDate = useMemo(() => {
    const grouped = new Map<string, WorkLog[]>();
    for (const log of filteredLogs) {
      const key = log.work_date;
      const current = grouped.get(key);
      if (current) {
        current.push(log);
      } else {
        grouped.set(key, [log]);
      }
    }
    return grouped;
  }, [filteredLogs]);

  const selectedDateKey = toDateKey(selectedDate);
  const selectedDateLogs = logsByDate.get(selectedDateKey) ?? [];

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const groupedForList = useMemo(() => {
    return filteredLogs.reduce<Record<string, WorkLog[]>>((acc, log) => {
      if (!acc[log.work_date]) acc[log.work_date] = [];
      acc[log.work_date].push(log);
      return acc;
    }, {});
  }, [filteredLogs]);

  const listDateKeys = useMemo(() => Object.keys(groupedForList).sort((a, b) => b.localeCompare(a)), [groupedForList]);

  function openDayPanel(date: Date) {
    setSelectedDate(date);
    setPanelMode('day');
    setPanelOpen(true);
    setError(null);
  }

  function openCreatePanel(date: Date) {
    const dateKey = toDateKey(date);
    setSelectedDate(date);
    setFormState(emptyForm(dateKey));
    setEditingLogId(null);
    setPanelMode('create');
    setPanelOpen(true);
    setError(null);
  }

  function openEditPanel(log: WorkLog) {
    setSelectedDate(parseISO(log.work_date));
    setFormState({
      work_date: log.work_date,
      project: log.project,
      title: log.title,
      description: log.description,
      status: log.status,
      related_link: log.related_link ?? '',
    });
    setEditingLogId(log.id);
    setPanelMode('edit');
    setPanelOpen(true);
    setError(null);
  }

  function closePanel() {
    setPanelOpen(false);
    setError(null);
    setSaving(false);
  }

  async function handleSaveLog() {
    if (!profile) return;

    if (!formState.title.trim()) {
      setError('Title은 필수입니다.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (panelMode === 'create') {
        const payload: CreateWorkLogInput = {
          user_id: profile.id,
          work_date: formState.work_date,
          project: formState.project,
          title: formState.title,
          description: formState.description,
          status: formState.status,
          related_link: formState.related_link,
        };
        await createWorkLog(payload);
      }

      if (panelMode === 'edit' && editingLogId) {
        const payload: UpdateWorkLogInput = {
          work_date: formState.work_date,
          project: formState.project,
          title: formState.title,
          description: formState.description,
          status: formState.status,
          related_link: formState.related_link,
        };
        await updateWorkLog(editingLogId, payload);
      }

      await refresh();
      setPanelMode('day');
      setSelectedDate(parseISO(formState.work_date));
      setSaving(false);
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    }
  }

  async function handleDeleteLog(logId: string) {
    const confirmed = window.confirm('이 업무일지를 삭제할까요?');
    if (!confirmed) return;

    try {
      await deleteWorkLog(logId);
      await refresh();

      if (panelMode === 'edit') {
        setPanelMode('day');
        setEditingLogId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl py-16 text-center">
        <p className="text-sm text-text-muted">로딩 중...</p>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Work Log</h1>
            <p className="mt-1 text-sm text-text-secondary">오늘 한 일을 기록하고 날짜별 업무 히스토리를 확인합니다.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCurrentMonth(startOfMonth(today));
                openDayPanel(today);
              }}
            >
              Today
            </Button>
            <Button size="sm" onClick={() => openCreatePanel(selectedDate)}>
              <Plus className="h-4 w-4" />
              Add Log
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value as WorkLogProject | 'all')}
            className="h-10 rounded-lg border-none bg-surface-elevated px-3 text-[13px] text-text-primary outline-none focus:ring-2 focus:ring-curi-pink/20"
          >
            <option value="all">All Projects</option>
            {workLogProjects.map((project) => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as WorkLogStatus | 'all')}
            className="h-10 rounded-lg border-none bg-surface-elevated px-3 text-[13px] text-text-primary outline-none focus:ring-2 focus:ring-curi-pink/20"
          >
            <option value="all">All Status</option>
            {workLogStatuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <Tabs value={view} onValueChange={(value) => setView(value as 'calendar' | 'my-logs')}>
          <TabsList>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="my-logs">My Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth((prev) => addMonths(prev, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-base font-semibold text-text-primary">{formatMonthLabel(currentMonth)}</h2>
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="grid grid-cols-7 border-b border-border bg-surface-elevated/60">
                {weekLabels.map((label) => (
                  <div key={label} className="px-3 py-2 text-xs font-medium text-text-muted">{label}</div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((day) => {
                  const key = toDateKey(day);
                  const dayLogs = logsByDate.get(key) ?? [];
                  const visibleLogs = dayLogs.slice(0, 3);
                  const hiddenCount = Math.max(0, dayLogs.length - visibleLogs.length);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, today);

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => openDayPanel(day)}
                      className={cn(
                        'min-h-[132px] border-b border-r border-border px-2.5 py-2 text-left transition-colors hover:bg-surface-elevated/50',
                        !isCurrentMonth && 'bg-surface/30',
                        isSameDay(day, selectedDate) && 'bg-curi-pink-soft/40'
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span
                          className={cn(
                            'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                            isToday ? 'bg-curi-pink text-white' : 'text-text-secondary',
                            !isCurrentMonth && !isToday && 'text-text-muted'
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {visibleLogs.map((log) => (
                          <div key={log.id} className="flex items-center gap-1.5 rounded-md bg-white/70 px-1.5 py-1 text-[11px] text-text-secondary">
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', workLogProjectStyle[log.project].dotClass)} />
                            <span className="truncate">{log.title}</span>
                          </div>
                        ))}
                        {hiddenCount > 0 && (
                          <div className="px-1.5 text-[11px] text-text-muted">+{hiddenCount} more</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="my-logs" className="space-y-4">
            {listDateKeys.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-text-muted">
                작성된 업무일지가 없습니다.
              </div>
            ) : (
              <div className="space-y-5">
                {listDateKeys.map((dateKey) => {
                  const dateLogs = groupedForList[dateKey] ?? [];
                  return (
                    <section key={dateKey} className="space-y-2">
                      <h3 className="text-sm font-semibold text-text-primary">{formatDayTitle(parseISO(dateKey))}</h3>
                      <div className="space-y-2">
                        {dateLogs.map((log) => (
                          <button
                            key={log.id}
                            type="button"
                            onClick={() => openEditPanel(log)}
                            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-elevated"
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn('inline-flex h-1.5 w-1.5 rounded-full', workLogProjectStyle[log.project].dotClass)} />
                              <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium', workLogProjectStyle[log.project].badgeClass)}>
                                {log.project}
                              </span>
                              <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium', workLogStatusStyle[log.status].badgeClass)}>
                                {log.status}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-text-primary">{log.title}</p>
                            {log.description && (
                              <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{log.description}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {panelOpen && (
        <div className="fixed inset-0 z-40">
          <button type="button" className="absolute inset-0 bg-black/25" onClick={closePanel} aria-label="패널 닫기" />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl border-l border-border bg-background shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <div>
                <p className="text-xs text-text-muted">Work Log</p>
                <h2 className="text-sm font-semibold text-text-primary">
                  {panelMode === 'day' ? formatDayTitle(selectedDate) : panelMode === 'create' ? 'Add Log' : 'Edit Log'}
                </h2>
              </div>
              <Button variant="ghost" size="sm" onClick={closePanel}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="h-[calc(100%-56px)] overflow-y-auto p-4">
              {panelMode === 'day' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-text-primary">{selectedDateLogs.length}개의 로그</p>
                    <Button size="sm" onClick={() => openCreatePanel(selectedDate)}>
                      <Plus className="h-4 w-4" /> Add Log
                    </Button>
                  </div>

                  {selectedDateLogs.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-center">
                      <CalendarDays className="mx-auto h-8 w-8 text-text-muted" />
                      <p className="mt-2 text-sm text-text-secondary">이 날짜에 기록된 업무가 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedDateLogs.map((log) => (
                        <button
                          key={log.id}
                          type="button"
                          onClick={() => openEditPanel(log)}
                          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-elevated"
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn('inline-flex h-1.5 w-1.5 rounded-full', workLogProjectStyle[log.project].dotClass)} />
                            <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium', workLogProjectStyle[log.project].badgeClass)}>
                              {log.project}
                            </span>
                            <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium', workLogStatusStyle[log.status].badgeClass)}>
                              {log.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-text-primary">{log.title}</p>
                          {log.description && (
                            <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{log.description}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(panelMode === 'create' || panelMode === 'edit') && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-[13px] font-medium text-text-primary">Date</span>
                      <Input
                        type="date"
                        value={formState.work_date}
                        onChange={(event) => setFormState((prev) => ({ ...prev, work_date: event.target.value }))}
                      />
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[13px] font-medium text-text-primary">Project</span>
                      <select
                        value={formState.project}
                        onChange={(event) => setFormState((prev) => ({ ...prev, project: event.target.value as WorkLogProject }))}
                        className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-curi-pink focus:ring-2 focus:ring-curi-pink/20"
                      >
                        {workLogProjects.map((project) => (
                          <option key={project} value={project}>{project}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="space-y-1.5">
                    <span className="text-[13px] font-medium text-text-primary">Title <span className="text-error">*</span></span>
                    <Input
                      value={formState.title}
                      onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="예: LG POC 설문 최종 수정"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[13px] font-medium text-text-primary">Description</span>
                    <Textarea
                      rows={5}
                      value={formState.description}
                      onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="오늘 진행한 업무 내용, 결정사항, 다음 액션 등을 기록하세요."
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-[13px] font-medium text-text-primary">Status</span>
                      <select
                        value={formState.status}
                        onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value as WorkLogStatus }))}
                        className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-curi-pink focus:ring-2 focus:ring-curi-pink/20"
                      >
                        {workLogStatuses.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-[13px] font-medium text-text-primary">Related Link</span>
                      <Input
                        value={formState.related_link}
                        onChange={(event) => setFormState((prev) => ({ ...prev, related_link: event.target.value }))}
                        placeholder="https://..."
                      />
                    </label>
                  </div>

                  {error && (
                    <p className="rounded-lg border border-error/20 bg-error/5 px-3 py-2 text-xs text-error">{error}</p>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <div>
                      {panelMode === 'edit' && editingLogId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteLog(editingLogId)}
                          className="text-error hover:bg-error/10 hover:text-error"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setPanelMode('day');
                          setSelectedDate(parseISO(formState.work_date));
                        }}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={handleSaveLog} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

