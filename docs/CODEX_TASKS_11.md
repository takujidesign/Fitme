# Round 11 tasks for Codex — animation fixes, social + gym check-in, guided tour, Me/admin redesign, random themes

Same rules as earlier CODEX_TASKS files (static ES modules in `app/`, `L()` + zh/ja/vi, new files in `SHELL` of `app/sw.js` without touching the `VERSION` line, 375px, both themes, per-tab accents, offline-safe, backward-compatible state, tests). Worker: keep name/bindings/API URL; new migration `worker/migrations/0007_round11.sql`. Deploy happens via GitHub workflows — do not deploy or apply remote migrations.

## 1. Exercise animation correctness (Claude's audit of all 40)
Claude rendered the start/peak frame of every exercise. Fix these:
- **Root cause, all exercises — angle interpolation.** `lerpVal` in `app/js/figure.js` lerps joint angles linearly, so `triceps_ext` (forearm 176° → −35°) sweeps 211° forward through horizontal instead of folding 149° behind the head (owner's screenshot: dumbbell held straight out in front). Interpolate angles along the shortest arc (normalise the delta to −180…180) unless a frame explicitly opts into the long way (`ex.longArc = ['a2', …]`). Re-check every exercise after this change.
- `child_pose`: renders lying flat. Should be kneeling, hips back on heels, torso folded over thighs, arms reaching forward on the floor, forehead down.
- `quad_stretch`: knee comes forward and the hand reaches forward. Should be standing on one straight leg, other knee pointing down, heel pulled to the glute **behind**, same-side hand holding the ankle behind, other hand on a wall/hip.
- `deadlift`: peak frame has a gap between torso and legs (hip joint disconnected); start frame hides the arms. Start = hip hinge with knees bent, flat back, arms straight down holding the bar at mid-shin; peak = standing tall, bar at thighs.
- `side_plank`: looks piked with the top arm vertical. Body must form one straight line from head to feet on one forearm (elbow under shoulder); top arm on the hip or straight up; hips lifted, not piked.
- `crunch`: peak is a full sit-up. Lift only the shoulder blades (~25–30° trunk flexion), lower back stays down.
- `jog` / `run_interval`: stride as wide as a lunge. Shorter stride, knee drive, slight forward lean, arms bent ~90°.
- `mountain_climber`: knee drive barely visible. Alternate knee to chest clearly under the hips, plank line kept.
- Props must render in Start–Finish frames and thumbnails (bench, bar, dumbbells, wall, chair, step, mat).
- Player screen: the "เชื่อมต่อนาฬิกา/สายคาดอก" card sits above the figure and pushes it down (owner's screenshot). Move it into a small heart-rate icon button in the player header that opens a sheet.
- **Automated pose checks** (`tests/poses.mjs`) over every keyframe and 8 interpolated steps: joint angles within human ranges (elbow 0–160°, knee no hyper-extension > 5°, shoulder/hip limits), no foot or hand below the floor line, no gap > 2 px between connected segments, hands on the implement when the exercise has one, and per-exercise invariants (plank/side plank body line straight ±10°; triceps extension upper arm vertical ±20° throughout; curls upper arm vertical ±15°; squat knees track over feet). Also export `docs/round11-screens/poses.png`: a contact sheet of start / mid / peak for all 40 so the owner can review.
- Generate the 6 missing AI illustrations with your built-in image generation (same style as round 9B; `goblet_squat`, `bridge`, `triceps_ext`, `db_row`, `crunch`, `walk`), check poses yourself, add to `app/data/illustrations.json`.

## 2. Profiles, friends, chat, gym check-in
Accounts are required for everything in this section. Minimum age 16 (ask at sign-up; store only "age ≥ 16" flag).

### 2.1 Profile
- Avatar upload: pick/take photo → square crop UI → resize to 256×256 WebP in the browser → `POST /api/profile/avatar` → R2 `MEDIA` under `avatars/<userId>/<random>.webp`; old file deleted. Default avatar = initials on the user's accent colour.
- Fields: display name (≤ 40), unique `@handle` (3–20, a–z 0–9 _ ., reserved words blocked), bio (≤ 160), home gym (§2.4), badges (supporter, streak 7/30/100, PR count, check-ins).
- Privacy per item: profile visible to `everyone / friends / only me`; stats shown (workouts, streak, weight change — weight hidden by default), check-ins visibility, "appear in friend suggestions" toggle.
- Public profile page `#/u/<handle>`; share link + QR.

### 2.2 Friends
- Add by `@handle` search, invite link/QR (`fixmee.app/#/add/<code>`), and suggestions (same gym, mutual friends) only for users who opted in.
- Requests: send / accept / decline / cancel; remove friend; **block** (hides both ways, stops chat) and **report** (reason + optional message ids) → admin queue (§4).
- Activity feed `#/friends`: friends' finished workouts, PRs, check-ins, challenge wins; reactions (💪 🔥 👏) and short comments; mute a friend.

### 2.3 Chat
- 1:1 and group chats (up to 20, reuse existing groups where it fits). Text (≤ 2,000 chars), emoji reactions, reply-to, share cards (workout summary, PR, meal, recipe, check-in), photos that **auto-delete after 24 h** (R2 lifecycle + D1 expiry; viewer sees a countdown; no download button), typing indicator, read receipts (toggle).
- Realtime: Cloudflare Durable Object per conversation with WebSocket (hibernation API); fallback to polling every 5 s when WebSockets fail. New-message Web Push (existing push system) with per-chat mute. Unread badge on the Me tab and in the friends list.
- Retention: messages kept 180 days then deleted; users can delete their own messages ("ลบสำหรับทุกคน" within 1 h). Messages are encrypted at rest only by the platform — say so plainly in privacy text (no end-to-end claim).
- Safety: only friends can start a chat (groups via invite), rate limit 30 messages/min, links shown as plain text with a warning, simple Thai/English profanity filter (admin-editable word list), block/report from any message.

### 2.4 Gym check-in with maps
- Gym directory: nearby search from OpenStreetMap (Overpass API: `leisure=fitness_centre`, `leisure=sports_centre` with `sport=fitness`, `amenity=gym`) within 3 km of the user's location, cached in D1 (`gyms` table, refreshed ≤ weekly per area). Users can add a missing gym (name + pin) → pending until admin approves. Each gym has "เปิดใน Google Maps" (`https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`) and directions links. Map view: Leaflet (BSD-2) with OSM-compliant tiles from a provider allowed for apps (make the tile URL admin-configurable; default to a free-tier provider and show attribution) — or a list-only view if no tile URL is set. Do not scrape Google Maps.
- Check-in: button on Today/Train → asks for location once → must be within 200 m of a gym (accuracy ≤ 100 m) → one check-in per gym per 4 h → shows on profile and friends feed per privacy setting; links to that day's workout. Location is used only at check-in time; never stored except the gym id and time.
- Gym page: who of my friends checked in this week (opt-in), my visit count, streak of gym days, "เพื่อนที่ยิมเดียวกัน" suggestions (opt-in).
- Badges: first check-in, 10/50/100 visits, 3 different gyms.

### 2.5 Extra ideas to build now
- **Train together**: invite a friend to a live session — both see the same workout and a shared rest timer via the chat Durable Object; finish screen shows both results.
- **Friend challenges**: 7- or 30-day duels (workouts, steps, check-ins) using the existing challenge engine, with a leaderboard among friends only.
- **Weekly recap card** (Sunday): workouts, minutes, PRs, check-ins, nutrition adherence; share to chat or as an image.
- **Accountability buddy**: pick one friend who gets a gentle push notification if you skip 2 planned workouts in a row (both must opt in).

## 3. Guided tour and help
- **First-run tour** (after onboarding): 6 coach marks with a spotlight cut-out, one per tab plus the AI coach button; each step uses that tab's accent colour; Next / Back / Skip; progress dots; focus trap, Esc to close, keyboard and screen-reader friendly; respects reduced motion.
- **Getting-started checklist** card on Today until done (dismissible): set profile photo, finish training settings, log a meal, add a supplement, finish first workout, choose an AI engine, add a friend, check in at a gym. Progress ring; confetti on completion.
- **Contextual tips** the first time a feature is opened (workout player, meal photo, barcode scan, supplement label scan, calendar, tools, chat, check-in) — one-line tip with "เข้าใจแล้ว".
- **Help centre** `#/help`: searchable FAQ (≥ 25 Q&A in 5 languages: plans, food, supplements, AI engines and keys, privacy, data backup, friends/chat safety, check-in, donations), "ดูทัวร์อีกครั้ง", "รีเซ็ตคำแนะนำทั้งหมด", contact/report a problem (creates an idea/report).
- A "?" icon in each main page header opens that page's tips.

## 4. Me page redesign and settings verification
Claude's audit: the Me page shows ~50 controls with duplicates ("แก้ไขข้อมูล" ×2, "บัญชี" ×2, "ความเป็นส่วนตัว" ×2), an unlabeled `winback-opt` button, subscription status shown in free mode, and raw "Failed to fetch" toasts when offline or signed out. Every handler exists; now make it clear and prove each works.
- New structure (grouped list rows with icons, chevrons, current value on the right):
  1. Profile header: avatar, name, @handle, badges, edit profile, share profile.
  2. ความคืบหน้า: weight, body photos, measurements, records/PRs, muscles, weekly recap.
  3. แผนของฉัน: training settings, food preferences, supplements, plan length (7/30/60/90), restart plan.
  4. เพื่อนและชุมชน: friends, chat, groups/challenges, gym check-ins.
  5. AI: engine (shows current), AI usage/credits (only when the Claude engine is enabled), AI summary page.
  6. แอป: language, theme and colours (§6), notifications, offline mode, guided tour/help.
  7. สุขภาพ: medical conditions, medications, wellbeing, health consent.
  8. บัญชีและข้อมูล: account and sync, back up / restore, export PDF / ICS, delete all data.
  9. สนับสนุน: donate, ideas board, credits, privacy, terms.
  - Hide subscription/pay/win-back rows when `freeMode` is on; label every row; no duplicates.
- Errors: replace raw network errors with friendly messages ("ยังไม่ได้เข้าสู่ระบบ", "ออฟไลน์อยู่ — จะลองใหม่เมื่อออนไลน์", "เซิร์ฟเวอร์ไม่ตอบ") everywhere via one helper.
- **Settings test matrix** (`tests/settings.mjs`, happy-dom): for every row, change the setting and assert the **effect**, not just state: language → visible strings change and `<html lang>`; theme → `data-theme`; accent mode (§6) → CSS variables; plan length → calendar/plan days; food prefs/exclusions → meal plan excludes the food; fasting window → timeline/IF card; supplements → schedule; training settings → generated plan; notifications time → scheduled reminder entry; offline mode → assets cached flag; medical/medications → notes/interaction warnings appear; consent withdraw → consent screen; backup → JSON excludes Gemini key; restore → state restored; delete all → state reset; edit profile → targets recalculated. Record results in `docs/ROUND11_VALIDATION.md`.

## 5. Admin redesign
Explain in README "Admin guide": open `https://fixmee.app/#/admin`, log in with `ADMIN_PASSWORD` (Cloudflare → Workers → fitme-api → Settings → Variables and Secrets), session lasts 2 h.
- Layout: left nav on ≥ 900 px, scrollable segmented nav on mobile; every section loads only after login; accent = Me colour.
- Sections:
  1. **แดชบอร์ด**: today/7/30-day users (active, new), workouts, check-ins, messages, AI calls and cost, donations, open reports, pending ideas/gyms, top errors; small charts.
  2. **ตั้งค่าเริ่มต้น (setup checklist)**: step-by-step cards with ✓/✗ status and a "ทดสอบ" button each: PromptPay ID + receiver name (QR preview), Thunder key, Wise/Stripe donation links, Claude key, Gemini default model hint, VAPID keys (**generate in the browser** and save; set `VAPID_SUBJECT` from the contact email), LINE, Resend email, contact email, map tile URL, free mode.
  3. **สมาชิก**: search by email/@handle, view profile/activity summary, suspend/unsuspend, delete account (PDPA request), grant/revoke supporter, adjust AI credits, export a member's data.
  4. **ชุมชน/ความปลอดภัย**: report queue (chat messages, profiles, avatars, ideas, check-ins) with actions dismiss / remove content / warn / suspend; profanity word list; banned handles; avatar review list.
  5. **เนื้อหา**: exercise videos, illustrations (approve/replace), recipes, shop products, announcements (banner with start/end date and target language), push broadcast (with preview and confirmation, rate-limited).
  6. **ยิม**: pending gyms (approve/merge/reject), edit gym data.
  7. **การเงิน**: donations, payments, promos, trainer payouts, Wise/Stripe links.
  8. **AI**: enabled engines, Claude models/effort/credit prices, usage and cost.
  9. **ระบบ**: feature flags (freeMode, social, chat, check-in, AI engines), maintenance mode banner, backups, error log, **audit log** of every admin change (who/what/when, stored in D1), active admin sessions with "log out all", optional TOTP two-factor for admin login.
- Every destructive admin action needs a confirm dialog and writes to the audit log.

## 6. Theme colours — random and custom
- Theme sheet gains "สีธีม": **ตามเมนู** (default, round 10 accents) / **สีเดียว** (pick from 12 presets or a colour wheel) / **🎲 สุ่ม**.
- Random: generate in OKLCH — random base hue, each tab offset by 72° so tabs stay distinct; lightness/chroma tuned separately for dark and light themes and auto-adjusted until text-on-accent and accent-on-background pass WCAG AA. Buttons: "สุ่มใหม่" (with a quick colour-wheel spin animation), "ล็อกสีนี้" per tab, "บันทึกชุดสี" (up to 5 saved palettes), "สุ่มทุกวัน" toggle.
- Supporters get 3 extra gradient palettes. Palettes sync with the account.
- Tests: generated palettes always pass contrast in both themes (1,000 random seeds); locked tabs keep their colour; saved palettes restore exactly.

## 7. Migration `0007_round11.sql`
`profiles` (user_id, handle UNIQUE, display_name, bio, avatar_key, privacy JSON, home_gym, created), `friendships` (a, b, status, created), `blocks`, `reports` (id, reporter, target_type, target_id, reason, status, created), `conversations`, `conversation_members`, `messages` (id, conversation_id, sender, body, kind, media_key, expires, created, deleted), `gyms` (id, osm_id, name, lat, lng, status, source, updated), `checkins` (id, user_id, gym_id, created, visibility), `feed_items`, `reactions`, `admin_audit` (id, action, target, detail, created), `announcements`. Indexes for every lookup used.

## Done when
- `tests/poses.mjs` passes for all 40 exercises; `poses.png` exported; triceps extension folds behind the head; the 6 new illustrations exist or are documented.
- Worker tests: handle uniqueness and reserved words, avatar upload size/type, friend request flow, block hides and stops chat, report reaches admin, chat permissions (only friends/members), rate limit, 24 h photo expiry, message retention job, check-in distance/accuracy/cooldown, gym submission moderation, admin audit log, TOTP login.
- App tests: tour steps and skip, checklist progress, help search, settings matrix (§4), random palette contrast (§6), friendly error helper.
- Screenshots (375 px, both themes): Me, profile, friends feed, chat, check-in map/list, tour step, help, admin dashboard and setup checklist → `docs/round11-screens/`.
- No console errors; all existing tests pass; worker dry-run bundles (or report the sandbox block). Leave changes uncommitted; do not push or deploy.
