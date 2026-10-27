# Round 19 validation — 2026-10-27

## Status and boundaries

Implementation is present in the working tree, **uncommitted**. No push, deployment, remote D1 operation, paid AI call, or real message/push delivery was performed. Repo-root JPG files were not read, copied, moved or published. No RepDB dataset, translation dataset, aliases or images were used. Existing unrelated Round 12 working-tree changes are preserved.

**The complete “Done when” gate is not yet met in this sandbox.** Chromium launch and Wrangler subprocesses fail with `spawn EPERM`. The connected managed-browser fallback requires approval, while this session has `approval=never`. Consequently real 375 px PNG screenshots, browser CSP/standalone-PWA confirmation, Lighthouse scores, Wrangler dry-run and Wrangler local-D1 application remain unverified. `tests/round19-browser.mjs` prepares the requested 18 screenshots and two synthetic app captures for the landing gallery. The gallery is wired through `app/seo/pages.json`, but remains omitted until those real captures exist; no mock image is presented as a screenshot.

## Implementation

- Shared closed telemetry vocabulary: `app/js/usage-policy.js`; client queue: `app/js/telemetry.js`; worker collection/rollups: `worker/src/usage.js`; schema: `worker/migrations/0011_round19.sql`.
- Queue retains the established storage key, 100-item cap, 20 events per request and 30-second timer. Hidden-page flush uses `sendBeacon` with a plain-text JSON body, falling back to keepalive fetch. The existing random installation-ID key is retained. Opt-out clears pending events, the local installation ID and route/open deduplication markers.
- `app_open` is deduplicated per installation/UTC date in both client and D1. `screen_view` deduplicates allowed routes in a tab session using sessionStorage. Raw exception messages, filenames, line numbers and User-Agent strings are not included in telemetry payloads or stored by the collector; errors become a count only.
- App version comes from the controller's `GET_VERSION` reply, with a same-origin SW-source fallback for uncontrolled first visits. Unstamped local builds are explicitly `dev`. Source `const VERSION = 'fitme-v1'` is unchanged.
- Health endpoint reads `DEPLOY_SHA`; the worker workflow injects the short commit SHA. Worker names, bindings and API base URLs are unchanged. No workflow was run.
- Admin Dashboard → Metrics loads the five new panels, 7/30/90-day ranges, previous-period KPI comparisons, SVG charts, expandable table fallbacks, cohort heat table and aggregate-only CSV. The new admin UI is loaded on demand. Both `/api/admin/usage*` and the existing social-dashboard path are admin guarded. Dashboard requests read daily totals/snapshots, not user-state JSON.
- Every requested feature has a hook: actual workout completion, workout start, manual/custom meal logs, daily menu edits, barcode lookup, successful AI requests/provider selection, health import, reminder changes, successful push enable/test initiation, chat sends/friend acceptance/check-in, export/sync/logout/theme/language/update/share.
- Me has a top-level Privacy shortcut, a clearly titled switch and privacy copy in th/en/zh/ja/vi. The existing legal content is shared with static legal pages and loaded lazily in the application.

## Telemetry payload and why it is non-personal

Envelope: `{installId, events}`. `installId` is a random UUID, unrelated to login, user ID, email or handle. It is salted and hashed immediately; only the hash is persisted. No raw installation identifier is stored in D1. Each event is strictly `{kind, name, dims?}`. Unknown names, dimensions, values and extra fields reject the entire batch. Body limit remains 16,000 bytes; rate limit remains 30 batches/hour/install.

| Event | Dimensions | Non-personal meaning |
|---|---|---|
| app_open | platform, lang, theme, account, version | Coarse categories only; no user identity, device model or raw UA |
| screen_view | route | A fixed screen category, without URL parameters or route IDs |
| feature_used | feature | A fixed action name, without arguments, result contents, food names or health values |
| onboarding_done | none | Setup completion count |
| workout_done | none | Completed workout count; no exercise IDs, weight, reps or measurements |
| purchase_started / purchase_completed | none | Event count; no amount, order ID, payment reference or buyer |
| ai_used | none | Legacy AI-use count; no prompt, response, key or model string |
| account_created | none | Signup completion count; never includes account identifiers |
| error | none | Exception occurrence count, never the exception message |

Allowed app-open values:

- platform: `ios-pwa`, `ios-safari`, `android-pwa`, `android-browser`, `desktop`.
- lang: `th`, `en`, `zh`, `ja`, `vi`; theme: `light`, `dark`; account: `yes`, `no`.
- version: 7–12 hexadecimal SHA characters; `dev` for unstamped local code.
- route: `today`, `workout`, `food`, `supps`, `me`, `chat`, `friends`, `gyms`, `coach`, `account`, `guide`, `daily-menu`, `health`, `settings`, `other`.
- feature: `workout_start`, `workout_done`, `meal_logged`, `daily_menu_edit`, `food_scan_barcode`, `label_scan`, `meal_photo_ai`, `body_photo_ai`, `ai_chat`, `byok_gemini`, `byok_openai`, `byok_kie`, `claude_credits`, `health_import`, `reminder_set`, `push_enabled`, `push_test`, `chat_message`, `friend_added`, `gym_checkin`, `backup_export`, `sync_now`, `logout`, `theme_change`, `language_change`, `update_applied`, `share`.

All feature values are constant action categories. No event transmits location, health values, meal names, free text, login details or provider credentials. The outgoing-request test includes synthetic private account/profile/error values and verifies an exact payload that excludes them.

## Retention, pruning and metric definitions

- `usage_daily(date,name,dim,value,count)`: counts only, retained 400 days. Dimensions are independently aggregated, not a cross-product fingerprint.
- `usage_actives(date,install_hash)`: distinct daily salted hashes, retained 90 days.
- `usage_installs(install_hash,first_seen)`: cohort anchor; removed after the same 90-day window. `usage_milestones` holds only salted installation hash, a fixed milestone name and date; also pruned after 90 days.
- `usage_snapshot(date,json)`: aggregate daily snapshots, retained 400 days. No per-account/profile values are copied into snapshots.
- KV CONFIG `usage-salt` holds the current and previous 90-day epoch salts. HMAC derivation from the existing server `MASTER_KEY` makes concurrent KV initialization deterministic. The previous salt is used only for still-retained cohorts, preserving D1/D7/D30 continuity across rotation; it is replaced at the following epoch. The existing MASTER_KEY must be configured; no new secret or binding was added.
- Daily unique installations are DAU; distinct hashes over inclusive 7/30-day date windows are WAU/MAU. Stickiness is DAU/MAU. D1/D7/D30 means activity on exactly that UTC day after first_seen, divided by cohort size. Unmatured cells are null/—, never zero. No first_seen hash survives the raw retention window.
- “New installs” means newly observed installation hashes within this bounded retention system, not verified app-store installs or lifetime-unique people. Reinstallation, opting out and back in, and expiration of the raw window can establish a new observation. Cohort account conversion uses first account-created milestones, not the count of all server accounts.
- Funnels show independent aggregate milestone totals, not a joined personal journey. Donations come from aggregate operational records, not an installation-to-donor identity join. Rates should not be interpreted as a causal funnel.
- “Sessions” in errors/1k sessions means opted-in daily opens, consistent with the requested once-per-day app_open event, not arbitrary browser session counts.
- The 20:00 UTC cron prunes raw data/old daily totals, rotates the salt, computes actives/retention and stores snapshots. It finalizes the prior day's activity/AI/new-account/payment/donation counts so events during 20:00–24:00 are not lost. Account/device/reminder gauges retain their original snapshot time (`at`).
- Snapshots include total accounts, synced accounts in seven days, OAuth health connections, push devices grouped into Apple/Google/Mozilla/other, reminder counts and AI calls/cost by engine. BYOK cost is zero **to Fixmee**, not zero provider cost to the user.
- Push success is a retained-status estimate: successful `lastSent` entries divided by those entries plus devices with a retained `lastError`. It is not a complete historical attempt ledger; retries and overwritten errors limit precision. UI explains this boundary.
- Opt-out excludes usage telemetry. Operational account/payment/push gauges still summarize existing service records, so those totals are not opt-in conversion counts.

## SEO build and content

`node scripts/build-seo.mjs` or `node web/deploy.mjs --build-only` generates `web/dist` without deployment. For a shell that blocks Node subprocess creation, supply `SEO_SHA` from `git rev-parse --short=8 HEAD` and `SEO_LASTMOD` from `git show -s --format=%cs HEAD`; both values were read from the local commit for this validation.

The build has 936 HTML pages: five landing languages, ten th/en feature pages, 40 Fixmee exercise pages, 876 Free Exercise DB exercise pages, the exercise directory, privacy/terms/guide and a real 404 page. The sitemap has 935 public URLs, excluding 404/private hash screens. `app/seo/pages.json` owns landing/feature copy, screenshot selection and the five original descriptions needed where Free Exercise DB instructions were empty. Existing exercise/legal/help content remains the source for those pages. Imported exercise pages use the language of their available instructions; missing equipment is labelled as unspecified rather than inferred.

Only approved existing equivalents are emitted as hreflang alternates: all five landing languages, th/en feature pairs, and self/x-default for untranslated exercise/legal pages. No unrelated language homepage is falsely marked as a translation of an exercise.

Free Exercise DB source is pinned to `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5`, with attribution retained. Imported pages use only that source's image URLs; Fixmee movements use reviewed local `app/img/ex` artwork where available. Five empty-instruction records receive explicitly authored steps in pages.json. Iron Cross was checked against the pinned source photos and equipment metadata: it is the dumbbell squat/arm-opening variation, not the rings skill. No RepDB dataset/image was fetched or read. The build excludes its adapters/data before copying and supplies empty optional-provider stubs so existing module imports remain valid.

The generated root is readable without JavaScript; anonymous visitors see the landing. Hash routes, returning onboarded visitors and installed PWAs select app mode before paint. Once the app mounts, static content is hidden and the public canonical/alternate/JSON-LD tags are removed from the private hash-routed UI. The existing admin noindex handling is retained.

Each page has a unique bounded title/description, one H1, an absolute non-www canonical, OG/Twitter metadata, dual colour-scheme theme colors and JSON-LD. Landing FAQ schema uses the visible FAQ. Feature/exercise pages have breadcrumbs; exercises have HowTo steps. No ratings/reviews are invented. Sixteen 1200×630 OG cards are generated from the SVG template; current files are under 32 KB each and are not committed. The font step in the web workflow installs Noto coverage for language rendering. OG URLs include the SHA for long immutable caching; HTML gets short caching. The build uses system fonts and no blocking application JavaScript for static landing content; images have explicit dimensions and the hero has fetchpriority=high. No new chart library was added.

Cloudflare `not_found_handling = "404-page"` replaces SPA fallback. Clean detail URLs are backed by `.html` files, and language/index URLs by directory indexes. See [Cloudflare static routing](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/) and [HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/). These documented semantics are not a substitute for the blocked local Cloudflare runtime check.

