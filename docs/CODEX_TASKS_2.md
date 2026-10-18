# Round 2 tasks for Codex

Same rules as docs/CODEX_TASKS.md: read README.md, static ES modules in `app/` (no build), bilingual strings via `L('ไทย','English')`, views register `views.x` / `actions['x']`, state via `getState/setState`, add any new JS file to `SHELL` in `app/sw.js` but do NOT change the `const VERSION = 'fitme-v1'` line (the deploy workflow rewrites it). Reuse existing CSS classes (`card`, `field`, `input-wrap`, `chip`, `seg`, `sheet`, `btn`, `tag`, `note`) and add new CSS to `app/css/app.css` in the same style (dark theme tokens in `:root`). Keep everything working offline and on a 375px-wide phone. Existing saved user state must keep working (add new fields with defaults in `defaults()` and the merge in `load()` in `store.js`).

## 1. Rename the app to "Fixmee"
Display name everywhere: `<title>`, `apple-mobile-web-app-title`, `manifest.webmanifest` (name/short_name), onboarding hero, PDF header, ICS calendar name/PRODID, install banner, README, Stripe product names in the worker. Keep storage keys (`fitme:v1`, IndexedDB `fitme`) unchanged so users don't lose data. Repo/URL stay the same.

## 2. Redesign the admin page (`app/js/views/admin.js`)
Currently raw labels (`thb`, `descTh`) and unstyled inputs. Make it a clean settings screen:
- Header with a short explanation and a status card: one row per item (API server, Token secret, Thunder, Stripe, Claude, CONFIG KV) with a green check / grey dash icon and plain-language Thai text ("พร้อมใช้งาน" / "ยังไม่ได้ตั้งค่า").
- Login card: password field with show/hide toggle, "จำไว้ในแท็บนี้" note.
- Section "การรับเงิน": PromptPay number (with format hint and live validation), PromptPay display name, receiver name(s) with helper text.
- Section "แพ็กเกจ": one card per product showing a live preview (name, price ฿/$, duration). Inputs with human labels: ชื่อแพ็กเกจ (ไทย/อังกฤษ), ราคา (บาท), ราคา (USD), จำนวนวัน (0 = ซื้อครั้งเดียว), จำนวนครั้งดาวน์โหลด, คำอธิบาย (ไทย/อังกฤษ), "แสดงป้ายคุ้มสุด" toggle. Use a 2-column grid for paired fields.
- Section "แผนฟรี": free days, free supplements as steppers (− / + buttons).
- Section "ตั้งค่าเซิร์ฟเวอร์": numbered setup steps with copyable commands (copy button), explaining that keys are Wrangler secrets.
- Sticky bottom save bar showing "มีการเปลี่ยนแปลงที่ยังไม่บันทึก" when dirty. Validate before save, show field errors inline.

## 3. Training preferences, avoid list, calendar planning
- **Exercise preferences** (new sheet from a "ตั้งค่าท่า" button on the workout page): per group (`GROUPS` in exercises.js) choose which exercises are allowed (chips), plus a global **avoid list** ("ท่าที่ไม่อยากทำ / มีอาการบาดเจ็บ") with quick presets: knees (lunge, squat_jump, jump_rope, high_knees), lower back (deadlift, rdl, superman), shoulders (shoulder_press, lateral_raise, bench_press), wrists (pushup, mountain_climber, plank). Store `profile.avoidEx` (array of ids) and `profile.preferEx` (array, optional). `workout.js` must never pick avoided exercises (including warm-up, finisher and cool-down — fall back to another exercise of the same group, then any allowed one) and should prefer `preferEx` when choosing.
- **Swap a single exercise** in a session: in the workout list each exercise gets a swap icon that opens alternatives from the same group; the choice is stored per date in `state.exSwaps[iso][index] = exerciseId` and used by both the list and the player.
- **Calendar**: a calendar icon in the workout header opens a month view (prev/next month) showing training days, rest days, completed days and days off. Tapping a day opens that date's plan (`#/workout/<iso>`). Must also be reachable from the Food page week strip.
- **Plan ahead / days off**: in the calendar, long-press or tap "แก้ไขวันนี้" to set a date as: วันหยุด/ไม่สะดวก (no workout), เพิ่มวันออกกำลังกาย (train on a normal rest day), or ปกติ. Store `state.dayOverrides[iso] = 'off' | 'train'`. Also a "ลาพักร้อน" range picker (start/end) that marks a range as off. `isTrainingDay` and the split rotation in `workout.js` must use overrides so the rotation continues correctly after days off (count only actual training days). Meals/targets for that day follow the training/rest status automatically (they already use `isTrainingDay`).

