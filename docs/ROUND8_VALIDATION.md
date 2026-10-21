# Round 8 validation

Date: 2026-10-21. Branch: `codex/round8`. Changes are intentionally uncommitted.

## Implemented

- Added validated `ai` settings in CONFIG/settings, consumed through `readConfig`. Six features have independent allowlisted Claude model, effort and token limits. Defaults match Round 8: Sonnet for chat/meal/body/plan, Haiku for suggestion extraction/labels; body effort medium, all others low.
- All AI endpoints use `worker/src/ai.js`. The Anthropic SDK and `messages.parse` / `zodOutputFormat` remain in use for structured results. Plain chat uses the same helper with `messages.create`. No other provider was added.
- Refusal and token-limit stops return HTTP 422 and refund credits. Structured-output failures on Haiku retry once on Sonnet and increment fallback statistics. Refusals, truncation, authentication failures and network failures do not trigger this fallback. SDK automatic retries are disabled.
- Stable shared system preamble plus per-feature instructions use ephemeral cache blocks. Language and user context are in user turns. Chat has top-level automatic caching and sorted context JSON in its first user message; the client snapshots context across turns in the open conversation.
- Usage includes ordinary input/output, cache reads/writes, model, feature, estimated USD cost and charged credits. Failed attempts with available provider usage remain visible with zero credits. No prompt text or image data is stored in AI accounting tables. Existing account sync is a separate pre-existing feature.
- Migration `0005_ai_credits.sql` adds the requested allowance, top-up and usage tables, plus reservation receipts/triggers, period anchors, hourly limits and aggregate event records. Orders also freeze purchased credit amounts/validity and guest wallet identity.
- Reservation is a single guarded SQL statement whose triggers debit allowance first, then trial remainder, then unexpired top-ups in expiry order. SQLite write atomicity and balance CHECK constraints prevent overspending across concurrent callers. Refunds are conditional and idempotent, including partial allocations across buckets.
- Signed-in user IDs own account balances. Guest balances require verified HMAC purchase tokens backed by payment records and retain a stable order wallet across top-ups. Only authenticated accounts receive the one-time trial grant. Pro windows reset every 30 days from their stored start and do not accumulate; Stripe subscriptions use the same allowance mechanism.
- Added 30 AI requests/hour per owner. Empty balances return HTTP 402 with `code: no_credits`; successful AI responses contain `creditsLeft`.
- `GET /api/ai/credits` returns balance, reset date, unexpired top-ups and the latest 20 accounting records. Account data export/deletion includes the new AI records.
- `credits40` is available through existing Thunder and Stripe Checkout paths at THB 49 / USD 1.49, with default 40 credits / 90 days. Credit amount and validity are frozen at quote creation and payment replay cannot grant twice.
- Coach header shows a balance pill. Chat, meal-photo, body-review, plan-review and label buttons show configured costs and gate insufficient balances with the Pro/top-up sheet. Free signed-in accounts can use AI trial credits without Pro.
- Me links to AI usage. Pay shows included credits, top-ups, monthly subscription credits and the explanation that local calculations do not use credits. New UI vocabulary is translated for Thai, English, Chinese, Japanese and Vietnamese.
- AI images use maximum 1024-pixel long edge and JPEG quality 0.8. Decode/encode failures do not silently send the original large image. Existing non-AI compression keeps its backward-compatible fallback.
- Authenticated Admin → AI provides model/effort/token/call-cost controls, allowance settings, THB rate, estimates, reset-to-recommended and a 30-day dashboard: calls/cost by feature/model, USD/THB, cache hit rate, average cost per active AI Pro owner, zero-credit owners and fallback count. Public config includes only credit prices/allowances, not private model configuration or dashboard data.
- Registered all three new client modules in service-worker SHELL. Preserved the entire VERSION line, Worker name/bindings and API URL. Updated README.

## Automated results

Node: v24.14.0. Every suite below exited 0.

| App command | Result |
| --- | --- |
| `node tests/round3.mjs` | PASS |
| `node tests/round4-ui.mjs` | PASS |
| `node tests/round4.mjs` | PASS |
| `node tests/round5.mjs` | PASS |
| `node tests/round5b.mjs` | PASS |
| `node tests/round5c.mjs` | PASS |
| `node tests/round6-offline.test.mjs` | PASS |
| `node tests/round6.test.mjs` | PASS |
| `node tests/round7.mjs` | PASS |
| `node tests/round8.mjs` | PASS |
| `node tests/test.mjs` | PASS |
| `node tests/ui-test.mjs` | PASS |

Worker commands were run from `worker/`:

| Command | Result |
| --- | --- |
| `node test.mjs` (includes Round 4 and 5a) | PASS |
| `node round8.test.mjs` | PASS |
| `node round8-payments.test.mjs` | PASS |
| `node round5c.test.mjs` (billing/backups regression) | PASS |
| `node round6.test.mjs` (admin-access regression) | PASS |

Round 8 Worker tests cover model allowlist/settings, SDK request model/effort/token limits, byte-identical cached system prompts with different input profiles/languages, stable sorted chat context, automatic chat cache, separate Haiku extraction, refusal/truncation/refund/fallback, one-time trial, 30-day boundary, non-stacking Pro90, top-up priority/expiry, concurrent reservations, 402, 30/hour cap, subscription allowances, admin access/statistics, accounting privacy and payment replay. Twenty concurrent requests against ten credits at three credits/request produce exactly three successful reservations.

Payment tests exercise both provider paths with mocked HTTP responses, guest top-up-only wallets, existing Pro wallet top-ups, THB/USD prices, 90-day validity, preserved balances and replay protection. No real payment or paid AI request was made.

App tests use happy-dom across all five languages and both theme settings. They verify cost/balance markup, no-credit sheets, account-token preference, usage rendering, package credits, admin login gating, model estimates/reset, and actual resize calculations with mocked bitmap/canvas backends. The real compression function is checked against landscape, portrait and already-small images and rejects decode failure in strict AI mode.

Existing Worker assertions were updated for the new Sonnet/low defaults and system cache blocks. The Round 4 chat fixture now uses an authenticated account and current migrations instead of an unbacked synthetic Pro token.

## Local migration and build limitations

- All migrations 0001–0005 apply successfully to a fresh in-memory SQLite database in the test adapter. The actual new SQL, triggers, constraints, reservations and refunds execute in those tests.
- `npx wrangler deploy --dry-run` was attempted and blocked before bundling by the sandbox: `Error: spawn EPERM`, `errno: -4048`, in `wrangler/bin/wrangler.js`.
- `npx wrangler d1 migrations apply fitme --local --persist-to .round8-local-d1` was attempted for a fresh local D1 environment and hit the same `spawn EPERM` block. Local D1/workerd compatibility remains unverified; SQLite success is not presented as D1 runtime success.
- Browser/Playwright/serve scripts and `extract-i18n` were excluded as requested. No new browser screenshots or pixel-layout validation at 375px were performed; DOM tests do not prove rendered layout. New controls reuse existing responsive/theme classes and include wrapping for dashboard rows.
- Real Anthropic model availability, live cache hits, provider billing and real payment integrations were not tested. Price tables use the task's planning assumptions; estimates are not live provider quotations.

## Workspace boundaries

- Current branch remains `codex/round8`; no commit, push, deployment or remote migration.
- `const VERSION = 'fitme-v1'` in `app/sw.js` is unchanged.
- Root JPG files were not read, moved, edited or published.
- Worker name `fitme-api`, Wrangler bindings and `CONFIG.API_BASE` were not changed.
- `git diff --check` passes.
