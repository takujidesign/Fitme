# Task: a reminder and notification system (Web Push + offline calendar + in-app + native)

This spec is self-contained. It describes a reminder system that has already been built and run in production in another PWA, including the bugs we found. Rebuild it to fit **this** repository's stack and conventions.

## 0. Before writing code
1. Read the repository and write down, at the top of `docs/REMINDERS_VALIDATION.md`:
   - the stack (front end, back end, database, hosting, cron capability);
   - where user settings live;
   - what "reminders" mean in this app. List every event type that should notify (for example appointments, tasks, medication, habits), and where each one's time comes from.
2. Fill in the placeholders below and use them consistently:
   - `{APP}`: the app name shown in notifications and the calendar name.
   - `{API}`: the API origin, for example `https://api.example.com`.
   - `{WEB}`: the web origin.
   - `{CATEGORIES}`: the reminder categories, used for the on/off toggles.
3. Rules:
   - Do not change existing storage keys, routes or API URLs.
   - Mock every third-party service in tests.
   - Do not commit, push or deploy.
   - Never put secrets in code or in the repository. VAPID keys are generated once by an admin endpoint or script and stored as secrets.

If the back end is not on Cloudflare Workers, keep the same behaviour and translate the platform pieces: KV becomes any key-value store or table, and the 5-minute cron becomes any scheduler.

## 1. Facts already learned (don't rediscover them)
- **An iPhone home-screen web app cannot schedule a local notification while closed.** Notification Triggers was abandoned, and a service worker is not woken by time. So the only things that fire on time are:
  - server **Web Push** (needs internet on both sides);
  - **calendar alarms** (the device clock, works offline);
  - **native local notifications** (Capacitor);
  - timers **while the app is open**.

  Build all four, sharing one reminder source.
- iOS Web Push only works after the user adds the PWA to the home screen (iOS 16.4+). The permission request must come from a user tap.
- **Cloudflare Workers `fetch` rejects `redirect:'error'`**: it throws, and that made every push fail with a transport error. Use `redirect:'manual'` for push endpoints. Add a test that fails if any server file contains `redirect:'error'`.
- Use push `TTL: 3600` for scheduled reminders, so a phone that is briefly offline still gets them, and `TTL: 60` for the self-test.
- The VAPID `sub` must be `mailto:<real contact>` or an `https://` URL. Apple rejects placeholder domains such as example.com (`BadJwtToken`). Show the subject in the admin UI.
- Apple / FCM answer `404`/`410` when a subscription is gone. Delete the device then. Any other non-2xx is an error: keep it as `lastError` for diagnostics.
- A **revoked or rotated calendar feed must return 200 with an empty calendar**, not 404. On a 404, iOS keeps the old events and keeps alarming.
- Android Chrome/FCM push works, but battery optimisation can delay it. Document this; don't try to fix it.

## 2. One shared reminder source (client)
Write a single module, for example `reminders.js`, with:
- `reminderPlan(startISO, prefs, days=7)`, which returns `[{id, date:'YYYY-MM-DD', time:'HH:MM', title, body, route, category}]`:
  - It uses **device local time and time zone**: `Intl.DateTimeFormat().resolvedOptions().timeZone`.
  - It applies the per-category toggles and **quiet hours** (`quietStart`/`quietEnd`, which can wrap midnight, e.g. 22:00–07:00).
  - Events after midnight belong to the next date.
  - Titles are at most 120 characters, bodies at most 500, in the user's language.
- `reminderID(r) = date:time:category:route:title`. This one stable ID is shared by push, calendar, in-app and native, so nothing double-notifies.
- Recompute and resync on any change to the plan or settings, on a time-zone change, and on app open.

## 3. Web Push (online, app closed)
### Server endpoints
- `POST /api/push/subscribe {deviceId?, subscription:{endpoint,keys:{p256dh,auth}}, tz, reminders[]}` returns `{deviceId}`.
  - Validate with a strict schema: at most 300 reminders; `time` matches `^([01]\d|2[0-3]):[0-5]\d$`; `date` is optional, `days` is an optional array of 0–6; `route` matches an **allowlist** regex.
  - Validate the time zone with `new Intl.DateTimeFormat('en',{timeZone:tz})`.
  - **Endpoint allowlist (SSRF guard):** https only, no port and no userinfo. Allowed hosts: `fcm.googleapis.com`, `web.push.apple.com`, `updates.push.services.mozilla.com` / `*.push.services.mozilla.com`, `*.notify.windows.com`.
  - Check that `p256dh` decodes to 65 bytes and `auth` to 16.
  - Store `device:<uuid>` = `{subscription, tz, reminders, lastSent, pending, lastError, registeredAt, expires: now+8 days}` with a matching TTL.
  - If the user is signed in, link `device_id → user_id`, and refuse to re-bind a device that belongs to another account (403).
