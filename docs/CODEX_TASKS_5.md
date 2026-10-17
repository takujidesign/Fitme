# Round 5 tasks for Codex

Same rules as earlier CODEX_TASKS files. Builds on round 4 (accounts in D1, admin page, encrypted secrets, trainer links). All new worker inputs validated with zod; tests in `tests/` and `worker/test.mjs`.

## 1. Privacy policy, terms and consent (PDPA)
- Routes `#/privacy` and `#/terms` with Thai + English text in `app/js/legal.js`: data collected (profile, health data, body photos stay on device, what goes to the server: account, synced state, slips, AI requests), purposes, legal basis (explicit consent for sensitive health data), processors (Cloudflare, Stripe, Thunder Solution, Anthropic), retention, user rights (access, correction, deletion, withdraw consent, data portability), contact email (from admin config `contactEmail`), effective date, and a clear "general wellness guidance, not medical advice" disclaimer. Mark the top with "ร่างเบื้องต้น — ควรให้ผู้เชี่ยวชาญกฎหมายตรวจก่อนใช้งานจริง".
- Onboarding: final step requires ticking "ยอมรับเงื่อนไข" and a separate explicit consent for health data processing; store `consents: {terms: date, health: date, version}`. Re-ask when the policy version changes. Links in Me and the pay page.

## 2. Delete account and data / export
- Me → account: "ดาวน์โหลดข้อมูลของฉัน" (full JSON incl. server copy) and "ลบบัญชีและข้อมูลทั้งหมด" (type the email to confirm). Worker `DELETE /api/account` removes the user row, sessions, synced state, trainer links, notes, push subscriptions, referral records; keeps only payment records required for accounting with the user id replaced by a random hash. Also clears local data on the device.

## 3. Error reporting and anonymous analytics (self-hosted, no third parties)
- App: `app/js/telemetry.js` captures `window.onerror` / `unhandledrejection` (message, file:line, route, app version, UA family — no state, no personal data) and a few events (onboarding_done, workout_done, purchase_started/completed, ai_used). Sent in batches to `POST /api/telemetry` with a random install id. Opt-out toggle in Me (default on, explained in the privacy policy).
- Worker stores daily aggregates in D1 (`telemetry_daily(date, kind, name, count)`, `errors(hash, message, route, version, count, first_seen, last_seen)`), rate-limited per install id.
- Admin dashboard shows errors (top 20) and event counts.

## 4. Promo codes and referrals
- Admin: create promo codes (code, % or fixed THB/USD off, product ids, max uses, expiry, active). Worker validates at checkout: Stripe price and PromptPay expected amount use the discounted price; usage counted after payment is verified.
- Referral: each logged-in user gets a link `?ref=CODE`; a new user who signs up with it and makes a first purchase gives both sides +7 days Pro (configurable in admin). Show "ชวนเพื่อน" card in Me with copy/share and count of successful referrals.

## 5. Admin dashboard
- Admin page gets tabs: ภาพรวม / การตั้งค่า / คีย์ API / โค้ดส่วนลด / เทรนเนอร์ / ข้อผิดพลาด.
- ภาพรวม: members (total, new last 7/30 days, trainers), active Pro, revenue by day (last 30 days, THB and USD separately), sales by product and payment method, conversion (signups → purchase), AI usage counts. Record every verified payment in D1 `payments(id, user_id?, product, amount, currency, method, ref, promo, created_at)` from the slip and Stripe flows. Simple SVG bar/line charts like the existing app charts.

## 6. Trainer marketplace with revenue share
- Trainers can create plan templates (name, description, price THB/USD, duration weeks, target goal/level, the workout settings and optional notes per week) and publish them after admin approval.
- Users browse `#/plans`, buy a plan (Stripe Checkout or PromptPay like other products, promo codes allowed), and applying it sets their profile/training settings and links them to the trainer.
- Revenue share: admin config `trainerShare` (default 70 %). For Stripe use **Stripe Connect Express**: trainer onboarding link (`/api/trainer/connect`), destination charges with `application_fee_amount`. For PromptPay sales record a payable balance per trainer; admin page lists balances and a "จ่ายแล้ว" button to mark manual payouts. Trainers see their sales and balance.

