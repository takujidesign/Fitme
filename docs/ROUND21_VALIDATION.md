# Round 21 validation

Implemented on `codex/round21`; changes remain uncommitted. No push or deployment was performed. The five pre-existing Round 12 artifact edits were preserved.

## Verification status

- Executed every executable top-level `tests/*.mjs` suite individually, plus `worker/test.mjs`, all `worker/round*.test.mjs`, `auth-errors.test.mjs`, and `push-redirect.test.mjs`. Node does not execute multiple script arguments as independent suites, so wildcard commands were expanded by the runner.
- 51 non-browser suites pass. Includes new `tests/round21.mjs` and `worker/round21.test.mjs`, real Worker routing against SQLite, existing crypto tests, DOM fixtures, SW event execution, mocked native scheduling and IDB renewal. See `round21-results/final-unit-tests.json` for the full non-browser run; `round21-results/final-focused-tests.json` records the passing final renewal/ack/calendar follow-up checks.
- 13 browser suites are blocked, not passed: ten encounter subprocess `EPERM` (Chromium launch or the Round 15 preliminary git subprocess); three older runners require the unavailable `playwright` package. Full individual results are in `round21-results/all-tests.json`.
- `npx wrangler deploy --dry-run`, from `worker/`, fails before bundling: `Error: spawn EPERM` in Wrangler's launcher. Bundle validation remains outstanding.
- `npx wrangler d1 migrations apply fixme --local`, from `worker/`, fails at the same launcher. Migration `0013_round21.sql` applies successfully in the cumulative SQLite test fixture, but Wrangler local-D1 application remains unverified. No remote migration was attempted.
- Browser screenshots are **not complete**. `tests/round21-browser.mjs` is ready to capture eight PNGs at 375 px (light/dark settings, privacy preview, missed list and diagnostics), but launching Chrome is blocked. `round21-screens/*.fixture.html` are eight labelled synthetic DOM fixtures, **not screenshots or visual QA evidence**.
- All network/provider delivery in tests is mocked. No live push, account, payment or production service was exercised. Utility servers and the i18n extraction generator were not treated as executable test suites.

Reproduce the suite with `python tests/support/run-round21.py`; use `--unit` for the 51 suites that do not need browser launch. The runner restores older tracked documentation artifacts after testing. Run `node tests/round21-browser.mjs` in an environment that permits Chromium to produce the missing PNGs.

## Routes

Shared `app/js/push-routes.js` exports `PUSH_ROUTE` and `safeRoute`. The classic SW has the exact same regex; a test compares both copies.

Allowed: `#/today`, `#/food`, `#/workout`, `#/supps`, `#/me`, `#/help` (moderation), `#/friends` (buddy), `#/friend-challenges`, `#/together`, `#/player/YYYY-MM-DD`, and `#/messages/<id>`. Chat IDs allow only `[A-Za-z0-9_-]{1,64}`. Invalid, external and `javascript:` routes fall back to today; subscribe rejects invalid reminder routes. Chat tap navigation is executed in SW tests.

## Preferences and delivery

The existing subscribe request accepts `prefs: {quietStart, quietEnd, chat, social, privacy, badge, lang}` plus the existing top-level `tz`. Preferences are validated and stored per KV device record. Defaults: chat/social/badge on; privacy `medications`; empty quiet times. State merging supplies the privacy default for existing installations.

`pushUser(..., {category})` checks the receiving device's category preference and timezone. Quiet hours may span midnight; equal start/end means no quiet interval. Deferred records contain `pending` and `notBefore` at the next local quiet end, including DST transitions. The five-minute cron rechecks preferences before sending. Chat accumulates one pending entry per conversation, with a count and generic body; no message text enters a push. Warnings and broadcasts use the social category and also defer during quiet hours.

Chat uses the persisted message UUID for dedup and `chat-<conversation>` for replacement. `{userId,id}` dedup TTL is ten minutes. Due reminder IDs hash date/time/category/route/event key, independently of UI language or privacy level; simultaneous medications remain distinct. Delivery retries expire one hour after the eligible quiet end, rather than one hour after the original message. HTTP chat/moderation/broadcast handlers register push work with `ctx.waitUntil`; the slow-provider test confirms the chat response completes before push resolves. Buddy nudges run in the existing background scheduled handler.

