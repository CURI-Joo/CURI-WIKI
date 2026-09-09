import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isDemoMode } from '@/lib/demo-mode';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (isDemoMode()) {
    return NextResponse.json({ ok: true });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('status, role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.status !== 'approved') {
    return NextResponse.json({ error: '문서 삭제 권한이 없습니다.' }, { status: 403 });
  }

  const supabaseAdmin = getSupabaseAdmin() as any;

  const { data: document, error: documentError } = await supabaseAdmin
    .from('documents')
    .select('id, owner_id')
    .eq('id', id)
    .single();

  if (documentError || !document) {
    return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
  }

  const canDelete = profile.role === 'admin' || document.owner_id === user.id;
  if (!canDelete) {
    return NextResponse.json({ error: '문서 삭제 권한이 없습니다.' }, { status: 403 });
  }

  const { data: attachments } = await supabaseAdmin
    .from('attachments')
    .select('id, storage_key')
    .eq('document_id', id);

  const storageKeys = (attachments ?? [])
    .map((attachment: { storage_key?: string | null }) => attachment.storage_key)
    .filter((storageKey: string | null | undefined): storageKey is string => Boolean(storageKey));

  if (storageKeys.length > 0) {
    await supabaseAdmin.storage.from('wiki-media').remove(storageKeys);
  }

  await supabaseAdmin
    .from('attachments')
    .delete()
    .eq('document_id', id);

  const { error: deleteError } = await supabaseAdmin
    .from('documents')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json(
      { error: `문서 삭제 실패: ${deleteError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id });
}