- `POST /api/push/unsubscribe {deviceId}` deletes the device.
- `GET /api/push/reminders?deviceId=` (header `X-Push-Device` must equal the deviceId, compared in constant time) returns what the server has, for the "check" UI.
- `POST /api/push/test {deviceId}` is the self-test:
  - It is rate-limited to **5 per hour per device**. When limited, return `429 {error, retryAfter: seconds}`.
  - Use `TTL 60`. Wrap `fetch` in try/catch and record `TransportError: <message>` as `lastError`.
- Admin: generate VAPID keys (ECDSA P-256; store the public key raw as base64url and the private key as JWK `d`), plus a test send to one user or device.

### Encryption (WebCrypto only, no Node libraries)
- Use RFC 8291 `aes128gcm` single record and RFC 8292 VAPID (ES256 JWT, `aud` = endpoint origin, `exp` = now + 1 h).
- Headers: `Authorization: vapid t=<jwt>, k=<pubkey b64url>`, `Content-Encoding: aes128gcm`, `TTL`, `Urgency: normal`.
- The payload is at most 3993 bytes: `{title, body, route, tag: reminder.id, reminder}`.
- Add a unit test with fixed salt and key pair, and check it against a decrypt helper.

### Scheduler (cron every 5 minutes)
- Go through every `device:*` record, paging with a cursor.
- For each minute in the last 5-minute window, format the instant in the **record's tz** (`formatToParts`, `hourCycle:'h23'`), so midnight and DST transitions are handled.
- A reminder is due when `time` matches, `date` (if any) matches, and `days` (if any) includes the weekday.
- Dedup key = `date:time:category:route:title`. Skip it if it is already in `lastSent`.
- Due items go into `pending`, and are retried each window for up to 1 hour, then dropped.
  - On success, set `lastSent[key]` and clear `lastError`.
  - On `404`/`410`, delete the device.
  - On other errors, record `{status, reason (≤300 chars), at}`.
- Prune `lastSent` older than 24 hours.
- Wrap each device in try/catch, so one bad device never stops the loop.
- When a registration is 6+ days old, send one "open the app to refresh reminders" push. The record expires at 8 days, so devices that are never opened stop.

### Service worker
- On `push`: parse JSON and validate `route` against the same allowlist (fallback route otherwise).
  - **Dedup:** if a delivery-cache entry for `tag` exists, do nothing. Otherwise call `showNotification(title, {body, icon, badge, tag, data:{route, reminder}, actions:[done, snooze]})`.
  - Then store the tag in the delivery cache and `postMessage({type:'REMINDER_DELIVERED', id})` to open clients.
- On `notificationclick`:
  - `done` just closes the notification.
  - `snooze` stores `{reminder, at: now+10 min}` in the cache, so the app reschedules it.
  - Otherwise, focus or navigate an existing client to the route, or open a new window.

### Client UI (Settings → Notifications)
- Show a step-by-step state:
  - unsupported;
  - "add to home screen first" on iOS when not standalone;
  - permission denied, with how to re-enable;
  - enabled.
- Buttons: enable/disable, "check with server" (shows tz, reminder count, last error), and the self-test.
- Map errors to friendly text, and keep the raw reason behind a "details" toggle:
  - `TransportError` → "Could not reach the push service. Try again."
  - `BadJwtToken` → "Invalid VAPID signature; ask the admin to check keys."
  - `ExpiredProviderToken` → "Check the server clock."
  - `retryAfter` → "Try again in N minutes."

## 4. Calendar reminders (offline, free, every phone)
A card titled "Reminders through your phone's calendar (works without internet)". It is not paywalled, and has category toggles plus an optional earlier alert (5, 10 or 15 minutes).

