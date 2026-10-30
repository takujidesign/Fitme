# Round 21 — Notification gaps: chat route bug, renewal, lock-screen privacy, server quiet hours, cross-device done, badge

Same rules as earlier CODEX_TASKS files:
- Keep storage keys, the worker name, the API URL and `const VERSION = 'fitme-v1'` in `app/sw.js`.
- Add migration `0013_round21.sql` only if needed.
- Mock third-party services.
- Never pre-cache RepDB.
- Do not commit, push or deploy.

## Facts Claude checked (2026-10-30)
- **Bug:** the chat push and other `pushUser` routes are dropped when the notification is tapped.
  - `worker/src/social.js:33` sends `route:'#/messages/<conversation>'`.
  - But `app/sw.js:88` and `:94` only allow `^#\/(today|food|workout|supps|me|player\/YYYY-MM-DD)$`, so a tap opens `#/today`.
  - `worker/src/social-extra.js:76` (buddy), `admin-social.js:50` (moderation warn) and `:67` (broadcast) also call `pushUser`; check which routes they send.
- `pushUser` (`worker/src/push.js:12`):
  - it ignores the receiver's quiet hours and category toggles;
  - it has no stable ID or dedup;
  - its callers `await` it inline, so sending a chat message waits on every push fetch.

  The receiver's quiet hours and toggles live only in the client state (`notifications.quietStart/quietEnd`, `store.js:36`); the server does not know them.
- Nothing handles `pushsubscriptionchange`. The client only re-registers when the plan, settings or tz change (`notifications.js:24`). If Safari or Chrome rotates the endpoint, the device silently stops receiving push until the 8-day expiry.
- Medication reminders put the medicine name and dose in the title and body (`reminders.js`, `type==='medication'`). These appear on the lock screen, in the webcal feed and in the downloaded `.ics`.
- There is no `setAppBadge`, no cross-device acknowledgement, and no admin view of recent push failures per service. Admin usage only shows the overall delivery success rate.
- Logout (`signOut` → `unlinkPush`) and account deletion (`round5.js` `deleteAccount` deletes KV devices; `calendar_feeds` cascades) are already fine. Don't rework them; just add tests where they're missing.

## 1. Fix notification routes (bug)
- Put one route allowlist in a small shared module, for example `app/js/push-routes.js`, exporting a regex and `safeRoute(route)`.
  - It covers every route the server sends: today, food, workout, supps, me, `player/<date>`, `messages/<id>`, and the friends/buddy/together screens if used.
  - IDs are limited to `[A-Za-z0-9_-]{1,64}`.
- The SW and the worker both use it. The SW can't import an ES module if it is a classic worker; in that case, inline the same regex and add a test that both copies are identical.
- The worker `pushRequest` reminder-route validation uses the same list.
- Tests:
  - tapping a chat push navigates to `#/messages/<id>`;
  - unknown or malformed routes fall back to `#/today`;
  - `javascript:` and external URLs are rejected.

## 2. Server-side notification preferences and pushUser hardening
- The client syncs `{quietStart, quietEnd, tz, chat:true, social:true, privacy}` to the server whenever they change. Use the existing push subscribe body or a small `POST /api/push/prefs`, stored on the device record.
- In Settings → การแจ้งเตือน, add two toggles: **ข้อความแชท** and **กิจกรรมเพื่อน / buddy**. Both are on by default.
- Change `pushUser(env, userId, payload, {category})`:
  - **Category:** skip devices whose preferences turn that category off.
  - **Quiet hours:**
    - During quiet hours, chat and social pushes are not shown. Store them as `pending` with `notBefore` = quiet end, and the 5-minute cron delivers them then.
    - Send at most one coalesced "N new messages" per conversation.
    - Moderation warnings and admin broadcasts also respect quiet hours.
  - **Stable tag/ID:** for example `chat-<conversation>`, so repeats replace each other instead of stacking. Dedup by `{userId, id}` within 10 minutes.
  - **Run in the background:** the callers use `ctx.waitUntil(pushUser(...))` (thread `ctx` through the routes as needed), so the HTTP response doesn't wait.
- Tests:
  - quiet hours delay a chat push and then deliver one coalesced push;
  - a category turned off means no push;
  - dedup works;
  - the message API responds without awaiting push (mock a slow fetch);
  - quiet hours that wrap midnight work in the receiver's tz.

## 3. Subscription renewal
- Store the push `deviceId` in IndexedDB too, so the SW can read it.
- In the SW, on `pushsubscriptionchange`:
  - re-subscribe with the same `applicationServerKey` (stored in IndexedDB at enable time);
  - `POST /api/push/subscribe` with the existing `deviceId`, the tz and the last reminder list (also in IndexedDB).
- On every app open while push is enabled:
  - Read `pushManager.getSubscription()`. If it is null, or its endpoint differs from the one last sent, re-subscribe and re-register.
  - If `Notification.permission` is now `denied`, call unsubscribe on the server and set push to off in the UI with a short explanation.
  - Otherwise re-register at most once per 24 h, so the 8-day expiry never lapses for active users.
