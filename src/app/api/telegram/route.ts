import { NextRequest, NextResponse } from 'next/server';

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

// ─── Chat ID Mapping ────────────────────────────────────
// TELEGRAM_CHAT_MAP env var: JSON string mapping user ID → chat ID
// Example: {"user-dev1":"123456789","user-ceo":"987654321"}
function getChatId(userId: string): string | null {
  const raw = process.env.TELEGRAM_CHAT_MAP;
  if (!raw) return null;

  try {
    const map = JSON.parse(raw) as Record<string, string>;
    return map[userId] ?? null;
  } catch {
    console.error('[Telegram] TELEGRAM_CHAT_MAP is not valid JSON');
    return null;
  }
}

// ─── Deduplication ──────────────────────────────────────
// In-memory set to prevent duplicate notifications for the same issue
// (resets on server restart, which is fine for demo)
const notifiedIssues = new Set<string>();

// ─── POST /api/telegram ─────────────────────────────────
export async function POST(request: NextRequest) {
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

  const { issue_id, project, title, priority, assignee_name, assignee_id, reporter_name, status, issue_url } = body;

  if (!issue_id || !assignee_id) {
    return NextResponse.json({ ok: false, reason: 'missing_fields' }, { status: 400 });
  }

  // Dedup check
  if (notifiedIssues.has(issue_id)) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_notified' });
  }

  const chatId = getChatId(assignee_id);
  if (!chatId) {
    console.warn(`[Telegram] No chat_id mapped for user: ${assignee_id}`);
    return NextResponse.json(
      { ok: false, reason: 'no_chat_id', user: assignee_id },
      { status: 200 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const fullUrl = issue_url ? `${appUrl}${issue_url}` : '';

  const lines = [
    '🚨 새로운 이슈가 등록되었습니다.',
    '',
    `Project: ${project}`,
    `Issue: ${issue_id}`,
    `중요도: ${priority}`,
    `제목: ${title}`,
    `담당자: ${assignee_name}`,
    `등록자: ${reporter_name}`,
    `상태: ${status}`,
  ];

  if (fullUrl) {
    lines.push('', `🔗 ${fullUrl}`);
  }

  const message = lines.join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      console.error('[Telegram] API error:', data.description);
      return NextResponse.json(
        { ok: false, reason: 'telegram_api_error', detail: data.description },
        { status: 200 }
      );
    }

    notifiedIssues.add(issue_id);
    console.log(`[Telegram] Notification sent for ${issue_id} to chat ${chatId}`);
    return NextResponse.json({ ok: true, sent: true });
  } catch (err) {
    console.error('[Telegram] Network error:', err);
    return NextResponse.json(
      { ok: false, reason: 'network_error' },
      { status: 200 }
    );
  }
}
