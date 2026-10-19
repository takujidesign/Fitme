# Round 6 validation

Implemented on `codex/round6`, with admin lock-down first.

- Admin: hashed two-hour KV sessions, login rate limit, logout/revocation, protected status, public-config allowlist, sessionStorage login gate and 401 reset, runtime noindex, no Me-page admin link. Missing/wrong/expired tokens are tested across 18 admin routes. Raw-password authorization removed.
- Library: 876 Free Exercise DB entries pinned to `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`; 155 Thai names and 154 short Thai instruction mappings. Lazy 1.14 MB JSON, paired lazy photos, filters/search, persisted selected exercises, planner additions/swaps. The 40 animated exercises remain the generated-plan defaults.
- Original front/back muscle map: all 40 + 876 exercises mapped; separate seven-day volume and recovery views; soreness contributes to recovery. The model is an estimate, not a physiological measurement.
- Calculators: requested formulas, profile prefills, reference tests, 1RM percentages, plates, Navy body fat, HR zones, energy/water/protein and logged overload history.
- Free sessions: sets/time, notes, persistent draft and custom rest default; existing daily logs/streaks/challenges; weight/1RM/reps-at-weight records, toast and share-card PR.
- Recipes: 30 original Thai/English recipes with existing food IDs, tags, scaling, per-serving macros, meal replacement, shopping-list meal prep and existing user recipes.
- Credits, retained licence texts, OFF provenance/attribution and main-branch web workflow plus secret-setup README added. No prohibited source code/data/images reused.

## Checks passed

- `node tests/test.mjs`
- `node tests/ui-test.mjs`
- `node tests/round6.test.mjs`
- `node tests/round6-offline.test.mjs`
- `node worker/test.mjs` (also runs Round 4 and Round 5a)
- `node worker/round5b.test.mjs`
- `node worker/round5c.test.mjs`
- `node worker/round6.test.mjs`
- Syntax parsing of 112 JavaScript modules; `git diff --check`.
- Real Chrome: 35 registered routes × 5 languages × 2 themes = 350 checks in a 375px iframe; zero captured JavaScript errors and zero document horizontal overflow. Final volume/recovery view rechecked in another 10 cases. Browser console inspection returned no warning/error entries. This is rendering/layout coverage, not live account/payment/provider integration.

Run browser checks with `node tests/serve-round6.mjs`, then open `http://127.0.0.1:5176/tests/browser-round6.html`. The test server blanks API_BASE in served code and uses synthetic local fixture state. Optional `?only=muscles` limits the matrix. No production API writes are involved.

## Verification boundary

`cd worker; npx wrangler deploy --dry-run` was attempted and blocked by the sandbox with `Error: spawn EPERM` in Wrangler's launcher. Bundle verification remains outstanding outside this sandbox. No real deployment, push, remote changes, paid API calls, or live authentication/payment/provider tests were performed. The new GitHub workflow has not run. Service-worker VERSION was not changed.

Calculator reference links: [Mifflin original paper](https://pubmed.ncbi.nlm.nih.gov/2305711/) and [circumference formula study](https://pmc.ncbi.nlm.nih.gov/articles/PMC4831679/). Formula code is original; tests use fixed numerical reference values.
