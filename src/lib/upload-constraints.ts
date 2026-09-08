// 업로드 허용 형식 / 용량 제한
// Supabase wiki-media 버킷 설정(supabase/migrations/003_document_attachments.sql)과 동일하게 유지합니다.

export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'];

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/json',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/zip',
  'application/x-zip-compressed',
];

export const ALLOWED_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
  ...ALLOWED_FILE_TYPES,
];

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (Supabase 프로젝트 전역 상한)

/** 파일 유형에 따른 업로드 용량 상한 */
export function maxSizeFor(mimeType: string) {
  return mimeType.startsWith('image/') ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
}

/** input[type=file]의 accept 속성 값 */
export const ACCEPT_ATTRIBUTE = ALLOWED_TYPES.join(',');