KV is eventually consistent; these checks are not an atomic exactly-once delivery guarantee across concurrent isolates. Real two-device propagation and provider replacement behavior still need device verification.

## Renewal

IndexedDB `fitme-push-v1` stores the device ID, public application server key, API base, timezone, last safe reminder list, preferences, endpoint and registration time. No account token is stored there. `pushsubscriptionchange` re-subscribes and registers using the same device capability. The linked-account ownership guard still rejects an authenticated different account; token-free device renewal is allowed without changing logout ownership checks.

On opening/resuming, a missing or changed endpoint triggers registration; an unchanged registration is throttled for 24 hours unless timezone/preferences change. Normal plan/settings changes still sync. Denied permission unregisters and switches the UI off with a permission explanation. Tests cover same-device SW renewal, null/changed endpoints, denied permission and the daily throttle.

## Privacy coverage

| Path | Protected content |
|---|---|
| Reminder plan / push subscribe | Medication title and dose become a localized generic title and empty body by default. IDs contain no medicine name. |
| Server push | Final privacy mapping uses receiver preferences, including previously stored reminder details. Legacy IDs containing details are hashed before delivery. |
| Service worker | Reapplies privacy before `showNotification`, including embedded reminder data. |
| Native scheduler | Protects title, body and `extra.reminder`; uses the notification badge option. |
| In-app due notice | Generic title/body; details are available in the app's missed list or today view. |
| Download and subscribed ICS | Protects summaries and alarm descriptions. Feed stores its privacy mode/language; existing legacy feeds default to medication protection. |

Modes are `medications` (default), `all`, and `off`. Generic titles are supplied in Thai, English, Chinese, Japanese and Vietnamese. `off` preserves original details. Download paths include both the notification settings download and the existing export action. Older Round 5b assertions were updated to require default calendar privacy and explicitly test opt-out details.

## Acknowledgements and badge

`POST /api/push/ack {id, action:'done'|'snooze', at}` authenticates either the account token or an active device capability; the server resolves device ownership from D1. Anonymous devices use a device-specific scope. Acknowledgements are stored as `ack:<owner>:<id>` for 48 hours, with server timestamps. Reads and writes share the existing D1-backed limit of 120 requests/minute per owner. `GET /api/push/ack?since=` returns recent items within that owner's scope.

Both the scheduler and `pushUser` check acknowledgements. SW Done/Snooze, native actions, missed-list controls and today checkmarks acknowledge. On open the app fetches recent acks, filters missed items, replans native reminders and closes matching notifications where `getNotifications` exists. Failed app acknowledgements remain queued locally for retry; SW actions persist a local cache receipt for the next open. There is no silent dismiss push. Already displayed notifications on another device are reconciled when that device opens.

Badge counts only today's due items that are neither checked done nor acknowledged. It updates on opening, local state changes, Done/Snooze, SW push and the existing 15-second runtime tick (which crosses midnight). Zero clears the badge; unsupported APIs are guarded; the preference can disable it.

## Diagnostics and cleanup

Migration `0013_round21.sql` creates an indexed D1 failure table. Scheduled, social and self-test delivery record only an eight-character device ID, push service hostname, status, bounded normalized reason and timestamp. Provider response bodies are deliberately excluded because they can echo private data. Entries older than 30 days are pruned on recording, cron and diagnostics reads.

The admin-only diagnostics endpoint returns the latest 50 failures plus service counts and 404/410 cleanup counts for the selected range, bounded to the 30-day retention. It does not scan device records. The existing Admin usage view displays the table. Tests cover admin authentication, cap, pruning, service totals and absence of payload/email fields. Existing account-deletion tests verify KV device cleanup; a calendar-feed cascade assertion was added. Logout unsubscribe is also covered without redesigning that flow.

## Remaining device evidence

Use `REMINDERS_DEVICE_TESTS.md` (Thai, approximately 30 minutes per representative platform round). Still required: real iPhone Safari/install gating and closed-PWA delivery, Android installed/browser and battery restrictions, desktop Chrome/Firefox/Safari, real endpoint rotation, native Capacitor actions/badge, lock-screen appearance, offline calendar alarms, timezone changes, quiet-end timing/coalescing, two-device propagation, revoked calendar refresh and logout.

`const VERSION = 'fitme-v1'`, existing storage keys, Worker name and configured API URL were preserved. New modules are in the shell cache; RepDB runtime data is not precached.
