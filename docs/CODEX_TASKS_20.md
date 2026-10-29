# Round 20 — Works without internet: offline app and reminders that follow the device clock and calendar

Same rules as earlier CODEX_TASKS files. Keep storage keys, the worker name, the API URL and `const VERSION = 'fitme-v1'` in `app/sw.js`. Add migration `0012_round20.sql` only if needed. Mock third-party services. Do not commit, push or deploy.

## Facts Claude checked (2026-10-29)
- Push delivery was broken until today: the worker used `fetch(..., {redirect:'error'})`, which Cloudflare Workers reject. This was fixed in `4621f88` (now `'manual'`). Server push still needs internet on both sides.
- An iPhone home-screen web app **cannot schedule a local notification** to fire later while the app is closed. Notification Triggers was abandoned, and a service worker is not woken by time. Without internet, the only things that fire on time are:
  - **calendar alarms** (the iOS/Android Calendar uses the device clock and works offline);
  - **native local notifications**, in the Capacitor app in `mobile/`;
  - timers **while the app is open**.
- `app/js/export.js` already builds an `.ics` file with VALARM. But it sits behind `canExport()` (premium) in Me, its alarm fires 5 minutes early, and it only covers plan events.
- The service worker caches the shell but skips `./data/exercise-db.json` and the three.js files. Other data and images are only cached once they're used.
- The self-test is capped at 3 per hour per device (`cap(env,'push-self',…,3,3600000)`). The app then shows a raw "Too many attempts; try again later".

## 1. Offline-first app
- Every core feature works with no network after the first load: today plan, workout player, timers, food/supplement logging, the daily menu editor, the food search (local FOODS DB plus custom foods), measurements, progress charts, settings, theme/language and the guide. AI, sync, social, chat, payments, Open Food Facts lookups and health OAuth say clearly that they need internet.
- Pre-cache in the background after the first load: all `app/data/*.json` the app reads (including the exercise DB) and the exercise illustrations in `app/img/ex`. Use a separate versioned cache with a size budget (default ≤ 40 MB) that respects `navigator.storage.estimate()`. Show progress in Me → เกี่ยวกับ ("พร้อมใช้ออฟไลน์ 100%"), plus a "ดาวน์โหลดสำหรับออฟไลน์" button. Never pre-cache RepDB runtime data or images (keep them network-only, as their licence allows).
- Call `navigator.storage.persist()` after onboarding, and show its status.
- Offline banner (`navigator.onLine` plus a failed-fetch heuristic): "ออฟไลน์ — ข้อมูลจะซิงก์เมื่อกลับมาออนไลน์". Sync queue: local edits keep their per-key timestamps and sync automatically on `online` / `visibilitychange` (reuse round 18 sync). Show "รอซิงก์ N รายการ".
- Network-first for navigations with a 3-second timeout and cache fallback; offline fallback page for uncached routes.
- Tests (happy-dom + SW unit tests): with fetch mocked to fail after the first load, every core route renders and logging works. The pre-cache honours the budget and excludes RepDB. The queue flushes when back online. The banner shows and hides.

## 2. Reminders without internet, using the device clock and calendar
One shared reminder source (`app/js/reminders.js`, reusing whatever the push scheduler already computes: meals, supplements, workouts, water every 2 h, bedtime −30 min, IF window start/end, the custom daily menu, and quiet hours). Times are in the **device's local time and time zone** (`Intl.DateTimeFormat().resolvedOptions().timeZone`). Recompute when the plan, settings or time zone change.

### 2a. Calendar reminders (works offline on every phone, free)
- In Settings → การแจ้งเตือน, add a card "เตือนผ่านปฏิทินของเครื่อง (ใช้ได้แม้ไม่มีเน็ต)". It is **not** premium-gated; remove `canExport()` for reminders, while the PDF stays as is.
- **Option A, subscribe (recommended for account users):** `webcal://api.fixmee.app/api/cal/<token>.ics`.
  - The token is random, at least 128 bits, revocable and rotatable. The server stores only its hash and generates the feed from the device's reminder list (as already stored for push).
  - The calendar app refreshes it while online, and the alarms then fire offline.
  - No personal data beyond the reminder titles. Set `Cache-Control` and `X-PUBLISHED-TTL:PT6H`, and rate-limit requests.
