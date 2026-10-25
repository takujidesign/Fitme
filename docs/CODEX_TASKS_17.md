# Round 17 — health data import (3 ways) + reminder/notification audit

Same rules as earlier CODEX_TASKS files. Worker: keep name/bindings/API URL; migration `worker/migrations/0010_round17.sql`. Mock every third-party service in tests; do not call real APIs. Deploys go through GitHub workflows — do not push or deploy.

## A. Health data — common model
- D1 `health_daily(user_id, date, source, steps, distance_m, active_kcal, resting_hr, avg_hr, max_hr, sleep_min, weight_kg, updated, PRIMARY KEY(user_id,date,source))`. Values validated with zod and clamped to sane ranges (steps 0–100 000, HR 25–230, sleep 0–1 440 min, weight 25–300 kg …).
- Merge rule per day: prefer the source with the most complete data; never double-count steps from two sources (take the max, not the sum); show which source was used.
- App: new "ข้อมูลสุขภาพ" screen (Me → สุขภาพ and Today card): today's steps ring, 7/30-day charts, resting HR and sleep trends, sources list with last sync time, "ลบข้อมูลทั้งหมดจากแหล่งนี้".
- Use the data: active calories adjust the day's calorie target (cap +30 % of TDEE, never below BMR, clearly labelled), readiness score uses resting HR and sleep, step challenges/duels and the weekly recap use steps.
- Account required; synced like other state; included in data export and deleted with the account. Consent: a specific health-import consent the first time (PDPA sensitive data), revocable. Privacy text updated (draft banner stays).

## B. Method 1 — iPhone Shortcuts (Apple Health)
- `POST /api/health/ingest` authenticated with a per-user **ingest token** (separate from the session token; 32 random bytes, only its hash stored; scope = write health only; rotate/revoke in the app). Body: `{ date: "YYYY-MM-DD", tz, steps?, distance_m?, active_kcal?, resting_hr?, avg_hr?, max_hr?, sleep_min?, weight_kg? }`, or `{ days: [...] }` for up to 30 days. Rate limit 60/hour per token. Source `apple_shortcut`.
- In-app setup guide (Thai/English, step-by-step with drawn mock screens, no Apple screenshots): copy the ingest URL + token, then build a Shortcut: Find Health Samples (Steps, Today, Sum) → … → Get Contents of URL (POST, JSON, header `Authorization: Bearer <ingest token>`); then Automation → Time of Day (e.g. 21:00, daily, "Run Immediately"). Include a "ทดสอบการส่ง" view in the app that shows the last received payload time.
- Admin setting `healthShortcutUrl` (an iCloud shortcut link the owner can create once and paste); when set, show "เพิ่มคำสั่งลัด" one-tap button; the guide still explains pasting the token.
- Tests: token auth (valid, revoked, wrong scope, session token rejected), validation/clamping, batch, idempotent re-send, rate limit.

## C. Method 2 — connect a wearable account (OAuth2)
Providers (each behind its own admin toggle and **beta-mode gated**, off for users by default; admin preview can test): **Fitbit** (Web API, PKCE, scopes activity heartrate sleep weight), **Polar AccessLink**, **Withings**, **Strava** (activities → active kcal/HR), **Oura** (v2).
- Admin page → ระบบ/การเชื่อมต่อ: per-provider client ID/secret (secrets encrypted like other keys), redirect URL shown to copy (`https://api.fixmee.app/api/health/oauth/<provider>/callback`).
- Flow: state + PKCE stored server-side (10 min), tokens encrypted at rest, refresh before expiry, revoke on disconnect, handle 401/429 with backoff.
- Sync: daily cron (existing 20:00 UTC slot or a new one) for the last 3 days + "ซิงก์ตอนนี้" button (rate-limited). Map each provider's daily summary to the common model.
- Tests with mocked provider responses for each: auth URL params, callback state/PKCE check, token refresh, mapping, disconnect revokes, beta gate.

