# Round 6 tasks for Codex

Same rules as earlier CODEX_TASKS files (static ES modules in `app/`, `L()` strings + i18n dictionaries for zh/ja/vi, state defaults, add new JS/data files to `SHELL` in `app/sw.js` without touching the `VERSION` line, reuse CSS, 375px, both themes, offline, tests in `tests/` and `worker/*.test.mjs`). The app is live at https://fixmee.app (web served by `web/` Worker) and API at https://api.fixmee.app (`worker/`).

## 0. Licences — read first
Only reuse code/data/images from these, with attribution on a new `#/credits` page and a `THIRD_PARTY_NOTICES.md` at the repo root:
- yuhonas/free-exercise-db — Unlicense (data + images).
- Rippy1911/anatome — Apache-2.0 (muscle map; keep its licence + NOTICE text if any SVG/code is copied).
- Cawlumm/lyftr, finegym-io/fitness-calc, AssiamahS/opengym3d, colaweb-pt/mediapipe-exercise-rep-counter, guillermoscript/calistenia-app — MIT (ideas or small snippets with the MIT notice).
- Open Food Facts data (already used) — ODbL: show "ข้อมูลจาก Open Food Facts (ODbL)" wherever OFF data is shown.
- MediaPipe — Apache-2.0.
Do NOT copy code, data or images from: wger, openGym, Granite (AGPL-3.0), PoseFit (GPL-3.0), or repos without a licence (waistline, gerardtorres/muscle-map, Sasha-s-Body-Map, exercises-dataset). Ideas only.

## 1. Lock down the admin area (security — do this first)
- Today `#/admin` renders the full settings UI to anyone, and the public `GET /api/config` returns `secrets` with `last4` of every key. Fix:
  - `GET /api/config` must return only what the public app needs (business settings, product prices, `vapidPublicKey` if set, feature flags). Remove the `secrets` object and any `last4` from public responses.
  - New `POST /api/admin/login` (rate-limited like today, constant-time compare) → returns a random admin session token (store only its SHA-256 hash in CONFIG KV with 2-hour TTL). All admin endpoints accept this token as `Authorization: Bearer` (keep accepting the raw password for backward compatibility only in tests, or remove it entirely — prefer remove). New `GET /api/admin/status` (admin) returns secret status with last4. `POST /api/admin/logout`.
  - App `#/admin`: shows only a login card until `/api/admin/login` succeeds; token kept in sessionStorage; on 401 return to the login card. Dashboard, settings, keys, promos, trainers, errors, videos, LINE, shop, org, A/B, backups tabs are only fetched/rendered after login.
  - Remove the "ผู้ดูแลระบบ/Admin" link from the Me page; add `<meta name="robots" content="noindex">` handling for the admin route (set at runtime) and `Disallow: /` is not needed for the whole site — just don't link it.
  - Tests: public config contains no `secrets`/`last4`; admin endpoints reject missing/expired/wrong tokens; login rate limit.

## 2. Exercise library from Free Exercise DB (Unlicense)
- Script `scripts/import-exercises.mjs` (run manually, output committed): download `dist/exercises.json` from yuhonas/free-exercise-db at a pinned commit, map to `app/data/exercise-db.json` with: id, name (en), Thai name (provide Thai names for the ~150 most common exercises in a mapping file `scripts/exercise-names-th.json`; others fall back to English), force/level/mechanic/equipment/category, primary/secondary muscles (mapped to our muscle ids from §3), instructions (en; Thai for the mapped 150 where you can write accurate short instructions), image paths.
- Images: load from jsDelivr at the same pinned commit (`https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@<commit>/exercises/<path>`), lazy-loaded; show the two photos alternating every 0.8 s like a GIF. Cache viewed images in the offline cache.
- Library page: search (Thai/English), filters (muscle, equipment, level, category), "ท่าแอนิเมชัน" badge for our 40 animated exercises (they stay the default in plans). Exercise sheet shows photos + instructions + target muscles on the muscle map.
- Planner: user can add any library exercise to a day or use it as a swap alternative; equipment/level/avoid rules still apply. Logging works the same.
- Keep bundle size reasonable: the JSON loads lazily only when the library opens.