- **Option B, one-time download (no account, fully offline):** an `.ics` file for the next 14 or 30 days (user picks).
  - Stable recurring events use `RRULE` (water, bedtime, daily supplements); changing ones (meals, workouts, IF, custom menu) are single events.
  - Each event has a VALARM `TRIGGER:PT0M` (at the time itself), plus an optional earlier alert (5/10/15 minutes).
  - Give every event a stable `UID` plus a `SEQUENCE`, and include `X-WR-CALNAME:Fixmee` and a `VTIMEZONE`/`TZID`.
  - Show a re-download reminder 3 days before the range ends.
- Category toggles, quiet hours respected, and titles in the user's language (5 languages).
- Step-by-step guides with screenshots-style illustrations:
  - iPhone: tap the file → "เพิ่มทั้งหมด"; or Settings → Calendar → Accounts → Add subscribed calendar.
  - Android / Google Calendar: open the file, or add the calendar by URL.
  - How to remove the calendar.

### 2b. In-app reminders while the app is open (offline)
- While the app is open or in the foreground, local timers show due reminders via `registration.showNotification` when permitted, otherwise as an in-app toast/sheet with "ทำแล้ว / เลื่อน 10 นาที".
- On every app open, show a "ที่พลาดไป" list of reminders due since the last open (max 24 h), with quick "ทำแล้ว".
- Never double-notify when server push already delivered the same reminder: share a reminder ID, and record delivered IDs locally from the push payload tag.

### 2c. Native app (Capacitor, `mobile/`)
- Add `@capacitor/local-notifications`. When running natively (`Capacitor.isNativePlatform()`), schedule the next reminders on the device: a rolling window that respects the iOS 64-pending limit, re-planned on app open and whenever the plan changes.
- Ask for permission, handle the tap → route, actions "ทำแล้ว" / "เลื่อน", and quiet hours.
- In that case, server push and calendar reminders are optional; the UI shows "เตือนจากเครื่องโดยตรง (ออฟไลน์ได้)".
- Document the build steps in Thai in `docs/LAUNCH_CHECKLIST.md`: `npm run sync`, open Xcode/Android Studio, signing, and what the owner must do in an Apple Developer account. No App Store submission is needed now.

### 2d. Push self-test UX
- Raise the self-test cap to 5 per hour.
- Return `retryAfter` (seconds) and show in Thai/English: "ทดสอบได้อีกครั้งในอีก N นาที".
- Map `TransportError: …` and the Apple reasons from round 18 to friendly text, and keep the raw reason in a "รายละเอียด" toggle.

### Tests
- Reminder times use the device time zone (fixtures for Asia/Bangkok, UTC and a DST zone) and recompute after a time-zone change.
- The ICS validates: CRLF line endings, 75-octet folding, escaping, VALARM at PT0M, RRULE, stable UIDs, TZID; it parses with a small RFC 5545 parser in the test.
- The webcal token is hashed in storage, revocable and rate-limited; the feed contains no email or user ID.
- The in-app missed list is correct and does not double-notify after a push.
- The Capacitor scheduler (mocked plugin) respects the 64 limit and re-plans on change.
- The self-test rate-limit message includes `retryAfter`.

## Done when
- All the above are implemented with tests, and all existing tests pass. The worker dry-run bundles, or report the block.
- `docs/ROUND20_VALIDATION.md` lists:
  - what works offline and what needs internet;
  - the reminder paths and which one fires in each situation (online / offline × web app / native app / calendar);
  - the cache sizes.
- Screenshots at 375 px in both themes go in `docs/round20-screens/`: the offline banner, the offline readiness indicator, the calendar reminder card and guide, the missed-reminders sheet, and the self-test retry message.
- Leave changes uncommitted; do not push or deploy.
