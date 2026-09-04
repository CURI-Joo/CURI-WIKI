'use client';

import { use, useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, X, Film, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import { createIssue } from '@/lib/issue-store';
import { seedProfiles } from '@/data/seed-profiles';
import type { IssuePriority, IssueProject } from '@/types';

const MAX_ATTACHMENTS = 4;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB

const projectMap: Record<string, IssueProject> = {
  admin: 'Admin',
  healthcare: 'Healthcare',
  dashboard: 'Dashboard',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface AttachmentFile {
  url: string;
  name: string;
  type: string;
  size: number;
}

export default function NewProjectIssuePage({ params }: { params: Promise<{ project: string }> }) {
  const { project: projectSlug } = use(params);
  const projectName = projectMap[projectSlug];
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [priority, setPriority] = useState<IssuePriority>('차차 수정 필요');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const activeProfiles = seedProfiles.filter((p) => p.status === 'active');

  const totalSize = attachments.reduce((sum, a) => sum + a.size, 0);

  if (!projectName) {
    return (
      <div className="mx-auto max-w-2xl py-20 text-center">
        <p className="text-text-muted">프로젝트를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const validateAndAddFiles = useCallback((files: File[]) => {
    setError(null);
    const remaining = MAX_ATTACHMENTS - attachments.length;
    if (remaining <= 0) {
      setError(`첨부파일은 최대 ${MAX_ATTACHMENTS}개까지 가능합니다.`);
      return;
    }

    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files.slice(0, remaining)) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        errors.push(`${file.name}: 이미지 또는 영상 파일만 첨부 가능합니다.`);
        continue;
      }

      if (file.type.startsWith('image/') && file.size > MAX_IMAGE_SIZE) {
        errors.push(`${file.name}: 이미지는 ${formatFileSize(MAX_IMAGE_SIZE)} 이하만 가능합니다.`);
        continue;
      }

      if (file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE) {
        errors.push(`${file.name}: 영상은 ${formatFileSize(MAX_VIDEO_SIZE)} 이하만 가능합니다.`);
        continue;
      }

      const newTotal = totalSize + validFiles.reduce((s, f) => s + f.size, 0) + file.size;
      if (newTotal > MAX_TOTAL_SIZE) {
        errors.push(`총 첨부파일 용량이 ${formatFileSize(MAX_TOTAL_SIZE)}를 초과합니다.`);
        break;
      }

      validFiles.push(file);
    }

    if (files.length > remaining) {
      errors.push(`첨부파일은 최대 ${MAX_ATTACHMENTS}개까지 가능합니다. ${remaining}개만 추가됩니다.`);
    }

    if (errors.length > 0) {
      setError(errors.join('\n'));
    }

    if (validFiles.length > 0) {
      const newAttachments = validFiles.map((file) => ({
        url: URL.createObjectURL(file),
        name: file.name,
        type: file.type,
        size: file.size,
      }));
      setAttachments((prev) => [...prev, ...newAttachments]);
    }
  }, [attachments.length, totalSize]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    validateAndAddFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed.url.startsWith('blob:')) {
        URL.revokeObjectURL(removed.url);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Clipboard paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && (item.type.startsWith('image/') || item.type.startsWith('video/'))) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        validateAndAddFiles(files);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [validateAndAddFiles]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      validateAndAddFiles(files);
    }
  }, [validateAndAddFiles]);

  const handleSubmit = async () => {
    if (!user) return;
    if (!title.trim()) {
      setError('이슈 제목을 입력해주세요.');
      return;
    }
    if (!description.trim()) {
      setError('이슈 내용을 입력해주세요.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const issue = createIssue({
        title,
        description,
        project: projectName,
        priority,
        reporter_id: user.id,
        assignee_id: assigneeId || null,
        attachments: attachments.map((a) => a.url),
      });

      // Telegram notification (fire-and-forget, never blocks issue creation)
      if (assigneeId) {
        const assigneeProfile = activeProfiles.find((p) => p.id === assigneeId);
        fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issue_id: issue.id,
            project: projectName,
            title: issue.title,
            priority: issue.priority,
            assignee_name: assigneeProfile?.name ?? assigneeId,
            assignee_id: assigneeId,
            reporter_name: user.name,
            status: issue.status,
            issue_url: `/issues/${projectSlug}/${issue.id}`,
          }),
        }).catch((err) => console.warn('[Telegram] notification failed:', err));
      }

      router.push(`/issues/${projectSlug}/${issue.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '이슈 생성에 실패했습니다.');
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/issues/${projectSlug}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <p className="text-xs text-text-muted">Issue &gt; {projectName}</p>
          <h1 className="text-xl font-bold text-text-primary">New Issue</h1>
        </div>
      </div>

      <div className="space-y-5 rounded-2xl border border-border bg-surface p-6">
        {/* Priority */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-text-primary">중요도</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as IssuePriority)}
            className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-curi-pink"
          >
            <option value="즉시 수정 필요">즉시 수정 필요</option>
            <option value="차차 수정 필요">차차 수정 필요</option>
            <option value="개선 사항">개선 사항</option>
          </select>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-text-primary">이슈 제목</label>
          <input
            type="text"
            placeholder="이슈 제목을 입력해주세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-curi-pink"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-text-primary">이슈 내용</label>
          <Textarea
            placeholder="이슈에 대해 상세히 설명해주세요..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="text-sm"
          />
        </div>

        {/* Assignee */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-text-primary">
            담당자 <span className="text-text-muted font-normal">(선택)</span>
          </label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-curi-pink"
          >
            <option value="">미지정</option>
            {activeProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Attachments */}
        <div className="space-y-1.5">
          <label className="text-[13px] font-medium text-text-primary">
            첨부파일 <span className="text-text-muted font-normal">({attachments.length}/{MAX_ATTACHMENTS})</span>
          </label>
          {totalSize > 0 && (
            <p className="text-[11px] text-text-muted">
              총 용량: {formatFileSize(totalSize)} / {formatFileSize(MAX_TOTAL_SIZE)}
            </p>
          )}

          {attachments.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {attachments.map((att, i) => (
                <div key={i} className="relative group rounded-lg border border-border overflow-hidden bg-surface-elevated">
                  {att.type.startsWith('video/') ? (
                    <div className="flex flex-col items-center justify-center h-32 bg-surface-elevated gap-1">
                      <Film className="h-8 w-8 text-text-muted" />
                      <span className="text-xs text-text-muted truncate max-w-[120px]">{att.name}</span>
                      <span className="text-[10px] text-text-muted">{formatFileSize(att.size)}</span>
                    </div>
                  ) : (
                    <div className="relative h-32">
                      <img src={att.url} alt={att.name} className="h-full w-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-0.5 flex items-center justify-between">
                        <span className="text-[10px] text-white truncate max-w-[100px]">{att.name}</span>
                        <span className="text-[10px] text-white/70">{formatFileSize(att.size)}</span>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => removeAttachment(i)}
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="삭제"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {attachments.length < MAX_ATTACHMENTS && (
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-6 text-sm transition-colors ${
                dragging
                  ? 'border-curi-pink bg-curi-pink/5 text-curi-pink'
                  : 'border-border text-text-muted hover:border-curi-pink/40 hover:text-text-secondary'
              }`}
            >
              <Upload className="h-5 w-5" />
              <span>이미지 또는 영상을 드래그하거나 클릭하여 첨부</span>
              <span className="text-[11px] text-text-muted">
                Cmd+V로 클립보드 이미지 붙여넣기 가능 | 이미지 10MB, 영상 50MB, 총 100MB
              </span>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 whitespace-pre-wrap">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Link href={`/issues/${projectSlug}`}>
            <Button variant="outline" size="sm">취소</Button>
          </Link>
          <Button
            onClick={handleSubmit}
            disabled={saving || !title.trim() || !description.trim()}
            size="sm"
          >
            {saving ? '등록 중...' : '이슈 등록'}
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-text-muted">
        * 데모 모드에서 첨부파일은 새로고침 시 유지되지 않습니다.
      </p>
    </div>
  );
}
