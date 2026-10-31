# Round 22 — Free AI for meal photos: recognise-then-lookup, a tiered engine (own key → free quota → credits), and an accuracy benchmark

Same rules as earlier CODEX_TASKS files:
- Keep storage keys, the worker name, the API URL and `const VERSION = 'fitme-v1'` in `app/sw.js`.
- Add migration `0014_round22.sql` only if needed.
- Mock every third-party and AI service in tests. Never make live AI calls from tests.
- Never send RepDB data or images to any model.
- Do not commit, push or deploy.

## Facts Claude checked (2026-10-31)
- Meal photo today: `POST /api/ai/meal-photo` → `mealPhoto()` in `worker/src/index.js:220`. It sends 1–2 base64 photos (up to about 4 MB each) to Claude through `aiCall(env,'mealPhoto',…)`, which uses Sonnet by default (`ai-config.js`). The model returns per-item grams **and macros**, which the worker totals. It costs 3 credits; the trial is 10 credits.
- BYOK: `app/js/byok.js` lets users call Gemini, OpenAI or kie.ai with their own key, directly from the browser. The engine choice lives in `localStorage 'fitme:ai-engine'` (default `gemini`; `claude` uses credits). See `beta.js:18`.
- Fixmee has its own food database (`app/js/foods.js`, Thai dishes with per-portion macros) and custom foods (`custom-foods.js`). The food log UI is `app/js/views/food-log.js` (`actions['meal-photo']`).
- Free options (prices and limits change; confirm before relying on numbers):
  - Gemini API free tier covers Flash models with image input. The user's own key means zero cost for Fixmee, but free-tier prompts may be used by Google to improve products.
  - Cloudflare Workers AI: 10,000 neurons per day free, account-wide, reset at 00:00 UTC, then $0.011 per 1,000 neurons. Vision-capable models are in the catalog. The worker can use an `[ai]` binding, with no external key.
  - Groq free tier: `meta-llama/llama-4-scout-17b-16e-instruct` has vision, with rate limits per organisation (reportedly about 1,000 requests per day). It needs a `GROQ_API_KEY` secret.

## 1. Recognise, then look up (meal photos)
Change what the model is asked to do. The model **identifies** foods and portions; Fixmee computes the macros.
- New output schema for every engine: `items: [{name_th, name_en, kind: 'dish'|'ingredient'|'drink'|'packaged', portion: {amount, unit: 'plate'|'bowl'|'ladle'|'piece'|'glass'|'g'|'ml'}, grams_est, confidence 0–1, macros_est?: {kcal,p,c,f}}]`.
  - `macros_est` is only a fallback.
- Client-side matching (`app/js/food-match.js`, new): map each item to the food database plus the user's custom foods.
  - Matching: normalised Thai/English name, aliases, then a fuzzy score (token overlap plus edit distance). Write a small alias table for common Thai dish spellings.
  - Above the threshold, use the database macros scaled by portion → grams.
  - Below it, use `macros_est` and mark the item "ประมาณการจาก AI".
- Review sheet before saving. Each item shows:
  - the matched food, with a dropdown of the top 3 candidates and "ค้นหาอื่น";
  - a portion stepper (½, 1, 1½, 2 × unit, or grams);
  - a confidence chip; low-confidence items are pre-unchecked.

  Totals update live, and nothing is logged until the user taps "บันทึก".
- Downscale photos on the client before sending: longest side 768 px, JPEG quality about 0.8, EXIF stripped. Log the byte sizes in tests.
- Keep the existing Claude path working with the new schema.
- Tests:
  - match accuracy on a fixture list of about 60 Thai and English dish names and misspellings;
  - portion scaling;
  - the fallback to `macros_est`;
  - a low-confidence item is unchecked by default;
  - the downscaler output is at most 768 px and has no EXIF.

## 2. Tiered engine: own key → free daily quota → credits
One function picks the engine for each AI request. Use it for `mealPhoto` now; `chatSuggestions` and `planReview` (text only) may also use the free tier.
1. **The user's own key** (existing BYOK: Gemini / OpenAI / kie). Cost to Fixmee is zero.
   - Add a "รับคีย์ Gemini ฟรี (2 นาที)" guide in AI settings. It gives step-by-step instructions for Google AI Studio → Get API key, a paste field, a "ทดสอบคีย์" button, and a choice of a Flash model as the default.
   - Note in Thai that Google may use free-tier data to improve its products, and offer a link to their terms.
   - The key stays on the device as now. Never send it to our server, except for the existing kie proxy behaviour.
