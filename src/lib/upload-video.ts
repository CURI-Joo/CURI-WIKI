import { isDemoMode } from '@/lib/demo-mode';
import { ALLOWED_VIDEO_TYPES, MAX_FILE_SIZE } from '@/lib/upload-constraints';
import type { Attachment } from '@/types';

async function videoRequest(body: Record<string, unknown>) {
  const response = await fetch('/api/upload/video', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || '영상 업로드에 실패했습니다.');
  return payload;
}

export async function uploadVideo(file: File, documentId?: string, onProgress?: (percent: number) => void): Promise<{ attachment: Attachment; markdown_url: string }> {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) throw new Error('MP4·WebM·MOV 영상을 선택해 주세요.');
  if (!file.size || file.size > MAX_FILE_SIZE) throw new Error('영상은 50MB 이하만 가능합니다.');
  onProgress?.(0);
  if (isDemoMode()) {
    const form = new FormData();
    form.append('file', file);
    if (documentId) form.append('document_id', documentId);
    const response = await fetch('/api/upload', { method: 'POST', body: form });
    if (!response.ok) throw new Error('영상 업로드에 실패했습니다.');
    onProgress?.(100);
    return response.json();
  }
  const prepared = await videoRequest({ action: 'init', file_name: file.name, mime_type: file.type, file_size: file.size, document_id: documentId ?? null });
  try {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', prepared.signed_url);
      xhr.timeout = 15 * 60 * 1000;
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress?.(Math.min(99, Math.round(event.loaded / event.total * 100))); };
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('영상 전송에 실패했습니다. 다시 시도해 주세요.'));
      xhr.onerror = () => reject(new Error('연결이 끊겼습니다. 네트워크를 확인하고 다시 업로드해 주세요.'));
      xhr.ontimeout = () => reject(new Error('영상 전송 시간이 초과되었습니다. 다시 시도해 주세요.'));
      xhr.send(file);
    });
    const result = await videoRequest({ action: 'complete', ticket: prepared.ticket });
    onProgress?.(100);
    return result;
  } catch (error) {
    await videoRequest({ action: 'cancel', ticket: prepared.ticket }).catch(() => {});
    throw error;
  }
}