## 7. Exercise demo videos
- Each exercise can have an optional video: admin page "วิดีโอท่า" lets the admin set a URL per exercise (YouTube/Vimeo link or an uploaded MP4 stored in R2 binding `MEDIA` via `PUT /api/admin/media/:id`). Exercise sheet and player show a "ดูวิดีโอ" toggle next to the animation (lazy-loaded, muted loop for MP4; privacy-enhanced youtube-nocookie embed). Animation stays the default and offline fallback.

## 8. Women's health mode
- Optional in profile (only when sex = female, explicit opt-in): cycle tracking (last period start, average cycle length) → phase per day (menstrual, follicular, ovulation, luteal). Plan adjustments: menstrual phase → lower intensity option and more mobility, luteal → +100-150 kcal guidance and cravings tips; user can turn adjustments off.
- Pregnancy and postpartum: these modes require ticking "แพทย์อนุญาตให้ออกกำลังกายแล้ว". Pregnancy: no lying-on-back exercises after the first trimester (exclude bench_press, crunch, leg_raise, bridge, superman), no jumping/high-impact, no fasting (IF disabled), no calorie deficit, moderate intensity, kegel/mobility suggestions, warning signs list (bleeding, dizziness, chest pain, contractions) → stop and contact a doctor. Postpartum: gentle 0-6 weeks (walk, breathing, pelvic floor), progressive return afterwards, no IF while breastfeeding, +400-500 kcal while breastfeeding. Supplement warnings when products' labels say not for pregnant/breastfeeding women (L-carnitine, collagen etc. — use the existing `note` text and a new `notPregnancy` flag in the catalog).

## 9. Special programs
- Program picker (Workout page → "โปรแกรม"): **วิ่ง 5K** (8-week walk/run intervals, 3 runs/week + 1 strength day), **ปวดหลัง** (gentle core and mobility: bird dog, dead bug, cat-cow, glute bridge, walking; excludes deadlift, rdl, superman, crunch; doctor note), **ผู้สูงอายุ 60+** (balance, chair squats, wall push-ups, step-ups, walking, flexibility; low impact, longer rest), **มือใหม่ 0→1** (2-week habit builder). Programs override the split generator while active and show progress by week.
- Add the new exercises needed with poses in the same keyframe format as `exercises.js` (bird_dog, dead_bug, cat_cow, chair_squat, wall_pushup, step_up, run_interval, side_plank, kegel/breathing as a timed "หายใจ" card) and check every new pose renders (side/front views).

## 10. LINE Login and LINE OA notifications
- LINE Login (OAuth 2.1 + PKCE): admin config `lineChannelId`, secret `lineChannelSecret` stored with the round 4 encrypted secrets. `GET /api/auth/line/start` → redirect with `state` + `code_challenge` and `bot_prompt=aggressive` (asks to add the OA as a friend); `GET /api/auth/line/callback` exchanges the code, verifies the ID token (`/oauth2/v2.1/verify`), creates or links a user (`users.line_user_id`), and returns to the app with a one-time code the app swaps for a session. Existing email users can link LINE from account settings.
- LINE OA reminders: admin secret `lineMessagingToken`. The round 3 cron sends reminders through the Messaging API push endpoint to users who linked LINE and chose "แจ้งเตือนทาง LINE" (per reminder type), as an alternative to Web Push. Respect a daily message cap per user (admin setting) because push messages beyond the free quota cost money; show this in the admin page. (LINE Notify was discontinued — do not use it.)

