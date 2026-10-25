# Round 17 validation

Date: 2026-10-25. Branch: `codex/round17`. Changes are uncommitted.

## Implemented scope

| Task | Implementation and evidence |
|---|---|
| A — shared health model | `0010_round17.sql` adds daily data, separate consent, hashed ingest tokens, atomic rate buckets, encrypted wearable connections and OAuth flows. Zod validates calendar dates/timezones/numeric metrics; sane ranges clamp values. Complete sources take precedence, steps use the maximum and field provenance is returned. Me and Today link to the health screen with a step ring, 7/30-day trends, source timestamps and source deletion. Active calories increase targets by at most 30% of TDEE with a BMR floor; readiness uses sleep and elevated resting HR against recent baseline. Canonical server health overlays feed existing step challenges, duels and weekly recap. Account export includes health; deletion/withdrawal removes health tables and cached imported health in synced state. Privacy retains the draft banner. |
| B — Shortcuts | Account-scoped, separately hashed 32-random-byte ingest credentials; rotation and revocation; write-only scope; single day or 30-day batch; idempotent upsert; 60/hour enforced in SQLite/D1. Thai/English drawn setup guide, copy URL/token, receipt timestamp and optional admin iCloud shortcut URL. Token is held only in page-module memory and is not persisted in backups or sync. |
| C — wearables | Fitbit, Polar, Withings, Strava and Oura each have admin settings, encrypted client secret, provider toggle and beta gate. Server-side state/PKCE expires after ten minutes and is consumed once. Callback and refresh tokens are encrypted. Adapters map provider summaries; Strava details supply activity calories/HR; Polar uses activity transactions and sleep reads. Daily 20:00 UTC cron and a four-per-hour manual sync request the recent three UTC dates. Refresh and bounded 401 retry, persisted 429/backoff, explicit disconnect/revocation. All provider behavior was exercised with mocks only. |
| D — Apple export | Local module Web Worker with vendored MIT fflate 0.8.2 from the existing installed three.js distribution. File stream feeds small compressed chunks to streaming unzip and an incremental XML scanner. Ignores non-export files, aggregates per source/local day, avoids summed steps across devices, converts units, unions asleep intervals, excludes awake/in-bed stages, and splits overnight sleep at local midnight using the sample offset. Default range is the last 90 days. Progress/cancel and explicit upload of daily aggregates only, in batches of at most 400. Raw ZIP/XML is never uploaded. |
| E — notifications | Missing/expired/changed-key subscription recovery; foreground and online refresh; category controls and quiet hours; seven-day plan and debounced rebuild; real stored-reminder GET with device-capability header; registration timestamp; local-time cron dedupe, transient retry queue, 404/410 cleanup and day-six refresh push. SW icon/badge/tag and safe click routes. `NOTIFICATIONS.md` documents the full path and phone checklists. |

Health and notification settings views load on demand to preserve the existing first-load JavaScript budget. New modules are in the service-worker shell; the exact `const VERSION = 'fitme-v1'` line is unchanged. New core UI labels include zh/ja/vi dictionaries; the detailed Shortcut instructions are Thai/English as requested.

## Tests and reproducible commands

All tests use mocked provider responses. The existing `tests/support/no-network.mjs` guard is preloaded to reject accidental external fetches.

```powershell
Get-ChildItem tests/*.mjs |
  Where-Object { $_.Name -notmatch 'browser|playwright|serve|extract-i18n' } |
  ForEach-Object { node --import ./tests/support/no-network.mjs $_.FullName }
Push-Location worker
node --import ../tests/support/no-network.mjs test.mjs
Get-ChildItem round*.test.mjs | ForEach-Object {
  node --import ../tests/support/no-network.mjs $_.Name
}
node --import ../tests/support/no-network.mjs auth-errors.test.mjs
Pop-Location
```

