# Round 22 validation

Implemented on the existing `codex/round22` branch. Changes are uncommitted. No push, deployment, remote migration, secret change, or live AI inference was performed. The pre-existing Round 12 documentation edits were preserved byte-for-byte; older test-generated evidence was restored after running the suites.

## Result and remaining verification

| Check | Result |
|---|---|
| Executable non-browser app suites | **31/31 passed** |
| Worker suites: every `round*.test.mjs`, auth-errors, push-redirect, plus `test.mjs` | **22/22 passed** |
| New `tests/round22.mjs`, `worker/round22.test.mjs` | Passed; all providers mocked |
| Matching fixture | **60/60 top-1**, all above the acceptance threshold; Thai/English exact names and spelling variants |
| First-load static import budget | **357,151 gzip bytes / 358,400 budget**, 131 modules; passed |
| D1 migration SQL | `0014_round22.sql` applied in the SQLite-backed D1 test adapter; quota concurrency tests passed |
| `npx wrangler d1 migrations apply fixme --local` | **Blocked: `spawn EPERM`** before Wrangler starts; not verified in the local D1 emulator |
| `npx wrangler deploy --dry-run --outdir .wrangler/round22-dry-run` | **Blocked: `spawn EPERM`** before Wrangler starts; bundle not verified |
| Browser suites | **14 blocked**: 11 Chrome subprocess `spawn EPERM`, 3 missing bundled Playwright browser executables |
| 375 px light/dark screenshots and actual JPEG/EXIF check | **Pending**, because `tests/round22-browser.mjs` cannot launch Chrome |
| Owner's real-photo accuracy benchmark | Not run; no owner images or provider keys used |

This is not an all-checks-green handoff: browser/visual, actual canvas encoding and Wrangler validation remain open. No synthetic HTML is presented as a screenshot. The screenshot runner produces 14 PNGs and `image-check.json` when run in an environment that allows Chrome; see [screenshots](round22-screens/README.md).

Suite inventories are in [unit-tests.json](round22-results/unit-tests.json), [browser-tests.json](round22-results/browser-tests.json) and [performance.json](round22-results/performance.json). Each executable `.mjs` was run separately; `node tests/*.mjs` does not execute all files. `serve-*.mjs` are long-running helper servers and `extract-i18n.mjs` is a source-generation utility, not a test. The final non-browser pass used `--import ./tests/support/no-network.mjs` (an absolute module URL when launched from `worker/`). Mocked provider requests override the guard only inside tests.

Old meal-photo fixtures were migrated to the new contract. The Round 8 resize assertion still checks 1024 px for other photo features; Round 22 separately checks its new 768 px path. Two existing reminder test fixtures were corrected for local/UTC date-boundary assumptions; notification production code was not changed. New files are in the existing service-worker shell; `const VERSION = 'fitme-v1'`, storage keys, worker name and API URL are unchanged.

## Engine selection and review

`pickMealTier()` is the shared meal-photo selector. It prefers the selected keyed BYOK provider, then another configured Gemini/OpenAI/kie key; without a key it uses the free chain. Explicit Claude/high-accuracy selection uses existing credits. Exhausting free quota offers a Gemini setup link, a separate credit choice, or tomorrow. It never silently charges credits. Other AI features keep their existing paths; the optional text-tier rollout is not enabled.

The free route is `POST /api/ai/meal-photo?tier=free`. The existing route without that query retains the credit reservation/refund path. Both return `review.items`. The free chain tries Workers AI, then Groq, at most once per provider; invalid JSON and schema failures follow the same fallback. No Groq call is made without `GROQ_API_KEY`. When there is no budget/provider available the response includes `code: 'free_quota_exhausted'` and `resetAt`; provider failures produce a friendly error without a paid retry.

The client combines one or two views of the same meal into a single canvas, longest side at most 768 px, encoded as JPEG quality 0.8. Re-encoding does not copy EXIF. Geometry, failure handling and JPEG parameters pass with a mocked canvas. Actual browser encoder/EXIF behavior and real byte sizes remain blocked; the browser test inserts an EXIF APP1 block into a synthetic JPEG and checks the output. Workers AI's chosen model accepts one image; older two-image free requests skip it and use Groq. The Claude route continues to accept two images.

Review rows contain the top three food candidates, search for another food, household multipliers/grams, numeric confidence, checkboxes, source labels and live totals. Confidence below 0.6 starts unchecked. Unknown foods without fallback nutrition also start unchecked and cannot be saved until matched. Saving is explicit; an optional local photo is stored only on the device. Tests exercise half portions, live totals, unchanged logs before save and exclusion of unchecked rows.

## Schema and matching

Every meal engine is validated with the shared Zod schema:

```js
{ items: [{
  name_th, name_en,
  kind: 'dish' | 'ingredient' | 'drink' | 'packaged',
  portion: { amount, unit: 'plate' | 'bowl' | 'ladle' | 'piece' | 'glass' | 'g' | 'ml' },
  grams_est, confidence, // confidence is 0..1
  macros_est: { kcal, p, c, f } // optional, for grams_est
}] }
```

