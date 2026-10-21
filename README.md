# Fixmee

Product domain: `fixmee.app`.

## Round 5a (sections 1–9 only)

Sections 10–28 of `docs/CODEX_TASKS_5.md` are not part of this round.

Before releasing this version, apply `worker/migrations/0002_round5a.sql` after `0001_init.sql`, using `npx wrangler d1 migrations apply fitme --remote` from `worker/`. This adds payment orders/ledger, promo codes, referrals, trainer plans/purchases/payables, push ownership, telemetry and video metadata. No remote migration or deployment was performed by this task.

For uploaded exercise videos, create `fitme-media` with `npx wrangler r2 bucket create fitme-media` and enable the commented `MEDIA` R2 binding in `worker/wrangler.toml`. Admin → Exercise videos accepts YouTube/Vimeo/HTTPS MP4 links or MP4 uploads up to 25 MB. Uploads require the admin bearer; playback is public. YouTube uses youtube-nocookie and Vimeo uses `dnt=1`. Players load only after a tap; animation remains the default/offline fallback. Video downloads are outside this round.

Enable Stripe Connect for the platform and configure the existing encrypted Stripe secret. Trainers use Account → Sell plans / earnings → Connect Stripe Express. The Worker requests card-payments/transfers capabilities and checks charge/payout readiness before checkout. Approved templates use [destination charges and application fees](https://docs.stripe.com/connect/destination-charges). Default trainer share is 70% of gross sales; processing fees reduce the platform remainder. Admin → Settings configures this share and referral reward days. PromptPay sales create payables: the admin must transfer funds before marking a payment paid; the button records bookkeeping only.

Trainers submit their current workout settings plus name, description, THB/USD prices, duration and weekly notes for admin approval. Purchased plans can be applied from the marketplace and link the buyer to their trainer. Promo product IDs are `export1`, `pro30`, `pro90` or `plan_<uuid>` from the submitted template.

Checkout first requests an authoritative price quote. Promo capacity is reserved for one hour and usage increments only on completion. Stripe needs at least 30 minutes remaining on the quote; otherwise refresh it. Prices, currency, duration and trainer share are frozen in the order. Fully discounted orders use a server-validated zero-price confirmation with no provider charge. Unique payment references and a D1 transaction prevent repeat entitlements, promo counts and referral rewards. A new referred account's first purchase grants both sides the configured Pro days. Signed account entitlement refresh runs at login, startup and the Me referral card. Guest purchases cannot earn referrals or buy trainer plans.

Stripe confirmation occurs when the buyer returns to the app. Webhook reconciliation and recurring Billing are outside this round; an interrupted return must be retried with the same Checkout session. No live payment or paid AI call was used during development.

Privacy/terms are bilingual **drafts requiring legal review before launch**. Set a real contact email in Admin → Settings and have counsel define the statutory accounting retention period. Terms and sensitive-health consent are separate, versioned choices. Withdrawal stops app sync and gates health screens; account export/deletion remain available. Body photos stay local except when explicitly selected for the existing AI photo-analysis feature. Export includes local image data and server records. Deletion removes account relationships, state, sessions, referrals, plans and linked push subscriptions; required payment/payable records retain a fresh random replacement user identifier. Providers may retain their own legally required records.

Optional telemetry defaults on and can be disabled in Me. Raw exception text, personal state and health data are not transmitted. The Worker stores sanitized error categories/allowlisted locations and event aggregates; a hashed install-ID counter limits batches to 30/hour, at most 20 events each. Records older than 90 days and rate buckets older than 24 hours are pruned on telemetry receipt. Dashboard AI counts reflect opted-in telemetry, not a billing audit.

Women’s health requires explicit opt-in on female profiles. Cycle adjustments can be disabled; pregnancy/postpartum restrictions stay active across regular and special programs. Medical clearance is required for pregnancy/postpartum. Pregnancy disables fasting and calorie deficits and removes specified supine/high-impact exercises. Early postpartum uses walking/breathing/pelvic-floor cards; breastfeeding disables fasting and adds 450 kcal guidance. These conservative product rules need clinical review and are not medical prescriptions. References: [ACOG exercise guidance](https://www.acog.org/womens-health/faqs/exercise-during-pregnancy), [breastfeeding nutrition](https://www.acog.org/womens-health/faqs/breastfeeding-your-baby). Supplement flags follow existing label warnings; contraindications are not invented for silent labels.

Workout → Programs offers eight-week 5K walk/run intervals, back care, active 60+ and a two-week habit builder. Programs override the regular split until completed or cancelled. The 5K progression builds to 30 minutes of running; distance varies with pace. Every new pose uses the existing keyframe renderer.

Run with Node 24+ (`happy-dom` is in `tests/package.json`):

```text
node tests/test.mjs
node tests/round3.mjs
node tests/round4.mjs
node tests/ui-test.mjs
node tests/round4-ui.mjs
node tests/round5.mjs
node worker/test.mjs
```

The Worker runner includes rounds 4 and 5a. Tests use real local SQLite SQL and mocked providers to cover promo reservations/math/expiry, authoritative amounts, replay protection, referral rewards, plan approval/access, destination fees, payouts, telemetry redaction/throttling, admin media and export/deletion. DOM tests cover TH/EN routes/themes, separate/versioned consent, telemetry opt-out, cycle calculations, pregnancy/postpartum restrictions across programs, run progression and all new side/front poses.

`tests/round5-browser.mjs` adds a 375px Chromium check with `PLAYWRIGHT_PATH` and optional `CHROME_PATH`. Browser launch was blocked here by sandbox `spawn EPERM`; actual layout/console checks remain unverified. DOM tests do not prove visual layout. Real D1/R2, Stripe Connect/Thunder payments, cross-device accounts and push delivery also remain unverified.

Mobile-first PWA (ติดตั้งเป็นแอปได้) สำหรับวางแผน **ออกกำลังกาย + อาหาร + อาหารเสริม + การพักผ่อน** เฉพาะบุคคล ภาษาไทย/อังกฤษ

## ฟีเจอร์

| ส่วน | รายละเอียด |
|---|---|
| โปรไฟล์ | อายุ เพศ ส่วนสูง น้ำหนัก น้ำหนักเป้าหมาย · ผลสแกน InBody (ไขมัน %, กล้ามเนื้อ, BMR) · รูปร่างก่อน/หลัง (เก็บในเครื่องเท่านั้น) · กราฟน้ำหนัก |
| คำนวณพลังงาน | BMR: ค่าจากเครื่องสแกน → Katch-McArdle (ถ้ามีไขมัน %) → Mifflin-St Jeor · TDEE ตามจำนวนวันฝึก · แคลอรี่วันฝึก/วันพักต่างกัน · BMI เกณฑ์เอเชีย |
| ออกกำลังกาย | 30 ท่า มีแอนิเมชันโครงกระดูก 2D (inverse kinematics) · แผนตามจำนวนวัน/สัปดาห์ (Full body / Upper-Lower / PPL) · บ้าน / ดัมเบล / ยิม · Progressive overload + Deload ทุกสัปดาห์ที่ 4 · ตัวจับเวลา เซ็ต/พัก เสียงเตือน |
| อาหาร | ฐานข้อมูลอาหารไทย 45 รายการ · คำนวณกรัมต่อมื้อให้ตรงโปรตีน/คาร์บ/ไขมัน · 3-6 มื้อ/วัน จัดเวลาก่อน/หลังออกกำลังกาย · มังสวิรัติ วีแกน ฮาลาล คาร์บต่ำ · ตัดหมวด เช่น ไม่ทานผลไม้ แพ้ถั่ว · สุ่มเมนูใหม่ |
| อาหารเสริม | ตารางทานตามฉลากจริง (ตามน้ำหนัก วันฝึก/วันพัก Loading/Maintenance) · 8 ผลิตภัณฑ์จากรูปตั้งต้น · อัปโหลดรูปฉลาก → AI (Claude) อ่านวิธีทาน · กรอกเอง · คำนวณวันหมด · เตือนวิตามินซ้ำซ้อน · โปรตีนจากเวย์ถูกหักจากมื้ออาหาร |
| พักผ่อน | ชั่วโมงนอนตามอายุ · เวลาเข้านอนตามรอบ 90 นาที · บันทึกการนอน · งดคาเฟอีน/ปิดจอ ในไทม์ไลน์ · วันพักฟื้น |
| ไทม์ไลน์วันนี้ | รวมทุกอย่างเป็นตารางเวลาเดียว ติ๊กทำแล้ว · วงแหวนแคลอรี่/โปรตีน/น้ำ |
| รายได้ | ฟรี 3 วันแรก + อาหารเสริม 2 รายการ · Pro 30/90 วัน · ซื้อดาวน์โหลดครั้งเดียว · PromptPay QR + ตรวจสลิปด้วย Thunder API · Stripe (บัตร/Apple Pay/Google Pay ทั่วโลก) |
| ดาวน์โหลด | PDF (ผ่านหน้าพิมพ์) · ปฏิทิน .ics พร้อมแจ้งเตือน · สำรอง/กู้คืน JSON |

## โครงสร้าง

```
app/      เว็บแอป (static, ไม่ต้อง build) → GitHub Pages
  js/     calc, workout, exercises+figure (แอนิเมชัน), foods+meals, supplements, day (ไทม์ไลน์), pay, export, views/
worker/   Cloudflare Worker: ตรวจสลิป Thunder, Stripe Checkout, AI อ่านฉลาก (Claude)
```

## รันในเครื่อง

```bash
python -m http.server 5173 --directory app
```

เปิด http://localhost:5173 — ถ้า `API_BASE` ใน `app/js/config.js` ว่าง แอปจะอยู่ใน **โหมดทดลอง** (จ่ายเงินแบบจำลอง, ปิด AI)

## Deploy

### 1. เว็บแอป (GitHub Pages)
1. Push repo ขึ้น GitHub (branch `main`)
2. Settings → Pages → Source: **GitHub Actions**
3. ทุกครั้งที่ push โฟลเดอร์ `app/` จะ deploy อัตโนมัติ (`.github/workflows/pages.yml`)

### 2. API (Cloudflare Worker) — สำหรับรับเงินจริงและ AI
```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put TOKEN_SECRET        # สุ่มข้อความยาว 32+ ตัว
npx wrangler secret put THUNDER_API_KEY     # จาก thunder.in.th
npx wrangler secret put STRIPE_SECRET_KEY   # sk_test_... หรือ sk_live_...
npx wrangler secret put ANTHROPIC_API_KEY   # สำหรับ AI อ่านฉลาก
npx wrangler deploy
```
แล้วแก้ `app/js/config.js`:
- `API_BASE` = URL ของ worker เช่น `https://fitme-api.<account>.workers.dev`
- `PROMPTPAY_ID` = เบอร์พร้อมเพย์/เลขผู้เสียภาษีของคุณ
- ใน `worker/wrangler.toml` ตั้ง `ALLOWED_ORIGINS` เป็นโดเมน Pages และ `RECEIVER_NAME` เป็นชื่อบัญชีผู้รับ (กันสลิปโอนให้คนอื่น)

### Admin settings
Open `#/admin` directly or use the small Admin link on Me. Set `ADMIN_PASSWORD` with `npx wrangler secret put ADMIN_PASSWORD`. Create a CONFIG KV namespace (`npx wrangler kv namespace create CONFIG`) and uncomment its binding/id in `worker/wrangler.toml` before deploying.

The admin form saves PromptPay details, slip receiver matching, product prices/names/descriptions/entitlements, and free limits. Public `GET /api/config` supplies these settings and masked service-key metadata; `PUT /api/admin/config` requires the admin bearer password. The browser loads settings at startup and caches the last response for offline use. Without KV settings, built-in defaults apply. The password stays in sessionStorage only; API keys can be encrypted in CONFIG through the API keys section, with existing Wrangler secrets taking precedence. KV updates can take time to propagate.

## ข้อควรรู้
- ข้อมูลทั้งหมด (รวมรูปร่างกาย) เก็บในเบราว์เซอร์ของผู้ใช้ (localStorage + IndexedDB) ไม่ส่งขึ้นเซิร์ฟเวอร์ ยกเว้นรูปสลิป รูปฉลาก และข้อมูลแผน/รูปร่างที่ผู้ใช้เลือกส่งให้ AI
- สิทธิ์ Pro เป็น token ที่ server เซ็นไว้ แต่การล็อกฟีเจอร์ทำฝั่งเครื่อง ผู้ที่แก้โค้ดในเบราว์เซอร์เลี่ยงได้ ถ้าต้องการกันจริงให้ย้ายการสร้างแผนไปฝั่ง server
- คำแนะนำในแอปเป็นข้อมูลทั่วไป ไม่ใช่คำวินิจฉัยทางการแพทย์

### AI coach
Pro members can review today's meals, targets and supplement schedule from Food. Suggestions are bilingual, and swaps use the built-in food catalog. Label reading remains available.

Me → Body photos → Analyze body with AI asks for explicit consent before selecting 1–3 front/side/back photos plus height, weight, age and sex. Shorts/sports bra are recommended. This adult-only feature offers a rough visual estimate, not a body-fat measurement or diagnosis. Requests go to the Worker and Claude; the Worker does not persist photos or results (provider retention policies still apply). Goal/focus changes require tapping Apply; the estimate never overwrites measured body-fat data. Each selected focus group adds one exercise to training sessions, subject to available equipment/level; recovery days stay unchanged.

Both `/api/ai/plan-review` and `/api/ai/body` require a valid, unexpired Pro token and `ANTHROPIC_API_KEY`. They use structured output with `claude-opus-5-5`, medium effort, matching the existing label reader. Live AI availability requires provider access to that model.

Exercise figures retain the original skeleton, IK and keyframes. Shaded tapered limbs, shaped torsos, lime muscle highlights and ground shadows are shared by animation and PDF thumbnails; SVG gradient/filter definitions are created once per figure.

Run `node worker/test.mjs` for mocked config, payment-config and AI endpoint checks (no live API calls).

### Round 2: planning and progress

- Display name is **Fixmee**. Existing `fitme:v1` localStorage data and the `fitme` image database remain compatible; repo and deployment URLs are unchanged.
- Admin has service readiness rows, a tab-only password with show/hide, PromptPay validation, bilingual package fields with live price/duration previews and best-value toggles, free-limit steppers, setup commands, and an unsaved-change bar. Keys can be entered in the encrypted API keys section (see Round 4 setup below). CONFIG KV readiness is returned as a boolean.
- Train → **Exercise preferences / ตั้งค่าท่า**: toggle allowed exercises by muscle group, apply knee/back/shoulder/wrist avoid presets, and choose preferred exercises. Exclusions apply to warm-up, main work, finishers, cool-down and recovery. An empty allowed pool produces no exercises. Each exercise's swap button stores an allowed same-group replacement for that date, shared by the plan and player.
- Open **Calendar / ปฏิทิน** from Train or the Food week strip. Tap a day to open its plan; reopen its calendar to edit that date as normal, extra training, or off. Vacation ranges mark all dates off. Split rotation counts actual training days, and food targets follow the same overrides.
- Food onboarding and Food preferences offer 12:12, 14:10, 16:8, 18:6, 20:4 and OMAD with a configurable window start (default noon). Meals fit within the window, including windows crossing midnight; shorter windows reduce meal count. OMAD uses one meal. Food-dependent or caloric supplements move into the window; zero-calorie morning/night doses can stay outside it. IF is disabled under 18, and the UI includes the requested suitability warning. Today shows a timer updated each minute; eating/fasting boundaries are included in the timeline, PDF and ICS.
- The player connects to standard BLE heart-rate devices through Web Bluetooth, displays BPM and age-based zones, and saves samples plus average/max HR. With samples, calorie estimates use the [Keytel equation](https://doi.org/10.1080/02640410470001730089); otherwise the existing MET estimate is used. This is an estimate, not a device-calibrated measurement. Use a chest strap or a compatible watch's broadcast-HR mode. iPhone/Safari lacks this API; Apple Watch and most Wear OS watches do not provide standard BLE HR broadcasting.
- Dumbbell/gym rep exercises support per-set kg/reps with steppers and previous-session defaults. Exercise details show the last five logged sessions and suggest +2.5 kg when every recorded set in the last complete exercise reached the prescribed upper rep target. Me shows eight weeks of workout counts, a consecutive-day streak, total logged minutes and the existing weight trend.
- Food → **7-day shopping list / รายการซื้อของ 7 วัน** aggregates planned food grams by category from the selected date. Free users receive only unlocked dates. Checkboxes persist locally; share/copy includes a selectable text fallback. Quantities use the food catalog's planned weights, which can be cooked weights.

Validation:

```bash
node tests/test.mjs
node worker/test.mjs
# Optional DOM/action integration tests (no live services or Bluetooth hardware):
npm install --prefix /tmp/fixme-tests happy-dom
HAPPY_DOM_PATH=file:///tmp/fixme-tests/node_modules/happy-dom/lib/index.js node tests/ui-test.mjs
```

`tests/test.mjs` covers old-state compatibility, avoidance, preferences/swaps, day rotation, IF windows, supplements and BLE parsing. `tests/ui-test.mjs` covers both-language views and actions, simulated BLE session completion, set/HR persistence, shopping and mocked admin saving. Real BLE hardware, live payment/config services and deployment are separate checks.

### Round 3

- Food and meal details offer **Meal photo / ถ่ายรูปอาหาร** (Pro). Select 1–2 views of the same meal and an optional note. Claude returns bilingual foods, portion/macronutrient estimates and confidence; adjust grams before saving. Images go to the Worker/provider only after the user agrees. The Worker does not persist photos; provider retention policies apply. **Keep photo** saves the first image locally in IndexedDB. Extra food logs without photos work offline. Today rings and Food totals now count eaten meals, checked supplements and extra logs, rather than the whole planned day.
- Food preferences → **My foods / เมนูของฉัน** accepts per-100-g or per-serving nutrition, household units, diet/allergen tags and recipes assembled from existing foods. Recipe macros and tags are calculated from ingredients. Enable **Use in meal plan** to make a food eligible for generation. Custom foods have `my-` IDs and are included in backups. Tag ingredients accurately so diet filters can exclude them.
- Me → **Body measurements** stores dated waist, hip, chest, arm and thigh measurements, trends, WHR/WHtR and the requested reference thresholds. Measurements also appear in the printable PDF.
- Me → **Share results** creates a local 1080×1350 PNG with days on plan, completed workouts, daily streak and change between logged weights. Before/after photos are optional selections made for that card only. Share uses the platform file share sheet when supported and otherwise downloads the PNG.
- The workout player's **Voice coach** toggle is remembered. Local speech synthesis announces exercises, sets, form cues, rest boundaries and three seconds remaining; Thai uses a Thai voice when installed, otherwise English. No speech service is called.
- Me → **Theme** selects automatic, dark or light. Automatic follows the OS preference. New state fields have defaults, and existing localStorage/IndexedDB names remain unchanged.

### Web Push setup

Generate a VAPID key pair **once** locally, using Node 20+ (do not commit the output):

```bash
cd worker
node --input-type=module -e "import {generateVapidKeys} from './src/push.js'; console.log(await generateVapidKeys())"
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler kv namespace create PUSH
```

Set `VAPID_SUBJECT` in `worker/wrangler.toml` to your contact `mailto:` URI, and uncomment the `PUSH` namespace binding with its actual ID. The public key is returned through `/api/config`; the private key stays in Worker secrets. Keep the pair stable across deployments. The existing cron entry `*/5 * * * *` runs every five minutes and does nothing until PUSH and all VAPID settings exist. No deployment is performed by tests.

Me → **Notifications** lets users select meals, supplements, workout, two-hour water reminders within waking hours, bedtime minus 30 minutes, and IF boundaries. Enabling asks browser permission and subscribes through the service worker. The next seven plan days are uploaded with the IANA timezone; schedules refresh on plan changes, app open, foregrounding and reconnection. Open the app at least weekly; records expire after eight days. Disable removes the server record and browser subscription. A random device ID acts as an unguessable management credential; keep backups private. Demo mode explains the server requirement. iPhone requires iOS 16.4+ and **Add to Home Screen**.

The sender uses WebCrypto for [RFC 8291 aes128gcm encryption](https://www.rfc-editor.org/rfc/rfc8291) and ES256 VAPID. It checks the current five-minute window, handles local dates across midnight, supports `days` weekday filters, and deletes 404/410 subscriptions. KV propagation and overlapping cron execution mean delivery is best effort, not exactly once; reminders can be delayed by up to five minutes and by browser/OS scheduling. Supported endpoint hosts are explicitly limited to browser push services. Put rate limits on the public subscribe route before a public launch.

### Native Android / iOS shell

`mobile/` pins Capacitor 8 and [`@capgo/capacitor-health`](https://github.com/Cap-go/capacitor-health), supporting HealthKit and Health Connect. The native bridge uses the installed plugin's `Health` methods through Capacitor's injected bridge; the static web app needs no SDK bundle or build step. Me hides Health data in ordinary browsers. In a native build, users explicitly request read access for steps, sleep, resting heart rate, active calories and weight for the last seven days. Empty/denied data is shown without treating it as zero. Import fills missing weight/sleep dates and refreshes imported daily step totals, unions overlapping sleep intervals and does not write back to HealthKit/Health Connect. Raw read results stay in memory; imported logs stay on the device and in user-requested backups, and sync when an account is connected.

Use Node 22+ and the platform tooling required by Capacitor 8:

```bash
cd mobile
npm ci
npx cap add android
npx cap sync android
npx cap open android
# On a Mac with Xcode:
npx cap add ios
npx cap sync ios
npx cap open ios
```

Build/run Android from Android Studio on a device with Health Connect (built in on Android 14+, install it on supported earlier versions). Review the merged manifest for the plugin's health permissions. This app requests read-only `READ_STEPS`, `READ_SLEEP`, `READ_RESTING_HEART_RATE`, `READ_ACTIVE_CALORIES_BURNED` and `READ_WEIGHT`; remove unnecessary write permissions from the app's merged manifest before distribution. Provide the Health Connect permission rationale and a privacy policy via the `health_connect_privacy_policy_url` Android string resource. Complete Google Play's Health Connect declaration before distribution.

On a Mac, enable the **HealthKit** capability for the iOS target in Xcode and set `NSHealthShareUsageDescription` in Info.plist (for example, “Read steps, sleep, resting heart rate, energy and weight to display your progress”). The plugin also documents `NSHealthUpdateUsageDescription`; supply a truthful description if required by your target, but this app requests no write access. Configure signing and run on an iPhone with sample health records. Generated `mobile/android/`, `mobile/ios/` and all `node_modules` are ignored. Re-run `npx cap sync` after web or plugin changes. Native health access **cannot be tested from the web build**; Android/iOS compilation, permissions and real health records require platform/device verification.

Round 3 checks (all test scripts are outside the published app):

```bash
node tests/test.mjs
node worker/test.mjs
# Install happy-dom / playwright in a temporary directory, then set their module paths:
HAPPY_DOM_PATH=file:///tmp/fixme-tests/node_modules/happy-dom/lib/index.js node tests/ui-test.mjs
HAPPY_DOM_PATH=file:///tmp/fixme-tests/node_modules/happy-dom/lib/index.js node tests/round3.mjs
PLAYWRIGHT_PATH=file:///tmp/fixme-tests/node_modules/playwright/index.mjs node tests/browser.mjs
cd worker && npx wrangler deploy --dry-run
```

On Windows, set environment variables using `$env:HAPPY_DOM_PATH` / `$env:PLAYWRIGHT_PATH`. `CHROME_PATH` optionally selects an installed Chrome executable. The browser test creates an isolated localhost server and test browser profile, checks 375px routes in both languages/themes and offline reload, and writes screenshots to the OS temporary directory. Worker tests mock Claude and push HTTP; they verify the VAPID signature, receiver-side payload decryption, subscription lifecycle, due windows and expired-subscription cleanup without paid requests.

Validation in the Round 3 workspace: `tests/test.mjs`, `tests/ui-test.mjs`, `tests/round3.mjs` and `worker/test.mjs` passed. Connected Chrome checked nine routes in Thai/English and dark/light at 375px with no observed JS errors or horizontal overflow; share canvas dimensions and quick-food persistence/totals were verified. Reloading after stopping the local HTTP server confirmed cached app operation and saved logs. The standalone Playwright runner and Wrangler dry-run were blocked by the environment's `spawn EPERM`; this is not a successful Worker bundle check. Real Claude requests, push delivery, native builds/health permissions and hardware speech output remain unverified.

## Round 4: encrypted keys, accounts, trainers and coaching

The app remains usable offline without an account. Me → Account & sync adds registration, login, role selection, sync status and trainer invitations. `#/trainer` shows linked clients and read-only summaries; notes and plan suggestions require client approval. `#/coach` keeps the last 50 messages locally (and in account sync); sending requires online Pro access. `#/challenges` computes daily checks from logs. Me shows earned and locked badges. After 28 days, `#/replan` presents the completed block and proposed changes; applying or keeping a plan opens a new block without changing `profile.startDate` or old logs.

### First-time server setup checklist

Run these commands from `worker/` using your own Cloudflare account. These are setup instructions, not actions performed by the tests.

1. Run `npm ci`, then `npx wrangler login`.
2. Run `npx wrangler kv namespace create CONFIG`. Uncomment its binding in `wrangler.toml` and paste the returned namespace ID. CONFIG stores business settings, encrypted service keys, and authentication rate counters.
3. Run `npx wrangler d1 create fitme`. Uncomment the `[[d1_databases]]` block with binding `DB`, database name `fitme`, the returned database ID, and `migrations_dir = "migrations"`.
4. Apply the schema: `npx wrangler d1 migrations apply fitme --local` for local development; `npx wrangler d1 migrations apply fitme --remote` when intentionally setting up the remote database. Migration `worker/migrations/0001_init.sql` creates users, sessions, user_state, trainer_links, invites and notes. Do not apply to an existing unrelated database.
5. Set the three bootstrap secrets individually:

   ```bash
   npx wrangler secret put ADMIN_PASSWORD
   npx wrangler secret put TOKEN_SECRET
   npx wrangler secret put MASTER_KEY
   ```

   Generate independent random values (32+ characters) using Admin → API keys → Generate random string, then copy each value to its Wrangler prompt. Keep MASTER_KEY stable: changing it without re-entering the service keys makes existing encrypted values unreadable. TOKEN_SECRET rotation invalidates existing entitlement signatures.
6. Set `ALLOWED_ORIGINS` to your app origin and `CONFIG.API_BASE` in `app/js/config.js` to the Worker URL. Run `npx wrangler deploy --dry-run` to check the bundle. Deploy only when ready to publish.
7. Open `#/admin`, enter ADMIN_PASSWORD, and save Thunder, Stripe, Claude and optional VAPID keys in the API keys section. Use Test connection for each service. Thunder uses the authenticated [GET /v2/info endpoint](https://document.thunder.in.th/en/guide/authentication), Stripe uses `/v1/balance`, and Claude uses `/v1/models`. VAPID testing validates the key pair locally in the Worker.
8. Optional notifications: configure the PUSH namespace and VAPID_SUBJECT as described above. Supply a matching generated VAPID public/private pair. Enable notifications only after these bindings are configured.
9. Register two test accounts, verify cross-device sync, switch one to trainer, create a 48-hour invitation from the client, and test linking, approving a suggestion and unlinking before inviting real clients.

Service secrets use HKDF-SHA256 → AES-256-GCM with random 12-byte IVs and authenticated key names. KV `secrets` contains base64 IV+ciphertext, never plaintext. Existing Wrangler service secrets take precedence over KV values; the admin Delete button deletes only the KV override. `/api/config` and secret-management responses expose only `{set,last4}` metadata for service keys. `/api/push/key` intentionally returns the **public** application-server key needed by PushManager; it never returns the private key. Provider error bodies are not forwarded to clients.

Accounts use PBKDF2-SHA256 (100,000 iterations, 16 random salt bytes), random 32-byte bearer tokens, hashed session storage and 30-day expiry. Auth and admin attempts are counted in CONFIG by hashed IP+email in 15-minute buckets (10 attempts). KV counters are eventually consistent, so this is an application throttle, not a globally atomic abuse-prevention guarantee. Use Cloudflare edge rate limiting if a strict cross-region cap is needed.

Sync runs on open, returning to the app, reconnecting, and five seconds after edits. D1 compare-and-swap prevents lost writes; a 409 returns the server copy, the client merges modification timestamps and retries once. Sync requests are limited to 1 MiB. Per-date logs and per-ID supplements, weights, measurements and custom foods merge independently; other fields use their top-level timestamps. Device clocks determine which edit is newer. Body/food photos and local image references, notification subscriptions, and account credentials are excluded. Premium tokens are signature-checked, expiry-checked, and their fields are reconstructed server-side. Images remain on the original device. Logging out offline clears the device token; server revocation requires a successful online logout or expiry.

Challenge hydration uses saved daily targets; meal challenges require 80% of planned meals ticked, Health steps are shown only after importing actual step data, and fasting completion is explicitly confirmed by the user. A freeze preserves the streak but is not a completed day. Replanning uses recorded calorie adherence, scheduled workouts, logged weights, top-set estimated 1RM and available sleep records; missing measurements do not trigger calorie/recovery adjustments. Suggestions always require a tap before changing the plan.

### Round 4 validation

Use Node 24+ for the built-in SQLite test adapter, which executes the actual migration and SQL used by the D1 implementation.

```bash
node tests/test.mjs
node tests/round4.mjs
node worker/test.mjs
# With HAPPY_DOM_PATH pointing to an installed happy-dom/lib/index.js:
node tests/ui-test.mjs
node tests/round3.mjs
node tests/round4-ui.mjs
# With PLAYWRIGHT_PATH and optionally CHROME_PATH configured:
node tests/browser.mjs
# From worker/:
npx wrangler deploy --dry-run
```

Worker tests include encrypted secret round-trip/redaction/precedence/deletion, password hashing, registration/login/logout/throttling, sync compare-and-swap and concurrent conflict, premium rejection, linked/unlinked trainer permissions, invitations and notes, and bounded chat requests with mocked structured responses. UI tests cover the conflict merge/retry path and explicit approval of trainer/chat/replan changes. No paid provider requests are made by tests.

Round 4 workspace verification: all six Node/DOM suites above passed. Connected Chrome exercised 12 routes (including coach, trainer, account, challenges and replan) in Thai/English and dark/light at 375px without observed console errors. A visual check caught and fixed chat prompt wrapping; cached coach reload worked after stopping the local HTTP server. The standalone Playwright runner and `npx wrangler deploy --dry-run` were blocked by sandbox `spawn EPERM`; bundling and remote D1/Cloudflare deployment are not verified. Real provider authentication, paid Claude chat, push delivery and real cross-device accounts still require the configured server.
# Round 5c: sections 19–28

Apply `worker/migrations/0004_round5c.sql` after migrations 0001–0003 using your usual D1 migration workflow. This adds subscriptions, trial claims, organisations, engagement and price experiments. No migration or deployment is performed by the test suite.

Admin → **Domain / billing / trial** configures the public app URL, public API URL, monthly THB/USD prices, trial enablement/duration and optional email sender. Admin → **API keys** accepts encrypted `stripeWebhookSecret` and optional `resendApiKey`; existing `MASTER_KEY` encryption and environment-secret precedence apply. Organisation admins must already have accounts; their email is entered when the organisation is created. Seats include the admin (maximum 50, matching group capacity). Employee invitations grant membership, never admin privileges. Organisation challenges reuse group challenge/score tables but expose only aggregate results, suppressed below five contributors.

Stripe Billing setup:

- Enable recurring payments and the hosted Customer Portal in the Stripe dashboard.
- Register `https://api.<domain>/api/stripe/webhook` for `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, and `customer.subscription.deleted`; save its signing secret as `stripeWebhookSecret` (or `STRIPE_WEBHOOK_SECRET`). The worker verifies the raw body and timestamp and retrieves current subscription state to handle delayed events. Invoice IDs deduplicate revenue.
- Monthly Checkout requires an account and uses server-configured prices. Me → subscription status shows renewal/cancellation and opens the hosted portal. PromptPay remains one-time. Expiry reminders are included in the existing notification schedule.
- Trials use a separate device installation ID and unique account/device claims. Clearing browser storage can reset a device identity; this is a best-effort device restriction, not hardware attestation. Minimal hashed device claims survive account deletion to prevent reuse.
- Price experiments accept 2–3 variants with splits totalling 100. Prices are recomputed on the server and frozen in the existing order quote. Stopping selects the winning price for subsequent quotes. Existing quotes remain valid until their expiry. The significance label is exploratory, requires at least 30 views per compared arm, and does not adjust for repeated looks.

Win-back reminders require explicit opt-in in Me. The daily job selects accounts inactive for three days, reserves at most one delivery per seven days, prefers linked LINE (respecting its daily cap), then Web Push, then optional Resend with a configured sender. Unconfigured email is skipped. Admin displays successful sends and returns detected from later syncs. A failed or ambiguous delivery still consumes the reservation to avoid duplicate messages.

## ใช้โดเมนของตัวเอง

For GitHub Pages, add `app/CNAME` containing your actual domain, set its DNS CNAME to your GitHub account's Pages host (`<github-user>.github.io`), and enable **Enforce HTTPS**. For an apex domain use the GitHub Pages DNS instructions. Configure a Worker custom domain or route at `api.<domain>`. No placeholder CNAME is committed because it would affect deployment before you choose a real domain.

Set the app and API HTTPS URLs in Admin → Domain. The app origin is merged with the Wrangler `ALLOWED_ORIGINS` variable; Stripe return URLs use the configured app URL and LINE uses the configured API callback URL. Register the exact `https://api.<domain>/api/auth/line/callback` with LINE Login. Keep `CONFIG.API_BASE` in `app/js/config.js` pointed at the Worker: an admin page cannot write `app/config.json` on a static host. Rebuild/redeploy the static app when changing API_BASE.

## Daily backups and restore

Create a **private** R2 bucket and enable the `BACKUPS` binding shown in `worker/wrangler.toml`. The additional `0 20 * * *` cron runs at 03:00 Asia/Bangkok. It streams D1 tables in 250-row pages through gzip to `backups/YYYY-MM-DD.json.gz`, plus CONFIG KV (service secrets remain ciphertext), retains the last 30 daily copies and the first successful copy of each of the last 12 months under `monthly/YYYY-MM.json.gz`. Admin → Backups lists sizes and generates one-minute signed worker download links. Anyone possessing a link can use it until expiry; the R2 bucket itself is never public.

Backups are a paged logical export, not a transactionally consistent snapshot while writes are occurring. D1 also provides **Time Travel** for point-in-time recovery. Preserve `MASTER_KEY` and Wrangler secrets separately: KV ciphertext cannot be decrypted without the original key, and environment secrets are not exported.

Restore into a new, empty D1 database, first applying the same migrations, then generate import files locally:

```sh
node worker/scripts/restore.mjs downloaded.json.gz restore.sql
npx wrangler d1 execute <new-database> --remote --file restore.sql
npx wrangler kv bulk put restore.sql.kv.json --namespace-id <new-config-namespace>
```

Run Wrangler from `worker/` with the corresponding file paths. The restore script only writes files (refuses to overwrite); it does not connect to or mutate a database. It skips D1 migration bookkeeping already created by migration application. Validate counts and application behaviour before switching bindings. Restore contains sensitive account/health data; use private storage.

Form checking uses pinned MediaPipe Tasks Vision 0.10.21 and the lite model, loaded only after the camera button is selected. Camera frames stay on device; model files require an initial network connection. Two-dimensional angle heuristics are approximate, sensitive to camera angle/occlusion, and have synthetic-fixture coverage, not real-person accuracy validation. Eating-out macros are typical portion estimates, not brand-label measurements. New screens fall back to English where translations are unavailable.

Validation commands (test dependencies live in `tests/package.json`):

```sh
node worker/round5c.test.mjs
node tests/round5c.mjs
node tests/round5c-browser.mjs
```

The optional browser test requires Playwright (`PLAYWRIGHT_PATH` can point to its `index.mjs`, and `CHROME_PATH` can select Chromium). It covers five languages and both themes at 375px. Unit tests mock external billing/messaging services; they do not prove live Stripe, LINE, Resend, R2, camera or production operation.

### Automatic web deployment

Pushes to `main` that change `app/**` or `web/**` run `.github/workflows/deploy-web.yml` and `node web/deploy.mjs`. The workflow skips with a notice when either secret is missing. The existing Pages workflow remains for the old URL and its move notice.

1. Cloudflare → My Profile → API Tokens → Create Token → **Edit Cloudflare Workers**.
2. Scope the account to the Fixmee account and the zone to **fixmee.app**. Create and copy the token securely.
3. GitHub repository → Settings → Secrets and variables → Actions: add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (the Fixmee account ID from Cloudflare).

Do not commit token values. Local API bundle verification: `cd worker` then `npx wrangler deploy --dry-run`. Running `node web/deploy.mjs` performs a real web deployment.

### Exercise data and Round 6

Run `node scripts/import-exercises.mjs` manually to regenerate the committed exercise catalogue. The source commit is pinned in that script; Thai names are in `scripts/exercise-names-th.json`. Default generated plans still use the animated exercises. The full library loads on demand and viewed images are cached by the service worker. Credits and licence texts are listed in `THIRD_PARTY_NOTICES.md` and `#/credits`.

Admin access is at `#/admin` without a public navigation link. Login creates a two-hour session; the password is never stored in the browser. `GET /api/config` is public; key status is available only at authenticated `GET /api/admin/status`. Log out revokes the current session.

### Round 7 training settings

Use Training settings from Train or Me to choose training styles, equipment, weekdays, session length, muscle focus and preferred/avoided exercises, including library exercises. Changes apply on Save; existing profiles keep their previous plan until settings are saved. See [Round 7 validation](docs/ROUND7_VALIDATION.md) for tests, screenshots and local visual-review instructions.


### Round 8: AI credits and model settings

AI calls now use server-enforced credits for signed-in accounts and verified guest purchase wallets. A signed-in account receives 10 one-time trial credits. Pro receives 60 credits per 30-day window, including 90-day purchases and Stripe subscriptions; unused period credits do not stack. `credits40` adds 40 credits for THB 49 / USD 1.49, expiring after 90 days, through the existing Thunder or Stripe Checkout flow. Credit amounts, call costs, model/effort/token limits and THB conversion are configurable in the authenticated Admin ? AI tab.

The recommended routing is Sonnet for chat and reviews, Haiku for suggestion extraction and labels. AI requests share cached, stable system instructions; chat also enables automatic history caching. Photos are resized to at most 1024 pixels before AI upload. Ordinary on-device calculations do not consume AI credits. The coach and AI buttons show credits; Me ? AI usage shows balance, reset date, top-ups and the latest 20 usage records.

Before a future release, migration `worker/migrations/0005_ai_credits.sql` must follow migrations 0001?0004. This implementation did not apply any remote migrations or deploy. `GET /api/ai/credits` accepts an account session or a verified guest purchase token. `GET/PUT /api/admin/ai` requires an admin session. Public config exposes credit prices/allowances; private model settings and cost reports remain authenticated. Usage accounting stores token counts, model, feature, cost and credit amounts, never AI prompts or uploaded images. The existing account sync feature is separate from AI usage accounting.

See [Round 8 validation](docs/ROUND8_VALIDATION.md) for tests and the local Wrangler sandbox limitations. Cost rates are planning assumptions supplied in `CODEX_TASKS_8.md`, not verified live provider quotations.
