# Round 13 validation

Date: 2026-10-23. Branch: `codex/round13`. Changes are uncommitted.

## Implemented

| Task | Implementation and evidence |
| --- | --- |
| 1. Rendering stability | Entrance CSS is gated by `data-enter`, removed after animation/timeout. Count-ups and ring intro run only on the first visit to a route in this session. Re-renders restore scroll, focus, text value/caret, and details; sheets remain outside the replaced view. Today’s minute timer updates only fasting text/ring attributes and the timeline marker. Visibility/online sync is throttled to 60 seconds and only a changed merge requests a render. Social badge polling changes badge nodes only. SW installation no longer calls `skipWaiting`; the update button is the only place that registers a reload after a user tap. Cold starts use the normal waiting-worker lifecycle. |
| 2. Beta mode | Default-on beta policy has separate switches for all AI engines, meal-photo, label-scan, body-photo, payments, donations, LINE, email, and maps. Disabled entry points are removed; disabled direct routes show a friendly card. Push and barcode remain available. Worker gates return `403 beta_disabled` and verify admin sessions before accepting preview headers. Verification skips Resend when disabled; scheduled email and ordinary LINE delivery are gated. Maps use the local list without tiles/directory-provider refresh when off. Admin LINE previews use short-lived, one-time server-issued OAuth tickets, not admin tokens in URLs. Today has a dismissible tester banner. |
| 3. Admin cleanup | One section navigation, horizontal scrolling below 900px and a sidebar at/above 900px; the admin container can use desktop width. Nine section routes and a unique panel manifest replace the legacy nested tab renderers. Only the selected panel mounts. Existing editing actions are reused. Trainer review and payouts are separated; languages and 2FA have their own destinations. Setup includes business fields, prices in paid mode, API-key setup and readiness status. System key status is read-only and describes GitHub Actions deployment. No Wrangler commands remain in the admin UI. |
| 4. AI lab | Five tasks use shared zod schemas; Claude, Gemini server/session key, available Nano, and copy/paste are supported. Synthetic meal/label/body SVG fixtures are bundled; browser validation confirmed local rasterization to a 256px JPEG. Uploaded images use strict resizing. Synthetic profile presets never read user profile/account data. Prompt editing, model selection, comparison, raw/parsed results, validation, latency, tokens, estimated cost and request IDs are exposed. Session Gemini keys are separate from user BYOK keys and are cleared at admin logout. `admin_ai_tests` records metadata tagged `admin_test`, separate from user credits, history and dashboards. |
| 5. Notifications | Setup explicitly explains missing VAPID keys. Notification status distinguishes unsupported/iPhone-not-installed, denied, unconfigured, inactive and active, with platform instructions. Subscribed users can request a self-test with a database-backed 3/hour cap and ownership checks. Admins can target a device or user. The actual scheduled sender was tested with mock transport across Bangkok and New York summer/winter/DST repetition. |
| 6. Gemini guide | `#/ai-guide/gemini` contains five steps, in-app schematic UI drawings, key testing, five error-pattern mappings, and storage/data-use/deletion/revocation FAQ. Linked from AI settings, Help and the lab. Normal users cannot access it while AI is disabled; admin preview can. Thai/English rendering is tested and captured. Common Round 13 messages also extend the lazy zh/ja/vi dictionaries. |

## Automated validation

- **19/19 app test runners passed**, including new `tests/round13.mjs`.
- **13/13 Worker runners passed**: `worker/test.mjs` plus every `worker/round*.test.mjs`.
- All runs preloaded `tests/support/no-network.mjs`; provider calls in tests were explicitly mocked. No real provider API was called.
- The excluded top-level tests were browser/Playwright/serve scripts and `extract-i18n`, as requested. The local mock server was used separately for the required screenshot review.
- Old integration tests now explicitly set beta off in their fixtures so they continue to exercise their original enabled-provider behavior. The Round 12 language assertion now verifies its new System destination. No production default was relaxed to pass an old test.
- Round 13 app tests cover five minute ticks with taps (zero subsequent entrance attributes; ticks/polling keep the view node), scroll/focus/caret/details/sheets, tap-only SW activation, beta entry-point filtering/admin bypass, unique panel ownership and mounting every panel, notification states, guide/error mapping, and five tasks across four mocked engines without account mutation.
- Round 13 Worker tests cover disabled endpoint rejection, forged preview rejection, admin bypass/per-integration toggles, skipped verification, isolated mocked Claude/Gemini usage, one-time LINE preview flow, push ownership/rate limits, and actual cron delivery/deduplication for Bangkok and New York including the repeated DST hour.
- New migration `worker/migrations/0009_round13.sql` is applied to fresh **in-memory SQLite only** by the test helper. No local persistent or remote D1 migration was applied.
- `git diff --check` passed (Windows line-ending warnings only).
- Static initial module graph: **347284 bytes gzip / 358,400-byte budget**, 116 modules; this is not a CPU/network benchmark.