`food-match.js` normalizes Unicode/case/punctuation, applies common Thai spelling/transliteration aliases, then scores normalized edit distance (85%) plus token overlap (15%). Threshold is 0.67. It searches the app foods and current custom foods. The repository's actual values are **per 100 g**, including converted eating-out dishes; matching scales these values using household grams when known, otherwise the estimated grams. It does not treat per-100-g values as per-plate values. Unmatched items use `macros_est`, labelled “ประมาณการจาก AI”. The 60-name fixture is a name-matching check, not real-photo recognition accuracy.

## Quotas, accounting and cost boundary

| Setting | Default | Guard |
|---|---:|---|
| `freeMealPhotosPerDay` | 3 | Server-side per account or anonymous install |
| `freeTextPerDay` | 10 | Saved/validated configuration; text tier is not enabled in this round |
| `workersAiNeuronsBudget` | 9,000 | Admin may lower it, cannot raise above 9,000 |
| `groqDailyRequests` | 800 | Admin may lower it, cannot raise above 800 |
| Workers AI reservation | 1,000 neurons/call | Conservative whole-context bound, no refund after a provider attempt |

An atomic D1 conditional UPSERT reserves quota before calling a provider. A test races 30 reservations against a 9,000 ceiling and accepts exactly nine. User counters count attempts, including failed provider calls; retries do not become a way to consume unmetered inference. Provider reservations also count failed/invalid responses and are never refunded because the provider may have done billable work. D1 stores only owner/timezone and counters: no images, notes, prompts, responses or BYOK keys.

User day boundaries use an IANA timezone stored on first use, with DST-aware next midnight; tests cover the 23-hour New York day. The stored zone is pinned to prevent changing zones to reset quota. This means an account that travels retains its initially registered quota timezone. Global provider days reset at 00:00 UTC. `resetAt` accounts for the exhausted scope. Anonymous install IDs can be replaced by clearing device data; the global provider ceiling still limits aggregate spend.

The Workers AI model is `@cf/meta/llama-3.2-11b-vision-instruct`, restricted to its audited adapter/cost allowlist. At its documented 128k context and the explicit 2,048 output-token cap, 1,000 neurons is a conservative reservation using the published token/Neuron conversion. Thus this app reserves at most 9,000/day, even with concurrent calls. Rates and account-wide allowances can change: [Cloudflare pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) and [model/input contract](https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/).

Groq defaults to `qwen/qwen3.8-27b`, which the current [Groq vision documentation](https://console.groq.com/docs/vision) lists. The task's Scout model remains an explicit compatibility option, not the current default. The owner's account must actually have free access to the selected model; the app does not assume a universal 1,000-RPD allowance. Model IDs are validated; adding another Workers AI model requires updating the audited adapter/upper bound, not just an arbitrary model string.

**The app counters cannot enforce billing for other applications on the same provider account.** Use a free-only/dedicated account or account-level spending controls and lower these budgets to leave room for other consumers. A request-count ceiling does not turn a paid Groq account into a free account. No live account/billing eligibility was checked here.

Admin → AI tiers provides provider toggles, validated model fields, quotas, UTC daily provider reservations/calls/errors and existing Claude credit usage. BYOK counts use the existing opt-in telemetry aggregates, explicitly marked partial/delayed; meal-photo BYOK failures are counted using closed-vocabulary telemetry events without keys, images, prompts or error messages. Opted-out devices are excluded. Claude meal-photo attempts/failures also have exact server counters. The separate all-feature Claude zero-credit total is labelled failed **or free**, not misrepresented as an exact error count.

## Privacy and owner setup

The meal consent sheet includes separate Thai, English, Chinese, Japanese and Vietnamese text naming all processors: own-key Google Gemini/OpenAI/kie.ai, free Cloudflare Workers AI then Groq, and credit-funded Anthropic Claude. It mentions the existing kie proxy exception, local key storage, in-memory server image processing and review before saving. Meal prompts do not include `aiSummary()`, exercise data or RepDB. Tests check that a BYOK key is absent from the Fixmee request body. Gemini setup includes the key/paste/test/model controls, a Flash default and [Google's free-tier data terms](https://ai.google.dev/gemini-api/terms).

Owner prerequisites, not performed by this change:

1. Apply `0014_round22.sql` after local migration validation succeeds; the current run only proved its SQL in the test adapter.
2. Enable Workers AI for the account and accept the selected model's Meta license/AUP. The `AI` binding is already added in `worker/wrangler.toml`.
3. Set `GROQ_API_KEY` only if the account/model has the intended free allowance; otherwise leave it absent or disable Groq.
4. Review Admin → AI tiers model availability, limits and provider spending controls. Preserve the repository's existing AI/meal-photo beta and social AI gates.
5. Run `node tests/round22-browser.mjs`, inspect the 375 px screenshots, then rerun the Wrangler dry-run/local migration in an environment permitting subprocesses. No deployment is authorized by this validation document.
6. Follow [FOOD_EVAL.md](FOOD_EVAL.md) for about 50 owner-labelled photos. `food-eval/*` is ignored except `labels.example.json`; the offline scorer is tested with synthetic data. The live runner is owner-only, requires `--run`, rejects CI, and uses only configured environment keys. Missing price information is shown as `—`, not invented as zero.