### ICS builder (shared by client and server; RFC 5545)
- Use CRLF line endings, and **fold lines at 75 octets** counting UTF-8 bytes (a continuation line starts with a space).
- Escape `\ ; , newline`.
- Include `X-WR-CALNAME:{APP}`, plus a `VTIMEZONE` for the tz, generated from `Intl` offsets: scan the days from year−1 to year+2 and binary-search each offset change to the minute.
- Events use `DTSTART;TZID=<tz>`.
- Each event carries a stable `UID` (a hash of the reminder ID plus `@{WEB host}`), a `SEQUENCE` and `DTSTAMP`.
- `VALARM ACTION:DISPLAY TRIGGER:PT0M` fires at the time itself; if the earlier alert is set, add a second VALARM `-PT<n>M`.
- Use a recurring `RRULE:FREQ=DAILY;COUNT=n` for stable daily items (same title and time every day); everything else becomes single events.
- Never include emails, user IDs or reminder bodies, only titles.

### Option A: subscribe (account users)
- `POST /api/cal {tz, reminders[≤1500], rotate?}` (authenticated, rate-limited) stores the reminders.
  - Create a token: random 32 bytes as 64 hex characters. Store **only its SHA-256 hash**.
  - On creation or `rotate`, return `{url:'webcal://{API host}/api/cal/<token>.ics'}`.
  - On later updates, bump `sequence` and keep the token.
- `DELETE /api/cal` revokes the feed (deletes the row).
- `GET /api/cal/<64-hex>.ics`:
  - Rate-limit by IP.
  - A malformed token returns 404.
  - **An unknown (revoked or rotated) token returns 200 with an empty calendar.**
  - Headers: `Content-Type: text/calendar; charset=utf-8`, `Cache-Control: private, max-age=300`, `X-PUBLISHED-TTL: PT6H`, `Referrer-Policy: no-referrer`.
- Resync the feed whenever the plan changes. The UI offers "copy link", "open in calendar", "new link" (rotate) and "revoke".

### Option B: one-time download (no account, fully offline)
- Download a `.ics` file for the next 14 or 30 days.
- Remember the range end, and show "download again" 3 days before it.

### Guides
Short illustrated steps for:
- iPhone: tap the file → Add All, preferably into a new calendar named `{APP}` so it is easy to delete; or Settings → Calendar → Accounts → Add Subscribed Calendar.
- Android / Google Calendar: import the file, or add the calendar by URL.
- **How to remove each kind:**
  - Revoking empties a subscription on its next refresh. To remove it at once: Settings → Calendar → Accounts → Delete Account.
  - Downloaded events are removed by deleting the `{APP}` calendar.

## 5. In-app reminders (app open, offline)
- While the app is in the foreground, keep timers for the next due reminders. When one fires:
  - with permission, ask the SW to show it (`postMessage({type:'LOCAL_REMINDER', payload})`, so it goes through the same dedup);
  - otherwise, show an in-app sheet with "Done" and "Snooze 10 min".
- On open, show a "Missed" list of reminders due since the last open (at most 24 hours), excluding any ID already delivered by push.
- Delivered IDs are stored locally and pruned after 2 days.
- Snoozes inside quiet hours are dropped.

## 6. Native app (Capacitor, only if this repo has or wants a native shell)
- `@capacitor/local-notifications`, used when `Capacitor.isNativePlatform()`.
- Keep a rolling window: cancel the pending notifications, then schedule the next **≤64** (the iOS pending limit), sorted by time, skipping quiet hours, with `allowWhileIdle:true`.
- Register the action type with `done` / `snooze`, and handle a tap by going to the route.
- Re-plan on app open, on plan or setting changes, and after a snooze. Serialise re-plans through a promise chain.
- When native is active, the UI says "Reminders come straight from the device (work offline)", and push and calendar become optional.
- Document the Xcode / Android Studio build and signing steps. No store submission now.

## 7. Additional requirements
### 7a. Server-triggered notifications
Some notifications come from events, not from the user's own schedule: someone books or changes an appointment, a new message arrives, an order status changes, a staff member assigns a task.
- Add a server function `notifyUser(env, userId, {title, body, route, category, id})`:
  - It sends to **every** active device of that user. A user→devices index (a table) maps the user to their devices.
  - The `id` is stable (for example `event:<type>:<entityId>:<version>`), so retries never double-notify.
  - Send it in the background (`ctx.waitUntil` or a queue). A push failure must never fail the action that triggered it.
- Server-owned schedules: when reminders depend on server data shared between users (for example appointments set by staff), the **server** computes them from the database.
  - Store them in a table with `fire_at_utc`.
  - Recompute them when the source row changes.
  - The scheduler sends them as well as the client-supplied ones.
  - The calendar feed includes them too.
- Respect each user's category toggles and quiet hours **on the server** for these. Sync the preferences to the server.