**Final result: 41/41 files passed (25 app, 16 worker), zero failures.** First-load static JavaScript: **356,418 bytes gzip**, below the unchanged 358,400-byte (350 KiB) budget. `git diff --check` passed.

Final per-file outcomes are in `round17-results/app-results.json` and `round17-results/worker-results.json`, with stdout/stderr logs alongside them. The aggregate `results.json` records the final total.

New tests cover:

- SQLite migrations and real route execution, account consent, rejected session/ingest credential interchange, wrong scope, hashes, rotation, revoke, clamping, invalid dates/timezones, batch limits, idempotence, 60/hour, account export and withdrawal cleanup.
- Each provider's auth URL, scopes, PKCE digest/verifier, callback state consumption/expiry, encrypted token storage, refresh, mapping, disconnect/revocation, beta/admin preview gates, 401 recovery and 429 backoff.
- A full fake-clock day in Bangkok and the New York DST fallback day, all reminder categories, dedupe, next-tick transient retry, invalid-device deletion, day-six prompt and protected server reminder reads.
- Chunked synthetic ZIP/XML, 100,000 incrementally fed records, cross-source step deduplication, local dates, unit conversion, HR aggregates, sleep stages/overlap/overnight split and cancellation.
- Missing and changed-VAPID subscriptions, plan categories, rest overrides, quiet hours, rebuild scheduling for profile/fasting/supplements/overrides/blocks/meal changes, bilingual health views and the actual service-worker event handlers.

Two existing test fixtures were updated: round 4's local SQLite database now loads migration 0010; round 14's muscle-recovery assertion supplies a fixed local afternoon time, avoiding its previous dependence on whether the test ran before noon. Product muscle-recovery behavior was not changed.

## Bundle and visual limits

`node node_modules/wrangler/bin/wrangler.js deploy --dry-run` was attempted from the worker directory using its local installation and telemetry disabled. The sandbox rejected Wrangler's child process with `spawn EPERM`. No remote operation occurred and no successful bundle is claimed.

`node tests/round17-browser.mjs` was attempted. The sandbox rejected Chromium launch with `browserType.launchPersistentContext: spawn EPERM`. Its temporary `.tmp/round17-browser-profile` was removed by the script's `finally` cleanup. Therefore the requested ten PNG screenshots and live 375px browser layout/console verification are **not completed** in this environment.

`round17-screens/` contains ten clearly labelled 375px **HTML DOM fixtures**, covering health, Shortcut guide, provider list, synthetic import progress and notification settings, both themes. These are not screenshots and do not establish visual fidelity. The browser runner is ready to capture the ten PNGs with mocked services on a machine that permits Chromium. `round17-screens/browser-block.txt` contains the launch evidence.

## Runtime boundaries and remaining checks

- No real wearable API, Apple Health account, iCloud shortcut, push service or phone was contacted. OAuth adapters and token/revoke flows require an owner-approved real-provider acceptance test before enabling them for users. Provider toggles default off; beta gates remain enforced server-side.
- No claim of on-phone notification delivery is made. Run the Android/iPhone checklist in `NOTIFICATIONS.md`; push-service acceptance is not proof of display.
- Cron deduplication uses existing eventually consistent PUSH KV, so concurrent cron executions are not an atomic exactly-once guarantee. Transient reminders retry for up to one hour.
- Parser day grouping follows offsets carried by exported samples; overnight sleep is split using the sample start offset. A sleep interval crossing an actual DST offset change should be reviewed against a real export before relying on that day's split.
- Apply migration 0010 through the existing authorized deployment workflow before releasing the worker. No remote migrations were applied here.

## Workspace constraints

No root-level `*.jpg` content was read, moved or published. No RepDB data or images were added or committed. No commits, pushes, deploys or remote migrations were performed. The pre-existing modified round-12 performance/2FA artifacts were backed up before tests and restored byte-for-byte afterward. All task-created browser profiles were removed. Existing worker name, bindings and API base URL remain unchanged.
