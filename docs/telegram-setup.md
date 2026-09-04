# Telegram Issue Notification 설정

CURI Wiki에서 Issue를 생성하고 담당자를 지정하면, 해당 담당자의 Telegram으로 알림이 전송됩니다.

---

## 1. Telegram Bot 생성

1. Telegram에서 [@BotFather](https://t.me/BotFather)를 검색합니다.
2. `/newbot` 명령어를 입력합니다.
3. Bot 이름을 입력합니다. (예: `CURI Wiki Bot`)
4. Bot username을 입력합니다. (예: `curi_wiki_bot`)
5. BotFather가 **Bot Token**을 발급합니다. 이 값을 복사해주세요.

```
예: 7123456789:AAH1234abcd5678efgh-IJKLMNOP
```

---

## 2. 담당자가 Bot과 대화 시작

알림을 받을 담당자(Dean, Jesse 등)가 직접 해당 Bot을 Telegram에서 검색하고 `/start`를 보내야 합니다.

Bot에게 먼저 메시지를 보내지 않으면 Bot이 해당 사용자에게 메시지를 보낼 수 없습니다.

---

## 3. chat_id 확인

담당자가 Bot에게 `/start` 또는 아무 메시지를 보낸 후, 아래 URL을 브라우저에서 열어 chat_id를 확인합니다.

```
https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
```

응답 JSON에서 `message.chat.id` 값을 찾습니다.

```json
{
  "result": [
    {
      "message": {
        "chat": {
          "id": 123456789,
          "first_name": "Dean"
        },
        "text": "/start"
      }
    }
  ]
}
```

이 `123456789`가 해당 담당자의 chat_id입니다.

---

## 4. .env.local 설정

프로젝트 루트의 `.env.local` 파일에 아래 환경변수를 추가합니다.

```env
# Telegram Bot (server-side only)
TELEGRAM_BOT_TOKEN=7123456789:AAH1234abcd5678efgh-IJKLMNOP

# user ID → Telegram chat ID 매핑 (JSON)
TELEGRAM_CHAT_MAP={"user-dev1":"123456789","user-ceo":"987654321"}
```

### 환경변수 설명

| 변수 | 설명 |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | BotFather가 발급한 Bot Token |
| `TELEGRAM_CHAT_MAP` | CURI Wiki user ID → Telegram chat ID 매핑 (JSON) |

### User ID 확인

CURI Wiki의 seed profile user ID는 다음과 같습니다.

| 이름 | User ID |
| --- | --- |
| 서민주 (Joo) | `user-minjoo` |
| jesse | `user-ceo` |
| dean | `user-dev1` |
| calix | `user-dev2` |
| jun | `user-designer` |

Google 로그인 사용자의 user ID는 Firebase UID입니다.

### TELEGRAM_CHAT_MAP 예시

```env
# Dean과 Jesse에게 알림 전송
TELEGRAM_CHAT_MAP={"user-dev1":"123456789","user-ceo":"987654321"}

# 모든 담당자에게 알림 전송
TELEGRAM_CHAT_MAP={"user-minjoo":"111","user-ceo":"222","user-dev1":"333","user-dev2":"444","user-designer":"555"}
```

---

## 5. 서버 재시작

`.env.local`을 수정한 후 개발 서버를 재시작합니다.

```bash
# 기존 서버 종료 후
npm run dev
```

환경변수는 서버 시작 시 로드되므로 반드시 재시작해야 합니다.

---

## 6. 테스트

1. `http://localhost:3000`에서 로그인합니다.
2. ISSUE → 프로젝트 선택 → New Issue를 클릭합니다.
3. 이슈 제목, 내용을 입력합니다.
4. **담당자**를 선택합니다 (TELEGRAM_CHAT_MAP에 매핑된 사용자).
5. **이슈 등록** 버튼을 클릭합니다.
6. Telegram에서 알림을 확인합니다.

### 알림 메시지 예시

```
🚨 새로운 이슈가 등록되었습니다.

Project: Admin
Issue: ISSUE-005
중요도: 즉시 수정 필요
제목: AI Survey 설정 Modal 오류
담당자: dean
등록자: 서민주
상태: 이슈 등록
```

---

## 7. Troubleshooting

### 알림이 오지 않는 경우

1. **TELEGRAM_BOT_TOKEN** 확인 — `.env.local`에 올바른 토큰이 설정되어 있는지 확인
2. **TELEGRAM_CHAT_MAP** 확인 — 담당자의 user ID와 chat ID가 올바르게 매핑되어 있는지 확인
3. **Bot /start** 확인 — 담당자가 Bot에게 `/start`를 보냈는지 확인
4. **서버 로그** 확인 — 터미널에 `[Telegram]` 로그가 출력됩니다
5. **담당자 미선택** — 담당자를 선택하지 않으면 알림이 전송되지 않습니다

### 서버 로그 예시

```
[Telegram] Notification sent for ISSUE-005 to chat 123456789
[Telegram] No chat_id mapped for user: user-dev2
[Telegram] TELEGRAM_BOT_TOKEN not configured, skipping notification
```

### Issue 생성은 정상인데 알림만 실패하는 경우

Telegram 알림 실패는 Issue 생성에 영향을 주지 않습니다. Issue는 정상 생성되고, 알림 실패는 서버 로그에만 기록됩니다.

---

## Architecture

```
Client (Issue 생성 성공)
        ↓
POST /api/telegram (fire-and-forget)
        ↓
Next.js API Route (server-side)
        ↓
TELEGRAM_BOT_TOKEN (env, server only)
TELEGRAM_CHAT_MAP (env, server only)
        ↓
https://api.telegram.org/bot.../sendMessage
        ↓
담당자 Telegram 채팅
```

- Bot Token은 서버에서만 접근 가능 (`NEXT_PUBLIC_` prefix 없음)
- Client에서는 `/api/telegram`으로 POST만 보내며 Token에 접근 불가
- 동일 Issue에 대한 중복 알림은 서버 메모리에서 방지