### 7b. Subscription renewal
- In the SW, on `pushsubscriptionchange`, subscribe again with the same `applicationServerKey` and post the new subscription to `/api/push/subscribe` with the existing `deviceId`. The deviceId is kept in IndexedDB so the SW can read it.
- On every app open while push is enabled, call `pushManager.getSubscription()`:
  - If it is null, or its endpoint differs from the one last sent, re-subscribe and re-register.
  - If permission went from granted to denied, mark push as off in the UI and unregister on the server.
- The re-register on open also refreshes the 8-day server expiry.

### 7c. Lock-screen privacy
- Add a setting "Hide details on the lock screen":
  - When on, every push, local, native and calendar notification shows only "`{APP}`: you have a reminder", with no body.
  - The details appear only after the app opens.
  - Default it to **on** for sensitive categories (health, medication, money), if the app has them.
- Calendar titles follow the same setting.
- The server never logs payload contents.

### 7d. Logout, account deletion and consent
- **Logout:**
  - Unsubscribe this device, on the server and with `subscription.unsubscribe()`.
  - Cancel native pending notifications.
  - Clear in-app timers and the local reminder state.
- **Account deletion:** delete every push device, the calendar feed (so the link serves an empty calendar), server-owned schedules and delivery logs for that user.
- Before asking for notification permission, show a short consent explanation listing what is sent, which services are used (Apple / Google / Mozilla push services) and how to turn it off. Add the same to the privacy policy text, in every language the app supports.
- Unlinked devices with no activity for 8 days expire automatically (already covered by the TTL).

### 7e. Scale and cost
- Don't scan every device on each cron run. Keep a `push_schedule(device_id, fire_at_utc, reminder_id)` table, indexed on `fire_at_utc`.
  - Rebuild a device's rows whenever that device registers.
  - Each run selects only `fire_at_utc <= now AND > now-1h`, plus the pending retries.
- Device records stay in KV or a table; pick whichever this stack prefers and explain why in the validation doc.
- **Cache the VAPID JWT** per push-service origin for about 50 minutes (it is valid for 1 hour).
- Send concurrently with a small limit, for example 6, and stop starting new sends near the platform's CPU and time limit. Unsent items stay pending for the next run.
- Write down the expected cost per 1k, 10k and 100k devices for this host.

### 7f. Cross-device "done"
- When a reminder is marked done or snoozed on one device (from the notification action or in the app), post `{id, action, at}` to `/api/push/ack` (authenticated, or via the device header).
- The server records the ack. Then:
  - it skips any not-yet-sent copies on the user's other devices;
  - it sends a silent clean-up message to those devices. Use a push with `{type:'dismiss', id}`; the SW finds notifications with that `tag` with `getNotifications({tag})` and closes them. On iOS, where every push must show a notification, skip the clean-up push and rely on the dedup instead.
- The app's missed list hides acked IDs.

### 7g. Fallback channels (optional, behind config)
- **Email fallback:** for users with an account but no active push device, send a daily digest, or the event notifications from 7a, by email through the app's existing email provider (mocked in tests).
  - The user opts in.
  - Every email has an unsubscribe link with a signed token.
- **LINE Messaging API:** LINE Notify was shut down in 2025, so use a LINE Official Account.
  - The user links their account through the official LINE Login / account-link flow.
  - Store only the LINE userId.
  - Send push messages for the opted-in categories, and respect the monthly free message quota (show the usage in admin).
  - Keep it disabled unless the channel secret and token are set. The owner sets them; never put them in the repo.

### 7h. Admin dashboard (admin-only, aggregates only)
- Panels:
  - active push devices, by push service and platform;
  - calendar feeds in use;
  - native installs, if any;
  - sends per day, success rate, and errors grouped by status and reason;
  - the 404/410 clean-ups.
- A table of recent failures shows the device ID shortened, the service, status, reason and time. It never shows payloads.
- Admin actions: generate or rotate VAPID keys (warning that this invalidates every subscription), test-send to a user or device, and show the VAPID subject.

### 7i. App badge
- Where `navigator.setAppBadge` exists (the installed PWA on iOS 16.4+, Chromium), set the badge to the number of due-but-not-done reminders today.
- The SW updates it on push; the app updates it on open, on done and on snooze.
- `clearAppBadge()` when the number is zero.
- The native app uses the platform badge API of the notifications plugin.

