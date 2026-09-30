import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readVideoUpload, signVideoUpload, videoStorageKey, videoUploadInput } from '@/lib/video-upload-ticket';

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Only metadata crosses the app server; video bytes go straight to private Storage. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('로그인이 필요합니다.', 401);
  const { data: profile } = await supabase.from('profiles').select('status, role').eq('id', user.id).single();
  if (profile?.status !== 'approved') return fail('승인된 사용자만 영상을 업로드할 수 있습니다.', 403);

  const body = await request.json().catch(() => null);
  if (!body || !['init', 'complete', 'cancel'].includes(body.action)) return fail('잘못된 업로드 요청입니다.', 400);
  const admin = getSupabaseAdmin();
  const bucket = admin.storage.from('wiki-media');
  const ticket = body.action === 'init' ? null : readVideoUpload(body.ticket, user.id);
  const input = body.action === 'init' ? videoUploadInput.safeParse(body) : null;
  if (body.action === 'init' ? !input?.success : !ticket) return fail('MP4·WebM·MOV 영상(50MB 이하)을 다시 선택해 주세요.', 400);
  const metadata = ticket ?? input!.data!;

  // Recheck the document at completion too: its category may have changed during upload.
  if (metadata.document_id && body.action !== 'cancel') {
    const { data: doc, error } = await admin.from('documents').select('category_id').eq('id', metadata.document_id).single();
    if (error || !doc) return fail('문서를 찾을 수 없습니다.', 404);
    if ((doc as { category_id: string }).category_id === 'cat-secret' && profile.role !== 'admin') return fail('Secret 문서에는 관리자만 첨부할 수 있습니다.', 403);
  }

  if (body.action === 'init') {
    const pending = { ...metadata, id: randomUUID(), user_id: user.id, expires: Date.now() + 60 * 60 * 1000 };
    const { data, error } = await bucket.createSignedUploadUrl(videoStorageKey(pending), { upsert: false });
    if (error || !data) return fail('영상 업로드를 준비하지 못했습니다. 다시 시도해 주세요.', 500);
    return NextResponse.json({ signed_url: data.signedUrl, ticket: signVideoUpload(pending) }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const key = videoStorageKey(ticket!);
  // Completion is idempotent, including when the response was lost on a slow connection.
  const { data: existing, error: lookupError } = await admin.from('attachments').select('*').eq('id', ticket!.id).maybeSingle();
  if (lookupError) return fail('영상 저장 상태를 확인하지 못했습니다. 다시 시도해 주세요.', 500);
  if (existing) {
    if (existing.uploaded_by !== user.id) return fail('접근 권한이 없습니다.', 403);
    return NextResponse.json({ attachment: existing, markdown_url: `/api/upload/${existing.id}/file` });
  }
  if (body.action === 'cancel') {
    await bucket.remove([key]);
    return NextResponse.json({ ok: true });
  }

  const { data: stored, error: infoError } = await bucket.info(key);
  if (infoError || !stored) return fail('영상 전송이 완료되지 않았습니다. 다시 시도해 주세요.', 400);
  if (stored.size !== ticket!.file_size || stored.contentType !== ticket!.mime_type) {
    await bucket.remove([key]);
    return fail('업로드한 영상의 형식 또는 용량이 일치하지 않습니다.', 400);
  }
  const { data: attachment, error: insertError } = await admin.from('attachments').upsert({
    id: ticket!.id, storage_key: key, file_name: ticket!.file_name, mime_type: ticket!.mime_type,
    file_size: stored.size, document_id: ticket!.document_id, uploaded_by: user.id,
  }, { onConflict: 'id', ignoreDuplicates: true }).select().single();
  if (insertError || !attachment) return fail('영상 저장을 완료하지 못했습니다. 다시 시도해 주세요.', 500);
  return NextResponse.json({ attachment, markdown_url: `/api/upload/${attachment.id}/file` });
}
