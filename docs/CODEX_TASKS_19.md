# Round 19 — Admin usage statistics and SEO

Same rules as earlier CODEX_TASKS files. Worker: keep name/bindings/API URL; add migration `0011_round19.sql` if needed. Do not change storage keys, `const VERSION = 'fitme-v1'` in `app/sw.js`, or the `fixmee-web` worker name. Mock third-party services in tests. Do not push, deploy or commit.

## Facts Claude checked (2026-10-27)
- Admin → แดชบอร์ด → สถิติ shows only new users, "active users" (= accounts whose `user_state.updated_at` changed), workouts (parsed from every user's state JSON on each request), check-ins, messages, AI calls/cost, donations, open queues and the top 10 errors.
- Telemetry (`app/js/telemetry.js`, `POST /api/telemetry`) sends only 5 event names (`onboarding_done`, `workout_done`, `purchase_started`, `purchase_completed`, `ai_used`) plus errors, into `telemetry_daily(date,kind,name,count)`. Users without an account are invisible, and so are which screens and features get used, the platform (iOS PWA or browser), the language, retention, push opt-in, and the app version in use. `APP_VERSION` is still `'round5b'`, and `/api/health` reports `version: "round12"`.
- SEO: `app/index.html` has only `<title>Fixmee</title>` and one Thai description. There is no robots.txt, no sitemap, no canonical tag, no Open Graph or Twitter tags, no structured data and no crawlable content without JS (everything is hash routes `#/...`). `web/wrangler.toml` uses `not_found_handling = "single-page-application"`, so every unknown path returns 200 with the app shell (a soft 404).

## 1. Usage statistics (privacy-first, aggregated)
### Collection (app)
- Extend telemetry with **aggregated, non-personal** events. Never include user ID, email, handle, free text, food names, weights, health values, location or the raw User-Agent. Respect the existing opt-out (`state.telemetry === false` sends nothing). Keep the install ID random, hash it on the server as now, and reset it on opt-out.
- New allowlisted names:
  - `app_open`: once per day per install, with dims `platform` (`ios-pwa`, `ios-safari`, `android-pwa`, `android-browser`, `desktop`), `lang` (th/en/zh/ja/vi), `theme` (light/dark), `account` (yes/no), `version` (short SHA read from the SW VERSION, replacing `APP_VERSION`).
  - `screen_view`: route name only from a fixed allowlist (today, workout, food, supps, me, chat, friends, gyms, coach, account, guide, daily-menu, health, settings, other). At most one per route per session.
  - `feature_used`: fixed allowlist covering workout_start, workout_done, meal_logged, daily_menu_edit, food_scan_barcode, label_scan, meal_photo_ai, body_photo_ai, ai_chat, byok_gemini, byok_openai, byok_kie, claude_credits, health_import, reminder_set, push_enabled, push_test, chat_message, friend_added, gym_checkin, backup_export, sync_now, logout, theme_change, language_change, update_applied, share.
  - The existing purchase and onboarding events stay.
- Wire `track()` at each of those points. Batching, the 100-item cap and the 30 s flush stay; also flush on `visibilitychange` → hidden via `navigator.sendBeacon` when available.
- Update the privacy text (all 5 languages): what is counted, that it is anonymous and aggregated, kept 90 days (raw) / 400 days (daily totals), and how to turn it off in Me → ความเป็นส่วนตัว (that switch must be easy to find; add it if missing).

### Storage (worker)
- The server validates every name and dim against the same allowlists (shared module, as with `beta-policy.js`); reject anything else.
- Daily rollups with no per-user rows:
  - `usage_daily(date, name, dim, value, count)` holds the counts.
  - `usage_actives(date, install_hash)` supports DAU/WAU/MAU and retention, keeps salted hashes only, and is pruned after 90 days. The salt lives in KV CONFIG (`usage-salt`) and rotates with the data window.
  - Add `first_seen` per install hash for cohort retention, deleted with the same 90-day rule.
- Run the heavy work in the 20:00 UTC cron:
  - Roll up the day.
  - Compute D1/D7/D30 retention for cohorts.
  - Snapshot per day: total accounts, accounts synced in the last 7 days, push devices (by push service), reminders, health-import connections, and AI usage/cost by engine.
  - Store the snapshot in `usage_snapshot(date, json)`.
- The admin dashboard must stop parsing every user's state JSON per request and read the rollups instead.
- Rate limits: the existing 30 batches per hour per install; the request body stays at most 16 KB.
- Fix `/api/health` `version` to report the deployed commit (inject at deploy via a `[vars]` value or a build-time constant from the workflow, short SHA).

### Admin UI (Admin → แดชบอร์ด, new panels: ภาพรวม / การใช้งาน / ฟีเจอร์ / การรักษาผู้ใช้ / อุปกรณ์และเวอร์ชัน)
- Range picker: 7 / 30 / 90 days, comparing each figure with the previous period (▲▼ %).
- Overview KPI cards: DAU, WAU, MAU, stickiness (DAU/MAU), new installs, new accounts, account conversion (installs → accounts), workouts done, meals logged, AI calls and cost, push-enabled devices with delivery success rate (from round 18 `lastSent`/`lastError`), and errors per 1k sessions.
- Charts: no new heavy library. Use small inline-SVG line and bar charts in a new `app/js/charts.js`, accessible (`<title>`, a table fallback via a "ดูเป็นตาราง" toggle) and theme-aware (CSS variables, light and dark). Show a daily-active line, a screen-views bar, feature-usage bars sorted by count, a retention cohort table (D1/D7/D30, heat-coloured), and breakdowns by platform, language, version and theme.
- Funnels: install → onboarding_done → first workout_done → account created → (paid / donated).
- Export the current view as CSV (aggregates only).
- An empty state when there's no data yet, plus the note "สถิติเป็นข้อมูลรวมแบบไม่ระบุตัวตน ผู้ใช้ที่ปิดการส่งสถิติจะไม่ถูกนับ".
- All strings in th/en (+ zh/ja/vi via dictionaries). The layout works at 375 px.
- Admin-only: every `/api/admin/usage*` endpoint uses the existing `admin()` guard.

### Tests
- Allowlists reject unknown names, dims and extra fields; opt-out sends nothing.
- No personal fields anywhere in the payload (snapshot the outgoing request).
- The rollup computes DAU/WAU/MAU and retention correctly on fixture data.
- Pruning after 90 days works, and the dashboard no longer reads `user_state.json`.
- The admin guard is enforced; CSV export works; charts render in both themes and the table fallback shows.

## 2. SEO (fixmee.app)
### Crawlable pages (static HTML generated at deploy, no JS needed to read them)
- Extend `web/deploy.mjs` (or a new `scripts/build-seo.mjs` it calls) to generate static HTML into `web/dist` from one source file `app/seo/pages.json`:
  - `/`: the landing page. Keep the app working, so the app shell still boots for `#/` routes and installed-PWA users land in the app as now. Real HTML content (hero, features, how it works, FAQ, screenshots, download/install instructions for iPhone and Android, CTA "เริ่มใช้งานฟรี") sits inside the page so crawlers see it; the app replaces it when it starts. Suggested approach: put the content in `<main id="seo">` and hide it once the app mounts. Pick something that doesn't flash content for returning users (e.g. skip the landing for an installed PWA or a returning visitor with onboarding done).
  - `/en/`, `/zh/`, `/ja/`, `/vi/`: localised landing pages (Thai at `/`), with a language switcher that uses real links.
  - `/features/workout-plan`, `/features/meal-plan`, `/features/ai-coach`, `/features/supplements`, `/features/health-import` in Thai, plus `/en/...` versions. Each has a unique title (≤60 chars), a meta description (≤155 chars), one H1 and helpful, original body text (no keyword stuffing), linking into the app (`/#/onboarding`).
  - `/exercises/` and `/exercises/<slug>`: one page per exercise from **our own** data only (Free Exercise DB / our own descriptions and our own illustrations in `app/img/ex`). **Never RepDB data or images**, and no mesh2motion/opengym renders unless their licences allow it (CC0/MIT do; keep attribution where required). Each page shows the name, target muscles, equipment, steps, tips and an image with alt text, links to related exercises, and offers "เพิ่มลงแผน" opening the app.
  - `/privacy`, `/terms`, `/guide`: static versions of the existing in-app texts (keep the "draft, legal review required" note).
  - A real `404.html`. Change `not_found_handling` so unknown paths return a 404 status, while `/` and the generated pages return 200 and the hash-routed app still works. Verify `/index.html`, `/sw.js`, `/manifest.webmanifest` and the existing static assets still serve.
- **Meta on every page:**
  - Unique `<title>` and meta description, plus `<link rel="canonical">` (absolute, `https://fixmee.app/...`, no `www`).
  - `hreflang` alternates for all languages plus `x-default`, and `<html lang>` set correctly.
  - Open Graph (`og:title`, `og:description`, `og:url`, `og:image` 1200×630, `og:locale` plus alternates, `og:type`) and Twitter `summary_large_image`.
  - `theme-color` for both colour schemes.
- **Structured data (JSON-LD):** `WebApplication`/`SoftwareApplication` (name, applicationCategory HealthApplication, operatingSystem "iOS, Android, Web", offers price 0, inLanguage), `Organization` (name, url, logo), `FAQPage` on landing pages (only FAQs actually visible on the page), `BreadcrumbList` on feature and exercise pages, and `HowTo` on exercise pages. Must validate against schema.org types; no fake ratings or reviews.
- **robots.txt:** allow everything except `/api/`, `/admin` and `/#/admin`; point to the sitemap. Add `<meta name="robots" content="noindex">` inside the admin view, and the hash-routed private screens never get canonical URLs.
- **sitemap.xml** (plus a sitemap index if it exceeds 50k URLs): all generated pages with `lastmod` from the git commit date and `xhtml:link` hreflang alternates.
- **OG images:** generate 1200×630 PNG/JPEG cards per landing and feature page at build time from an SVG template (brand colours, title, app icon). Commit only the generator and the template, or the outputs if they're small (<150 KB each).
- **Performance and Core Web Vitals for the landing:** inline critical CSS, `fetchpriority="high"` on the hero image, explicit width/height on images (CLS), lazy-loading for images below the fold, `font-display: swap`, no render-blocking JS for the static content, and modern image formats with fallback. Target Lighthouse SEO 100 and Performance ≥ 90 on mobile for `/` and one exercise page (run Lighthouse if available, or report the block).
- **Headers:** keep the CSP in `app/_headers` working for the new pages (JSON-LD needs no `unsafe-inline` if served as `application/ld+json` data blocks — confirm). Add `Cache-Control` for the HTML pages (short) and the OG images (long).
- Add to `docs/LAUNCH_CHECKLIST.md`, in Thai, the steps for the owner: verify the domain in Google Search Console and Bing Webmaster Tools (DNS TXT through Cloudflare), submit the sitemap, check the coverage report after 1–2 weeks, and optionally submit to IndexNow.

### Tests
- Every generated page has a unique title and description, one H1, a canonical tag, hreflang reciprocity, valid JSON-LD (parse it and check required fields), and OG tags with an existing image.
- The sitemap lists every page and nothing private; robots.txt is correct.
- Unknown paths return 404, while `/` and the app's hash routes still work.
- Exercise pages contain no RepDB-sourced fields (a test that fails if any RepDB ID or URL appears in `web/dist`).
- The landing content is hidden after the app mounts, and an installed PWA skips the landing.
- Every internal link resolves to a generated file.

## Done when
- Both sections are implemented with the tests above, all existing tests pass, and the worker dry-run bundles (or you report the sandbox block). The local D1 migration applies.
- `docs/ROUND19_VALIDATION.md` contains:
  - the list of telemetry events and dims, with the reason each is non-personal;
  - the retention and pruning rules;
  - a list of the SEO pages with their titles;
  - Lighthouse results, or the reason they couldn't be run.
- Screenshots at 375 px in both themes go in `docs/round19-screens/`: the admin overview, usage, features, retention and devices panels, the landing page (th/en), an exercise page and the 404 page.
- Leave changes uncommitted; do not push or deploy.
