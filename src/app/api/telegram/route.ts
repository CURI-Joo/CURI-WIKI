import { after, NextRequest, NextResponse } from 'next/server';
import { isDemoMode } from '@/lib/demo-mode';

// ─── Types ───────────────────────────────────────────────
interface TelegramNotifyRequest {
  issue_id: string;
  project: string;
  title: string;
  priority: string;
  assignee_name: string;
  assignee_id: string;
  reporter_name: string;
  status: string;
  issue_url?: string;
}

interface TelegramDispatchInput {
  issue_id: string;
  project?: string;
  title?: string;
  priority?: string;
  assignee_name?: string;
  reporter_name?: string;
  status?: string;
  issue_url?: string;
  botToken: string;
  chatId: string;
  threadId?: string;
}

// ─── Group Topic Config ──────────────────────────────────
// TELEGRAM_CHAT_ID: Group chat ID (e.g. -1002011880068)
// TELEGRAM_MESSAGE_THREAD_ID: Topic thread ID within the group (e.g. 67730)

// ─── Deduplication ──────────────────────────────────────
// In-memory set to prevent duplicate notifications for the same issue
// (resets on server restart, which is fine for demo)
const notifiedIssues = new Set<string>();

async function sendTelegramNotification({
  issue_id,
  project,
  title,
  priority,
  assignee_name,
  reporter_name,
  status,
  issue_url,
  botToken,
  chatId,
  threadId,
}: TelegramDispatchInput) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const fullUrl = issue_url ? `${appUrl}${issue_url}` : '';

  const lines = [
    '🚨 새로운 이슈가 등록되었습니다.',
    '',
    `Project: ${project ?? '-'}`,
    `Issue: ${issue_id}`,
    `중요도: ${priority ?? '-'}`,
    `제목: ${title ?? '-'}`,
    `담당자: ${assignee_name ?? '-'}`,
    `등록자: ${reporter_name ?? '-'}`,
    `상태: ${status ?? '-'}`,
  ];

  if (fullUrl) {
    lines.push('', `🔗 ${fullUrl}`);
  }

  const message = lines.join('\n');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: Number(chatId),
        ...(threadId ? { message_thread_id: Number(threadId) } : {}),
        text: message,
        parse_mode: 'HTML',
      }),
      signal: controller.signal,
    });

    const data = await res.json();

    if (!data.ok) {
      console.error('[Telegram] API error:', data.description);
      return;
    }

    notifiedIssues.add(issue_id);
    console.log(`[Telegram] Notification sent for ${issue_id} to group ${chatId}${threadId ? ` (topic ${threadId})` : ''}`);
  } catch (err) {
    console.error('[Telegram] Network error:', err);
  } finally {
    clearTimeout(timeout);
  }
}

// ─── POST /api/telegram ─────────────────────────────────
export async function POST(request: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'demo_mode' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN not configured, skipping notification');
    return NextResponse.json(
      { ok: false, reason: 'bot_token_not_configured' },
      { status: 200 }
    );
  }

  let body: TelegramNotifyRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 });
  }

  const { issue_id, project, title, priority, assignee_name, reporter_name, status, issue_url } = body;

  if (!issue_id) {
    return NextResponse.json({ ok: false, reason: 'missing_fields' }, { status: 400 });
  }

  // Dedup check
  if (notifiedIssues.has(issue_id)) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_notified' });
  }

  const chatId = process.env.TELEGRAM_CHAT_ID;
  const threadId = process.env.TELEGRAM_MESSAGE_THREAD_ID;

  if (!chatId) {
    console.warn('[Telegram] TELEGRAM_CHAT_ID not configured, skipping notification');
    return NextResponse.json(
      { ok: false, reason: 'chat_id_not_configured' },
      { status: 200 }
    );
  }

  after(async () => {
    await sendTelegramNotification({
      issue_id,
      project,
      title,
      priority,
      assignee_name,
      reporter_name,
      status,
      issue_url,
      botToken,
      chatId,
      threadId: threadId || undefined,
    });
  });

  return NextResponse.json({ ok: true, queued: true });
}
