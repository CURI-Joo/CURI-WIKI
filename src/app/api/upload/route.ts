import { NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demo-mode';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(request: NextRequest) {
  if (isDemoMode()) {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const issueId = formData.get('issue_id') as string | null;
    const documentId = formData.get('document_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 });
    }

    const markdownUrl = file.type.startsWith('image/')
      ? `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`
      : null;

    return NextResponse.json({
      attachment: {
        id: `demo-attachment-${Date.now()}`,
        issue_id: issueId,
        document_id: documentId,
        storage_key: `demo/${file.name}`,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        uploaded_by: 'user-minjoo',
        created_at: new Date().toISOString(),
      },
      markdown_url: markdownUrl,
    });
  }

  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  // Check approved status
  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .single();

  if (!profile || profile.status !== 'approved') {
    return NextResponse.json({ error: '승인된 사용자만 파일을 업로드할 수 있습니다.' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const issueId = formData.get('issue_id') as string | null;
  const documentId = formData.get('document_id') as string | null;

  if (!file) {
    return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: '허용되지 않은 파일 형식입니다. (png, jpg, webp, gif, mp4, webm, mov)' },
      { status: 400 }
    );
  }

  const isVideo = file.type.startsWith('video/');
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    const limit = isVideo ? '100MB' : '10MB';
    return NextResponse.json(
      { error: `파일 크기가 ${limit}를 초과합니다.` },
      { status: 400 }
    );
  }

  // Generate storage key
  const ext = file.name.split('.').pop() || 'bin';
  const timestamp = Date.now();
  const storageKey = `${user.id}/${timestamp}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const supabaseAdmin = getSupabaseAdmin();

  // Upload to Supabase Storage using admin client
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from('wiki-media')
    .upload(storageKey, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `업로드 실패: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // Insert attachment record
  const { data: attachment, error: insertError } = await supabaseAdmin
    .from('attachments')
    .insert({
      issue_id: issueId || null,
      document_id: documentId || null,
      storage_key: storageKey,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    // Cleanup uploaded file
    await supabaseAdmin.storage.from('wiki-media').remove([storageKey]);
    return NextResponse.json(
      { error: `첨부파일 기록 실패: ${insertError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    attachment,
    markdown_url: file.type.startsWith('image/') ? `/api/upload/${attachment.id}/file` : null,
  });
}
