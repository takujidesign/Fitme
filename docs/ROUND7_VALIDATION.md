# Round 7 validation

Date: 2026-10-20. Branch: `codex/round7`. Changes are uncommitted; no push or deployment.

## Implemented

- Replaced render wrappers with named, ordered view slots. Today starts with its header and summary, followed by compact readiness and sleep controls. Train has Plan/Library navigation, icon quick actions, the session and exercises, and a sticky Start control. Me has grouped settings rows and secondary sections.
- Added `#/training-settings`, linked from Train and Me. Shared onboarding/settings controls offer six training styles and equipment selection. Settings include weekdays, frequency, session length, muscle-map focus, searchable grouped exercise preferences, lazy-loaded library choices, and a live weekly preview.
- Prefer/normal/avoid are mutually exclusive. Saved library choices are retained for generation. Settings remain staged until Save; preview does not leave temporary library exercises in the global registry. Save regenerates from today, clears future swap overrides, retains logs, and records previous training settings for historical dates.
- Old profiles derive display styles but keep legacy generation until settings are explicitly saved. Storage keys remain unchanged. Equipment, avoidance, health constraints, warmups and recovery remain enforced.
- Swap alternatives now have thumbnails and muscle labels. Sheets close on route changes and share sticky headers, styled close buttons, internal scrolling and safe-area spacing.
- Readiness uses five-point segments, a half-hour sleep stepper and the muscle map. New soreness regions map back to the existing readiness scoring groups.
- Applied shared field/control styling, including admin forms; improved rings, coach action, fasting labels, spacing and narrow layouts. Added Chinese, Japanese and Vietnamese translations for new controls and new modules to the offline shell.

## Automated validation

All 11 non-browser application suites passed:

| Suite | Result |
| --- | --- |
| `tests/round3.mjs` | PASS |
| `tests/round4-ui.mjs` | PASS |
| `tests/round4.mjs` | PASS |
| `tests/round5.mjs` | PASS |
| `tests/round5b.mjs` | PASS |
| `tests/round5c.mjs` | PASS |
| `tests/round6-offline.test.mjs` | PASS |
| `tests/round6.test.mjs` | PASS |
| `tests/round7.mjs` | PASS |
| `tests/test.mjs` | PASS |
| `tests/ui-test.mjs` | PASS |

`node test.mjs` in `worker/`: **PASS**. No worker implementation changes.

Round 7 assertions cover exact legacy-plan compatibility, six style mappings, equipment filtering, exclusive preferences, a library exercise appearing in a generated plan, avoidance, staged settings and preview cleanup, save/history/log retention, sheet dismissal, map-based check-in, header ordering in five languages and both themes, and offline-shell membership. Two existing UI tests were updated to exercise the replacement controls instead of removed checkbox/chip actions.

Reproduce application suites in PowerShell:

```powershell
Get-ChildItem tests -Filter '*.mjs' |
  Where-Object { $_.Name -notmatch 'browser|extract-i18n|^serve-' } |
  ForEach-Object {
    node $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Failed: $($_.Name)" }
  }
```

Run the worker suite separately:

```powershell
Set-Location worker
node test.mjs
```

Browser/Playwright test scripts and `extract-i18n.mjs` were not run, as requested. `serve-*.mjs` are persistent development servers, not test suites. `git diff --check` passed.

## Browser and visual evidence

Connected Chrome was used against the local fixture server, with API access disabled and a synthetic onboarded profile. The standalone headless capture attempt was blocked by the environment (`spawn EPERM`); connected-browser capture succeeded.

The following **18 screenshots are each 375 × 812 pixels**, nine screens in each theme:

| Screen | Dark | Light |
| --- | --- | --- |
| Today | [image](round7-screens/dark-today.jpg) | [image](round7-screens/light-today.jpg) |
| Train plan | [image](round7-screens/dark-workout.jpg) | [image](round7-screens/light-workout.jpg) |
| Train library | [image](round7-screens/dark-library.jpg) | [image](round7-screens/light-library.jpg) |
| Training settings | [image](round7-screens/dark-training-settings.jpg) | [image](round7-screens/light-training-settings.jpg) |
| Food | [image](round7-screens/dark-food.jpg) | [image](round7-screens/light-food.jpg) |
| Supplements | [image](round7-screens/dark-supps.jpg) | [image](round7-screens/light-supps.jpg) |
| Me | [image](round7-screens/dark-me.jpg) | [image](round7-screens/light-me.jpg) |
| Readiness sheet | [image](round7-screens/dark-readiness.jpg) | [image](round7-screens/light-readiness.jpg) |
| Swap sheet | [image](round7-screens/dark-swap.jpg) | [image](round7-screens/light-swap.jpg) |

Visual checks covered header/content order, theme contrast, ring labels, action styles and sheet layout. Long settings, lists and sheets intentionally scroll.

The route audit rendered 34 routes in TH/EN/ZH/JA/VI and both themes, at both 375px and 320px: **680 render/layout checks, no captured JavaScript errors or unhandled rejections, and no horizontal document overflow**. Evidence: [375px report](round7-screens/audit-375.json), [320px report](round7-screens/audit-320.json). This audit excludes `player` and `line-return`, which require session or authentication context; it does not assert that every interactive path on every route was exercised. Player/BLE/session persistence has simulated automated coverage.

A separate browser workflow selected gym plus bodyweight, three training days, 20-minute sessions and chest focus; loaded the library; searched for and preferred Dumbbell Bench Press; and saved. The resulting plan contained that library exercise alongside built-in exercises. Supplemental captures: [library preference](round7-screens/library-preference.jpg), [generated plan](round7-screens/generated-library-plan.jpg). These two workflow captures have different dimensions from the required screenshot set.

To inspect the local fixture:

```powershell
node tests/serve-round7.mjs
```

Open `http://127.0.0.1:5177/?theme=dark&screen=today`. Other screen values match the screenshot names; `readiness` and `swap` open their sheets. `?audit=1` runs the route audit at the current viewport. The fixture resets local test settings unless `keep=1` is supplied. It serves only application files and its QA driver, and does not serve repository-root images.

## Boundaries

- The `const VERSION = 'fitme-v1'` line in `app/sw.js` is unchanged; only shell entries were added.
- Repository-root `*.jpg` files were not read, moved or published. Generated screenshots are confined to `docs/round7-screens/`.
- Existing storage keys and logged workouts are retained. New state fields are additive.
- Worker integrations, BLE and offline behavior are validated by local/mocked suites where applicable. These results do not prove live authentication, payments, device BLE, production service-worker upgrades or deployment behavior.
- No commit, push, deployment, production mutation or live integration test was performed.