- Tests: the SW event re-registers with the same deviceId; a changed or null endpoint on open re-subscribes; denied permission unregisters; the 24-h throttle holds.

## 4. Lock-screen privacy ("ซ่อนรายละเอียดบนหน้าจอล็อก")
- Add a setting in Settings → การแจ้งเตือน with two levels:
  - **Medications only** (default ON for every user, including existing ones through a state migration with a default value);
  - **All reminders**.
- When a reminder is covered by the setting:
  - push, in-app, native and calendar titles become `Fixmee: ถึงเวลาแล้ว` / `Fixmee: reminder due` (and the 3 other languages), with an empty body;
  - the details show only inside the app, after it opens, in the missed list or the today view.
- Apply it in:
  - `reminders.js` output, or a final mapper used by every path;
  - the SW `showNotification`;
  - the Capacitor scheduler;
  - `buildICS` (subscribed feed and download);
  - server pushes when the device preference says so.
- Chat push already says "New message from a friend". Keep it generic and never include message text.
- Tests: with the default setting, no medication name appears in a push payload, the ICS, the native schedule or the SW notification; "All reminders" hides every title; turning it off restores the details; the state migration sets the default.

## 5. Cross-device "done"
- Add `POST /api/push/ack {id, action:'done'|'snooze', at}`, authenticated with the account token or the device header, and rate-limited. Store `ack:<userId>:<id>` in KV with a 48-h TTL.
- The scheduler and `pushUser` skip pending copies on the user's other devices when an ack exists. A device without an account only acks itself (local).
- The SW `notificationclick` handler for `done`/`snooze` posts the ack. The in-app missed list, the today view and native actions post it too.
- On open, the app fetches recent acks (`GET /api/push/ack?since=`) and hides those IDs in the missed list. On platforms where it is supported, it closes matching notifications with `registration.getNotifications({tag})`.
- Don't send a silent "dismiss" push: iOS requires every push to show a notification.
- Tests: an ack on device A prevents the pending send to device B; the missed list hides acked IDs; the rate limit applies; anonymous devices stay local.

## 6. App badge
- When `navigator.setAppBadge` exists, set the badge to the number of today's reminders that are due but not done or acked.
  - The SW updates it on push; the app updates it on open, done, snooze and at midnight.
  - Call `clearAppBadge()` at zero.
- With Capacitor, use the badge option of the local-notifications plugin.
- Add a toggle "แสดงตัวเลขบนไอคอนแอป", on by default.
- Tests: the count updates on push, done and open, and clears at zero; nothing runs when the API is unsupported.

## 7. Admin: push diagnostics
- In Admin → แดชบอร์ด → การใช้งาน (or the existing push card in admin-setup), add a "ปัญหาการแจ้งเตือนล่าสุด" table with the last 50 failures:
  - device ID shortened to 8 characters, push service host, status, reason (truncated) and time;
  - counts per service for the selected range;
  - the number of 404/410 clean-ups.
- No payloads or user emails. Admin-only (`admin()` guard).
- Record failures in a capped KV list or a small D1 table that is pruned after 30 days. Don't scan every device per request.
- Tests: admin-only; no payload fields; capped at 50; pruning works.

## 8. Real-device checklist
Add `docs/REMINDERS_DEVICE_TESTS.md` in Thai: a checklist the owner can run in about 30 minutes, with the expected result for each step.
- **iPhone:**
  - Safari tab shows "add to home screen first";
  - in the home-screen PWA: enable → self-test → a scheduled reminder with the app closed → Done/Snooze → a tap opens the right screen (chat too);
  - lock-screen privacy hides the medication name;
  - the badge count.
- **Android Chrome,** installed and in the browser: the same steps, plus a note on battery optimisation.
- **Desktop** Chrome, Firefox and Safari.
- **Offline and time zone:**
  - airplane mode: a calendar alarm still fires, and the missed list appears on the next open;
  - change the phone's time zone: reminders follow after the app opens.
- **Quiet hours:** a chat during quiet hours arrives after quiet hours end, as one notification.
- **Two devices:** Done on one stops the other.
- **Calendar link:** after revoking, the events disappear after the calendar refreshes.
- **Logout:** no further notifications.

## Done when
- Everything above is implemented with tests, and all existing tests pass:
  ```
  node tests/*.mjs
  cd worker && node test.mjs round*.test.mjs auth-errors.test.mjs push-redirect.test.mjs
  ```
  Add `round21.test.mjs`.
- The worker dry-run bundles (`npx wrangler deploy --dry-run`), and the local D1 migration applies, or you report the block.
- `docs/ROUND21_VALIDATION.md` lists:
  - the route allowlist;
  - the server preference fields;
  - the quiet-hours/coalescing rules;
  - what privacy mode hides on each path;
  - the ack flow;
  - what still needs a real device.
- Screenshots at 375 px in light and dark go in `docs/round21-screens/`:
  - the notification settings with the new toggles and privacy setting;
  - a privacy-mode notification preview;
  - the missed list with acked items hidden;
  - the admin push diagnostics.
- Leave changes uncommitted; do not push or deploy.
