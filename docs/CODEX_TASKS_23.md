# Round 23 — My routine: users set their own meal and activity times, and the plan fits everything else around them

Same rules as earlier CODEX_TASKS files:
- Keep storage keys, the worker name, the API URL and `const VERSION = 'fitme-v1'` in `app/sw.js`.
- New data goes in new fields under `profile` (and the day log for one-day changes). Old profiles must load unchanged and produce the same plan as today.
- Every new file in `app/js` goes in the SW `SHELL` list. Lazy-load the new UI so the first-load JS budget test (`tests/round12.mjs`) still passes.
- Text in all 5 languages.
- Do not commit, push or deploy.

## Why
Today the app computes every time from wake, bed, workout time, meal count and the IF window. The user wants to set the main parts of their own day and have the app fit the rest around them.

Example: 2 meals a day, the first at 08:10 and the last at 16:30. Today that is impossible, because:
- without IF, `mealSlots` forces at least 3 meals (`Math.max(3, …)` in `app/js/meals.js:61`);
- every meal time is computed, never chosen.

## Facts Claude checked (2026-11-03)
- `planDay` (`app/js/day.js`) builds the timeline: wake, water, meals, workout, supplement slots, medication times, IF start/end, caffeine and screens notes, sleep.
- `mealSlots(p, isTraining)` (`app/js/meals.js`) has an IF branch and a non-IF branch. Both use `spreadAround(lo, hi, n, blocks)` to avoid the workout block `[w-45, end+30]`. `eatingRange` in `fasting.js` keeps IF meals between wake+30 and bed−180.
- Supplement slots follow meals (`slotTime` in `day.js`). `supplementTime` keeps doses inside waking hours, away from medications.
- Meal count chips are 3–6 in onboarding (`views/onboard.js:53`) and the food settings (`views/food.js:64`).
- Reminders read the planned times (`reminder-runtime.js`, `notifications.js`).
- `tests/timeline-audit.mjs` sweeps 10,360 generated plans and checks the timing rules. Extend it; do not loosen it.

## 1. Data
- `profile.mealsPerDay`: allow 1–6, not just 3–6. 1–2 meals is valid without IF.
- `profile.routine` (new, optional):
  ```js
  {
    meals: [{ time: '08:10' | null }, ...],  // one entry per meal; null = automatic
    activities: [{ id, label, start: 'HH:MM', end: 'HH:MM', days: [0..6], kind: 'busy' | 'free' }],
    weekend: { wake?, bed?, meals?: [...] } | null  // optional override for Sat/Sun
  }
  ```
  - `meals.length` always equals `mealsPerDay`. Changing the count keeps the times the user set and adds or removes automatic entries.
  - `activities` are the user's own fixed blocks, for example work, a commute, school pickup or a nap. `busy` means "nothing scheduled here except medications"; `free` is only a label on the timeline.
  - `workoutTime` stays as it is and counts as an anchor.
- One-day changes go in the day log, for example `log[iso].timeOverrides = { 'meal-m0': '09:00', workout: '19:00' }`. They never change the routine.
- Missing `routine` means everything is automatic, exactly as today. Add a test that old profiles produce byte-identical plans.

## 2. Planner: anchors first, then fill
Rewrite how `planDay` and `mealSlots` place things, keeping one module for the logic (for example `app/js/routine-plan.js`).

1. **Anchors** are what the user set:
   - wake and bed;
   - the workout time;
   - meals with a time;
   - activities;
   - medications;
   - one-day overrides.

   The planner never moves an anchor.
2. **Automatic meals** fill the free time between anchors, using `spreadAround`:
   - Keep the current rules: ≥20 min after wake, last meal about 2–3 h before bed, ≥90 min apart, outside the workout block and outside busy blocks.
   - If only some meals are fixed, the automatic ones sit between and around them.
3. **Everything else follows the final times:**
   - supplement slots (with breakfast/lunch/dinner, pre/post workout, morning, night);
   - water;
   - the caffeine cutoff and the screens note;
   - meal kinds (breakfast/lunch/dinner/snack by order and time);
   - macro shares.