### 7j. Real-device test checklist
Add `docs/REMINDERS_DEVICE_TESTS.md`, a checklist the owner can run in about 30 minutes, with the expected result for each step:
- iPhone, Safari tab: shows "add to home screen first".
- iPhone home-screen PWA: enable → self-test → scheduled reminder with the app closed → Done/Snooze actions → tap opens the right screen.
- Android Chrome, both installed and in the browser, including a battery-saver note.
- Desktop Chrome, Firefox and Safari.
- Airplane mode: a calendar alarm still fires; the missed list appears on the next open.
- Change the phone's time zone: the reminders follow it after the app opens; the calendar subscription updates after a refresh.
- Revoke the calendar link: the events disappear after the calendar refreshes.
- Logout: no further notifications on that device.
- Two devices: Done on one clears or skips the other.
- Lock-screen privacy on: no details shown.

## 8. Tests (unit, plus happy-dom for the UI; mock all network calls)
- Reminder times use the device zone. Use fixtures for Asia/Bangkok, UTC and a DST zone (America/New_York, across the March change), and check the plan recomputes after a tz change.
- Quiet hours that wrap midnight; category toggles.
- Scheduler:
  - fires once in the window and dedups with `lastSent`;
  - keeps a reminder pending and retries it on a transport error;
  - deletes the device on 404 and 410;
  - one throwing device doesn't block the others;
  - sends the refresh push at 6 days.
- `redirect:'error'` is absent from all server code; the endpoint allowlist rejects other hosts, ports and userinfo.
- Encryption round-trips with a fixed key pair, and the VAPID JWT has the correct `aud`, `exp` and `sub`.
- Self-test: the limit returns `retryAfter`, and a transport error shows the friendly text.
- ICS:
  - parse it with a small RFC 5545 parser in the test;
  - CRLF, 75-octet folding (including Thai/emoji), escaping;
  - VALARM PT0M plus the optional earlier alert, RRULE, stable UIDs, TZID/VTIMEZONE.
- Calendar feed:
  - only the token hash is stored;
  - rotate gives a new URL and the old one serves 200 with no `BEGIN:VEVENT`;
  - revoke behaves the same; a malformed token returns 404;
  - rate limit applies;
  - no email or user ID appears in the output.
- SW: dedup by tag, the `done`/`snooze` actions, and the route allowlist.
- Missed list: correct window, and no double notification after a push.
- Capacitor (mocked plugin): respects 64, re-plans on change, permission denied → no schedule.
- `notifyUser`:
  - reaches every device of the user;
  - the same `id` twice sends once;
  - a push failure doesn't fail the triggering request;
  - server-side quiet hours and toggles are applied;
  - server-owned schedules recompute when the source row changes.
- Renewal:
  - `pushsubscriptionchange` re-registers with the same deviceId;
  - a changed or null endpoint on open re-subscribes;
  - denied permission unregisters.
- Privacy mode: payloads, local and native notifications and the ICS titles carry no details.
- Logout and account deletion remove the devices, feed, schedules and pending native notifications. The deleted feed's URL serves an empty calendar.
- Scale:
  - the scheduler only reads due rows;
  - the JWT cache is reused within 50 minutes;
  - the concurrency limit holds;
  - unsent items stay pending.
- Ack: Done on device A skips the not-yet-sent copy on device B; a dismiss push closes the notification by tag.
- Fallback channels:
  - email goes only to opted-in users with no active push, and the unsubscribe token works;
  - LINE is disabled without config, sends to linked users only, and respects the quota.
- Admin endpoints are admin-only and return aggregates with no payloads.
- Badge: the count updates on push, done and open, and clears at zero; it is skipped when unsupported.

## Done when
- Everything above is implemented to fit this repo, and every existing and new test passes. The server build or dry-run bundles, or you report the block.
- `docs/REMINDERS_VALIDATION.md` lists:
  - the stack decisions from step 0;
  - a matrix showing which path fires in each situation (online / offline × app open / closed × iPhone PWA / Android / desktop / native / calendar);
  - the secrets and config the owner must set (VAPID keys, contact for the VAPID subject, cron, email provider, LINE channel);
  - the cost estimate from 7e;
  - known limits (iOS needs home-screen install; Android battery optimisation; calendar refresh can take hours).
- `docs/REMINDERS_DEVICE_TESTS.md` exists (7j).
- Screenshots at 375 px in light and dark: the notification settings states, the consent explanation, the privacy toggle, the self-test retry message, the calendar card and guide, the missed-reminders sheet and the admin panel.
- Leave changes uncommitted; do not push or deploy.
