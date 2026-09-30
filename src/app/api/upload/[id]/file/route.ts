import { after, NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demo-mode';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loadImagePreview, PRIVATE_IMAGE_CACHE } from '@/lib/image-preview-server';
import { isPublicDocumentImage } from '@/lib/public-document-image';

type AttachmentDocument = { category_id: string | null; status: string; content_markdown: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isDemoMode()) {
    return NextResponse.json(
      { error: `데모 모드 첨부파일은 Storage에 저장되지 않습니다: ${id}` },
      { status: 404 }
    );
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: attachment, error } = await supabaseAdmin.from('attachments')
    .select('storage_key, document_id, mime_type').eq('id', id).single();

  if (error || !attachment) {
    return NextResponse.json({ error: '첨부파일을 찾을 수 없습니다.' }, { status: 404 });
  }

  let document: AttachmentDocument | null = null;
  let publicImage = false;
  if (attachment.document_id) {
    const { data: documentData, error: documentError } = await supabaseAdmin
      .from('documents')
      .select('category_id, status, content_markdown')
      .eq('id', attachment.document_id)
      .single();

    document = documentData as AttachmentDocument | null;

    if (documentError || !document) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
    }

    publicImage = attachment.mime_type.startsWith('image/') && isPublicDocumentImage(document, id, request.nextUrl.origin);
  } else if (attachment.mime_type.startsWith('image/')) {
    // Images uploaded while composing a new document do not have a parent ID yet.
    const { data: candidates, error: candidateError } = await supabaseAdmin.from('documents')
      .select('category_id, status, content_markdown').eq('status', 'Published').neq('category_id', 'cat-secret')
      .ilike('content_markdown', `%/api/upload/${id}/file%`).limit(20);
    publicImage = !candidateError && (candidates ?? []).some(candidate => isPublicDocumentImage(candidate, id, request.nextUrl.origin));
  }

  if (!publicImage) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('status, role').eq('id', user.id).single();
    if (!profile || profile.status !== 'approved' || (document?.category_id === 'cat-secret' && profile.role !== 'admin')) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }
  }

  const cacheHeaders = { 'Cache-Control': PRIVATE_IMAGE_CACHE, Vary: 'Cookie, Authorization' };
  const bucket = supabaseAdmin.storage.from('wiki-media');
  if (request.nextUrl.searchParams.get('preview') === '1' && attachment.mime_type.startsWith('image/')) {
    try {
      const preview = await loadImagePreview(bucket, attachment.storage_key);
      if (preview.persist) after(preview.persist);
      return new NextResponse(new Uint8Array(preview.bytes), {
        headers: { ...cacheHeaders, 'Content-Type': preview.contentType, 'X-Content-Type-Options': 'nosniff', 'Content-Length': String(preview.bytes.length) },
      });
    } catch {
      // Missing previews or unsupported images must never turn a working original into a broken image.
    }
  }

  const { data: signedUrl, error: signError } = await bucket.createSignedUrl(attachment.storage_key, 3600);

  if (signError || !signedUrl) {
    return NextResponse.json({ error: 'URL 생성에 실패했습니다.' }, { status: 500 });
  }

  return NextResponse.redirect(signedUrl.signedUrl, { headers: cacheHeaders });
}
