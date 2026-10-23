# Round 13 tasks for Codex — beta mode, admin cleanup, AI test lab, Gemini guide, no-flash rendering

Same rules as earlier CODEX_TASKS files. Worker: keep name/bindings/API URL; add a migration only if needed (`0009_round13.sql`). Deploy happens via GitHub workflows — do not deploy or apply remote migrations. Mock all third-party services.

Context: friends are now beta-testing the general features on https://fixmee.app. The owner wants all external-API features switched off for normal users, and an admin-only place to test AI.

## 1. "The site keeps refreshing" (Claude found the cause — fix first)
- `render()` in `app/js/app.js` replaces `#view` with a new `.view-inner` on **every** state change, and CSS plays entrance animations on it each time (`.view-inner { animation: fade … }`, `.view-inner>.card { animation: r10-enter … }`, ring/number count-ups). `views.today.mount` also calls a full `rerender()` every 60 s, and `syncNow()` runs on every `visibilitychange`. Result: the whole page fades/slides in again every minute and after every tap — users see it as the page refreshing.
- Fix:
  - Play entrance animations only on **route change** (add `data-enter` on `hashchange` render, remove it after the animation); plain re-renders must not animate. Count-up/ring-fill animations only on first view of the route per session.
  - Preserve scroll position, focused element (and caret position), open `<details>`, and open sheets across re-renders.
  - Today's 60 s tick updates only the time-dependent nodes (IF ring + countdown text, timeline "now" marker) without `rerender()`.
  - `syncNow()` on visibility/online: re-render only if the remote merge actually changed state; throttle to at most once per 60 s.
  - Social badge polling (30 s) must never re-render the view.
  - Service worker update: never reload the page automatically; when a new version is waiting show a small "มีเวอร์ชันใหม่ — แตะเพื่ออัปเดต" toast, and apply on tap or on next cold start.
- Test: a happy-dom test counting `.view-inner` replacements and animation attributes over a simulated 5-minute Today session with taps; must be 0 entrance animations after the first.

## 2. Beta mode: switch external APIs off for users
- New admin feature flag group **"โหมดเบต้า"** (default ON now) with per-integration toggles, all **off for users** by default: AI (all four engines incl. Gemini BYOK and on-device, ChatGPT/Gemini copy-paste), meal-photo and label-scan AI, body-photo AI, payments (Stripe, Thunder slip), donations, LINE login/reminders, Resend-dependent flows (verification falls back to "skipped" mode), map tiles (list view only). Push notifications stay available (they only need VAPID; see §5). Barcode lookup (Open Food Facts) stays on.
- When a feature is off: hide its buttons/entry points entirely (no dead buttons); where a page would be empty, show a friendly "ฟีเจอร์นี้เปิดเร็วๆ นี้ (ช่วงทดสอบ)" card. Server endpoints for disabled integrations return 403 `{code:'beta_disabled'}` for non-admin callers — the UI flag alone is not enough.
- Admin session bypass: when an admin token is present (admin logged in on this device), the app shows a small "Admin preview" pill and can use the disabled features for testing, without affecting other users.
- A "Beta tester" banner (dismissible) on Today: "กำลังทดสอบ — เจอปัญหากดเสนอ/รายงานได้ที่นี่" linking to the ideas board / report form.

## 3. Admin page cleanup (duplicated menus — see owner screenshots)
Current problems at 375–768 px: the new left nav (แดชบอร์ด, ตั้งค่าเริ่มต้น, สมาชิก, ความปลอดภัย, เนื้อหา, ยิม, การเงิน, AI, ระบบ, ออกจากระบบ) is shown **together with** the old round-5 tab chips (ออกจากระบบ again, โดเมน/รายเดือน/ทดลอง, องค์กร, ทดสอบราคา, สำรองข้อมูล, LINE, ร้านค้า, and a row of squashed one-letter chips "AI พร ตั้ง ขAP ส่ว นเ"); selecting "AI" or "เนื้อหา" still shows the same "ตั้งค่าระบบ" content; the old "ตั้งค่าเซิร์ฟเวอร์" card still tells the owner to run `npx wrangler login` (no longer needed — deploys use GitHub Actions); two logout buttons.
- One navigation only: left sidebar ≥ 900 px; on smaller screens a top bar with the current section name + a menu button that opens a full-height section list (or a horizontally scrolling single-line chip bar). Remove the legacy tab chip rows completely.
- Map every legacy panel into exactly one section and render **only** the selected section:
  - แดชบอร์ด: metrics.
  - ตั้งค่าเริ่มต้น: setup checklist (keep), business settings (PromptPay, receiver, contact email, prices if not free mode).
  - สมาชิก: members, supporters/badges, trainers.
  - ความปลอดภัย: report queue, word list, banned handles, avatar review, admin 2FA, sessions, audit log.
  - เนื้อหา: exercise videos, illustrations, recipes, announcements, push broadcast, shop products.
  - ยิม: gyms.
  - การเงิน: donations, payments, promos, payouts, domain/billing/trial, price experiments.
  - AI: engines, models/credits, usage, **AI test lab (§4)**.
  - ระบบ: beta-mode flags (§2), feature flags, languages, LINE, organisations, backups, error log, maintenance banner, keys/secrets status (read-only list, replace the old "ตั้งค่าเซิร์ฟเวอร์" card and remove the Wrangler instructions — say "deploy อัตโนมัติผ่าน GitHub Actions").