## D. Method 3 — Apple Health export import
- User exports from the Health app (profile → Export All Health Data → share `export.zip`) and picks the file in Fixmee.
- Parse **entirely in the browser** in a Web Worker: stream-unzip (`fflate`, MIT, vendored) and stream-scan `export.xml` (can be hundreds of MB) for `HKQuantityTypeIdentifierStepCount`, `DistanceWalkingRunning`, `ActiveEnergyBurned`, `RestingHeartRate`, `HeartRate`, `BodyMass`, and `HKCategoryTypeIdentifierSleepAnalysis`; aggregate per local day; let the user choose the date range (default last 90 days); show progress and allow cancel. Never upload the raw file — only the daily aggregates go to `POST /api/health/days` (session auth, ≤ 400 days per request). Source `apple_export`.
- Tests: worker parser on synthetic XML fixtures (multiple sources per day → no double counting, time zones, sleep stages summed as asleep only), large-file streaming without loading all into memory (chunked fixture), cancel.

## E. Reminder / notification audit (owner asks: do phone notifications really work?)
Claude checked production on 2026-10-25: **0 devices are subscribed** in the PUSH KV, so no reminder has ever been delivered. VAPID keys exist since 2026-10-23. Audit and fix the whole path:
1. **Subscribe flow**: find why no device is stored (e.g. the owner enabled reminders before VAPID keys existed and the app never retried, or a silent error). On every app open, if the user has reminders enabled and permission is granted, ensure a valid subscription exists for the current VAPID public key (re-subscribe if the key changed or the subscription is missing) and re-register it with the server. Show the real state in Settings → การแจ้งเตือน (not supported / needs home-screen install on iOS / permission denied / server not ready / active with device registered at <time>).
2. **Reminder content**: verify the reminder list the app sends covers each category the timeline shows — wake, water, meals (each meal at its planned time, respecting IF windows), workout (planned time on training days only, not on rest/override days), supplements (each dose time), sleep wind-down/bedtime — with per-category toggles and quiet hours. The list must be rebuilt and re-sent (debounced) whenever the plan, profile times, fasting window, supplements or day overrides change.
3. **Server delivery**: `sendScheduled` (5-minute cron) must fire each reminder once at the user's local time (stored tz) within its 5-minute window, dedupe via `lastSent`, handle 404/410 by deleting the device, and retry transient errors next tick. Device records expire after 8 days — make the app refresh the record (and the next 7 days of date-specific reminders) on every open, and send a "เปิดแอปเพื่ออัปเดตการแจ้งเตือน" push on day 6 if the app hasn't been opened.
4. **Service worker**: `push` handler shows title/body/icon/badge with a tag per category, `notificationclick` focuses/opens the right route (e.g. `#/today`, `#/player/<date>`, `#/supps`).
5. **Visibility**: new "การแจ้งเตือนที่ตั้งไว้" list in Settings showing exactly the reminders the server holds for this device (new `GET /api/push/reminders?deviceId=` authenticated by the device's own subscription id/secret), plus the existing "ส่งทดสอบถึงตัวเอง".
6. **Tests**: fake-clock worker tests across a full day in Asia/Bangkok and one DST zone for every category; app tests that reminders are rebuilt on each kind of change; SW handler tests; re-subscribe when the VAPID key changes or the subscription is missing.
7. Write `docs/NOTIFICATIONS.md`: how it works end to end and a phone test checklist (Android Chrome, iPhone home-screen app iOS 16.4+), including how the owner can confirm a device is registered (the new list + the `push-diagnostics` GitHub workflow).

## Done when
- A–E implemented with the tests above; all existing tests pass; worker dry-run bundles (or report the sandbox block).
- Screenshots (375 px, both themes) of the health screen, Shortcut guide, provider connect list, Apple export import progress, and notification settings with the reminder list → `docs/round17-screens/`.
- Leave changes uncommitted; do not push or deploy.
