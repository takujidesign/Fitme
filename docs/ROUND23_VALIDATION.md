# Round 23 validation

Branch: `codex/round23`. All changes are uncommitted. No push, deployment, remote change, or storage-key/API/worker-name change was made. `app/sw.js` retains `const VERSION = 'fitme-v1'`.

Implementation and automated assertions are complete. **The browser acceptance check and required PNG screenshots remain blocked by the execution environment.** The HTML files in `round23-screens/` are explicitly labeled DOM fixtures; they are not screenshots or evidence of pixel layout.

## Data

`profile.mealsPerDay` accepts 1–6, including 1–2 meals without IF. Onboarding and food preferences both expose that range.

```js
profile.routine = {                  // optional; never added during load
  meals: [{ time: '08:10' }, { time: '16:30' }], // null time means automatic
  activities: [{
    id: 'work', label: 'Work', start: '09:00', end: '17:00',
    days: [1, 2, 3, 4, 5], kind: 'busy' // or 'free'
  }],
  weekend: { wake: '07:00', bed: '23:00', meals: [{time: null}, {time: null}] },
  postWorkoutSnack: true,             // optional; defaults to enabled
  workoutAutomatic: false            // set by the workout conflict fix
};
logs['2026-11-02'].timeOverrides = {
  'meal-m0': '09:00', workout: '19:00', 'activity-work': '10:00'
};
```

`weekend` may be null, or contain only some overrides. It applies on local Saturday/Sunday. Activity day numbers use Sunday = 0. Changing an activity's start for one day retains its duration. A null meal/workout day override requests automatic placement for that day. It does not alter the recurring routine.

Meal-count changes resize both the ordinary and weekend arrays. Shrinking removes automatic entries before discarding fixed entries; growing appends automatic entries. Effective planning also normalizes imported arrays without mutating stored data.

## Anchor-then-fill order

`app/js/routine-plan.js` owns effective-day resolution, placement, warnings, IF derivation and snack suggestions. `planDay` resolves weekend settings and day-log overrides before calculating the session, meals, food macros and timeline. `mealSlots` uses the same placement logic, including callers outside `planDay`.

1. Resolve wake/bed, workout, timed meals, activities, medications and the day's overrides. Fixed times retain their exact HH:MM values and stable meal keys.
2. Find the awake/eating interval, including windows crossing midnight. Subtract busy activities and the workout block from 45 minutes before training through 30 minutes after its end.
3. Fill each run of automatic meal rows between its fixed neighbours. `spreadAround` supplies the ideal times; a constrained candidate search maintains at least 90 minutes between automatic meals and all other meals. Normally meals begin at wake + 30 minutes and finish by bed − 180 minutes. The search accounts for already placed automatic rows across separate gaps.
4. If there is insufficient room, place the largest feasible subset and show an `unplaced` warning for each remaining automatic row. Do not move anchors or insert automatic meals into prohibited intervals to force the requested count.
5. Assign meal kinds/shares by final order and time. Mark meals 45–180 minutes before training as pre-workout; mark meals 30–150 minutes after the session as post-workout, including their carbohydrate boost.
6. Food-bound supplement slots use the final meals. Other slots follow the effective wake, workout and bedtime. Existing medication-separation checks remain active; automatic supplement doses avoid busy blocks and stay inside waking hours. Water and caffeine/screens notes avoid busy blocks as well. Medication anchors remain untouched.
7. If there is no post-workout meal and sufficient time, suggest an optional snack at session end + 30 minutes, at least two hours before bedtime. The routine sheet can disable it. Suggestions are not automatically added to food totals or reminders.

Existing profiles with no routine and no day override retain the legacy planner path. Twenty serialized pre-change fixtures cover 3–6 meals, IF, overnight schedules and food-timed supplements; their entire plans compare byte-for-byte with `JSON.stringify`.

## Warnings and fixes

Warnings identify the meal/workout in the UI and keep its chosen time:

| Code | Condition |
| --- | --- |
| `wake` | Meal less than 20 minutes after wake |
| `bed` | Meal less than two hours before bed |
| `spacing` | Two meals less than 60 minutes apart |
| `workout` | Meal within the workout block |
| `busy` | Meal within a busy activity |
| `if` | Meal outside the effective eating window |
| `sleep` | Workout overlaps sleep |
| `unplaced` | Not enough permissible time for an automatic meal |

“Make automatic” in the routine sheet changes the draft only. On Today it sets a null override for that day only. The workout fix finds an awake slot around busy blocks and timed meals. Capacity warnings can remain until the user frees sufficient time or reduces the meal count.

## IF and fixed meals