- One logout button (sidebar footer / menu). Deep links `#/admin/<section>` work and survive reload.
- Test: each section renders only its own panels; no legacy chips in the DOM; every legacy panel id is reachable from exactly one section.

## 4. Admin AI test lab (`#/admin/ai`)
- Run each AI task — coach chat, meal photo, body review, plan review, supplement label — against each engine: Claude (server key), Gemini (an admin-entered key kept in sessionStorage only for the lab, or a server-side `geminiApiKey` secret if set), on-device Nano (if available in this browser), ChatGPT/Gemini copy-paste (builds the prompt and parses a pasted reply).
- Inputs: sample fixtures (bundled sample meal photo/label/body silhouette images that are synthetic, profile presets) or upload your own; editable prompt preview; model picker.
- Output panel: raw response, parsed structured result, zod validation status, latency, tokens and estimated cost (Claude/Gemini), errors with request id. "Compare" mode runs one input on two engines side by side.
- Nothing from the lab is saved to any user account; lab calls are tagged `admin_test` in usage stats and excluded from user dashboards.

## 5. Notifications: make them testable and honest
- Today the public VAPID key is empty (`/api/push/key` → `publicKey: ""`), so no push can be delivered. Admin setup checklist "การแจ้งเตือน" card: generate keys (exists) + clearly show "ยังส่งไม่ได้ จนกว่าจะสร้างคีย์".
- User side: notification settings show the real state — not supported (iOS not installed as an app / browser), permission denied, server not configured, or active — with instructions per platform (Android Chrome; iPhone: install to home screen first, iOS 16.4+).
- "ส่งทดสอบถึงตัวเอง" button for users (rate-limited 3/hour) after subscribing; admin "send test to device id/user".
- Verify the 5-minute cron delivers scheduled reminders at the user's local time (timezone stored at subscribe) — add a worker test with a fake clock across Asia/Bangkok and another zone, including DST-free and DST zones.

## 6. Gemini setup guide (for when AI is enabled later)
- `#/ai-guide/gemini`: an illustrated step-by-step wizard (5 steps, each with an in-app drawn mock of the Google AI Studio screen — no screenshots of Google UI): 1) open https://aistudio.google.com/app/apikey and sign in with a Google account, 2) "Create API key" (choose/create a project), 3) copy the key, 4) paste into Fixmee and press "ทดสอบ", 5) optional: set usage limits / understand free-tier data use.
- Inline troubleshooting: invalid key, API not enabled, quota exceeded (429), region not supported, network blocked; each with the exact Gemini error text pattern → Thai explanation and fix.
- FAQ: is it free, what is sent, where the key is stored (only this device), how to delete it, how to revoke it in AI Studio.
- Linked from AI settings, help centre and the admin AI lab. Hidden from users while beta mode has AI off (admins can preview).

## Done when
- No full-view re-render animation after the first render of a route (test); scroll/focus preserved; no automatic page reloads.
- Beta mode: with flags off, a normal user sees no AI/payment/donation/LINE entry points and the server rejects those endpoints with `beta_disabled`; an admin on the same build can use them (tests for both).
- Admin: single navigation, sections render only their panels, no Wrangler instructions remain, deep links work (tests + screenshots at 375/768/1280 px in both themes → `docs/round13-screens/`).
- AI lab works with mocked engines (tests); Gemini guide renders in th/en with troubleshooting mapping tests.
- Notification status UI shows each state correctly (tests); cron timezone test passes.
- All existing tests pass; worker dry-run bundles (or report the sandbox block). Leave changes uncommitted; do not push or deploy.