Commands used from the repository root (PowerShell loop runs each file independently):

```powershell
Get-ChildItem tests/*.mjs |
  Where-Object Name -NotMatch 'browser|serve|extract-i18n|playwright' |
  ForEach-Object { node --import ./tests/support/no-network.mjs $_.FullName }

cd worker
node --import ../tests/support/no-network.mjs test.mjs
Get-ChildItem round*.test.mjs |
  ForEach-Object { node --import ../tests/support/no-network.mjs $_.Name }
```

Machine-readable results and individual logs: [round13-results](round13-results/), especially [app-tests.json](round13-results/app-tests.json) and [worker-tests.json](round13-results/worker-tests.json).

## Browser review

- Actual app ES modules/CSS, served by `tests/serve-round13.mjs` on loopback with synthetic API responses and a same-origin-only CSP. No production site was opened.
- **54 admin screenshots**: all nine sections × 375/768/1280px × dark/light. Each capture waits for entrance attributes to disappear.
- Every measured admin route had exactly one main admin navigation and one logout button, with no horizontal document overflow. Desktop width and selected-tab contrast were corrected during visual review.
- Four additional screenshots cover beta Today, mocked Claude/Gemini comparison, and Thai/English Gemini guides: **58 screenshots total**.
- Beta Today browser check: zero AI/payment/donation entry links, tester banner visible. Lab comparison produced two valid mocked results. Synthetic fixture conversion was verified in the browser.
- App error/unhandled-rejection collection: `[]`, saved in [browser-app-errors.json](round13-results/browser-app-errors.json). The browser extension logged its own connection diagnostic; that is not attributed to app code.
- Review [the screenshot gallery](round13-screens/index.html) and [layout checks](round13-screens/layout-checks.json). Screenshots are viewport captures. Two full-page capture attempts timed out; viewport captures succeeded.

## Limits and release boundary

- Worker dry-run attempted with `node node_modules/wrangler/bin/wrangler.js deploy --dry-run --outdir ../docs/round13-results/worker-bundle`. **Sandbox blocked child-process creation with `spawn EPERM`** before bundling. See [worker-dry-run.log](round13-results/worker-dry-run.log). No successful dry-run bundle is claimed.
- Live Claude/Gemini/Nano generation, real OAuth/email/payment/push transport, and real mobile push delivery were not exercised. Lab cost figures are planning estimates, not verified live prices or invoices. SW update behavior has unit/source coverage; a two-version production lifecycle was not tested.
- No commit, push, deployment, remote migration, real service request or personal email was added. Worker name, bindings and API base URL remain unchanged.
- The exact `const VERSION = 'fitme-v1'` line in `app/sw.js` is unchanged; new modules and synthetic fixtures were added to SHELL.
- Repository-root JPG files were never opened, moved, modified, served or published. Local validation serves only `app/` plus explicit test endpoints; screenshot JPGs are under `docs/round13-screens/`.
- The existing connected browser was used; no throwaway browser profile was created. Temporary viewport overrides were reset and the validation tab/server closed after review.
- The worktree began with three modified Round 12 outputs: `performance.json`, `dark-admin-2fa.html`, `light-admin-2fa.html`. The required existing Round 12 runner regenerated those outputs; they remain uncommitted. Other clean historical screenshot fixtures regenerated by that runner were restored to their original tracked content.