## 4. Intermittent fasting (IF)
- New profile fields `fasting: 'none' | '12:12' | '14:10' | '16:8' | '18:6' | '20:4' | 'omad'` and `eatStart: 'HH:MM'` (default 12:00). Choose in onboarding step "อาหาร" and in the Food preferences sheet, with a short explanation of each pattern and a warning (not for pregnancy, diabetes on medication, history of eating disorders, under 18 — block for under 18).
- `meals.js mealSlots`: when fasting, place all meals inside the eating window (window length from the pattern; OMAD = 1 meal + optional small snack inside 1 h). Reduce `mealsPerDay` to what fits (16:8 → max 3, 18:6 → 2-3, 20:4 → 2, OMAD → 1). Training days: put the post-workout meal right after the workout if it is inside the window; if the workout falls in the fast, show a note suggesting moving the workout near the window start.
- Supplements that need food (`breakfast`, `lunch`, `dinner` slots and anything with protein/kcal) must be moved into the eating window; `morning`/`night` slots outside the window keep only zero-calorie items (creatine in water is fine, whey is not — move whey into the window). Implement this in `day.js` when computing slot times.
- Today page: a fasting ring/timer card ("กำลัง IF · เหลือ 3:20 ชม. ถึงเวลากิน" or "ช่วงกิน · เหลือ 5:10 ชม."), and timeline events "เริ่มกินได้" / "เริ่ม IF". Include them in the PDF and ICS export.

## 5. Bluetooth heart rate (Web Bluetooth)
- In the workout player add a "เชื่อมต่อนาฬิกา/สายคาดอก" button (only when `navigator.bluetooth` exists; otherwise show a small note that iPhone/Safari doesn't support it). Use `navigator.bluetooth.requestDevice({ filters: [{ services: ['heart_rate'] }] })`, subscribe to `heart_rate_measurement`, parse the flags byte (uint8 vs uint16). Show live BPM, HR zone (zones from 220-age), and keep a per-session array of samples.
- On finish, save avg/max HR to the workout log and estimate kcal from HR (Keytel formula using sex/age/weight) instead of MET when HR data exists.
- Explain in the UI that this works with devices that broadcast standard BLE heart rate (chest straps, Garmin/Polar/Coros/Amazfit "broadcast HR" mode); Apple Watch and most Wear OS watches don't broadcast it.

## 6. Workout logging and progress
- In the player for rep exercises with equipment `db`/`gym`, let the user enter weight (kg) and reps done per set (quick +/− steppers, prefilled from the last time). Store in `state.logs[iso].sets = [{id, set, kg, reps}]`.
- Exercise detail sheet: show history (last 5 sessions) and a suggestion: if all sets hit the top of the rep range last time → "เพิ่มน้ำหนัก 2.5 kg".
- Me page: "สถิติ" card with workouts per week (last 8 weeks bar chart), current streak, total minutes, and weight trend (existing sparkline).

## 7. Shopping list
- Food page button "รายการซื้อของ 7 วัน": aggregate grams of each food for the next 7 days (respecting locks for free users: only free days), grouped by category, with checkboxes (stored in state) and a share/copy-as-text button.

## Done when
- No console errors on every route in Thai and English, mobile width.
- An existing state from the previous version loads without errors.
- Avoided exercises never appear; overrides change training days; IF windows hold all meals; supplements move into the window.
- `cd worker && node test.mjs` still passes.
- README updated with the new features.