## 3. Interactive muscle map + recovery heatmap
- `app/js/muscle-map.js`: front/back body SVG (adapt Anatome under Apache-2.0 with attribution, or draw our own) with ~16 regions: chest, front delts, side/rear delts, biceps, triceps, forearms, abs, obliques, traps, lats, lower back, glutes, quads, hamstrings, adductors, calves. Map our 40 exercises and the Free Exercise DB muscles to these ids.
- Uses: (a) workout page shows today's target muscles; (b) Me → "กล้ามเนื้อ" weekly volume heatmap (sets per muscle, last 7 days) from set logs/completed sessions; (c) recovery status per muscle (fresh / recovering / fatigued) with a simple decay model (48–72 h by volume) — readiness check-in soreness also feeds it; (d) tap a muscle → filtered exercise list.
- Accessible: each region focusable with a label; colours readable in both themes.

## 4. Calculators page `#/tools`
- BMI (Asian cut-offs, existing), BMR (Mifflin-St Jeor, Harris-Benedict revised, Katch-McArdle), TDEE, macros by goal, 1RM (Epley and Brzycki, plus a % of 1RM table), plate calculator (kg: 25/20/15/10/5/2.5/1.25, bar 20/15/10 kg, per side), body fat (US Navy method from neck/waist/hip/height; links to the measurements log), heart-rate zones (Karvonen with resting HR; 220−age and Tanaka 208−0.7×age max HR options), calories burned (MET × weight × time for our exercises), water needs, ideal protein, and progressive-overload trend per exercise from set logs.
- Every calculator: inputs prefilled from the profile, short explanation and "ค่าประมาณ" note. Unit tests with known reference values for each formula.
- Entry from the Me page and the workout page.

## 5. Free workout logging and PRs (ideas from Lyftr, MIT)
- "บันทึกการฝึกเอง": start an empty session, add exercises from the library, log sets (kg/reps or time), rest timer with custom default, notes; saved like planned sessions (counts for challenges/streaks).
- PR detection per exercise (heaviest weight, best estimated 1RM, most reps at a weight), PR toasts, PR list in Me, and include PRs in the share card.

## 6. Recipes and meal prep (ideas from Mealie/Tandoor)
- `app/data/recipes-th.json`: ~30 healthy Thai recipes (ingredients from our FOODS with grams, steps in Thai/English, servings, prep time, tags: high-protein, low-carb, vegetarian, halal, budget). Recipe page with serving scaling, macros per serving, "ใส่ในแผน" (replace a meal) and "ทำเผื่อ (meal prep)" for N days → adds to the shopping list.
- User recipes (round 3) appear in the same list.

## 7. Auto-deploy the web app to Cloudflare
- New GitHub Actions workflow `.github/workflows/deploy-web.yml`: on push to `main` (paths `app/**`, `web/**`), run `node web/deploy.mjs` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from repository secrets; skip with a notice if the secrets are missing. Install wrangler via `npm ci --prefix worker`. Keep the existing Pages workflow (old URL notice).
- README: how to create the token (Cloudflare → My Profile → API Tokens → Create Token → template "Edit Cloudflare Workers", account = the Fixmee account, zone = fixmee.app) and add both secrets in GitHub → Settings → Secrets and variables → Actions.

## Done when
- No console errors on all routes, 5 languages, both themes, 375px; old state loads.
- Tests for: admin lock-down (§1), formula reference values (§4), PR detection, recipe scaling, muscle mapping completeness (every one of our 40 exercises and every imported exercise maps to ≥ 1 region), exercise-db import mapping.
- `cd worker && npx wrangler deploy --dry-run` bundles (or report the sandbox block).
- `#/credits` and `THIRD_PARTY_NOTICES.md` list every third-party source with its licence.
