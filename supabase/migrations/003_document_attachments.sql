-- ============================================================
-- CURI Wiki: 문서 첨부파일 지원
-- ============================================================

-- ─── 조회 성능 인덱스 ────────────────────────────────────────
create index if not exists attachments_document_id_idx
  on public.attachments (document_id);

create index if not exists attachments_issue_id_idx
  on public.attachments (issue_id);

-- ─── 첨부파일 삭제 정책 ──────────────────────────────────────
-- 업로더 본인과 관리자만 첨부파일 기록을 삭제할 수 있습니다.
drop policy if exists "Uploaders and admins can delete attachments" on public.attachments;

create policy "Uploaders and admins can delete attachments"
  on public.attachments for delete
  using (
    public.is_approved()
    and (uploaded_by = auth.uid() or public.is_admin())
  );

-- ─── wiki-media 버킷 허용 확장자 확대 ────────────────────────
-- 문서 첨부는 이미지/영상 외 문서·압축 파일도 허용합니다.
-- file_size_limit은 프로젝트 전역 업로드 상한(50MB)을 넘을 수 없습니다.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
  -- 이미지
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/svg+xml',
  -- 영상
  'video/mp4', 'video/webm', 'video/quicktime',
  -- 오디오
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm',
  -- 문서
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/json',
  'text/plain', 'text/csv', 'text/markdown',
  -- 압축
  'application/zip', 'application/x-zip-compressed'
]
where id = 'wiki-media';
