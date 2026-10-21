# Round 8 tasks for Codex — AI credits, model per feature, prompt caching

Same rules as earlier CODEX_TASKS files (static ES modules in `app/`, `L()` + zh/ja/vi dictionaries, add new files to `SHELL` in `app/sw.js` without touching the `VERSION` line, 375px, both themes, offline-safe, backward-compatible state, tests in `tests/` and `worker/*.test.mjs`). Worker: keep name `fitme-api`, bindings and API URL; new D1 migration `worker/migrations/0005_ai_credits.sql`. Keep the Anthropic SDK (`@anthropic-ai/sdk`, `messages.parse` + `zodOutputFormat` from `zod/v4`) — no other providers, no OpenAI-compatible shims.

## Background (cost model Claude worked out)
Prices per 1M tokens: Opus 5.5 $4 in / $20 out, Sonnet 5.5 $2 / $10, Haiku 5.5 $0.10 / $0.50 (≤100K prompt); cache reads $0.20 (Opus/Sonnet). Thinking tokens bill as output. Today every AI call in `worker/src/index.js` and `worker/src/chat.js` uses `claude-opus-5-5`, effort `medium`, with no per-user quota. Estimated cost per call:

| Feature (endpoint) | Opus 5.5 now | Recommended | Cost recommended |
|---|---|---|---|
| Coach chat message (`/api/ai/chat`) | ~$0.042 | Sonnet 5.5, effort low; suggestion extraction on Haiku 5.5 | ~$0.015 |
| Meal photo estimate | ~$0.075 | Sonnet 5.5, effort low | ~$0.035 |
| Body photo review | ~$0.066 | Sonnet 5.5, effort medium | ~$0.033 |
| Meal/supplement plan review | ~$0.066 | Sonnet 5.5, effort low | ~$0.030 |
| Supplement label read (`/api/label/analyze`) | ~$0.10 | Haiku 5.5, effort low | ~$0.003 |

## 1. Model and effort per feature (admin-configurable)
- New config block `ai` in CONFIG KV (read through the existing `readConfig`, editable in the admin page, only after admin login): for each feature id `chat`, `chatSuggestions`, `mealPhoto`, `bodyReview`, `planReview`, `labelRead` → `{ model: 'claude-opus-5-5'|'claude-sonnet-5-5'|'claude-haiku-5-5', effort: 'low'|'medium'|'high', maxTokens }`. Defaults = the "Recommended" column above; maxTokens defaults: chat 1200, chatSuggestions 600, mealPhoto 2500, bodyReview 2500, planReview 2500, labelRead 4000. Validate with zod (model allow-list only).
- One helper `aiCall(env, feature, params)` in a new `worker/src/ai.js` used by every AI endpoint: builds the client, applies model/effort/max_tokens from config, handles `stop_reason` `refusal`/`max_tokens` (clear 422 error, no credit charged), records usage (see §3), and returns the parsed output.
- Haiku 5.5 notes: do not send assistant prefill or non-default sampling params; if `messages.parse` structured output fails for a feature on Haiku, retry once on Sonnet 5.5 and log it (count in the admin AI dashboard).
- Admin page: "AI" tab with a model/effort dropdown per feature, showing the estimated cost per call for the selected model (from a price table in `ai.js`) and a "reset to recommended" button.

## 2. Prompt caching
- Make every system prompt a stable string (move per-request values such as language name out of the system prompt into the user turn) and send `system: [{ type: 'text', text, cache_control: { type: 'ephemeral' } }]`. Add a short shared, stable preamble (product scope, safety rules, Thai food knowledge, output conventions) so the system prompt clears the 512-token minimum on Opus/Sonnet 5.5. Never put timestamps, user ids or random values before the breakpoint.
- Chat: also use top-level automatic `cache_control: { type: 'ephemeral' }` so the growing history is cached across turns; keep the context JSON in the first user message, byte-stable across turns (sorted keys).
- Record `cache_read_input_tokens` / `cache_creation_input_tokens` from `usage` and show the cache hit rate in the admin AI dashboard.
- Client: resize uploaded photos to max 1024 px long edge, JPEG quality ~0.8 before sending (meal, body, label) — fewer image tokens.

## 3. AI credits (server-enforced)
- Credit prices per call: chat message 1, label read 1, plan review 2, meal photo 3, body review 3 (stored in the `ai` config so admin can change them).
- Allowances (admin-editable in `ai.credits`):
  - Free (signed-in account only): 10 trial credits once per account.
  - Pro 30 days: 60 credits per 30-day period. Pro 90 days: 60 per 30-day period (reset every 30 days from start, not stacked).
  - Top-up product `credits40`: 40 credits, 49 THB / $1.49, valid 90 days (new product in `products`, works with both Thunder slip and Stripe Checkout like `export1`).
  - Subscribers via Stripe Billing get the same 60/period.
- D1 migration `0005_ai_credits.sql`: `ai_credits(owner TEXT, period_start TEXT, granted INT, used INT, PRIMARY KEY(owner, period_start))`, `ai_topups(id TEXT PRIMARY KEY, owner TEXT, credits INT, used INT, expires TEXT)`, `ai_usage(id TEXT PRIMARY KEY, owner TEXT, feature TEXT, model TEXT, input_tokens INT, output_tokens INT, cache_read INT, cache_write INT, cost_usd REAL, credits INT, created TEXT)`.
- Owner key: account user id when signed in; otherwise the entitlement token's stable id (order / subscription id inside the HMAC token). Free trial requires an account.
- Charge flow: reserve credits atomically before the API call (period allowance first, then the oldest unexpired top-up); refund on failure/refusal; never go negative under concurrency (D1 conditional UPDATE). Return `{ creditsLeft }` with every AI response and `402 { code: 'no_credits' }` when empty.
- New `GET /api/ai/credits` → remaining, period reset date, top-ups, recent usage (last 20, no prompts stored — privacy).
- Keep the existing rate limits; add a per-owner cap of 30 AI calls per hour.

## 4. App UI
- Credits pill (e.g. "✦ 42") in the AI coach header and on every AI button (meal photo, body review, plan review, label read) showing its credit cost; when insufficient, the button opens a sheet: "เครดิต AI หมด" with Pro / top-up options (go to `#/pay`).
- `#/pay`: show credits included in each package and the top-up product; explain that plan generation, workouts, meal plans and supplement schedules are computed on the device and are unlimited — only AI features use credits.
- Me → "การใช้ AI": remaining credits, reset date, recent usage list (feature, credits, date).
- All strings in 5 languages.

## 5. Admin AI dashboard
- Last 30 days: calls and cost (USD and THB at an admin-set rate, default 34) per feature and per model, cache hit rate, average cost per active Pro user, number of owners who hit 0 credits, Haiku→Sonnet fallbacks. Admin session token required.

## Done when
- Worker tests: config validation and model allow-list; `aiCall` uses the configured model/effort/max_tokens (mock the SDK); system prompt has `cache_control` and is byte-identical across two requests with different users/languages; credit reserve/refund, period reset at 30 days, top-up order and expiry, concurrent reservations never overspend, 402 when empty, free trial only once and only with an account; usage rows have no prompt text.
- App tests: credit pill/costs render, no-credits sheet, image resize to ≤1024 px, pay page lists credits.
- `cd worker && npx wrangler deploy --dry-run` bundles (or report the sandbox block). Migration file applies on a fresh local D1.
- Leave changes uncommitted; do not push, deploy or apply migrations remotely.