IF medical restrictions still apply. When IF is available, a fixed first meal defines the window start and a fixed last meal defines its end. With only one fixed endpoint, the other endpoint uses the selected pattern's length. Interior fixed meals never move to fit that window; violations produce a warning.

The UI shows the implied fast and a pattern/start mismatch offer. Updating the offer changes `eatStart` and, when an exact built-in duration exists, the pattern in the draft. Nonstandard durations remain represented by the fixed endpoints; the selected pattern can still differ. Nothing persists until Save.

For the requested 05:30–21:30 day with meals at 08:10/16:30, workout at 17:30 and a 45-minute session:

- Both meals remain fixed, and breakfast/dinner supplements use 08:10/16:30.
- The optional snack is 18:45; there are no conflict warnings.
- With IF 16:8, the derived eating window is 08:10–16:30, the displayed fast is **15 h 40 min (16:30 → 08:10)**, and a mismatch offer appears.

## UI and reminders

The routine sheet is reachable from Me, Planning's calendar sheet, food preferences, and the optional meal-time action after onboarding's meal count. It supports meal toggles, wake/bed/workout times, editable activity labels/times/weekdays/busy/free, weekend settings, live preview and inline fixes. Cancel/close discards its cloned draft. All new labels have Thai, English, Chinese, Japanese and Vietnamese text.

Meals expose the time action from their details sheet. Workouts and activities expose it directly from Today. “Change time today” writes the log; “Use every day” writes the routine and clears the current item's day override. The resulting toast lists dependent events whose times moved. Pins distinguish anchored meals, workout, activities and wake/bed.

The routine editor and its full translations load dynamically. Every new JS file is in the SW shell. `reminderPlan`, the native reminder runtime and push synchronization consume the final planned events. Wake/sleep reminders respect weekend hours; water reminders avoid busy blocks.

## Test results

| Check | Result |
| --- | --- |
| Frontend assertion/DOM suites | **33/33 passed** |
| Worker suites: `test.mjs`, all `round*.test.mjs`, auth errors, push redirects | **22/22 passed** |
| `tests/round23.mjs` | Passed: example, IF, partial anchors, busy/medications/supplements, weekends, one-day meal/workout/activity changes, all seven conflict fixes, old plan bytes, reminders, 1–2 automatic meals, overnight IF, snack toggle, draft/save/daily-save, five languages |
| Existing timeline sweep | **10,360 plans**, unchanged assertions passed |
| New deterministic randomized timeline sweep | **320 plans**, fixed meals from none to all, busy/free activities, overrides, spacing, supplements and matching warnings passed |
| Round 12 first-load budget | **358,300 / 358,400 gzip bytes**, 132 static modules; passed |
| Local HTTP preview | Passed public pages/assets and private/unknown 404 checks |
| `git diff --check` excluding protected Round 12 paths | Passed |
| Chromium/browser assertions and screenshots | **Blocked**, not passed |

Round 17's existing Worker test used a subscription expiring on 2026-11-02 while checking it against the real current clock. Its synthetic scheduling scenario now also fixes `Date.now` to its existing fixture date and restores it afterwards. The reminder response is explicitly asserted to be 200 before checking its contents. Worker application code was not changed.

`round23-results/regression/results.json`, `worker-results.json` and their logs record the runs. The Round 12 test normally writes protected artifacts; a temporary test copy redirected those outputs under `round23-results/regression/`. The Round 14 repository scan excluded `food-eval/` and the protected Round 12 paths. No root JPG contents or `food-eval/` contents were read.

Reproduce the non-browser checks without overwriting existing round artifacts:

```powershell
python tests/round23-regressions.py
node tests/round19-http.mjs
```

The adapter preserves assertions; it redirects artifact destinations and excludes the user-prohibited paths from the repository scan. Server helpers, the i18n extraction generator and browser-only capture scripts are not standalone assertion suites.

## Screenshot acceptance remains open

`node tests/round23-browser.mjs` fails at Chromium launch with **`browserType.launch: spawn EPERM`**, before a page opens. Browser access through computer-use also reported an unavailable browser host, and native access to Chrome was not approved. There is no verified browser rendering or overflow result.

Ten 375px light/dark HTML fixtures cover the requested sheet, conflict, pinned timeline, time-change dialog and toast. Generate them with `node tests/round23-dom.mjs`. **They do not satisfy the PNG screenshot requirement.** The browser capture runner is ready to generate the ten PNGs and exercise the actual meal-tap/time-change flow when browser execution is available:

```powershell
node tests/round23-browser.mjs
```

The spec's full “Done when” therefore remains unmet only for browser validation and screenshot capture. No commit, push or deployment has been performed.
