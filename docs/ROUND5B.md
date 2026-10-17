# Round 5b: sections 10–18

Implementation is limited to CODEX_TASKS_5 sections 10–18 and the requested wall/chair props. Sections 19–28 are not implemented here.

## Configuration

- Apply `worker/migrations/0003_round5b.sql` after the existing migrations when deploying. This change does not apply migrations to a remote database.
- LINE: Admin → LINE sets the channel ID, HTTPS app return URL, and per-user daily cap. The app origin must be in `ALLOWED_ORIGINS`. Set `lineChannelSecret` and `lineMessagingToken` in Admin → API keys (existing encrypted storage). Register `https://<worker-host>/api/auth/line/callback` with LINE. Login and Messaging channels must use the same LINE provider; users must add the OA as a friend.
- LINE reservations count toward the cap even if delivery fails or the network result is ambiguous. This prevents cron retries from spending beyond the cap. No LINE Notify integration is used.
- Shop: Admin → Shop maintains products, approved exact HTTPS hostnames, and click totals. Affiliate redirects recheck the allowlist. There is no physical-goods checkout.

## App entry points

- Account: LINE login/linking and per-type LINE reminder choices. The browser proves possession of a separate verifier before receiving a session or completing an account link.
- Food logging: barcode scanner, typed barcode fallback, Open Food Facts lookup, editable nutrition, local lookup cache, synced custom foods, and local food logs.
- Me: groups/challenges, shop, offline video storage, medical conditions, medications, and five-language picker. Group screens share only requested daily metrics and public nicknames.
- Today/Workout: daily readiness and immediate recovery; check-ins also inform the four-week replan. Existing exclusions and women's-health constraints still apply.
- Medications: user-entered prescribed times remain fixed. Supplement times move to respect known separation rules, including midnight boundaries. No feasible slot means that supplement dose is not scheduled; interaction warnings remain visible. The rule list is limited and includes source links in `app/js/interactions.js`.
- Kidney mode caps the protein target, scales planned food to the remaining protein budget, and withholds automatic protein/creatine supplementation pending clinician advice. Heart mode requires medical clearance and removes HIIT. These are wellness constraints, not treatment.
- Offline video downloads accept only app R2 media URLs. Video and font/library caches survive shell upgrades. YouTube/Vimeo embeds remain online-only. Food logs and sync changes stay in local state; telemetry is persisted and retried online.

## Validation

Run from the repository root with the dependencies in `tests/package.json` and `worker/package.json` installed:

```text
node tests/test.mjs
node tests/ui-test.mjs
node tests/round3.mjs
node tests/round4.mjs
node tests/round4-ui.mjs
node tests/round5.mjs
node tests/round5b.mjs
node worker/test.mjs
node worker/round5b.test.mjs
```

The new suites exercise SQLite migrations and constraints, LINE PKCE/nonce/link proof/replay/caps with mocked provider responses, group authorization/privacy/capacity, affiliate URL validation, five-language DOM rendering, translation coverage/placeholders, readiness/conditions, medication forms and spacing, barcode conversion/cache, offline cache retention, and side/front wall/chair poses.

`node tests/extract-i18n.mjs` refreshes the English-key manifest. Dictionaries contain generated translations with corrections to core exercise terminology, medication warnings, and placeholders; broader linguistic quality has not had a native-speaker review. No translation service is called at app runtime.

Chromium launch was denied by this environment (`spawn EPERM`), so browser layout, camera hardware, actual offline media playback, live LINE/OA delivery, and production deployment remain unverified. No production migration, deployment, push, or remote change is part of this work.