## 11. Barcode scan for packaged food
- Food log: "สแกนบาร์โค้ด" uses the `BarcodeDetector` API when available, else lazy-load ZXing (`@zxing/browser` from cdnjs/jsdelivr with a pinned version) with the rear camera. Look up `https://world.openfoodfacts.org/api/v2/product/<code>.json` (fields: product_name, brands, nutriments per 100 g / per serving, serving_size, image). If not found, offer manual entry and save it as a custom food keyed by barcode (`state.customFoods`, synced). Cache lookups locally.

## 12. Groups and leaderboards
- Logged-in users can create a group (name, 6-char join code, max 50 members) and a group challenge (steps from Health data, workouts done, active minutes, water days) with start/end dates. D1 tables: `groups`, `group_members`, `group_challenges`, `group_scores(day, user_id, metric, value)`.
- App uploads only the daily aggregate needed for the metric. Leaderboard `#/groups/:id` (rank, display name or nickname, value, streak), weekly winner badge. Users choose a public nickname; never show emails. Leave/delete group; owner can remove members.

## 13. Shop and affiliate links
- Admin page "ร้านค้า": products with name, image URL, price text, category (supplement/equipment/food), tags (e.g. creatine, whey, dumbbell, yoga mat), affiliate URLs (Shopee, Lazada, other), active flag, sort order. Stored in KV/D1, public read endpoint.
- App `#/shop` and contextual suggestions: supplements page (match product tags with the user's supplements or category gaps), workout page (equipment for the chosen location), clearly labelled "ลิงก์พันธมิตร — เราอาจได้รับค่าคอมมิชชั่น". Click tracking via `GET /api/shop/go/:id` (counts in D1, then 302 to the affiliate URL; allow only https URLs on an admin-approved domain list). No in-app checkout for physical goods in this round.

## 14. More languages: Chinese, Japanese, Vietnamese
- Refactor `L()` in `app/js/ui.js` to support `{th, en, zh, ja, vi}` objects and `L(th, en)` calls via a dictionary `app/js/i18n/<lang>.js` keyed by the English string (generate the dictionaries for all existing UI strings; foods, exercises, supplements and goals get `zh/ja/vi` names too). Fallback order: chosen language → English → Thai. Language picker in onboarding and Me (ไทย, English, 中文, 日本語, Tiếng Việt). Dates/numbers via `Intl` with the right locale; add Google Fonts Noto Sans SC/JP only when those languages are selected (lazy). Keep AI prompts answering in the user's language.

## 15. Full offline mode with downloadable videos
- Me → "โหมดออฟไลน์": shows storage usage (`navigator.storage.estimate()`), "ดาวน์โหลดวิดีโอท่าในแผนของฉัน" (only MP4 videos from R2; YouTube cannot be cached — say so), progress bar, delete button. Videos stored in the Cache API under a separate cache name that the service worker version bump does not delete; request `navigator.storage.persist()`. Player and exercise sheet use the cached copy offline.
- Make sure every app route, fonts and the QR library work offline after first load; queue telemetry, sync and food logs while offline and flush when back online.

## 16. "วันนี้ไม่ไหว" — readiness-based adjustment
- Today page and workout page: quick check-in (energy 1-5, sleep hours auto from the sleep log, soreness body map: legs/back/shoulders/arms, stress 1-5). Readiness score → today's session: normal / lighter (−1 set, lower-intensity variants, no finisher) / recovery (walk + mobility) / rest. A "วันนี้ไม่ไหว" button directly switches to the recovery session. Store in `logs[iso].checkin`; the 4-week re-plan uses it.

## 17. Medical conditions (diabetes, hypertension, gout/high uric acid)
- Profile "โรคประจำตัว" (opt-in, sensitive data → covered by the health consent): diabetes, hypertension, high uric acid/gout, high cholesterol, kidney disease, heart disease, plus "อื่นๆ". Effects:
  - Diabetes: evenly spaced carbs, prefer low-GI carbs (brown rice, riceberry, oats, sweet potato over jasmine rice/rice noodles), no IF unless "แพทย์อนุญาต" is ticked, warn about hypoglycaemia with exercise.
  - Hypertension: sodium note per meal and avoid salty items; avoid heavy breath-holding lifts (note on bench/deadlift: exhale on effort).
  - Gout / high uric acid: limit high-purine foods (shrimp, organ meats, some fish, beer), flag them in meal plans and swaps; extra water target.
  - Kidney disease: do NOT raise protein; cap protein at 0.8 g/kg and show "ปรึกษาแพทย์ก่อนปรับโปรตีน"; warn about creatine.
  - Heart disease: require "แพทย์อนุญาต"; moderate intensity only, no HIIT finishers.
- Every condition shows a persistent "ปรึกษาแพทย์" banner. Never claim treatment.

## 18. Medications and interaction warnings
- "ยาที่ทานประจำ": name (free text + common Thai/generic list), dose text, times, with/without food → reminders in the timeline, push/LINE and ICS.
- `app/js/interactions.js`: a small curated, cited rule list between common medication classes and the supplements in the app (examples: warfarin/anticoagulants ↔ vitamin E, vitamin K, fish oil, astaxanthin; levothyroxine ↔ calcium/iron/multivitamins/whey — separate by 4 h; metformin ↔ vitamin B12 note; statins ↔ red yeast rice; MAOIs ↔ high-tyramine foods; diuretics ↔ potassium; kidney disease ↔ creatine). Output: warning text + "แยกเวลาทาน X ชั่วโมง" when applicable; the scheduler moves the supplement accordingly. Disclaimer: "ไม่ครอบคลุมทุกกรณี ปรึกษาเภสัชกร". Include source links in comments.

## 19. AI form check with the camera (on-device)
- Player button "ตรวจฟอร์มด้วยกล้อง" for squat, lunge, push-up, plank, bridge, shoulder press, lateral raise, curl: lazy-load MediaPipe Tasks Vision Pose Landmarker (`@mediapipe/tasks-vision` pinned version from jsdelivr, lite model) and run it on the front camera locally — no frames leave the device; say so on screen.
- Per exercise: rep counter from joint-angle state machine (e.g. knee angle for squat, elbow angle for push-up), hold timer for plank, and 2-3 form rules (squat depth, knees caving, torso lean; push-up hip sag; plank hip height; shoulder press elbows flaring). Voice/visual cue on errors, summary at set end, auto-fill reps into the set log. Graceful fallback if the camera/model is unavailable.

## 20. Mood, stress and breathing
- Daily mood (5 faces) and stress 1-5 with optional note; trends chart in Me. Exercises: box breathing 4-4-4-4, 4-7-8 for sleep, 2-minute body scan, with an animated circle and optional voice (round 3 voice module). Suggest one after a high-stress check-in or before bedtime.

## 21. Eating out: convenience stores and Thai dishes
- Add a food group "อาหารนอกบ้าน" with typical portions: 7-Eleven items (อกไก่ปรุงรสพร้อมทาน, ไข่ต้ม, ข้าวกล่องยอดนิยม, แซนด์วิช, โยเกิร์ต, นมถั่วเหลือง), ร้านตามสั่ง (กะเพราไก่ไข่ดาว, ข้าวผัด, ราดหน้า, ผัดซีอิ๊ว), ข้าวมันไก่, ส้มตำ+ไก่ย่าง, ก๋วยเตี๋ยว, สุกี้, ชาบู. Each with kcal/protein/carbs/fat per portion and "สั่งยังไงให้ดีต่อแผน" tips (e.g. ขอน้ำมันน้อย, ไข่ต้มแทนไข่ดาว). Mark values as typical estimates.
- Meal plan option "กินข้าวนอกบ้านมื้อไหน" (lunch/dinner): those slots pick eating-out dishes and the remaining meals rebalance to hit daily protein.

## 22. Monthly subscription (auto-renew)
- Stripe Billing: product "Pro รายเดือน" with monthly price (THB/USD from admin). Checkout in `mode=subscription`; webhook `POST /api/stripe/webhook` (verify the `Stripe-Signature` header with the webhook signing secret stored as an encrypted secret) handles `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated/deleted` and updates the user's entitlement in D1 (requires an account). Customer portal link (`/api/stripe/portal`) for cancel/change card. Show renewal date and status in Me. PromptPay stays one-time (no auto-renew) with a reminder before expiry.

## 23. Corporate / team package
- Admin creates an organisation (name, seats, expiry, price note) and gets an invite link/code. Employees who join get Pro while the org is active. Org admin role: `#/org` dashboard with aggregate, anonymised stats only (active members, workouts per week, average steps, challenge participation) and only when ≥ 5 members contribute (k-anonymity); never individual health data. Org-wide challenges reuse the groups feature.

## 24. Free 7-day Pro trial
- New accounts (one per account and per device install id) can start a 7-day trial from the pay page and the onboarding summary; worker issues a trial entitlement token (`pid: 'trial7'`). Admin can toggle the trial and its length. Reminder 1 day before it ends.

## 25. Win-back messages
- Cron daily: users with no app activity (last sync) for 3 days and opted in to reminders get one friendly message via LINE (if linked) or Web Push (email only if an email provider is configured — add optional Resend API key as an encrypted secret; if not set, skip email). Max one win-back per 7 days; content varies (streak at risk, today's short workout, a challenge). Admin page shows sent/returned counts.

## 26. Price A/B testing
- Admin: create an experiment with 2-3 variants of product prices/labels and traffic split. Variant assigned per install id (stable hash) and sent with checkout; worker enforces the variant price (never trust the client price). Dashboard: views of the pay page, checkouts started, purchases and revenue per variant, with a simple significance indicator. Stop experiment → pick the winner.

## 27. Custom domain, configurable
- Admin "โดเมน": field for the public app URL; the worker uses it for `ALLOWED_ORIGINS` (merged with the wrangler var), Stripe return URLs and LINE callback URLs. App: no hard-coded `takujidesign.github.io` anywhere (check README too); `CONFIG.API_BASE` may be set from the admin page into a small `app/config.json` is NOT possible on a static host, so keep `API_BASE` in `config.js` and document it.
- README section "ใช้โดเมนของตัวเอง": GitHub Pages custom domain (add `app/CNAME`, DNS CNAME to `takujidesign.github.io`, enable HTTPS) and a Worker custom domain/route (`api.<domain>`).

## 28. Daily database backups
- Cron (daily 03:00 Asia/Bangkok): export all D1 tables to JSON (paged), gzip, and store in R2 binding `BACKUPS` as `backups/YYYY-MM-DD.json.gz`; keep the last 30 daily and 12 monthly copies (delete older). Also back up the CONFIG KV (encrypted secrets stay encrypted). Admin page: list of backups with size, download link (admin only, short-lived signed URL via the worker), and a documented restore script `worker/scripts/restore.mjs` (D1 import). Note in README that D1 also has built-in Time Travel (point-in-time restore).

## Done when
- No console errors on all routes, all 5 languages, both themes, 375px; old state loads.
- Worker tests: account deletion removes all rows, promo code math and expiry, referral reward once only, Connect fee calculation, telemetry rate limit and no PII stored, media upload admin-only, LINE callback state/PKCE validation and ID-token verification path (mocked), group access control (non-members cannot read scores), affiliate redirect allow-list.
- More worker tests: Stripe webhook signature verification and subscription state changes, trial once per account/device, A/B variant price enforcement, org stats hidden below 5 members, backup retention pruning. App unit tests in `tests/` for readiness adjustment, condition rules (kidney protein cap, gout purine flags), medication interaction spacing, rep-counter state machine (with recorded landmark fixtures).
- README: R2 `MEDIA` and `BACKUPS` bindings, Stripe Connect + Billing webhook setup, LINE channel setup (Login + Messaging API), custom domain, new migrations, legal review note.