JSON-LD is a non-executable data block per the [HTML script type rules](https://html.spec.whatwg.org/dev/scripting.html) and [JSON-LD embedding specification](https://www.w3.org/TR/json-ld/). CSP script-src was not weakened with unsafe-inline. Actual Chromium CSP verification is included in the blocked browser runner; it has not been claimed as passed.

## Validation commands and evidence

**43 permitted test commands passed.** Final focused reruns also passed after sharing the privacy copy with static legal pages. The static import graph measured 356758 bytes gzip against the unchanged 358,400-byte budget.

- `node worker/round19.test.mjs`: strict field/dimension/name validation; 16 KB limit; 30/hour cap; salted identifiers; daily/milestone deduplication; DAU/WAU/MAU; exact-day retention and immature cells; 90/400-day pruning; authorized/unauthorized admin and invalid range; snapshots; rotation continuity.
- `node tests/round19.mjs`: exact outgoing payload, opt-out/identity reset, hidden flush beacon, route deduplication, five languages/two themes/five admin panels, table fallback, scoped CSV, returning/PWA mode selection, all 936 pages' metadata/schema/link checks and forbidden-source scan.
- `node tests/round19-http.mjs`: local read-only preview returns 200 for public pages/assets/hash navigation and 404 for unknown/private paths. This is not a Wrangler-runtime test.
- Existing test command results are recorded in `docs/round19-test-results.json`. The legacy tests were updated only where Round 19 deliberately changes contracts: rejecting old free-text error payloads, snapshot dashboard response and injected health version. The original 350 KiB startup JS budget remains enforced; the latest measured static import graph is recorded there.
- `tests/round14.mjs` and the live Round 14 browser suite were not executed because they exercise the excluded RepDB source. Other browser suites were not claimed as run. All test provider calls are mocked or network-blocked.
- The SQL migration applies to the local in-memory SQLite D1 test adapter with all eleven migrations. **Wrangler local D1 was not successfully applied:** both its launcher and direct CLI attempts failed at subprocess startup (`spawn EPERM`). No remote fallback was attempted.
- Worker dry-run likewise failed before bundling at Wrangler/esbuild subprocess startup (`spawn EPERM`). This is an environment block, not a successful bundle result.
- `node tests/round19-browser.mjs`: Chromium launch fails with `spawn EPERM`. `docs/round19-screens/browser-block.txt` contains the error. The `.fixture.html` files are explicitly labelled synthetic DOM fixtures, **not screenshots**. Expected PNGs are light/dark × overview, usage, features, retention, devices, landing-th, landing-en, exercise and 404.
- Lighthouse is not installed here, and Chromium launch is blocked. No Lighthouse SEO 100 / Performance ≥90 claim is made. On a browser-capable machine, build, run `node web/preview.mjs`, then audit `http://127.0.0.1:5199/` and `/exercises/squat` in mobile mode. Capture the browser gallery and rebuild before publishing.

## Generated pages and titles

The following is the complete local build inventory, including the noindex 404 page.

| URL path | Title |
|---|---|
| / | Fixmee — วางแผนออกกำลังกายและอาหาร |
| /en/ | Fixmee — Workout and meal plans for everyday life |
| /zh/ | Fixmee — 日常训练与饮食计划 |
| /ja/ | Fixmee — 毎日の運動と食事プラン |
| /vi/ | Fixmee — Kế hoạch tập luyện và ăn uống |
| /features/workout-plan | แผนออกกำลังกาย \| Fixmee |
| /en/features/workout-plan | Workout plans \| Fixmee |
| /features/meal-plan | แผนอาหาร \| Fixmee |
| /en/features/meal-plan | Meal plans \| Fixmee |
| /features/ai-coach | AI โค้ช \| Fixmee |
| /en/features/ai-coach | AI coach \| Fixmee |
| /features/supplements | จัดตารางอาหารเสริม \| Fixmee |
| /en/features/supplements | Supplement schedules \| Fixmee |
| /features/health-import | นำเข้าข้อมูลสุขภาพ \| Fixmee |
| /en/features/health-import | Health import \| Fixmee |
| /exercises/squat | สควอท — วิธีฝึก \| Fixmee |
| /exercises/goblet-squat | กอบเล็ตสควอท — วิธีฝึก \| Fixmee |
| /exercises/lunge | สปลิตสควอท / ลันจ์ — วิธีฝึก \| Fixmee |
| /exercises/bridge | กลูทบริดจ์ — วิธีฝึก \| Fixmee |
| /exercises/calf-raise | เขย่งปลายเท้า — วิธีฝึก \| Fixmee |
| /exercises/squat-jump | สควอทจัมพ์ — วิธีฝึก \| Fixmee |
| /exercises/deadlift | เดดลิฟต์ — วิธีฝึก \| Fixmee |
| /exercises/rdl | โรมาเนียนเดดลิฟต์ — วิธีฝึก \| Fixmee |
| /exercises/pushup | วิดพื้น — วิธีฝึก \| Fixmee |
| /exercises/knee-pushup | วิดพื้นคุกเข่า — วิธีฝึก \| Fixmee |
| /exercises/bench-press | เบนช์เพรส — วิธีฝึก \| Fixmee |
| /exercises/shoulder-press | ดัมเบลชอลเดอร์เพรส — วิธีฝึก \| Fixmee |
| /exercises/lateral-raise | ยกดัมเบลด้านข้าง — วิธีฝึก \| Fixmee |
| /exercises/triceps-ext | ดัมเบลโอเวอร์เฮดไตรเซ็ป — วิธีฝึก \| Fixmee |
| /exercises/db-row | ดัมเบลโรว์ก้มตัว — วิธีฝึก \| Fixmee |
| /exercises/lat-pulldown | แลตพูลดาวน์ — วิธีฝึก \| Fixmee |
| /exercises/db-curl | ดัมเบลเคิร์ล — วิธีฝึก \| Fixmee |
| /exercises/superman | ซูเปอร์แมน — วิธีฝึก \| Fixmee |
| /exercises/plank | แพลงก์ — วิธีฝึก \| Fixmee |
| /exercises/crunch | ครันช์ — วิธีฝึก \| Fixmee |
| /exercises/leg-raise | ยกขา — วิธีฝึก \| Fixmee |
| /exercises/mountain-climber | เมาท์เทนไคลม์เบอร์ — วิธีฝึก \| Fixmee |
| /exercises/jumping-jack | จัมปิ้งแจ็ค — วิธีฝึก \| Fixmee |
| /exercises/high-knees | ยกเข่าสูง — วิธีฝึก \| Fixmee |
| /exercises/jog | วิ่งเหยาะอยู่กับที่ — วิธีฝึก \| Fixmee |
| /exercises/walk | เดินเร็ว — วิธีฝึก \| Fixmee |
| /exercises/jump-rope | กระโดดเชือก (จำลอง) — วิธีฝึก \| Fixmee |
| /exercises/forward-fold | ก้มแตะปลายเท้า — วิธีฝึก \| Fixmee |
| /exercises/quad-stretch | ยืดต้นขาหน้า — วิธีฝึก \| Fixmee |
| /exercises/child-pose | ท่าเด็ก (Child's pose) — วิธีฝึก \| Fixmee |
| /exercises/bird-dog | เบิร์ดด็อก — วิธีฝึก \| Fixmee |
| /exercises/dead-bug | เดดบั๊ก — วิธีฝึก \| Fixmee |
| /exercises/cat-cow | แมวและวัว — วิธีฝึก \| Fixmee |
| /exercises/chair-squat | นั่งลุกจากเก้าอี้ — วิธีฝึก \| Fixmee |
| /exercises/wall-pushup | ดันกำแพง — วิธีฝึก \| Fixmee |
| /exercises/step-up | ก้าวขึ้นขั้นเตี้ย — วิธีฝึก \| Fixmee |
| /exercises/run-interval | เดินสลับวิ่ง — วิธีฝึก \| Fixmee |
| /exercises/side-plank | แพลงก์ด้านข้าง — วิธีฝึก \| Fixmee |
| /exercises/kegel | หายใจ / อุ้งเชิงกราน — วิธีฝึก \| Fixmee |
| /exercises/breathing | หายใจ — วิธีฝึก \| Fixmee |
| /exercises/db-3-4-sit-up | 3/4 Sit-Up \| Fixmee |
| /exercises/db-90-90-hamstring | 90/90 Hamstring \| Fixmee |
| /exercises/db-ab-crunch-machine | เครื่องครันช์หน้าท้อง \| Fixmee |
| /exercises/db-ab-roller | Ab Roller \| Fixmee |
| /exercises/db-adductor | Adductor \| Fixmee |
| /exercises/db-adductor-groin | Adductor/Groin \| Fixmee |
| /exercises/db-advanced-kettlebell-windmill | Advanced Kettlebell Windmill \| Fixmee |
| /exercises/db-air-bike | Air Bike \| Fixmee |
| /exercises/db-all-fours-quad-stretch | All Fours Quad Stretch \| Fixmee |
| /exercises/db-alternate-hammer-curl | Alternate Hammer Curl \| Fixmee |
| /exercises/db-alternate-heel-touchers | Alternate Heel Touchers \| Fixmee |
| /exercises/db-alternate-incline-dumbbell-curl | เคิร์ลดัมเบลสลับแขนบนม้านั่งเอียง \| Fixmee |
| /exercises/db-alternate-leg-diagonal-bound | Alternate Leg Diagonal Bound \| Fixmee |
| /exercises/db-alternating-cable-shoulder-press | Alternating Cable Shoulder Press \| Fixmee |
| /exercises/db-alternating-deltoid-raise | Alternating Deltoid Raise \| Fixmee |
| /exercises/db-alternating-floor-press | Alternating Floor Press \| Fixmee |
| /exercises/db-alternating-hang-clean | Alternating Hang Clean \| Fixmee |
| /exercises/db-alternating-kettlebell-press | Alternating Kettlebell Press \| Fixmee |
| /exercises/db-alternating-kettlebell-row | Alternating Kettlebell Row \| Fixmee |
| /exercises/db-alternating-renegade-row | Alternating Renegade Row \| Fixmee |
| /exercises/db-ankle-circles | Ankle Circles \| Fixmee |
| /exercises/db-ankle-on-the-knee | Ankle On The Knee \| Fixmee |
| /exercises/db-anterior-tibialis-smr | Anterior Tibialis-SMR \| Fixmee |
| /exercises/db-anti-gravity-press | Anti-Gravity Press \| Fixmee |
| /exercises/db-arm-circles | Arm Circles \| Fixmee |
| /exercises/db-arnold-dumbbell-press | อาร์โนลด์เพรสดัมเบล \| Fixmee |
| /exercises/db-around-the-worlds | Around The Worlds \| Fixmee |
| /exercises/db-atlas-stone-trainer | Atlas Stone Trainer \| Fixmee |
| /exercises/db-atlas-stones | Atlas Stones \| Fixmee |
| /exercises/db-axle-deadlift | Axle Deadlift \| Fixmee |
| /exercises/db-back-flyes-with-bands | Back Flyes - With Bands \| Fixmee |
| /exercises/db-backward-drag | Backward Drag \| Fixmee |
| /exercises/db-backward-medicine-ball-throw | Backward Medicine Ball Throw \| Fixmee |
| /exercises/db-balance-board | Balance Board \| Fixmee |
| /exercises/db-ball-leg-curl | Ball Leg Curl \| Fixmee |
| /exercises/db-band-assisted-pull-up | ดึงข้อใช้ยางช่วย \| Fixmee |
| /exercises/db-band-good-morning | Band Good Morning \| Fixmee |
| /exercises/db-band-good-morning-pull-through | Band Good Morning (Pull Through) \| Fixmee |
| /exercises/db-band-hip-adductions | Band Hip Adductions \| Fixmee |
| /exercises/db-band-pull-apart | ดึงยางแยกแขน \| Fixmee |
| /exercises/db-band-skull-crusher | Band Skull Crusher \| Fixmee |
| /exercises/db-barbell-ab-rollout | Barbell Ab Rollout \| Fixmee |
| /exercises/db-barbell-ab-rollout-on-knees | Barbell Ab Rollout - On Knees \| Fixmee |
| /exercises/db-barbell-bench-press-medium-grip | เบนช์เพรสบาร์เบลจับกลาง \| Fixmee |
| /exercises/db-barbell-curl | ไบเซปเคิร์ลบาร์เบล \| Fixmee |
| /exercises/db-barbell-curls-lying-against-an-incline | Barbell Curls Lying Against An Incline \| Fixmee |
| /exercises/db-barbell-deadlift | เดดลิฟต์บาร์เบล \| Fixmee |
| /exercises/db-barbell-full-squat | สควอทบาร์เบลเต็มช่วง \| Fixmee |
| /exercises/db-barbell-glute-bridge | สะพานก้นบาร์เบล \| Fixmee |
| /exercises/db-barbell-guillotine-bench-press | Barbell Guillotine Bench Press \| Fixmee |
| /exercises/db-barbell-hack-squat | Barbell Hack Squat \| Fixmee |
| /exercises/db-barbell-hip-thrust | ฮิปทรัสต์บาร์เบล \| Fixmee |
| /exercises/db-barbell-incline-bench-press-medium-grip | เบนช์เพรสบาร์เบลม้านั่งเอียงขึ้น \| Fixmee |
| /exercises/db-barbell-incline-shoulder-raise | Barbell Incline Shoulder Raise \| Fixmee |
| /exercises/db-barbell-lunge | ลันจ์บาร์เบล \| Fixmee |
| /exercises/db-barbell-rear-delt-row | Barbell Rear Delt Row \| Fixmee |
| /exercises/db-barbell-rollout-from-bench | Barbell Rollout from Bench \| Fixmee |
| /exercises/db-barbell-seated-calf-raise | นั่งเขย่งน่องบาร์เบล \| Fixmee |
| /exercises/db-barbell-shoulder-press | กดไหล่บาร์เบล \| Fixmee |
| /exercises/db-barbell-shrug | ยักไหล่บาร์เบล \| Fixmee |
| /exercises/db-barbell-shrug-behind-the-back | Barbell Shrug Behind The Back \| Fixmee |
| /exercises/db-barbell-side-bend | เอียงลำตัวด้านข้างบาร์เบล \| Fixmee |
| /exercises/db-barbell-side-split-squat | Barbell Side Split Squat \| Fixmee |
| /exercises/db-barbell-squat | สควอทบาร์เบล \| Fixmee |
| /exercises/db-barbell-squat-to-a-bench | Barbell Squat To A Bench \| Fixmee |
| /exercises/db-barbell-step-ups | ก้าวขึ้นแท่นบาร์เบล \| Fixmee |
| /exercises/db-barbell-walking-lunge | เดินลันจ์บาร์เบล \| Fixmee |
| /exercises/db-battling-ropes | Battling Ropes \| Fixmee |
| /exercises/db-bear-crawl-sled-drags | Bear Crawl Sled Drags \| Fixmee |
| /exercises/db-behind-head-chest-stretch | Behind Head Chest Stretch \| Fixmee |
| /exercises/db-bench-dips | Bench Dips \| Fixmee |
| /exercises/db-bench-jump | Bench Jump \| Fixmee |
| /exercises/db-bench-press-powerlifting | Bench Press - Powerlifting \| Fixmee |
| /exercises/db-bench-press-with-bands | Bench Press - With Bands \| Fixmee |
| /exercises/db-bench-press-with-chains | Bench Press with Chains \| Fixmee |
| /exercises/db-bench-sprint | Bench Sprint \| Fixmee |
| /exercises/db-bent-arm-barbell-pullover | Bent-Arm Barbell Pullover \| Fixmee |
| /exercises/db-bent-arm-dumbbell-pullover | Bent-Arm Dumbbell Pullover \| Fixmee |
| /exercises/db-bent-knee-hip-raise | Bent-Knee Hip Raise \| Fixmee |
| /exercises/db-bent-over-barbell-row | ก้มดึงบาร์เบล \| Fixmee |
| /exercises/db-bent-over-dumbbell-rear-delt-raise-with-head-on-bench | Bent Over Dumbbell Rear Delt Raise With Head On Be \| Fixmee |
| /exercises/db-bent-over-low-pulley-side-lateral | Bent Over Low-Pulley Side Lateral \| Fixmee |
| /exercises/db-bent-over-one-arm-long-bar-row | Bent Over One-Arm Long Bar Row \| Fixmee |
| /exercises/db-bent-over-two-arm-long-bar-row | Bent Over Two-Arm Long Bar Row \| Fixmee |
| /exercises/db-bent-over-two-dumbbell-row | ก้มดึงดัมเบลสองข้าง \| Fixmee |
| /exercises/db-bent-over-two-dumbbell-row-with-palms-in | ก้มดึงดัมเบลฝ่ามือเข้าหากัน \| Fixmee |
| /exercises/db-bent-press | Bent Press \| Fixmee |
| /exercises/db-bicycling | Bicycling \| Fixmee |
| /exercises/db-bicycling-stationary | Bicycling, Stationary \| Fixmee |
| /exercises/db-board-press | Board Press \| Fixmee |
| /exercises/db-body-up | Body-Up \| Fixmee |
| /exercises/db-body-tricep-press | Body Tricep Press \| Fixmee |
| /exercises/db-bodyweight-flyes | Bodyweight Flyes \| Fixmee |
| /exercises/db-bodyweight-mid-row | Bodyweight Mid Row \| Fixmee |
| /exercises/db-bodyweight-squat | สควอทน้ำหนักตัว \| Fixmee |
| /exercises/db-bodyweight-walking-lunge | Bodyweight Walking Lunge \| Fixmee |
| /exercises/db-bosu-ball-cable-crunch-with-side-bends | Bosu Ball Cable Crunch With Side Bends \| Fixmee |
| /exercises/db-bottoms-up-clean-from-the-hang-position | Bottoms-Up Clean From The Hang Position \| Fixmee |
| /exercises/db-bottoms-up | Bottoms Up \| Fixmee |
| /exercises/db-box-jump-multiple-response | Box Jump (Multiple Response) \| Fixmee |
| /exercises/db-box-skip | Box Skip \| Fixmee |
| /exercises/db-box-squat | บ็อกซ์สควอท \| Fixmee |
| /exercises/db-box-squat-with-bands | Box Squat with Bands \| Fixmee |
| /exercises/db-box-squat-with-chains | Box Squat with Chains \| Fixmee |
| /exercises/db-brachialis-smr | Brachialis-SMR \| Fixmee |
| /exercises/db-bradford-rocky-presses | Bradford/Rocky Presses \| Fixmee |
| /exercises/db-butt-ups | Butt-Ups \| Fixmee |
| /exercises/db-butt-lift-bridge | Butt Lift (Bridge) \| Fixmee |
| /exercises/db-butterfly | Butterfly \| Fixmee |
| /exercises/db-cable-chest-press | เคเบิลดันอก \| Fixmee |
| /exercises/db-cable-crossover | เคเบิลครอสโอเวอร์ \| Fixmee |
| /exercises/db-cable-crunch | เคเบิลครันช์ \| Fixmee |
| /exercises/db-cable-deadlifts | Cable Deadlifts \| Fixmee |
| /exercises/db-cable-hammer-curls-rope-attachment | แฮมเมอร์เคิร์ลเคเบิลเชือก \| Fixmee |
| /exercises/db-cable-hip-adduction | เคเบิลหุบขา \| Fixmee |
| /exercises/db-cable-incline-pushdown | Cable Incline Pushdown \| Fixmee |
| /exercises/db-cable-incline-triceps-extension | Cable Incline Triceps Extension \| Fixmee |
| /exercises/db-cable-internal-rotation | Cable Internal Rotation \| Fixmee |
| /exercises/db-cable-iron-cross | Cable Iron Cross \| Fixmee |
| /exercises/db-cable-judo-flip | Cable Judo Flip \| Fixmee |
| /exercises/db-cable-lying-triceps-extension | นอนเหยียดหลังแขนเคเบิล \| Fixmee |
| /exercises/db-cable-one-arm-tricep-extension | เหยียดหลังแขนเคเบิลข้างเดียว \| Fixmee |
| /exercises/db-cable-preacher-curl | พรีเชอร์เคิร์ลเคเบิล \| Fixmee |
| /exercises/db-cable-rear-delt-fly | กางไหล่หลังเคเบิล \| Fixmee |
| /exercises/db-cable-reverse-crunch | Cable Reverse Crunch \| Fixmee |
| /exercises/db-cable-rope-overhead-triceps-extension | เหยียดหลังแขนเหนือศีรษะเคเบิลเชือก \| Fixmee |
| /exercises/db-cable-rope-rear-delt-rows | ดึงเคเบิลเชือกฝึกไหล่หลัง \| Fixmee |
| /exercises/db-cable-russian-twists | รัสเซียนทวิสต์เคเบิล \| Fixmee |
| /exercises/db-cable-seated-crunch | นั่งครันช์เคเบิล \| Fixmee |
| /exercises/db-cable-seated-lateral-raise | นั่งกางไหล่เคเบิล \| Fixmee |
| /exercises/db-cable-shoulder-press | กดไหล่เคเบิล \| Fixmee |
| /exercises/db-cable-shrugs | ยักไหล่เคเบิล \| Fixmee |
| /exercises/db-cable-wrist-curl | งอข้อมือเคเบิล \| Fixmee |
| /exercises/db-calf-machine-shoulder-shrug | Calf-Machine Shoulder Shrug \| Fixmee |
| /exercises/db-calf-press | Calf Press \| Fixmee |
| /exercises/db-calf-press-on-the-leg-press-machine | เขย่งน่องบนเครื่องดันขา \| Fixmee |
| /exercises/db-calf-raise-on-a-dumbbell | Calf Raise On A Dumbbell \| Fixmee |
| /exercises/db-calf-raises-with-bands | Calf Raises - With Bands \| Fixmee |
| /exercises/db-calf-stretch-elbows-against-wall | Calf Stretch Elbows Against Wall \| Fixmee |
| /exercises/db-calf-stretch-hands-against-wall | Calf Stretch Hands Against Wall \| Fixmee |
| /exercises/db-calves-smr | Calves-SMR \| Fixmee |
| /exercises/db-car-deadlift | Car Deadlift \| Fixmee |
| /exercises/db-car-drivers | Car Drivers \| Fixmee |
| /exercises/db-carioca-quick-step | Carioca Quick Step \| Fixmee |
| /exercises/db-cat-stretch | Cat Stretch \| Fixmee |
| /exercises/db-catch-and-overhead-throw | Catch and Overhead Throw \| Fixmee |
| /exercises/db-chain-handle-extension | Chain Handle Extension \| Fixmee |
| /exercises/db-chain-press | Chain Press \| Fixmee |
| /exercises/db-chair-leg-extended-stretch | Chair Leg Extended Stretch \| Fixmee |
| /exercises/db-chair-lower-back-stretch | Chair Lower Back Stretch \| Fixmee |
| /exercises/db-chair-squat | สควอทเก้าอี้ \| Fixmee |
| /exercises/db-chair-upper-body-stretch | Chair Upper Body Stretch \| Fixmee |
| /exercises/db-chest-and-front-of-shoulder-stretch | Chest And Front Of Shoulder Stretch \| Fixmee |
| /exercises/db-chest-push-from-3-point-stance | Chest Push from 3 point stance \| Fixmee |
| /exercises/db-chest-push-multiple-response | Chest Push (multiple response) \| Fixmee |
| /exercises/db-chest-push-single-response | Chest Push (single response) \| Fixmee |
| /exercises/db-chest-push-with-run-release | Chest Push with Run Release \| Fixmee |
| /exercises/db-chest-stretch-on-stability-ball | Chest Stretch on Stability Ball \| Fixmee |
| /exercises/db-childs-pose | Child's Pose \| Fixmee |
| /exercises/db-chin-up | ดึงข้อหงายมือ \| Fixmee |
| /exercises/db-chin-to-chest-stretch | Chin To Chest Stretch \| Fixmee |
| /exercises/db-circus-bell | Circus Bell \| Fixmee |
| /exercises/db-clean | Clean \| Fixmee |
| /exercises/db-clean-deadlift | Clean Deadlift \| Fixmee |
| /exercises/db-clean-pull | Clean Pull \| Fixmee |
| /exercises/db-clean-shrug | Clean Shrug \| Fixmee |
| /exercises/db-clean-and-jerk | Clean and Jerk \| Fixmee |
| /exercises/db-clean-and-press | Clean and Press \| Fixmee |
| /exercises/db-clean-from-blocks | Clean from Blocks \| Fixmee |
| /exercises/db-clock-push-up | Clock Push-Up \| Fixmee |
| /exercises/db-close-grip-barbell-bench-press | เบนช์เพรสบาร์เบลจับแคบ \| Fixmee |
| /exercises/db-close-grip-dumbbell-press | ดันดัมเบลจับชิด \| Fixmee |
| /exercises/db-close-grip-ez-bar-curl-with-band | Close-Grip EZ-Bar Curl with Band \| Fixmee |
| /exercises/db-close-grip-ez-bar-press | Close-Grip EZ-Bar Press \| Fixmee |
| /exercises/db-close-grip-ez-bar-curl | Close-Grip EZ Bar Curl \| Fixmee |
| /exercises/db-close-grip-front-lat-pulldown | ดึงเคเบิลลงด้านหน้าจับแคบ \| Fixmee |
| /exercises/db-close-grip-push-up-off-of-a-dumbbell | Close-Grip Push-Up off of a Dumbbell \| Fixmee |
| /exercises/db-close-grip-standing-barbell-curl | Close-Grip Standing Barbell Curl \| Fixmee |
| /exercises/db-cocoons | Cocoons \| Fixmee |
| /exercises/db-conans-wheel | Conan's Wheel \| Fixmee |
| /exercises/db-concentration-curls | Concentration Curls \| Fixmee |
| /exercises/db-cross-body-crunch | ครันช์บิดลำตัว \| Fixmee |
| /exercises/db-cross-body-hammer-curl | Cross Body Hammer Curl \| Fixmee |
| /exercises/db-cross-over-with-bands | Cross Over - With Bands \| Fixmee |
| /exercises/db-crossover-reverse-lunge | Crossover Reverse Lunge \| Fixmee |
| /exercises/db-crucifix | Crucifix \| Fixmee |
| /exercises/db-crunch-hands-overhead | Crunch - Hands Overhead \| Fixmee |
| /exercises/db-crunch-legs-on-exercise-ball | Crunch - Legs On Exercise Ball \| Fixmee |
| /exercises/db-crunches | ครันช์หน้าท้อง \| Fixmee |
| /exercises/db-cuban-press | Cuban Press \| Fixmee |
| /exercises/db-dancers-stretch | Dancer's Stretch \| Fixmee |
| /exercises/db-dead-bug | Dead Bug \| Fixmee |
| /exercises/db-deadlift-with-bands | Deadlift with Bands \| Fixmee |
| /exercises/db-deadlift-with-chains | Deadlift with Chains \| Fixmee |
| /exercises/db-decline-barbell-bench-press | ดันบาร์เบลม้านั่งเอียงลง \| Fixmee |
| /exercises/db-decline-close-grip-bench-to-skull-crusher | Decline Close-Grip Bench To Skull Crusher \| Fixmee |
| /exercises/db-decline-crunch | ครันช์ม้านั่งเอียงลง \| Fixmee |
| /exercises/db-decline-dumbbell-bench-press | ดันดัมเบลม้านั่งเอียงลง \| Fixmee |
| /exercises/db-decline-dumbbell-flyes | กางอกดัมเบลม้านั่งเอียงลง \| Fixmee |
| /exercises/db-decline-dumbbell-triceps-extension | Decline Dumbbell Triceps Extension \| Fixmee |
| /exercises/db-decline-ez-bar-triceps-extension | Decline EZ Bar Triceps Extension \| Fixmee |
| /exercises/db-decline-oblique-crunch | Decline Oblique Crunch \| Fixmee |
| /exercises/db-decline-push-up | วิดพื้นเท้าสูง \| Fixmee |
| /exercises/db-decline-reverse-crunch | Decline Reverse Crunch \| Fixmee |
| /exercises/db-decline-smith-press | Decline Smith Press \| Fixmee |
| /exercises/db-deficit-deadlift | Deficit Deadlift \| Fixmee |
| /exercises/db-depth-jump-leap | Depth Jump Leap \| Fixmee |
| /exercises/db-dip-machine | Dip Machine \| Fixmee |
| /exercises/db-dips-chest-version | Dips - Chest Version \| Fixmee |
| /exercises/db-dips-triceps-version | Dips - Triceps Version \| Fixmee |
| /exercises/db-donkey-calf-raises | Donkey Calf Raises \| Fixmee |
| /exercises/db-double-kettlebell-alternating-hang-clean | Double Kettlebell Alternating Hang Clean \| Fixmee |
| /exercises/db-double-kettlebell-jerk | Double Kettlebell Jerk \| Fixmee |
| /exercises/db-double-kettlebell-push-press | Double Kettlebell Push Press \| Fixmee |
| /exercises/db-double-kettlebell-snatch | Double Kettlebell Snatch \| Fixmee |
| /exercises/db-double-kettlebell-windmill | Double Kettlebell Windmill \| Fixmee |
| /exercises/db-double-leg-butt-kick | Double Leg Butt Kick \| Fixmee |
| /exercises/db-downward-facing-balance | Downward Facing Balance \| Fixmee |
| /exercises/db-drag-curl | Drag Curl \| Fixmee |
| /exercises/db-drop-push | Drop Push \| Fixmee |
| /exercises/db-dumbbell-alternate-bicep-curl | ไบเซปเคิร์ลดัมเบลสลับแขน \| Fixmee |
| /exercises/db-dumbbell-bench-press | เบนช์เพรสดัมเบล \| Fixmee |
| /exercises/db-dumbbell-bench-press-with-neutral-grip | เบนช์เพรสดัมเบลฝ่ามือเข้าหากัน \| Fixmee |
| /exercises/db-dumbbell-bicep-curl | ไบเซปเคิร์ลดัมเบล \| Fixmee |
| /exercises/db-dumbbell-clean | Dumbbell Clean \| Fixmee |
| /exercises/db-dumbbell-floor-press | นอนพื้นดันดัมเบล \| Fixmee |
| /exercises/db-dumbbell-flyes | กางอกดัมเบล \| Fixmee |
| /exercises/db-dumbbell-incline-row | ดึงดัมเบลบนม้านั่งเอียง \| Fixmee |
| /exercises/db-dumbbell-incline-shoulder-raise | Dumbbell Incline Shoulder Raise \| Fixmee |
| /exercises/db-dumbbell-lunges | ลันจ์ดัมเบล \| Fixmee |
| /exercises/db-dumbbell-lying-one-arm-rear-lateral-raise | Dumbbell Lying One-Arm Rear Lateral Raise \| Fixmee |
| /exercises/db-dumbbell-lying-pronation | Dumbbell Lying Pronation \| Fixmee |
| /exercises/db-dumbbell-lying-rear-lateral-raise | Dumbbell Lying Rear Lateral Raise \| Fixmee |
| /exercises/db-dumbbell-lying-supination | Dumbbell Lying Supination \| Fixmee |
| /exercises/db-dumbbell-one-arm-shoulder-press | กดไหล่ดัมเบลข้างเดียว \| Fixmee |
| /exercises/db-dumbbell-one-arm-triceps-extension | เหยียดหลังแขนดัมเบลข้างเดียว \| Fixmee |
| /exercises/db-dumbbell-one-arm-upright-row | ดึงดัมเบลขึ้นแนวตั้งข้างเดียว \| Fixmee |
| /exercises/db-dumbbell-prone-incline-curl | คว่ำตัวบนม้านั่งเอียงเคิร์ลดัมเบล \| Fixmee |
| /exercises/db-dumbbell-raise | Dumbbell Raise \| Fixmee |
| /exercises/db-dumbbell-rear-lunge | ลันจ์ถอยหลังดัมเบล \| Fixmee |
| /exercises/db-dumbbell-scaption | Dumbbell Scaption \| Fixmee |
| /exercises/db-dumbbell-seated-box-jump | Dumbbell Seated Box Jump \| Fixmee |
| /exercises/db-dumbbell-seated-one-leg-calf-raise | นั่งเขย่งน่องดัมเบลข้างเดียว \| Fixmee |
| /exercises/db-dumbbell-shoulder-press | กดไหล่ดัมเบล \| Fixmee |
| /exercises/db-dumbbell-shrug | ยักไหล่ดัมเบล \| Fixmee |
| /exercises/db-dumbbell-side-bend | เอียงลำตัวด้านข้างดัมเบล \| Fixmee |
| /exercises/db-dumbbell-squat | สควอทดัมเบล \| Fixmee |
| /exercises/db-dumbbell-squat-to-a-bench | สควอทดัมเบลแตะม้านั่ง \| Fixmee |
| /exercises/db-dumbbell-step-ups | ก้าวขึ้นแท่นดัมเบล \| Fixmee |
| /exercises/db-dumbbell-tricep-extension-pronated-grip | Dumbbell Tricep Extension -Pronated Grip \| Fixmee |
| /exercises/db-dynamic-back-stretch | Dynamic Back Stretch \| Fixmee |
| /exercises/db-dynamic-chest-stretch | Dynamic Chest Stretch \| Fixmee |
| /exercises/db-ez-bar-curl | EZ-Bar Curl \| Fixmee |
| /exercises/db-ez-bar-skullcrusher | EZ-Bar Skullcrusher \| Fixmee |
| /exercises/db-elbow-circles | Elbow Circles \| Fixmee |
| /exercises/db-elbow-to-knee | Elbow to Knee \| Fixmee |
| /exercises/db-elbows-back | Elbows Back \| Fixmee |
| /exercises/db-elevated-back-lunge | Elevated Back Lunge \| Fixmee |
| /exercises/db-elevated-cable-rows | Elevated Cable Rows \| Fixmee |
| /exercises/db-elliptical-trainer | Elliptical Trainer \| Fixmee |
| /exercises/db-exercise-ball-crunch | ครันช์บนบอล \| Fixmee |
| /exercises/db-exercise-ball-pull-in | Exercise Ball Pull-In \| Fixmee |
| /exercises/db-extended-range-one-arm-kettlebell-floor-press | Extended Range One-Arm Kettlebell Floor Press \| Fixmee |
| /exercises/db-external-rotation | External Rotation \| Fixmee |
| /exercises/db-external-rotation-with-band | External Rotation with Band \| Fixmee |
| /exercises/db-external-rotation-with-cable | External Rotation with Cable \| Fixmee |
| /exercises/db-face-pull | ดึงเคเบิลเข้าหาใบหน้า \| Fixmee |
| /exercises/db-farmers-walk | Farmer's Walk \| Fixmee |
| /exercises/db-fast-skipping | Fast Skipping \| Fixmee |
| /exercises/db-finger-curls | Finger Curls \| Fixmee |
| /exercises/db-flat-bench-cable-flyes | Flat Bench Cable Flyes \| Fixmee |
| /exercises/db-flat-bench-leg-pull-in | Flat Bench Leg Pull-In \| Fixmee |
| /exercises/db-flat-bench-lying-leg-raise | นอนม้านั่งยกขา \| Fixmee |
| /exercises/db-flexor-incline-dumbbell-curls | Flexor Incline Dumbbell Curls \| Fixmee |
| /exercises/db-floor-glute-ham-raise | Floor Glute-Ham Raise \| Fixmee |
| /exercises/db-floor-press | Floor Press \| Fixmee |
| /exercises/db-floor-press-with-chains | Floor Press with Chains \| Fixmee |
| /exercises/db-flutter-kicks | Flutter Kicks \| Fixmee |
| /exercises/db-foot-smr | Foot-SMR \| Fixmee |
| /exercises/db-forward-drag-with-press | Forward Drag with Press \| Fixmee |
| /exercises/db-frankenstein-squat | Frankenstein Squat \| Fixmee |
| /exercises/db-freehand-jump-squat | กระโดดสควอทน้ำหนักตัว \| Fixmee |
| /exercises/db-frog-hops | Frog Hops \| Fixmee |
| /exercises/db-frog-sit-ups | Frog Sit-Ups \| Fixmee |
| /exercises/db-front-barbell-squat | ฟรอนต์สควอทบาร์เบล \| Fixmee |
| /exercises/db-front-barbell-squat-to-a-bench | Front Barbell Squat To A Bench \| Fixmee |
| /exercises/db-front-box-jump | Front Box Jump \| Fixmee |
| /exercises/db-front-cable-raise | ยกเคเบิลด้านหน้า \| Fixmee |
| /exercises/db-front-cone-hops-or-hurdle-hops | Front Cone Hops (or hurdle hops) \| Fixmee |
| /exercises/db-front-dumbbell-raise | ยกดัมเบลด้านหน้า \| Fixmee |
| /exercises/db-front-incline-dumbbell-raise | Front Incline Dumbbell Raise \| Fixmee |
| /exercises/db-front-leg-raises | Front Leg Raises \| Fixmee |
| /exercises/db-front-plate-raise | Front Plate Raise \| Fixmee |
| /exercises/db-front-raise-and-pullover | Front Raise And Pullover \| Fixmee |
| /exercises/db-front-squat-clean-grip | ฟรอนต์สควอทจับแบบคลีน \| Fixmee |
| /exercises/db-front-squats-with-two-kettlebells | Front Squats With Two Kettlebells \| Fixmee |
| /exercises/db-front-two-dumbbell-raise | Front Two-Dumbbell Raise \| Fixmee |
| /exercises/db-full-range-of-motion-lat-pulldown | Full Range-Of-Motion Lat Pulldown \| Fixmee |
| /exercises/db-gironda-sternum-chins | Gironda Sternum Chins \| Fixmee |
| /exercises/db-glute-ham-raise | Glute Ham Raise \| Fixmee |
| /exercises/db-glute-kickback | Glute Kickback \| Fixmee |
| /exercises/db-goblet-squat | กอบเลตสควอท \| Fixmee |
| /exercises/db-good-morning | Good Morning \| Fixmee |
| /exercises/db-good-morning-off-pins | Good Morning off Pins \| Fixmee |
| /exercises/db-gorilla-chin-crunch | Gorilla Chin/Crunch \| Fixmee |
| /exercises/db-groin-and-back-stretch | Groin and Back Stretch \| Fixmee |
| /exercises/db-groiners | Groiners \| Fixmee |
| /exercises/db-hack-squat | แฮกสควอท \| Fixmee |
| /exercises/db-hammer-curls | Hammer Curls \| Fixmee |
| /exercises/db-hammer-grip-incline-db-bench-press | Hammer Grip Incline DB Bench Press \| Fixmee |
| /exercises/db-hamstring-smr | Hamstring-SMR \| Fixmee |
| /exercises/db-hamstring-stretch | Hamstring Stretch \| Fixmee |
| /exercises/db-handstand-push-ups | Handstand Push-Ups \| Fixmee |
| /exercises/db-hang-clean | Hang Clean \| Fixmee |
| /exercises/db-hang-clean-below-the-knees | Hang Clean - Below the Knees \| Fixmee |
| /exercises/db-hang-snatch | Hang Snatch \| Fixmee |
| /exercises/db-hang-snatch-below-knees | Hang Snatch - Below Knees \| Fixmee |
| /exercises/db-hanging-bar-good-morning | Hanging Bar Good Morning \| Fixmee |
| /exercises/db-hanging-leg-raise | ห้อยบาร์ยกขา \| Fixmee |
| /exercises/db-hanging-pike | Hanging Pike \| Fixmee |
| /exercises/db-heaving-snatch-balance | Heaving Snatch Balance \| Fixmee |
| /exercises/db-heavy-bag-thrust | Heavy Bag Thrust \| Fixmee |
| /exercises/db-high-cable-curls | High Cable Curls \| Fixmee |
| /exercises/db-hip-circles-prone | Hip Circles (prone) \| Fixmee |
| /exercises/db-hip-extension-with-bands | Hip Extension with Bands \| Fixmee |
| /exercises/db-hip-flexion-with-band | Hip Flexion with Band \| Fixmee |
| /exercises/db-hip-lift-with-band | Hip Lift with Band \| Fixmee |
| /exercises/db-hug-a-ball | Hug A Ball \| Fixmee |
| /exercises/db-hug-knees-to-chest | Hug Knees To Chest \| Fixmee |
| /exercises/db-hurdle-hops | Hurdle Hops \| Fixmee |
| /exercises/db-hyperextensions-back-extensions | Hyperextensions (Back Extensions) \| Fixmee |
| /exercises/db-hyperextensions-with-no-hyperextension-bench | Hyperextensions With No Hyperextension Bench \| Fixmee |
| /exercises/db-it-band-and-glute-stretch | IT Band and Glute Stretch \| Fixmee |
| /exercises/db-iliotibial-tract-smr | Iliotibial Tract-SMR \| Fixmee |
| /exercises/db-inchworm | Inchworm \| Fixmee |
| /exercises/db-incline-barbell-triceps-extension | Incline Barbell Triceps Extension \| Fixmee |
| /exercises/db-incline-bench-pull | Incline Bench Pull \| Fixmee |
| /exercises/db-incline-cable-chest-press | Incline Cable Chest Press \| Fixmee |
| /exercises/db-incline-cable-flye | Incline Cable Flye \| Fixmee |
| /exercises/db-incline-dumbbell-bench-with-palms-facing-in | Incline Dumbbell Bench With Palms Facing In \| Fixmee |
| /exercises/db-incline-dumbbell-curl | เคิร์ลดัมเบลม้านั่งเอียง \| Fixmee |
| /exercises/db-incline-dumbbell-flyes | กางอกดัมเบลม้านั่งเอียงขึ้น \| Fixmee |
| /exercises/db-incline-dumbbell-flyes-with-a-twist | Incline Dumbbell Flyes - With A Twist \| Fixmee |
| /exercises/db-incline-dumbbell-press | ดันดัมเบลม้านั่งเอียงขึ้น \| Fixmee |
| /exercises/db-incline-hammer-curls | Incline Hammer Curls \| Fixmee |
| /exercises/db-incline-inner-biceps-curl | Incline Inner Biceps Curl \| Fixmee |
| /exercises/db-incline-push-up | วิดพื้นมือบนแท่น \| Fixmee |
| /exercises/db-incline-push-up-close-grip | วิดพื้นมือบนแท่นจับแคบ \| Fixmee |
| /exercises/db-incline-push-up-depth-jump | Incline Push-Up Depth Jump \| Fixmee |
| /exercises/db-incline-push-up-medium | Incline Push-Up Medium \| Fixmee |
| /exercises/db-incline-push-up-reverse-grip | Incline Push-Up Reverse Grip \| Fixmee |
| /exercises/db-incline-push-up-wide | Incline Push-Up Wide \| Fixmee |
| /exercises/db-intermediate-groin-stretch | Intermediate Groin Stretch \| Fixmee |
| /exercises/db-intermediate-hip-flexor-and-quad-stretch | Intermediate Hip Flexor and Quad Stretch \| Fixmee |
| /exercises/db-internal-rotation-with-band | Internal Rotation with Band \| Fixmee |
| /exercises/db-inverted-row | Inverted Row \| Fixmee |
| /exercises/db-inverted-row-with-straps | Inverted Row with Straps \| Fixmee |
| /exercises/db-iron-cross | Iron Cross \| Fixmee |
| /exercises/db-iron-crosses-stretch | Iron Crosses (stretch) \| Fixmee |
| /exercises/db-isometric-chest-squeezes | Isometric Chest Squeezes \| Fixmee |
| /exercises/db-isometric-neck-exercise-front-and-back | Isometric Neck Exercise - Front And Back \| Fixmee |
| /exercises/db-isometric-neck-exercise-sides | Isometric Neck Exercise - Sides \| Fixmee |
| /exercises/db-isometric-wipers | Isometric Wipers \| Fixmee |
| /exercises/db-jm-press | JM Press \| Fixmee |
| /exercises/db-jackknife-sit-up | Jackknife Sit-Up \| Fixmee |
| /exercises/db-janda-sit-up | Janda Sit-Up \| Fixmee |
| /exercises/db-jefferson-squats | Jefferson Squats \| Fixmee |
| /exercises/db-jerk-balance | Jerk Balance \| Fixmee |
| /exercises/db-jerk-dip-squat | Jerk Dip Squat \| Fixmee |
| /exercises/db-jogging-treadmill | Jogging, Treadmill \| Fixmee |
| /exercises/db-keg-load | Keg Load \| Fixmee |
| /exercises/db-kettlebell-arnold-press | Kettlebell Arnold Press \| Fixmee |
| /exercises/db-kettlebell-dead-clean | Kettlebell Dead Clean \| Fixmee |
| /exercises/db-kettlebell-figure-8 | Kettlebell Figure 8 \| Fixmee |
| /exercises/db-kettlebell-halo | Kettlebell Halo \| Fixmee |
| /exercises/db-kettlebell-halo-with-overhead-extension | Kettlebell Halo with Overhead Extension \| Fixmee |
| /exercises/db-kettlebell-hang-clean | Kettlebell Hang Clean \| Fixmee |
| /exercises/db-kettlebell-one-legged-deadlift | Kettlebell One-Legged Deadlift \| Fixmee |
| /exercises/db-kettlebell-overhead-triceps-extension | Kettlebell Overhead Triceps Extension \| Fixmee |
| /exercises/db-kettlebell-pass-between-the-legs | Kettlebell Pass Between The Legs \| Fixmee |
| /exercises/db-kettlebell-pirate-ships | Kettlebell Pirate Ships \| Fixmee |
| /exercises/db-kettlebell-pistol-squat | Kettlebell Pistol Squat \| Fixmee |
| /exercises/db-kettlebell-seated-press | Kettlebell Seated Press \| Fixmee |
| /exercises/db-kettlebell-seesaw-press | Kettlebell Seesaw Press \| Fixmee |
| /exercises/db-kettlebell-sumo-high-pull | Kettlebell Sumo High Pull \| Fixmee |
| /exercises/db-kettlebell-thruster | Kettlebell Thruster \| Fixmee |
| /exercises/db-kettlebell-turkish-get-up-lunge-style | Kettlebell Turkish Get-Up (Lunge style) \| Fixmee |
| /exercises/db-kettlebell-turkish-get-up-squat-style | Kettlebell Turkish Get-Up (Squat style) \| Fixmee |
| /exercises/db-kettlebell-windmill | Kettlebell Windmill \| Fixmee |
| /exercises/db-kipping-muscle-up | Kipping Muscle Up \| Fixmee |
| /exercises/db-knee-across-the-body | Knee Across The Body \| Fixmee |
| /exercises/db-knee-circles | Knee Circles \| Fixmee |
| /exercises/db-knee-hip-raise-on-parallel-bars | Knee/Hip Raise On Parallel Bars \| Fixmee |
| /exercises/db-knee-tuck-jump | Knee Tuck Jump \| Fixmee |
| /exercises/db-kneeling-arm-drill | Kneeling Arm Drill \| Fixmee |
| /exercises/db-kneeling-cable-crunch-with-alternating-oblique-twists | Kneeling Cable Crunch With Alternating Oblique Twi \| Fixmee |
| /exercises/db-kneeling-cable-triceps-extension | Kneeling Cable Triceps Extension \| Fixmee |
| /exercises/db-kneeling-forearm-stretch | Kneeling Forearm Stretch \| Fixmee |
| /exercises/db-kneeling-high-pulley-row | Kneeling High Pulley Row \| Fixmee |
| /exercises/db-kneeling-hip-flexor | Kneeling Hip Flexor \| Fixmee |
| /exercises/db-kneeling-jump-squat | Kneeling Jump Squat \| Fixmee |
| /exercises/db-kneeling-single-arm-high-pulley-row | Kneeling Single-Arm High Pulley Row \| Fixmee |
| /exercises/db-kneeling-squat | Kneeling Squat \| Fixmee |
| /exercises/db-landmine-180s | Landmine 180's \| Fixmee |
| /exercises/db-landmine-linear-jammer | Landmine Linear Jammer \| Fixmee |
| /exercises/db-lateral-bound | Lateral Bound \| Fixmee |
| /exercises/db-lateral-box-jump | Lateral Box Jump \| Fixmee |
| /exercises/db-lateral-cone-hops | Lateral Cone Hops \| Fixmee |
| /exercises/db-lateral-raise-with-bands | Lateral Raise - With Bands \| Fixmee |
| /exercises/db-latissimus-dorsi-smr | Latissimus Dorsi-SMR \| Fixmee |
| /exercises/db-leg-over-floor-press | Leg-Over Floor Press \| Fixmee |
| /exercises/db-leg-up-hamstring-stretch | Leg-Up Hamstring Stretch \| Fixmee |
| /exercises/db-leg-extensions | เครื่องเหยียดเข่า \| Fixmee |
| /exercises/db-leg-lift | Leg Lift \| Fixmee |
| /exercises/db-leg-press | เครื่องดันขา \| Fixmee |
| /exercises/db-leg-pull-in | Leg Pull-In \| Fixmee |
| /exercises/db-leverage-chest-press | Leverage Chest Press \| Fixmee |
| /exercises/db-leverage-deadlift | Leverage Deadlift \| Fixmee |
| /exercises/db-leverage-decline-chest-press | Leverage Decline Chest Press \| Fixmee |
| /exercises/db-leverage-high-row | Leverage High Row \| Fixmee |
| /exercises/db-leverage-incline-chest-press | Leverage Incline Chest Press \| Fixmee |
| /exercises/db-leverage-iso-row | Leverage Iso Row \| Fixmee |
| /exercises/db-leverage-shoulder-press | Leverage Shoulder Press \| Fixmee |
| /exercises/db-leverage-shrug | Leverage Shrug \| Fixmee |
| /exercises/db-linear-3-part-start-technique | Linear 3-Part Start Technique \| Fixmee |
| /exercises/db-linear-acceleration-wall-drill | Linear Acceleration Wall Drill \| Fixmee |
| /exercises/db-linear-depth-jump | Linear Depth Jump \| Fixmee |
| /exercises/db-log-lift | Log Lift \| Fixmee |
| /exercises/db-london-bridges | London Bridges \| Fixmee |
| /exercises/db-looking-at-ceiling | Looking At Ceiling \| Fixmee |
| /exercises/db-low-cable-crossover | Low Cable Crossover \| Fixmee |
| /exercises/db-low-cable-triceps-extension | Low Cable Triceps Extension \| Fixmee |
| /exercises/db-low-pulley-row-to-neck | Low Pulley Row To Neck \| Fixmee |
| /exercises/db-lower-back-smr | Lower Back-SMR \| Fixmee |
| /exercises/db-lower-back-curl | Lower Back Curl \| Fixmee |
| /exercises/db-lunge-pass-through | Lunge Pass Through \| Fixmee |
| /exercises/db-lunge-sprint | Lunge Sprint \| Fixmee |
| /exercises/db-lying-bent-leg-groin | Lying Bent Leg Groin \| Fixmee |
| /exercises/db-lying-cable-curl | Lying Cable Curl \| Fixmee |
| /exercises/db-lying-cambered-barbell-row | Lying Cambered Barbell Row \| Fixmee |
| /exercises/db-lying-close-grip-bar-curl-on-high-pulley | Lying Close-Grip Bar Curl On High Pulley \| Fixmee |
| /exercises/db-lying-close-grip-barbell-triceps-extension-behind-the-head | Lying Close-Grip Barbell Triceps Extension Behind  \| Fixmee |
| /exercises/db-lying-close-grip-barbell-triceps-press-to-chin | Lying Close-Grip Barbell Triceps Press To Chin \| Fixmee |
| /exercises/db-lying-crossover | Lying Crossover \| Fixmee |
| /exercises/db-lying-dumbbell-tricep-extension | นอนเหยียดหลังแขนดัมเบล \| Fixmee |
| /exercises/db-lying-face-down-plate-neck-resistance | Lying Face Down Plate Neck Resistance \| Fixmee |
| /exercises/db-lying-face-up-plate-neck-resistance | Lying Face Up Plate Neck Resistance \| Fixmee |
| /exercises/db-lying-glute | Lying Glute \| Fixmee |
| /exercises/db-lying-hamstring | Lying Hamstring \| Fixmee |
| /exercises/db-lying-high-bench-barbell-curl | Lying High Bench Barbell Curl \| Fixmee |
| /exercises/db-lying-leg-curls | นอนคว่ำงอเข่าเครื่อง \| Fixmee |
| /exercises/db-lying-machine-squat | Lying Machine Squat \| Fixmee |
| /exercises/db-lying-one-arm-lateral-raise | Lying One-Arm Lateral Raise \| Fixmee |
| /exercises/db-lying-prone-quadriceps | Lying Prone Quadriceps \| Fixmee |
| /exercises/db-lying-rear-delt-raise | Lying Rear Delt Raise \| Fixmee |
| /exercises/db-lying-supine-dumbbell-curl | Lying Supine Dumbbell Curl \| Fixmee |
| /exercises/db-lying-t-bar-row | Lying T-Bar Row \| Fixmee |
| /exercises/db-lying-triceps-press | นอนกดหลังแขน \| Fixmee |
| /exercises/db-machine-bench-press | Machine Bench Press \| Fixmee |
| /exercises/db-machine-bicep-curl | Machine Bicep Curl \| Fixmee |
| /exercises/db-machine-preacher-curls | Machine Preacher Curls \| Fixmee |
| /exercises/db-machine-shoulder-military-press | Machine Shoulder (Military) Press \| Fixmee |
| /exercises/db-machine-triceps-extension | Machine Triceps Extension \| Fixmee |
| /exercises/db-medicine-ball-chest-pass | Medicine Ball Chest Pass \| Fixmee |
| /exercises/db-medicine-ball-full-twist | Medicine Ball Full Twist \| Fixmee |
| /exercises/db-medicine-ball-scoop-throw | Medicine Ball Scoop Throw \| Fixmee |
| /exercises/db-middle-back-shrug | Middle Back Shrug \| Fixmee |
| /exercises/db-middle-back-stretch | Middle Back Stretch \| Fixmee |
| /exercises/db-mixed-grip-chin | Mixed Grip Chin \| Fixmee |
| /exercises/db-monster-walk | Monster Walk \| Fixmee |
| /exercises/db-mountain-climbers | Mountain Climbers \| Fixmee |
| /exercises/db-moving-claw-series | Moving Claw Series \| Fixmee |
| /exercises/db-muscle-snatch | Muscle Snatch \| Fixmee |
| /exercises/db-muscle-up | Muscle Up \| Fixmee |
| /exercises/db-narrow-stance-hack-squats | Narrow Stance Hack Squats \| Fixmee |
| /exercises/db-narrow-stance-leg-press | เครื่องดันขาวางเท้าแคบ \| Fixmee |
| /exercises/db-narrow-stance-squats | Narrow Stance Squats \| Fixmee |
| /exercises/db-natural-glute-ham-raise | Natural Glute Ham Raise \| Fixmee |
| /exercises/db-neck-smr | Neck-SMR \| Fixmee |
| /exercises/db-neck-press | Neck Press \| Fixmee |
| /exercises/db-oblique-crunches | ครันช์ท้องด้านข้าง \| Fixmee |
| /exercises/db-oblique-crunches-on-the-floor | ครันช์ท้องด้านข้างบนพื้น \| Fixmee |
| /exercises/db-olympic-squat | Olympic Squat \| Fixmee |
| /exercises/db-on-your-back-quad-stretch | On-Your-Back Quad Stretch \| Fixmee |
| /exercises/db-on-your-side-quad-stretch | On Your Side Quad Stretch \| Fixmee |
| /exercises/db-one-arm-dumbbell-row | ดึงดัมเบลข้างเดียว \| Fixmee |
| /exercises/db-one-arm-flat-bench-dumbbell-flye | One-Arm Flat Bench Dumbbell Flye \| Fixmee |
| /exercises/db-one-arm-high-pulley-cable-side-bends | One-Arm High-Pulley Cable Side Bends \| Fixmee |
| /exercises/db-one-arm-incline-lateral-raise | One-Arm Incline Lateral Raise \| Fixmee |
| /exercises/db-one-arm-kettlebell-clean | One-Arm Kettlebell Clean \| Fixmee |
| /exercises/db-one-arm-kettlebell-clean-and-jerk | One-Arm Kettlebell Clean and Jerk \| Fixmee |
| /exercises/db-one-arm-kettlebell-floor-press | One-Arm Kettlebell Floor Press \| Fixmee |
| /exercises/db-one-arm-kettlebell-jerk | One-Arm Kettlebell Jerk \| Fixmee |
| /exercises/db-one-arm-kettlebell-military-press-to-the-side | One-Arm Kettlebell Military Press To The Side \| Fixmee |
| /exercises/db-one-arm-kettlebell-para-press | One-Arm Kettlebell Para Press \| Fixmee |
| /exercises/db-one-arm-kettlebell-push-press | One-Arm Kettlebell Push Press \| Fixmee |
| /exercises/db-one-arm-kettlebell-row | One-Arm Kettlebell Row \| Fixmee |
| /exercises/db-one-arm-kettlebell-snatch | One-Arm Kettlebell Snatch \| Fixmee |
| /exercises/db-one-arm-kettlebell-split-jerk | One-Arm Kettlebell Split Jerk \| Fixmee |
| /exercises/db-one-arm-kettlebell-split-snatch | One-Arm Kettlebell Split Snatch \| Fixmee |
| /exercises/db-one-arm-kettlebell-swings | One-Arm Kettlebell Swings \| Fixmee |
| /exercises/db-one-arm-long-bar-row | One-Arm Long Bar Row \| Fixmee |
| /exercises/db-one-arm-medicine-ball-slam | One-Arm Medicine Ball Slam \| Fixmee |
| /exercises/db-one-arm-open-palm-kettlebell-clean | One-Arm Open Palm Kettlebell Clean \| Fixmee |
| /exercises/db-one-arm-overhead-kettlebell-squats | One-Arm Overhead Kettlebell Squats \| Fixmee |
| /exercises/db-one-arm-side-deadlift | One-Arm Side Deadlift \| Fixmee |
| /exercises/db-one-arm-side-laterals | One-Arm Side Laterals \| Fixmee |
| /exercises/db-one-legged-cable-kickback | One-Legged Cable Kickback \| Fixmee |
| /exercises/db-one-arm-against-wall | One Arm Against Wall \| Fixmee |
| /exercises/db-one-arm-chin-up | One Arm Chin-Up \| Fixmee |
| /exercises/db-one-arm-dumbbell-bench-press | One Arm Dumbbell Bench Press \| Fixmee |
| /exercises/db-one-arm-dumbbell-preacher-curl | One Arm Dumbbell Preacher Curl \| Fixmee |
| /exercises/db-one-arm-floor-press | One Arm Floor Press \| Fixmee |
| /exercises/db-one-arm-lat-pulldown | ดึงเคเบิลลงข้างเดียว \| Fixmee |
| /exercises/db-one-arm-pronated-dumbbell-triceps-extension | One Arm Pronated Dumbbell Triceps Extension \| Fixmee |
| /exercises/db-one-arm-supinated-dumbbell-triceps-extension | One Arm Supinated Dumbbell Triceps Extension \| Fixmee |
| /exercises/db-one-half-locust | One Half Locust \| Fixmee |
| /exercises/db-one-handed-hang | One Handed Hang \| Fixmee |
| /exercises/db-one-knee-to-chest | One Knee To Chest \| Fixmee |
| /exercises/db-one-leg-barbell-squat | One Leg Barbell Squat \| Fixmee |
| /exercises/db-open-palm-kettlebell-clean | Open Palm Kettlebell Clean \| Fixmee |
| /exercises/db-otis-up | Otis-Up \| Fixmee |
| /exercises/db-overhead-cable-curl | Overhead Cable Curl \| Fixmee |
| /exercises/db-overhead-lat | Overhead Lat \| Fixmee |
| /exercises/db-overhead-slam | Overhead Slam \| Fixmee |
| /exercises/db-overhead-squat | Overhead Squat \| Fixmee |
| /exercises/db-overhead-stretch | Overhead Stretch \| Fixmee |
| /exercises/db-overhead-triceps | Overhead Triceps \| Fixmee |
| /exercises/db-pallof-press | Pallof Press \| Fixmee |
| /exercises/db-pallof-press-with-rotation | Pallof Press With Rotation \| Fixmee |
| /exercises/db-palms-down-dumbbell-wrist-curl-over-a-bench | งอข้อมือดัมเบลคว่ำมือบนม้านั่ง \| Fixmee |
| /exercises/db-palms-down-wrist-curl-over-a-bench | Palms-Down Wrist Curl Over A Bench \| Fixmee |
| /exercises/db-palms-up-barbell-wrist-curl-over-a-bench | Palms-Up Barbell Wrist Curl Over A Bench \| Fixmee |
| /exercises/db-palms-up-dumbbell-wrist-curl-over-a-bench | งอข้อมือดัมเบลหงายมือบนม้านั่ง \| Fixmee |
| /exercises/db-parallel-bar-dip | Parallel Bar Dip \| Fixmee |
| /exercises/db-pelvic-tilt-into-bridge | Pelvic Tilt Into Bridge \| Fixmee |
| /exercises/db-peroneals-smr | Peroneals-SMR \| Fixmee |
| /exercises/db-peroneals-stretch | Peroneals Stretch \| Fixmee |
| /exercises/db-physioball-hip-bridge | Physioball Hip Bridge \| Fixmee |
| /exercises/db-pin-presses | Pin Presses \| Fixmee |
| /exercises/db-piriformis-smr | Piriformis-SMR \| Fixmee |
| /exercises/db-plank | แพลงก์ \| Fixmee |
| /exercises/db-plate-pinch | Plate Pinch \| Fixmee |
| /exercises/db-plate-twist | Plate Twist \| Fixmee |
| /exercises/db-platform-hamstring-slides | Platform Hamstring Slides \| Fixmee |
| /exercises/db-plie-dumbbell-squat | Plie Dumbbell Squat \| Fixmee |
| /exercises/db-plyo-kettlebell-pushups | Plyo Kettlebell Pushups \| Fixmee |
| /exercises/db-plyo-push-up | Plyo Push-up \| Fixmee |
| /exercises/db-posterior-tibialis-stretch | Posterior Tibialis Stretch \| Fixmee |
| /exercises/db-power-clean | Power Clean \| Fixmee |
| /exercises/db-power-clean-from-blocks | Power Clean from Blocks \| Fixmee |
| /exercises/db-power-jerk | Power Jerk \| Fixmee |
| /exercises/db-power-partials | Power Partials \| Fixmee |
| /exercises/db-power-snatch | Power Snatch \| Fixmee |
| /exercises/db-power-snatch-from-blocks | Power Snatch from Blocks \| Fixmee |
| /exercises/db-power-stairs | Power Stairs \| Fixmee |
| /exercises/db-preacher-curl | Preacher Curl \| Fixmee |
| /exercises/db-preacher-hammer-dumbbell-curl | Preacher Hammer Dumbbell Curl \| Fixmee |
| /exercises/db-press-sit-up | Press Sit-Up \| Fixmee |
| /exercises/db-prone-manual-hamstring | Prone Manual Hamstring \| Fixmee |
| /exercises/db-prowler-sprint | Prowler Sprint \| Fixmee |
| /exercises/db-pull-through | Pull Through \| Fixmee |
| /exercises/db-pullups | ดึงข้อคว่ำมือ \| Fixmee |
| /exercises/db-push-up-wide | วิดพื้นมือกว้าง \| Fixmee |
| /exercises/db-push-ups-close-triceps-position | วิดพื้นมือชิดเน้นหลังแขน \| Fixmee |
| /exercises/db-push-ups-with-feet-elevated | วิดพื้นยกเท้าสูง \| Fixmee |
| /exercises/db-push-ups-with-feet-on-an-exercise-ball | Push-Ups With Feet On An Exercise Ball \| Fixmee |
| /exercises/db-push-press | Push Press \| Fixmee |
| /exercises/db-push-press-behind-the-neck | Push Press - Behind the Neck \| Fixmee |
| /exercises/db-push-up-to-side-plank | Push Up to Side Plank \| Fixmee |
| /exercises/db-pushups | วิดพื้น \| Fixmee |
| /exercises/db-pushups-close-and-wide-hand-positions | Pushups (Close and Wide Hand Positions) \| Fixmee |
| /exercises/db-pyramid | Pyramid \| Fixmee |
| /exercises/db-quad-stretch | Quad Stretch \| Fixmee |
| /exercises/db-quadriceps-smr | Quadriceps-SMR \| Fixmee |
| /exercises/db-quick-leap | Quick Leap \| Fixmee |
| /exercises/db-rack-delivery | Rack Delivery \| Fixmee |
| /exercises/db-rack-pull-with-bands | Rack Pull with Bands \| Fixmee |
| /exercises/db-rack-pulls | Rack Pulls \| Fixmee |
| /exercises/db-rear-leg-raises | Rear Leg Raises \| Fixmee |
| /exercises/db-recumbent-bike | Recumbent Bike \| Fixmee |
| /exercises/db-return-push-from-stance | Return Push from Stance \| Fixmee |
| /exercises/db-reverse-band-bench-press | Reverse Band Bench Press \| Fixmee |
| /exercises/db-reverse-band-box-squat | Reverse Band Box Squat \| Fixmee |
| /exercises/db-reverse-band-deadlift | Reverse Band Deadlift \| Fixmee |
| /exercises/db-reverse-band-power-squat | Reverse Band Power Squat \| Fixmee |
| /exercises/db-reverse-band-sumo-deadlift | Reverse Band Sumo Deadlift \| Fixmee |
| /exercises/db-reverse-barbell-curl | เคิร์ลบาร์เบลคว่ำมือ \| Fixmee |
| /exercises/db-reverse-barbell-preacher-curls | Reverse Barbell Preacher Curls \| Fixmee |
| /exercises/db-reverse-cable-curl | เคิร์ลเคเบิลคว่ำมือ \| Fixmee |
| /exercises/db-reverse-crunch | รีเวิร์สครันช์ \| Fixmee |
| /exercises/db-reverse-flyes | Reverse Flyes \| Fixmee |
| /exercises/db-reverse-flyes-with-external-rotation | Reverse Flyes With External Rotation \| Fixmee |
| /exercises/db-reverse-grip-bent-over-rows | Reverse Grip Bent-Over Rows \| Fixmee |
| /exercises/db-reverse-grip-triceps-pushdown | เคเบิลกดหลังแขนหงายมือ \| Fixmee |
| /exercises/db-reverse-hyperextension | Reverse Hyperextension \| Fixmee |
| /exercises/db-reverse-machine-flyes | Reverse Machine Flyes \| Fixmee |
| /exercises/db-reverse-plate-curls | Reverse Plate Curls \| Fixmee |
| /exercises/db-reverse-triceps-bench-press | Reverse Triceps Bench Press \| Fixmee |
| /exercises/db-rhomboids-smr | Rhomboids-SMR \| Fixmee |
| /exercises/db-rickshaw-carry | Rickshaw Carry \| Fixmee |
| /exercises/db-rickshaw-deadlift | Rickshaw Deadlift \| Fixmee |
| /exercises/db-ring-dips | Ring Dips \| Fixmee |
| /exercises/db-rocket-jump | Rocket Jump \| Fixmee |
| /exercises/db-rocking-standing-calf-raise | Rocking Standing Calf Raise \| Fixmee |
| /exercises/db-rocky-pull-ups-pulldowns | Rocky Pull-Ups/Pulldowns \| Fixmee |
| /exercises/db-romanian-deadlift | Romanian Deadlift \| Fixmee |
| /exercises/db-romanian-deadlift-from-deficit | Romanian Deadlift from Deficit \| Fixmee |
| /exercises/db-rope-climb | Rope Climb \| Fixmee |
| /exercises/db-rope-crunch | ครันช์เชือก \| Fixmee |
| /exercises/db-rope-jumping | Rope Jumping \| Fixmee |
| /exercises/db-rope-straight-arm-pulldown | ดึงเคเบิลเชือกลงแขนตรง \| Fixmee |
| /exercises/db-round-the-world-shoulder-stretch | Round The World Shoulder Stretch \| Fixmee |
| /exercises/db-rowing-stationary | Rowing, Stationary \| Fixmee |
| /exercises/db-runners-stretch | Runner's Stretch \| Fixmee |
| /exercises/db-running-treadmill | Running, Treadmill \| Fixmee |
| /exercises/db-russian-twist | Russian Twist \| Fixmee |
| /exercises/db-sandbag-load | Sandbag Load \| Fixmee |
| /exercises/db-scapular-pull-up | ห้อยบาร์ดึงสะบัก \| Fixmee |
| /exercises/db-scissor-kick | Scissor Kick \| Fixmee |
| /exercises/db-scissors-jump | Scissors Jump \| Fixmee |
| /exercises/db-seated-band-hamstring-curl | Seated Band Hamstring Curl \| Fixmee |
| /exercises/db-seated-barbell-military-press | Seated Barbell Military Press \| Fixmee |
| /exercises/db-seated-barbell-twist | Seated Barbell Twist \| Fixmee |
| /exercises/db-seated-bent-over-one-arm-dumbbell-triceps-extension | Seated Bent-Over One-Arm Dumbbell Triceps Extensio \| Fixmee |
| /exercises/db-seated-bent-over-rear-delt-raise | นั่งก้มกางไหล่หลัง \| Fixmee |
| /exercises/db-seated-bent-over-two-arm-dumbbell-triceps-extension | Seated Bent-Over Two-Arm Dumbbell Triceps Extensio \| Fixmee |
| /exercises/db-seated-biceps | Seated Biceps \| Fixmee |
| /exercises/db-seated-cable-rows | นั่งดึงเคเบิล \| Fixmee |
| /exercises/db-seated-cable-shoulder-press | Seated Cable Shoulder Press \| Fixmee |
| /exercises/db-seated-calf-raise | นั่งเขย่งน่อง \| Fixmee |
| /exercises/db-seated-calf-stretch | Seated Calf Stretch \| Fixmee |
| /exercises/db-seated-close-grip-concentration-barbell-curl | Seated Close-Grip Concentration Barbell Curl \| Fixmee |
| /exercises/db-seated-dumbbell-curl | นั่งเคิร์ลดัมเบล \| Fixmee |
| /exercises/db-seated-dumbbell-inner-biceps-curl | Seated Dumbbell Inner Biceps Curl \| Fixmee |
| /exercises/db-seated-dumbbell-palms-down-wrist-curl | Seated Dumbbell Palms-Down Wrist Curl \| Fixmee |
| /exercises/db-seated-dumbbell-palms-up-wrist-curl | Seated Dumbbell Palms-Up Wrist Curl \| Fixmee |
| /exercises/db-seated-dumbbell-press | นั่งกดไหล่ดัมเบล \| Fixmee |
| /exercises/db-seated-flat-bench-leg-pull-in | Seated Flat Bench Leg Pull-In \| Fixmee |
| /exercises/db-seated-floor-hamstring-stretch | Seated Floor Hamstring Stretch \| Fixmee |
| /exercises/db-seated-front-deltoid | Seated Front Deltoid \| Fixmee |
| /exercises/db-seated-glute | Seated Glute \| Fixmee |
| /exercises/db-seated-good-mornings | Seated Good Mornings \| Fixmee |
| /exercises/db-seated-hamstring | Seated Hamstring \| Fixmee |
| /exercises/db-seated-hamstring-and-calf-stretch | Seated Hamstring and Calf Stretch \| Fixmee |
| /exercises/db-seated-head-harness-neck-resistance | Seated Head Harness Neck Resistance \| Fixmee |
| /exercises/db-seated-leg-curl | นั่งงอเข่าเครื่อง \| Fixmee |
| /exercises/db-seated-leg-tucks | Seated Leg Tucks \| Fixmee |
| /exercises/db-seated-one-arm-dumbbell-palms-down-wrist-curl | Seated One-Arm Dumbbell Palms-Down Wrist Curl \| Fixmee |
| /exercises/db-seated-one-arm-dumbbell-palms-up-wrist-curl | Seated One-Arm Dumbbell Palms-Up Wrist Curl \| Fixmee |
| /exercises/db-seated-one-arm-cable-pulley-rows | Seated One-arm Cable Pulley Rows \| Fixmee |
| /exercises/db-seated-overhead-stretch | Seated Overhead Stretch \| Fixmee |
| /exercises/db-seated-palm-up-barbell-wrist-curl | Seated Palm-Up Barbell Wrist Curl \| Fixmee |
| /exercises/db-seated-palms-down-barbell-wrist-curl | Seated Palms-Down Barbell Wrist Curl \| Fixmee |
| /exercises/db-seated-side-lateral-raise | นั่งกางไหล่ด้านข้าง \| Fixmee |
| /exercises/db-seated-triceps-press | นั่งเหยียดหลังแขนเหนือศีรษะ \| Fixmee |
| /exercises/db-seated-two-arm-palms-up-low-pulley-wrist-curl | Seated Two-Arm Palms-Up Low-Pulley Wrist Curl \| Fixmee |
| /exercises/db-see-saw-press-alternating-side-press | See-Saw Press (Alternating Side Press) \| Fixmee |
| /exercises/db-shotgun-row | Shotgun Row \| Fixmee |
| /exercises/db-shoulder-circles | Shoulder Circles \| Fixmee |
| /exercises/db-shoulder-press-with-bands | Shoulder Press - With Bands \| Fixmee |
| /exercises/db-shoulder-raise | Shoulder Raise \| Fixmee |
| /exercises/db-shoulder-stretch | Shoulder Stretch \| Fixmee |
| /exercises/db-side-lying-floor-stretch | Side-Lying Floor Stretch \| Fixmee |
| /exercises/db-side-bridge | Side Bridge \| Fixmee |
| /exercises/db-side-hop-sprint | Side Hop-Sprint \| Fixmee |
| /exercises/db-side-jackknife | Side Jackknife \| Fixmee |
| /exercises/db-side-lateral-raise | Side Lateral Raise \| Fixmee |
| /exercises/db-side-laterals-to-front-raise | Side Laterals to Front Raise \| Fixmee |
| /exercises/db-side-leg-raises | Side Leg Raises \| Fixmee |
| /exercises/db-side-lying-groin-stretch | Side Lying Groin Stretch \| Fixmee |
| /exercises/db-side-neck-stretch | Side Neck Stretch \| Fixmee |
| /exercises/db-side-standing-long-jump | Side Standing Long Jump \| Fixmee |
| /exercises/db-side-to-side-chins | Side To Side Chins \| Fixmee |
| /exercises/db-side-wrist-pull | Side Wrist Pull \| Fixmee |
| /exercises/db-side-to-side-box-shuffle | Side to Side Box Shuffle \| Fixmee |
| /exercises/db-single-arm-cable-crossover | Single-Arm Cable Crossover \| Fixmee |
| /exercises/db-single-arm-linear-jammer | Single-Arm Linear Jammer \| Fixmee |
| /exercises/db-single-arm-push-up | Single-Arm Push-Up \| Fixmee |
| /exercises/db-single-cone-sprint-drill | Single-Cone Sprint Drill \| Fixmee |
| /exercises/db-single-leg-high-box-squat | Single-Leg High Box Squat \| Fixmee |
| /exercises/db-single-leg-hop-progression | Single-Leg Hop Progression \| Fixmee |
| /exercises/db-single-leg-lateral-hop | Single-Leg Lateral Hop \| Fixmee |
| /exercises/db-single-leg-leg-extension | Single-Leg Leg Extension \| Fixmee |
| /exercises/db-single-leg-stride-jump | Single-Leg Stride Jump \| Fixmee |
| /exercises/db-single-dumbbell-raise | Single Dumbbell Raise \| Fixmee |
| /exercises/db-single-leg-butt-kick | Single Leg Butt Kick \| Fixmee |
| /exercises/db-single-leg-glute-bridge | สะพานก้นขาเดียว \| Fixmee |
| /exercises/db-single-leg-push-off | Single Leg Push-off \| Fixmee |
| /exercises/db-sit-up | Sit-Up \| Fixmee |
| /exercises/db-sit-squats | Sit Squats \| Fixmee |
| /exercises/db-skating | Skating \| Fixmee |
| /exercises/db-sled-drag-harness | Sled Drag - Harness \| Fixmee |
| /exercises/db-sled-overhead-backward-walk | Sled Overhead Backward Walk \| Fixmee |
| /exercises/db-sled-overhead-triceps-extension | Sled Overhead Triceps Extension \| Fixmee |
| /exercises/db-sled-push | Sled Push \| Fixmee |
| /exercises/db-sled-reverse-flye | Sled Reverse Flye \| Fixmee |
| /exercises/db-sled-row | Sled Row \| Fixmee |
| /exercises/db-sledgehammer-swings | Sledgehammer Swings \| Fixmee |
| /exercises/db-smith-incline-shoulder-raise | Smith Incline Shoulder Raise \| Fixmee |
| /exercises/db-smith-machine-behind-the-back-shrug | Smith Machine Behind the Back Shrug \| Fixmee |
| /exercises/db-smith-machine-bench-press | Smith Machine Bench Press \| Fixmee |
| /exercises/db-smith-machine-bent-over-row | Smith Machine Bent Over Row \| Fixmee |
| /exercises/db-smith-machine-calf-raise | Smith Machine Calf Raise \| Fixmee |
| /exercises/db-smith-machine-close-grip-bench-press | Smith Machine Close-Grip Bench Press \| Fixmee |
| /exercises/db-smith-machine-decline-press | Smith Machine Decline Press \| Fixmee |
| /exercises/db-smith-machine-hang-power-clean | Smith Machine Hang Power Clean \| Fixmee |
| /exercises/db-smith-machine-hip-raise | Smith Machine Hip Raise \| Fixmee |
| /exercises/db-smith-machine-incline-bench-press | Smith Machine Incline Bench Press \| Fixmee |
| /exercises/db-smith-machine-leg-press | Smith Machine Leg Press \| Fixmee |
| /exercises/db-smith-machine-one-arm-upright-row | Smith Machine One-Arm Upright Row \| Fixmee |
| /exercises/db-smith-machine-overhead-shoulder-press | Smith Machine Overhead Shoulder Press \| Fixmee |
| /exercises/db-smith-machine-pistol-squat | Smith Machine Pistol Squat \| Fixmee |
| /exercises/db-smith-machine-reverse-calf-raises | Smith Machine Reverse Calf Raises \| Fixmee |
| /exercises/db-smith-machine-squat | สควอทสมิทแมชชีน \| Fixmee |
| /exercises/db-smith-machine-stiff-legged-deadlift | Smith Machine Stiff-Legged Deadlift \| Fixmee |
| /exercises/db-smith-machine-upright-row | Smith Machine Upright Row \| Fixmee |
| /exercises/db-smith-single-leg-split-squat | Smith Single-Leg Split Squat \| Fixmee |
| /exercises/db-snatch | Snatch \| Fixmee |
| /exercises/db-snatch-balance | Snatch Balance \| Fixmee |
| /exercises/db-snatch-deadlift | Snatch Deadlift \| Fixmee |
| /exercises/db-snatch-pull | Snatch Pull \| Fixmee |
| /exercises/db-snatch-shrug | Snatch Shrug \| Fixmee |
| /exercises/db-snatch-from-blocks | Snatch from Blocks \| Fixmee |
| /exercises/db-speed-band-overhead-triceps | Speed Band Overhead Triceps \| Fixmee |
| /exercises/db-speed-box-squat | Speed Box Squat \| Fixmee |
| /exercises/db-speed-squats | Speed Squats \| Fixmee |
| /exercises/db-spell-caster | Spell Caster \| Fixmee |
| /exercises/db-spider-crawl | Spider Crawl \| Fixmee |
| /exercises/db-spider-curl | Spider Curl \| Fixmee |
| /exercises/db-spinal-stretch | Spinal Stretch \| Fixmee |
| /exercises/db-split-clean | Split Clean \| Fixmee |
| /exercises/db-split-jerk | Split Jerk \| Fixmee |
| /exercises/db-split-jump | Split Jump \| Fixmee |
| /exercises/db-split-snatch | Split Snatch \| Fixmee |
| /exercises/db-split-squat-with-dumbbells | สปลิตสควอทดัมเบล \| Fixmee |
| /exercises/db-split-squats | สปลิตสควอท \| Fixmee |
| /exercises/db-squat-jerk | Squat Jerk \| Fixmee |
| /exercises/db-squat-with-bands | Squat with Bands \| Fixmee |
| /exercises/db-squat-with-chains | Squat with Chains \| Fixmee |
| /exercises/db-squat-with-plate-movers | Squat with Plate Movers \| Fixmee |
| /exercises/db-squats-with-bands | Squats - With Bands \| Fixmee |
| /exercises/db-stairmaster | Stairmaster \| Fixmee |
| /exercises/db-standing-alternating-dumbbell-press | Standing Alternating Dumbbell Press \| Fixmee |
| /exercises/db-standing-barbell-calf-raise | ยืนเขย่งน่องบาร์เบล \| Fixmee |
| /exercises/db-standing-barbell-press-behind-neck | Standing Barbell Press Behind Neck \| Fixmee |
| /exercises/db-standing-bent-over-one-arm-dumbbell-triceps-extension | Standing Bent-Over One-Arm Dumbbell Triceps Extens \| Fixmee |
| /exercises/db-standing-bent-over-two-arm-dumbbell-triceps-extension | Standing Bent-Over Two-Arm Dumbbell Triceps Extens \| Fixmee |
| /exercises/db-standing-biceps-cable-curl | ยืนเคิร์ลหน้าแขนเคเบิล \| Fixmee |
| /exercises/db-standing-biceps-stretch | Standing Biceps Stretch \| Fixmee |
| /exercises/db-standing-bradford-press | Standing Bradford Press \| Fixmee |
| /exercises/db-standing-cable-chest-press | Standing Cable Chest Press \| Fixmee |
| /exercises/db-standing-cable-lift | Standing Cable Lift \| Fixmee |
| /exercises/db-standing-cable-wood-chop | เคเบิลสับไม้ \| Fixmee |
| /exercises/db-standing-calf-raises | ยืนเขย่งน่อง \| Fixmee |
| /exercises/db-standing-concentration-curl | Standing Concentration Curl \| Fixmee |
| /exercises/db-standing-dumbbell-calf-raise | ยืนเขย่งน่องดัมเบล \| Fixmee |
| /exercises/db-standing-dumbbell-press | ยืนกดไหล่ดัมเบล \| Fixmee |
| /exercises/db-standing-dumbbell-reverse-curl | ยืนเคิร์ลดัมเบลคว่ำมือ \| Fixmee |
| /exercises/db-standing-dumbbell-straight-arm-front-delt-raise-above-head | Standing Dumbbell Straight-Arm Front Delt Raise Ab \| Fixmee |
| /exercises/db-standing-dumbbell-triceps-extension | ยืนเหยียดหลังแขนดัมเบล \| Fixmee |
| /exercises/db-standing-dumbbell-upright-row | ยืนดึงดัมเบลขึ้นแนวตั้ง \| Fixmee |
| /exercises/db-standing-elevated-quad-stretch | Standing Elevated Quad Stretch \| Fixmee |
| /exercises/db-standing-front-barbell-raise-over-head | Standing Front Barbell Raise Over Head \| Fixmee |
| /exercises/db-standing-gastrocnemius-calf-stretch | Standing Gastrocnemius Calf Stretch \| Fixmee |
| /exercises/db-standing-hamstring-and-calf-stretch | Standing Hamstring and Calf Stretch \| Fixmee |
| /exercises/db-standing-hip-circles | Standing Hip Circles \| Fixmee |
| /exercises/db-standing-hip-flexors | Standing Hip Flexors \| Fixmee |
| /exercises/db-standing-inner-biceps-curl | Standing Inner-Biceps Curl \| Fixmee |
| /exercises/db-standing-lateral-stretch | Standing Lateral Stretch \| Fixmee |
| /exercises/db-standing-leg-curl | ยืนงอเข่าเครื่อง \| Fixmee |
| /exercises/db-standing-long-jump | Standing Long Jump \| Fixmee |
| /exercises/db-standing-low-pulley-deltoid-raise | Standing Low-Pulley Deltoid Raise \| Fixmee |
| /exercises/db-standing-low-pulley-one-arm-triceps-extension | Standing Low-Pulley One-Arm Triceps Extension \| Fixmee |
| /exercises/db-standing-military-press | ยืนมิลิทารีเพรส \| Fixmee |
| /exercises/db-standing-olympic-plate-hand-squeeze | Standing Olympic Plate Hand Squeeze \| Fixmee |
| /exercises/db-standing-one-arm-cable-curl | ยืนเคิร์ลเคเบิลข้างเดียว \| Fixmee |
| /exercises/db-standing-one-arm-dumbbell-curl-over-incline-bench | Standing One-Arm Dumbbell Curl Over Incline Bench \| Fixmee |
| /exercises/db-standing-one-arm-dumbbell-triceps-extension | Standing One-Arm Dumbbell Triceps Extension \| Fixmee |
| /exercises/db-standing-overhead-barbell-triceps-extension | Standing Overhead Barbell Triceps Extension \| Fixmee |
| /exercises/db-standing-palm-in-one-arm-dumbbell-press | Standing Palm-In One-Arm Dumbbell Press \| Fixmee |
| /exercises/db-standing-palms-in-dumbbell-press | Standing Palms-In Dumbbell Press \| Fixmee |
| /exercises/db-standing-palms-up-barbell-behind-the-back-wrist-curl | Standing Palms-Up Barbell Behind The Back Wrist Cu \| Fixmee |
| /exercises/db-standing-pelvic-tilt | Standing Pelvic Tilt \| Fixmee |
| /exercises/db-standing-rope-crunch | Standing Rope Crunch \| Fixmee |
| /exercises/db-standing-soleus-and-achilles-stretch | Standing Soleus And Achilles Stretch \| Fixmee |
| /exercises/db-standing-toe-touches | Standing Toe Touches \| Fixmee |
| /exercises/db-standing-towel-triceps-extension | Standing Towel Triceps Extension \| Fixmee |
| /exercises/db-standing-two-arm-overhead-throw | Standing Two-Arm Overhead Throw \| Fixmee |
| /exercises/db-star-jump | Star Jump \| Fixmee |
| /exercises/db-step-up-with-knee-raise | Step-up with Knee Raise \| Fixmee |
| /exercises/db-step-mill | Step Mill \| Fixmee |
| /exercises/db-stiff-legged-barbell-deadlift | เดดลิฟต์บาร์เบลขาค่อนข้างตรง \| Fixmee |
| /exercises/db-stiff-legged-dumbbell-deadlift | เดดลิฟต์ดัมเบลขาค่อนข้างตรง \| Fixmee |
| /exercises/db-stiff-leg-barbell-good-morning | Stiff Leg Barbell Good Morning \| Fixmee |
| /exercises/db-stomach-vacuum | Stomach Vacuum \| Fixmee |
| /exercises/db-straight-arm-dumbbell-pullover | Straight-Arm Dumbbell Pullover \| Fixmee |
| /exercises/db-straight-arm-pulldown | ดึงเคเบิลลงแขนตรง \| Fixmee |
| /exercises/db-straight-bar-bench-mid-rows | Straight Bar Bench Mid Rows \| Fixmee |
| /exercises/db-straight-raises-on-incline-bench | Straight Raises on Incline Bench \| Fixmee |
| /exercises/db-stride-jump-crossover | Stride Jump Crossover \| Fixmee |
| /exercises/db-sumo-deadlift | Sumo Deadlift \| Fixmee |
| /exercises/db-sumo-deadlift-with-bands | Sumo Deadlift with Bands \| Fixmee |
| /exercises/db-sumo-deadlift-with-chains | Sumo Deadlift with Chains \| Fixmee |
| /exercises/db-superman | Superman \| Fixmee |
| /exercises/db-supine-chest-throw | Supine Chest Throw \| Fixmee |
| /exercises/db-supine-one-arm-overhead-throw | Supine One-Arm Overhead Throw \| Fixmee |
| /exercises/db-supine-two-arm-overhead-throw | Supine Two-Arm Overhead Throw \| Fixmee |
| /exercises/db-suspended-fallout | Suspended Fallout \| Fixmee |
| /exercises/db-suspended-push-up | Suspended Push-Up \| Fixmee |
| /exercises/db-suspended-reverse-crunch | Suspended Reverse Crunch \| Fixmee |
| /exercises/db-suspended-row | Suspended Row \| Fixmee |
| /exercises/db-suspended-split-squat | Suspended Split Squat \| Fixmee |
| /exercises/db-svend-press | Svend Press \| Fixmee |
| /exercises/db-t-bar-row-with-handle | T-Bar Row with Handle \| Fixmee |
| /exercises/db-tate-press | Tate Press \| Fixmee |
| /exercises/db-the-straddle | The Straddle \| Fixmee |
| /exercises/db-thigh-abductor | Thigh Abductor \| Fixmee |
| /exercises/db-thigh-adductor | Thigh Adductor \| Fixmee |
| /exercises/db-tire-flip | Tire Flip \| Fixmee |
| /exercises/db-toe-touchers | Toe Touchers \| Fixmee |
| /exercises/db-torso-rotation | Torso Rotation \| Fixmee |
| /exercises/db-trail-running-walking | Trail Running/Walking \| Fixmee |
| /exercises/db-trap-bar-deadlift | Trap Bar Deadlift \| Fixmee |
| /exercises/db-tricep-dumbbell-kickback | ดัมเบลคิกแบ็กหลังแขน \| Fixmee |
| /exercises/db-tricep-side-stretch | Tricep Side Stretch \| Fixmee |
| /exercises/db-triceps-overhead-extension-with-rope | Triceps Overhead Extension with Rope \| Fixmee |
| /exercises/db-triceps-pushdown | เคเบิลกดหลังแขน \| Fixmee |
| /exercises/db-triceps-pushdown-rope-attachment | เคเบิลกดหลังแขนเชือก \| Fixmee |
| /exercises/db-triceps-pushdown-v-bar-attachment | เคเบิลกดหลังแขนด้ามวี \| Fixmee |
| /exercises/db-triceps-stretch | Triceps Stretch \| Fixmee |
| /exercises/db-tuck-crunch | Tuck Crunch \| Fixmee |
| /exercises/db-two-arm-dumbbell-preacher-curl | Two-Arm Dumbbell Preacher Curl \| Fixmee |
| /exercises/db-two-arm-kettlebell-clean | Two-Arm Kettlebell Clean \| Fixmee |
| /exercises/db-two-arm-kettlebell-jerk | Two-Arm Kettlebell Jerk \| Fixmee |
| /exercises/db-two-arm-kettlebell-military-press | Two-Arm Kettlebell Military Press \| Fixmee |
| /exercises/db-two-arm-kettlebell-row | Two-Arm Kettlebell Row \| Fixmee |
| /exercises/db-underhand-cable-pulldowns | ดึงเคเบิลลงหงายมือ \| Fixmee |
| /exercises/db-upper-back-leg-grab | Upper Back-Leg Grab \| Fixmee |
| /exercises/db-upper-back-stretch | Upper Back Stretch \| Fixmee |
| /exercises/db-upright-barbell-row | ดึงบาร์เบลขึ้นแนวตั้ง \| Fixmee |
| /exercises/db-upright-cable-row | ดึงเคเบิลขึ้นแนวตั้ง \| Fixmee |
| /exercises/db-upright-row-with-bands | Upright Row - With Bands \| Fixmee |
| /exercises/db-upward-stretch | Upward Stretch \| Fixmee |
| /exercises/db-v-bar-pulldown | ดึงเคเบิลลงด้ามวี \| Fixmee |
| /exercises/db-v-bar-pullup | V-Bar Pullup \| Fixmee |
| /exercises/db-vertical-swing | Vertical Swing \| Fixmee |
| /exercises/db-walking-treadmill | Walking, Treadmill \| Fixmee |
| /exercises/db-weighted-ball-hyperextension | Weighted Ball Hyperextension \| Fixmee |
| /exercises/db-weighted-ball-side-bend | Weighted Ball Side Bend \| Fixmee |
| /exercises/db-weighted-bench-dip | Weighted Bench Dip \| Fixmee |
| /exercises/db-weighted-crunches | ครันช์ถ่วงน้ำหนัก \| Fixmee |
| /exercises/db-weighted-jump-squat | Weighted Jump Squat \| Fixmee |
| /exercises/db-weighted-pull-ups | ดึงข้อถ่วงน้ำหนัก \| Fixmee |
| /exercises/db-weighted-sissy-squat | Weighted Sissy Squat \| Fixmee |
| /exercises/db-weighted-sit-ups-with-bands | Weighted Sit-Ups - With Bands \| Fixmee |
| /exercises/db-weighted-squat | Weighted Squat \| Fixmee |
| /exercises/db-wide-grip-barbell-bench-press | Wide-Grip Barbell Bench Press \| Fixmee |
| /exercises/db-wide-grip-decline-barbell-bench-press | Wide-Grip Decline Barbell Bench Press \| Fixmee |
| /exercises/db-wide-grip-decline-barbell-pullover | Wide-Grip Decline Barbell Pullover \| Fixmee |
| /exercises/db-wide-grip-lat-pulldown | ดึงเคเบิลลงจับกว้าง \| Fixmee |
| /exercises/db-wide-grip-pulldown-behind-the-neck | Wide-Grip Pulldown Behind The Neck \| Fixmee |
| /exercises/db-wide-grip-rear-pull-up | Wide-Grip Rear Pull-Up \| Fixmee |
| /exercises/db-wide-grip-standing-barbell-curl | Wide-Grip Standing Barbell Curl \| Fixmee |
| /exercises/db-wide-stance-barbell-squat | สควอทบาร์เบลยืนกว้าง \| Fixmee |
| /exercises/db-wide-stance-stiff-legs | Wide Stance Stiff Legs \| Fixmee |
| /exercises/db-wind-sprints | Wind Sprints \| Fixmee |
| /exercises/db-windmills | Windmills \| Fixmee |
| /exercises/db-worlds-greatest-stretch | World's Greatest Stretch \| Fixmee |
| /exercises/db-wrist-circles | Wrist Circles \| Fixmee |
| /exercises/db-wrist-roller | Wrist Roller \| Fixmee |
| /exercises/db-wrist-rotations-with-straight-bar | Wrist Rotations with Straight Bar \| Fixmee |
| /exercises/db-yoke-walk | Yoke Walk \| Fixmee |
| /exercises/db-zercher-squats | Zercher Squats \| Fixmee |
| /exercises/db-zottman-curl | Zottman Curl \| Fixmee |
| /exercises/db-zottman-preacher-curl | Zottman Preacher Curl \| Fixmee |
| /exercises/ | คลังท่าออกกำลังกายและวิธีฝึก \| Fixmee |
| /privacy | นโยบายความเป็นส่วนตัว \| Fixmee |
| /terms | เงื่อนไขการใช้บริการ \| Fixmee |
| /guide | คู่มือเริ่มต้นใช้งาน \| Fixmee |
| /404.html | ไม่พบหน้านี้ \| Fixmee |
