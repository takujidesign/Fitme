# Round 7 tasks for Codex — UX/UI cleanup and exercise selection

Same rules as earlier CODEX_TASKS files (static ES modules in `app/`, `L()` strings + zh/ja/vi dictionaries, add new files to `SHELL` in `app/sw.js` without touching the `VERSION` line, 375px first, both themes, offline, keep storage keys/state shape backward compatible, tests in `tests/`). No worker changes are expected this round.

The owner tested the live app on a phone and found the UI messy, and that they **cannot choose the type of training or which exercises they want**. Findings from Claude's review at 375×812, dark theme:

## 1. Stop bolting cards onto pages (root cause of most mess)
- `app/js/views/round5.js` and `round5b.js` (and similar) define `wrap(name, extra)` that prepends/appends raw `<section class="card">` blocks to `views.today`, `views.workout`, `views.me`, `views.food`, `views.supps`, `views.account`. Result: an affiliate card ("ลิงก์พันธมิตร… ร้านค้า") and a "ความพร้อมวันนี้" readiness card render **above the page header** on Today and Train; an empty progress bar sits in the readiness card; links render as underlined text.
- Replace the wrapper approach with explicit, ordered **slots** inside each view (e.g. `slot('workout.afterPlan')`), so every page has the same order: header → primary content → secondary cards → links/footer. Remove all `wrap()` use.
- Page order targets:
  - **Today:** header (greeting, date, AI coach button) → day summary ring card → today's workout CTA → readiness check-in as one compact row ("เช็กความพร้อม" + "วันนี้ไม่ไหว" chips; hide the empty bar until there is a score) → sleep row → timeline. The affiliate/shop card goes to the bottom, or only on Supps.
  - **Train:** header → Plan / Library segmented control → week strip + calendar button → session card → exercise list → sticky Start. The tools ("เครื่องคำนวณ", "บันทึกการฝึกเอง", "เพิ่มท่า", "ตั้งค่าท่า", "โปรแกรม") become one row of icon+label buttons (`.quick-actions`, horizontally scrollable, 44px touch targets) directly under the header — no underlined links.
  - **Me:** profile card → body/progress → a grouped settings list (iOS-style rows with chevrons): Training settings, Food preferences, Supplements, Language, Theme, Account, Groups & challenges, Shop, Data & backup, Privacy & terms, Credits. No loose buttons or underlined links.
- Every link-styled control that performs an action must use existing `.btn`/`.chip`/list-row styles. Search the app for bare `<a ...>` and `<button>` without a class inside cards and fix them.

## 2. Training type and exercise choice (owner's main complaint)
- Add a **Training settings** screen `#/training-settings` (linked from Train quick actions and Me), editable at any time without re-running onboarding:
  - **Training style** (multi-select cards with icon + one-line description): weights in the gym, dumbbells at home, bodyweight / calisthenics, cardio / walking-running, HIIT, mobility / yoga-stretch. Map to the generator's existing inputs (equipment, focus groups, programs) — add a `profile.styles` array (default derived from current equipment/focus so old states keep their plan).
  - **Equipment available** (chips), **days per week** + which weekdays, **session length** (20/30/45/60 min), **focus muscle groups** (use the round 6 muscle map: tap regions to toggle).
  - **Exercise picker**: list of exercises allowed by the choices above, grouped by muscle group, each row = small animated figure/thumbnail + name + three-state control **ชอบ / ปกติ / ไม่เอา** (prefer / normal / avoid). Search box at top. Include Free Exercise DB exercises (lazy-load) under a "เพิ่มจากคลังท่า" section so users can add any library exercise to their rotation (`profile.preferEx` may hold library ids; the generator must handle them and their muscle mapping).
  - Live preview at the bottom: "แผนสัปดาห์นี้" mini week summary (split per day, minutes, number of moves) that updates as settings change; Save button applies and re-generates from today (keep logs).
- Replace the current "ตั้งค่าท่า" sheet (`actions['exercise-prefs']` in `planning.js`) with this screen. The old sheet's 40-chip walls (all green "✓" chips for avoid, then a second wall of preferred chips with no visible selected state) are confusing.
- Swap sheet (`exercise-swap`): show alternatives as rows with thumbnail and target muscles, plus "ค้นหาในคลังท่า" button styled as a button; style the missing sheet header/close button.
- Onboarding: the training step should use the same style cards and equipment chips (share the component).

## 3. Bottom sheets and forms
- **Bug:** an open sheet stays open after route change (open ตั้งค่าท่า, then tap Me tab → sheet still covers Me). Close any open sheet on `hashchange`.
- Readiness check-in sheet: raw number inputs and a crude stick figure. Replace with: energy / stress as 1–5 segmented buttons with emoji or labels, sleep hours as a stepper (−/+ by 0.5), soreness as the round 6 muscle map (tap sore regions) instead of the stick figure + four checkboxes. Primary button full width at the bottom.
- Audit every sheet and form for unstyled native inputs (`input[type=number|date|time|text]`, `select`, fieldsets): give them the app's input style (full width, label above, 44px height, theme colours). Add a shared `.field` component in `app.css` if missing and use it everywhere (admin pages too).
- Sheet content must scroll inside the sheet with the header sticky; the bottom tab bar must not cover sheet buttons (respect safe areas).

## 4. Visual polish
- Today ring card: the two small empty rings beside the kcal ring have no labels — label them (protein, water) or remove them; values should sit next to their ring.
- Today header: AI coach is an underlined "AI โค้ช" link squeezed left of the greeting — make it an icon button on the right next to the date arrows, or a card further down.
- IF card: "08:00–18:00 · 14:10" and "ถึงเวลากิน" read as unrelated lines; show "ช่วงกิน 08:00–18:00" and the status with the countdown ring.
- Consistent spacing scale (8/12/16/24), card padding, section headings (`h3.sec`) and empty states across Today, Train, Food, Supps, Me, Library, Tools, Recipes.
- Check text overflow at 320px and with zh/ja/vi strings.

## Done when
- Screenshots at 375×812 of Today, Train (plan + library), Training settings, Food, Supps, Me, readiness sheet, swap sheet in both themes look consistent (save them to `docs/round7-screens/`).
- A user can, after onboarding, change training style, equipment, days, and pick prefer/avoid exercises (including library ones) and see the plan change; old saved states load with the same plan as before until they change settings.
- No console errors on all routes; all existing tests pass; new tests: style → generator mapping, three-state prefer/avoid, library exercise in a generated plan, sheet closes on route change, old-state migration.
- Leave changes uncommitted; do not push or deploy.
