# Round 10 validation

Date: 2026-10-22. Branch: `codex/round10`. Changes are uncommitted.

## Implemented

- **Free mode:** default-on CONFIG flag, admin control, existing entitlement checks unlock full plan/supplements/exports, paid cards and subscription/trial upsells hidden. Turning it off retains old purchases, locks and exports. AI credits remain charged only by the existing Claude Worker path.
- **AI choice:** device-local engine/model preference; Gemini BYOK with paginated model discovery, generateContent-only models, newest Flash preference, direct browser requests with `x-goog-api-key`, inline resized images, JSON output schema and shared Zod v4 validation. Key storage is separate from state, backup, sync and telemetry. First-send text/photo preview, free-tier privacy notice, opt-out/reset and key removal. Prompt API availability detection, download status, text-only Nano. Claude stays on its unchanged credit wallet and can be hidden. External copy/open, 6,000-character URL fallback, FIXMEE extraction/validation, human reply review, then existing meal/body/chat confirmation flows. Local chat remains capped at 50 messages. Readable AI summary route excludes authentication/payment keys.
- **Support:** amount presets/custom PromptPay QR (existing library now vendored for offline use), optional slip endpoint, required receiver config, amount checks, rate limit, D1 transactional replay protection including cross-payment triggers, HMAC supporter receipt, manually configurable international links, note copying/contact, email grants/one-time codes, badge/share mark, supporter colour, confetti, seven-day dismissible Today card. Admin donation history and monthly currency totals.
- **Ideas:** pending submissions, atomic three-per-UTC-day owner limit, public approved/planned/in-progress/done list, popularity/new/status tabs, escaped content, explicit desired-state vote/unvote for retry idempotence, server-authoritative supporter double votes (including existing votes on grant), admin approve/reject/status/merge with duplicate-owner vote consolidation.
- **Appearance:** specified dark/light accent fills by tab and sub-route, accessible foreground choices (light-theme text uses an 88% accent / 12% black mix: the requested Today fill alone is below AA as text on the light grey background), shared accent/soft/glow tokens, frosted tab bar/pill/glow/bounce, View Transitions with CSS fallback, radial background, entrance/press/ripple/ring/count-up/shimmer effects, haptics, completion/PR/donation confetti and reduced-motion overrides. IF card has one title, one countdown/status and a ring.
- Five-language additions use the existing L/dictionary mechanism. New app modules and vendored runtime libraries are in the service-worker shell. MIT notices accompany Zod and QR code dependencies.

## Automated checks

Every requested non-browser test runner passed. Browser/Playwright/serve scripts and extract-i18n were excluded from the ordinary suite. A separate screenshot capture was attempted to satisfy the explicit visual deliverable.

| Suite | Runner | Result |
|---|---|---|
| App | `tests/round10.mjs` | PASS |
| App | `tests/round3.mjs` | PASS |
| App | `tests/round4-ui.mjs` | PASS |
| App | `tests/round4.mjs` | PASS |
| App | `tests/round5.mjs` | PASS |
| App | `tests/round5b.mjs` | PASS |
| App | `tests/round5c.mjs` | PASS |
| App | `tests/round6-offline.test.mjs` | PASS |
| App | `tests/round6.test.mjs` | PASS |
| App | `tests/round7.mjs` | PASS |
| App | `tests/round8.mjs` | PASS |
| App | `tests/round9.mjs` | PASS |
| App | `tests/test.mjs` | PASS |
| App | `tests/ui-test.mjs` | PASS |
| Worker | `worker/test.mjs` | PASS |
| Worker | `worker/round10.test.mjs` | PASS |
| Worker | `worker/round4.test.mjs` | PASS |
| Worker | `worker/round5.test.mjs` | PASS |
| Worker | `worker/round5b.test.mjs` | PASS |
| Worker | `worker/round5c.test.mjs` | PASS |
| Worker | `worker/round6.test.mjs` | PASS |
| Worker | `worker/round8-payments.test.mjs` | PASS |
| Worker | `worker/round8.test.mjs` | PASS |

Raw runner outputs: `round10-app-tests.json` and `round10-worker-tests.json`. New tests are `tests/round10.mjs` and `worker/round10.test.mjs`; they also verify vendored QR generation and WCAG AA foreground/background contrast. Earlier paid-mode/Claude UI fixtures explicitly select those retained modes; their assertions were preserved. The Round 10 suite separately checks default free mode and BYOK/external/Nano.

Worker tests apply migrations 0001 through 0006 to fresh in-memory SQLite. New cases cover valid/replayed/wrong-receiver/wrong-amount slips, cross-payment replay, supporter signing, one-time-code claims, admin authentication, moderation, merging, rate limiting, idempotent votes and double weight. Provider HTTP and SDK calls in tests are mocked.

`git diff --check` passed. The `const VERSION = 'fitme-v1'` line is unchanged. Worker name/bindings, API_BASE and deployment workflows are unchanged.

## Browser evidence

16 screenshots (Today, Train, Food, Supps, Me, AI settings, Support, Ideas, each dark/light) are in `docs/round10-screens/`. `overview.png` is the visual review grid; `capture.json` records viewport/route checks. Chrome viewport was 375 x 812; measured document widths were at most 375px. Screenshots were inspected and recaptured with a reduced-motion fixture to freeze transitions/count-ups; normal-motion pages were also inspected. `support-qr-light.jpg` additionally records a real local SVG QR generated without a provider request. Fixture state and API replies are synthetic; the server exposes only app/ assets, never repository-root images.

Direct Chromium spawning from `tests/round10-browser-capture.mjs` failed with sandbox `spawn EPERM`. The available Chrome extension supplied the screenshot fallback, using `tests/serve-round10.mjs` on loopback and mocked API/provider fetches. This is local UI evidence, not live provider evidence.

Chrome repeatedly emitted this connection message: `Could not establish connection. Receiving end does not exist.` Its source was not conclusively attributed. No different error message was observed during the route captures. A completely clean-console claim is therefore not made.

## Bundle and runtime limits

`cd worker && npx --no-install wrangler deploy --dry-run` was attempted and blocked by sandbox `spawn EPERM` in the Wrangler launcher. A separate esbuild bundle of worker/src/index.js succeeded (about 2.0 MB); it reported six pre-existing duplicate state-key warnings in app/js/store.js. This is not equivalent to a successful Wrangler dry run; the temporary bundle was removed.

No real Gemini, OpenAI, Anthropic, Thunder, Wise or Stripe request/payment was made. Gemini account quota/model compatibility, Chrome model download/hardware, actual external-site reply behavior, live payment verification and deployed D1 concurrency remain unverified. The optional Prompt API is mocked in tests, so availability depends on the user's Chrome/device.

Migration `worker/migrations/0006_round10.sql` exists for later release through the established workflow. No remote migration, push, commit or deployment was performed. Repository-root JPG files were not read, moved or published. Screenshot JPGs were newly created only under docs/round10-screens/.
