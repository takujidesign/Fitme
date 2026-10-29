# Round 20 validation — 2026-10-29

Implementation is present, with the validation limitations below. No commit, push, deployment, remote migration, paid API call, or App Store submission was performed. Repo-root JPGs were not read, moved, or published. RepDB data/images were not used or pre-cached.

## Offline behavior

After shell installation and the background download complete: today plan, workout/player and timers, food and supplement logs, daily menus, local/custom food search, measurements/progress, settings, theme/language and help work locally. Core routes and the mounted player were exercised in happy-dom with fetch failing. The existing local logging and menu suites also pass.

AI/provider requests, account sync, social/chat, payments, Open Food Facts and health OAuth require internet. API requests fail with a clear internet-required message offline. The banner uses browser connectivity and consecutive failed remote fetches; successful remote fetches or an online event clear it. Existing timestamp-based sync flushes on reconnect/visibility and retains edits made during requests. The pending count compares local key timestamps with the last acknowledged server timestamps.

Me → About shows download progress, actual downloaded body bytes, persistent-storage permission and pending sync keys. `navigator.storage.persist()` is requested after onboarding. A failed or storage-limited download remains incomplete and can be retried; 100% is never inferred from an attempted download. Storage eviction is still controlled by the browser.

Navigations are network-first with a three-second timeout. Cached navigations work offline; unknown uncached routes get the offline fallback page with a scope-correct link back to the app. RepDB adapter **code** remains shell-cacheable because existing app modules import it; restricted runtime data and images are network-only and excluded from the manifest.

## Reminder paths

| Environment | Online | Offline |
| --- | --- | --- |
| Web app open/foreground | Optional server push plus opted-in foreground reminders, deduplicated by reminder ID in the service worker | Opted-in foreground timer uses notifications when permitted, otherwise a sheet with Done / Snooze 10 minutes |
| Web app closed/background | Existing server push, if enabled and supported | No timed web notification; use imported/subscribed Calendar alarms |
| Native Capacitor app | Opted-in device notifications; server push/calendar optional | Device notifications already scheduled continue; replan on app open or plan change, at most 64 pending |
| Device Calendar | Subscription refreshes online, or manually import the file | Previously imported/refreshed event alarms use the device clock |

Shared `app/js/reminders.js` supplies meals/custom menus, supplements, workouts, water, sleep, fasting and medication/wake reminders, honoring category switches and quiet hours. Local scheduling follows the device timezone and rechecks it on foreground and periodic ticks. Push registration refreshes on foreground using the same source. The missed list covers at most 24 hours; delivered push IDs are read from a persistent worker ledger before local notification checks.

Calendar download is free and independent of PDF entitlement. Settings offers 14/30 days, at-time alarms and optional 5/10/15-minute extra alarms. Consecutive stable water/sleep/supplement events use RRULE; other events are individual occurrences. ICS has CRLF, UTF-8 75-octet folding, escaped text, stable hashed UIDs, sequence numbers and a VTIMEZONE with transitions for the export years. A reminder appears three days before the downloaded range ends. Guides cover iPhone, Android/Google Calendar and removal, with inline phone-style SVG illustrations. Google Calendar file import may require its desktop website.

Account calendar subscription uses an authenticated upload of the same computed reminders without bodies or account fields. A random 256-bit token is returned once; only its SHA-256 hash is stored in D1. Rotation and deletion invalidate previous server access. Feed contents contain titles and event scheduling metadata, no account ID/email. Feed access is rate limited and sets Cache-Control and a six-hour published TTL. The range is refreshed when the app is opened/changed online; if the app is never reopened, it does not invent future plans. Already-imported calendar events are not deleted by server token revocation.

Native integration adds `@capacitor/local-notifications` with permission handling, action routing, quiet hours and a rolling schedule. Actual iOS/Android behavior, signing and exact-alarm permission are **not device-verified**. Owner build steps are in `LAUNCH_CHECKLIST.md`.

Push self-test permits five attempts/hour/device, returns `retryAfter` seconds on 429, and displays rounded-up minutes. Transport/Apple errors have friendly copy and a raw-details disclosure.

## Cache sizes

| Cache | Body bytes | Policy |
| --- | ---: | --- |
| Shell | 1,872,553 at measurement; 187 URL entries | Existing `VERSION`, unchanged literal `fitme-v1`; includes code needed for offline startup |
| Background offline assets | 5,042,268 (4.81 MiB), 93 files | `${VERSION}-offline-r20`; 40 MiB maximum body budget, additionally limited to 80% of estimated remaining quota for new writes |
| Reminder delivery ledger | Small per-ID records, no images | Two-day records pruned when the app reads them |
| Existing fonts/3D/video runtime caches | Usage-dependent; not included in offline percentage | Existing cache names retained; video remains user-initiated |

Sizes exclude browser cache metadata and HTTP headers. Manifest regeneration is `node scripts/build-offline-manifest.mjs`; it only enumerates explicit app asset directories. Shell size may change slightly with subsequent copy edits. The first-load static JS check passed at 353,478 gzip bytes, below the existing 350 KiB (358,400-byte) budget; export and reminder-only UI load lazily.

## Automated evidence

- 27 app/core/DOM suites and 20 worker suites passed in the recorded regression run, with external network blocked and providers mocked. Exact commands/status are in `round20-results.json`.
- `node tests/round20.mjs`: offline core views/player/logging; quota/budget/restricted asset exclusions; banner; actual reconnect queue flush; Bangkok/UTC/New York fixtures; RFC5545 component parser/folding/alarms/recurrence/UIDs; missed and duplicate notifications; serialized push/foreground dedup; native plugin mock with 64 limit and replanning; five-language rendering; retry message.
- `node worker/round20.test.mjs`: all migrations including `0012_round20.sql` applied to local SQLite; authenticated calendar creation, hashed token storage, rotation/revocation, feed privacy/rate limiting; self-test five-attempt limit and retryAfter.
- Existing Round 13 self-test assertions were updated from three to five attempts. The Round 17 SW mock now supplies cache/message APIs required by the delivery ledger. The previous performance budget was retained, not raised.
- `tests/round14.mjs` was deliberately **not run**: it reads `app/data/repdb-names-th.json`, prohibited by this task. Therefore this report does not claim that every existing test ran.

## Blocked / not verified

- `node tests/round20-browser.mjs` could not launch Chrome: `spawn EPERM`. The alternative hidden Chrome launch was rejected by automatic policy review as blocked by policy. No real PNG screenshots or browser offline-reload/layout evidence were produced. `docs/round20-screens/` contains the runner failure and 12 clearly labeled 375px light/dark **HTML DOM fixtures**, not screenshots. The browser runner is ready for a permitted environment.
- Worker `wrangler deploy --dry-run` failed before bundling because its child process could not spawn (`EPERM`). Worker unit tests import the implementation successfully; this is not a successful Wrangler bundle. No remote D1/production call was made.
- Native platforms are not generated in this repository and Xcode/signing/device testing were not available here. Calendar import/refresh/alarm behavior on actual phones remains to be checked.
- Old generated Round 12/17/18 fixtures were already dirty at task start. Regression runners regenerate them. Their pre-full-suite snapshots were restored; an initial Round 18 test had already regenerated its fixtures before that snapshot. They are not evidence of new browser verification.

All changes are left uncommitted. Completion still requires the blocked browser screenshots, permitted dry-run bundle and actual-device checks; these have not been represented as passing.
