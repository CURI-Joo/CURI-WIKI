import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { MAX_FILE_SIZE } from '@/lib/upload-constraints';

export const videoUploadInput = z.object({
  file_name: z.string().trim().min(1).max(255),
  mime_type: z.enum(['video/mp4', 'video/webm', 'video/quicktime']),
  file_size: z.number().int().positive().max(MAX_FILE_SIZE),
  document_id: z.string().min(1).max(100).nullable().default(null),
});
const ticketSchema = videoUploadInput.extend({ id: z.uuid(), user_id: z.string().min(1), expires: z.number().int() });
export type VideoUploadTicket = z.infer<typeof ticketSchema>;

function signature(payload: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Upload signing key is required');
  return createHmac('sha256', key).update(`curi-video-upload:v1:${payload}`).digest();
}

export function signVideoUpload(ticket: VideoUploadTicket) {
  const payload = Buffer.from(JSON.stringify(ticket)).toString('base64url');
  return `${payload}.${signature(payload).toString('base64url')}`;
}

export function readVideoUpload(value: unknown, userId: string): VideoUploadTicket | null {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const [payload, mac, extra] = value.split('.');
    if (!payload || !mac || extra) return null;
    const received = Buffer.from(mac, 'base64url');
    const expected = signature(payload);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    const ticket = ticketSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString()));
    return ticket.user_id === userId && ticket.expires > Date.now() ? ticket : null;
  } catch { return null; }
}

export function videoStorageKey(ticket: VideoUploadTicket) {
  const ext = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' }[ticket.mime_type];
  return `${ticket.user_id}/videos/${ticket.id}.${ext}`;
}