2. **Free daily quota** for users without a key. The server uses its free providers in a fallback chain:
   - **Workers AI** (binding `AI`; pick a current vision model from the Cloudflare catalog and make it configurable in admin);
   - then **Groq** (secret `GROQ_API_KEY`, model configurable; disabled when the secret is missing).
   - Limits:
     - each install or account gets `freeMealPhotosPerDay` (default 3, admin-configurable, in the user's local day) and `freeTextPerDay` (default 10);
     - a global daily ceiling per provider (`workersAiNeuronsBudget` default 9,000, `groqDailyRequests` default 800), so the app never pays by accident;
     - when both are exhausted, the reply is `{code:'free_quota_exhausted', resetAt}`.
   - Count usage in D1/KV without storing images. Images are processed in memory only.
   - The privacy text in all 5 languages names the processor for each tier.
3. **Credits** (existing Claude path) when the free quota is used up, or when the user picks "แม่นยำสูง (ใช้เครดิต)".
- UI:
  - In the meal-photo sheet, show which engine will run and what remains, for example "ฟรีวันนี้เหลือ 2 ครั้ง" or "ใช้คีย์ Gemini ของคุณ" or "ใช้ 3 เครดิต".
  - When the free quota runs out, offer: get a free Gemini key, use credits, or try tomorrow.
- Admin (AI settings):
  - provider on/off and model IDs for Workers AI and Groq;
  - the quotas above;
  - today's usage per tier and provider, and error counts.
- Every provider must return the §1 schema. Validate with zod. On a parse failure, retry once with the next provider in the chain, then return a friendly error.
- Tests (all providers mocked):
  - the tier order;
  - the per-user quota and the global ceilings;
  - the fallback on provider error and on invalid JSON;
  - Groq is skipped without a secret;
  - the `free_quota_exhausted` response;
  - images are not persisted;
  - the BYOK key never appears in any server request body;
  - admin config validation.

## 3. Accuracy benchmark (offline script, owner-run)
- `scripts/food-eval.mjs` plus `docs/FOOD_EVAL.md`.
- The owner puts their **own** photos in a git-ignored folder `food-eval/` (never commit it), with `labels.json`: `[{file, dishes:[name_th], grams?}]`. Provide `food-eval/labels.example.json`.
- The script runs the same photos through each configured engine: Workers AI, Groq, Gemini with the owner's key from an env var, and Claude from an env var.
- It reports:
  - top-1 and top-3 dish match after `food-match.js`;
  - mean absolute kcal error against the labelled dishes;
  - latency and approximate cost per photo;
  - a table written to `food-eval/results-<date>.md`.
- It runs only when invoked by the owner with keys in env. It never runs in CI.
- `docs/FOOD_EVAL.md` (Thai) explains how to take about 50 photos (common Thai dishes, drinks, mixed plates), how to label them, how to run the script, and how to choose the default free model from the results.
- Tests: the scoring functions run on a tiny synthetic fixture with mocked engines; no real images are committed.

## Done when
- Everything above is implemented with tests, and all existing tests pass:
  ```
  node tests/*.mjs
  cd worker && node <each round*.test.mjs, auth-errors.test.mjs, push-redirect.test.mjs>
  ```
  Add `tests/round22.mjs` and `worker/round22.test.mjs`.
- The worker dry-run bundles with the `[ai]` binding added to `worker/wrangler.toml`, and the local D1 migration applies, or you report the block.
- The first-load JS budget test still passes (lazy-load the new modules).
- `docs/ROUND22_VALIDATION.md` covers:
  - the engine tiers;
  - the default quotas and ceilings, with how they protect cost;
  - the privacy text for each tier;
  - the output schema;
  - the matching approach and its fixture accuracy;
  - what the owner must set: the `GROQ_API_KEY` secret, enabling Workers AI on the account, and the admin quotas.
- Screenshots at 375 px in light and dark go in `docs/round22-screens/`:
  - the Gemini key guide;
  - the meal-photo sheet in each tier;
  - the review sheet with candidates and low-confidence items;
  - the quota-exhausted options;
  - the admin AI tiers.
- Leave changes uncommitted; do not push or deploy.