4. **Workout links:**
   - A meal that ends up 30–150 min after the session is the post-workout meal, with the carb boost.
   - A meal 45–180 min before it is the pre-workout meal.
   - If no meal is close after training and there is time before bed, add an optional "ของว่างหลังซ้อม" suggestion. It is marked optional, and the user can switch it off in the routine sheet.
5. **IF with fixed meals.** When IF is on and the user fixes the first or last meal:
   - derive the eating window from the fixed meals;
   - show the implied fasting length, for example "อดอาหาร 15 ชม. 40 นาที (16:30 → 08:10)";
   - if it does not match the chosen pattern, offer to update the pattern or `eatStart`, but never move a fixed meal silently.
6. **Conflicts** keep the user's time and show a warning, not an error. Warn when:
   - a meal is less than 20 min after wake;
   - the last meal is less than 2 h before bed;
   - two meals are less than 60 min apart;
   - a meal is inside the workout block or a busy block;
   - a meal is outside the IF window;
   - the workout is inside sleep hours (this warning is missing today).

   Each warning names the item and offers one fix ("ให้ระบบจัดให้" = make that item automatic).
7. Reminders and push use the final times, including one-day overrides.

## 3. UI
- **"กิจวัตรของฉัน"** sheet, reachable from Me/Planning and from the food settings. It contains:
  - wake, bed and workout time;
  - the meal count (1–6);
  - one row per meal, with an "อัตโนมัติ / ตั้งเวลาเอง" toggle and a time input;
  - activities: add, edit and delete, with a label, start/end, weekdays and busy/free;
  - an optional "วันหยุดใช้เวลาต่างกัน" section.

  A live preview of the day's timeline updates as the user edits, with the warnings from §2.6 inline. Nothing saves until "บันทึก".
- **Today timeline:** tapping a meal, the workout or an activity offers "เปลี่ยนเวลาวันนี้" and "ใช้ทุกวัน". After the change, the rest of the day re-plans and a toast lists what moved, for example "ย้ายวิตามินไป 09:00 ตามมื้อเช้า".
- **Onboarding:** the meal count allows 1–6. Add an optional "ตั้งเวลามื้อเอง" step after the meal count. Skipping it keeps everything automatic.
- Mark fixed items on the timeline with a small pin icon, so users can see what they set and what the app chose.

## 4. Tests
- `tests/round23.mjs`:
  - **The user's example:** wake 05:30, bed 21:30, 2 meals fixed at 08:10 and 16:30, workout 17:30.
    - Meals stay at 08:10 and 16:30.
    - Food-timed supplements land at those meals.
    - The post-workout snack is suggested after the session and ≥2 h before bed.
    - There are no warnings.
  - **Same with IF 16:8:** the implied fast is shown, the pattern-mismatch offer appears, and no meal moves.
  - **Partly fixed:** 4 meals with only the first fixed. The others are automatic and obey all spacing rules.
  - **Busy block:** activity 09:00–17:00 busy on weekdays. No automatic meal or supplement lands inside it; medications still can.
  - **Weekend override:** it applies on Sat/Sun only.
  - **One-day override:** it moves that day only; the next day uses the routine.
  - **Conflicts:** each warning in §2.6 appears, and its fix works.
  - **Old profile:** no `routine` gives a plan identical to before.
  - **Reminders** use the final times.
- **Extend `tests/timeline-audit.mjs`** with random fixed meals (0–all), activities and overrides. Invariants:
  - fixed times never move;
  - automatic items obey the existing rules;
  - every rule a fixed item breaks has a matching warning.
- Existing tests all pass:
  ```
  node tests/*.mjs
  cd worker && node test.mjs round*.test.mjs auth-errors.test.mjs push-redirect.test.mjs
  ```

## Done when
- Everything above is implemented and tested, and the first-load budget test passes.
- `docs/ROUND23_VALIDATION.md` explains:
  - the data shape;
  - the anchor-then-fill order;
  - the warning list;
  - how IF works with fixed meals;
  - the test results.
- Screenshots at 375 px in light and dark go in `docs/round23-screens/`:
  - the routine sheet with the example (2 meals, 08:10 and 16:30);
  - a conflict warning;
  - the Today timeline with pinned items;
  - the "เปลี่ยนเวลาวันนี้" flow and its toast.
- Leave changes uncommitted; do not push or deploy.
