# Round 9 validation

Date: 2026-10-21. Branch: `codex/round9`. Changes are uncommitted. No push or deployment was performed.

## Implemented

- Original SVG muscle-belly paths follow the existing solved bones: chest, front/rear delts, biceps, triceps, forearms, abs, obliques, traps/lats, lower back, glutes, thighs and calves, plus neck/pelvic-floor regions. Neutral grey shading, dark shorts and equipment; original pose keyframes, IK and props retained.
- Targets come from `exerciseMuscles(ex)`. For the original ordered mappings the first region is primary and the remaining regions secondary; imported explicit primary/secondary arrays retain their semantics. Both themes define `--muscle-primary`, `--muscle-secondary` and neutral tokens.
- Automatic quadratic movement arrows choose the largest moving endpoint/keyframe. Static holds do not get arrows. `exercises.js` demonstrates `{joint, bend}` overrides for hip-driven exercises and bench press. The first and peak frames share arrows in the paired view. SVG nodes/defs are retained between animation frames, changed attributes are updated in place, offscreen/background drawing is skipped and arrows fade over each rep.
- Exercise sheets offer Animation / Start–Finish, with Thai/English and zh/ja/vi labels. Reduced motion defaults to paired static frames. Existing list/player animation API remains compatible; imported photo exercises still fall back to their existing photo view.
- Original curved front/back muscle-map paths replace rectangles while retaining all region IDs, focusable links/buttons, accessible labels, selected state and existing heat colours. No third-party artwork was copied.
- Optional approved-image loader validates local paths and source metadata. Missing/invalid/empty manifests show figures. Approved pairs appear first, show model attribution, provide side-by-side images plus an alternating crossfade, support tap/keyboard activation and optional overlaid arrows. Any broken image switches back to the figure. Automatic alternation is disabled for reduced motion. Timers/observers are cleaned up on removal.
- New JS and the empty manifest are in service-worker SHELL. Viewed WebP files use the existing network-first/offline-fallback runtime cache and are not in SHELL.
- Owner-run Node 22+ illustration pipeline: 40 shared-style prompt pairs (80 prompts), disabled female-variant metadata, env-only Kie settings, object/string input support, reference-field support, four-job maximum, shared 550 ms admission spacing, three-second polling, 429 backoff, non-200 body-code checks, immediate WebP download/conversion via scripts-only sharp, credit logging, task receipts, skip/resume, `--only`, `--queue`, and keyless/networkless `--dry-run`.
- Creation intent is persisted before paid POST. Ambiguous creates require manual task reconciliation rather than automatic duplicate POST. Generation lock plus generation IDs/per-pose queue progress protect retries and partial regeneration. No live provider call was made.
- Loopback review server and grid: Approve / Regenerate / Reject, approved-only manifest, matching receipt-model checks, queue persistence, origin/token checks, limited file routes and blocked review writes while generation is running. Rejected IDs leave the regeneration queue.
- README includes exact PowerShell commands and resume/review instructions. Credits and THIRD_PARTY_NOTICES explain optional AI attribution and original SVG artwork.

## Tests

All 13 eligible `tests/*.mjs` files passed (exit 0):

| Suite | Result |
| --- | --- |
| `round3.mjs` | PASS |
| `round4-ui.mjs` | PASS |
| `round4.mjs` | PASS |
| `round5.mjs` | PASS |
| `round5b.mjs` | PASS |
| `round5c.mjs` | PASS |
| `round6-offline.test.mjs` | PASS, extended with both viewed WebP poses and no-image-precache assertions |
| `round6.test.mjs` | PASS |
| `round7.mjs` | PASS |
| `round8.mjs` | PASS |
| `round9.mjs` | PASS |
| `test.mjs` | PASS |
| `ui-test.mjs` | PASS |

`cd worker; node test.mjs`: PASS (exit 0). Its SQLite experimental warning is informational. Worker code was not changed. The requested browser/Playwright/serve scripts and extract-i18n were excluded from the batch.

Round 9 tests cover all 40 figures, every primary region rendered, token-based highlights, nonzero moving arrows/static holds, explicit overrides, Start–Finish in five languages/two themes, map accessibility, missing/empty/invalid/approved/broken images, reduced motion, mocked Kie success/fail/HTTP-200 error codes/resultJson, mocked 429/rate admission/concurrency, downloaded-file skips, saved-task resume, ambiguous creation and generation-ID retry protection, plus real loopback review HTTP requests for approval/removal/queue and origin rejection. Provider fetch is mocked; the local HTTP review test makes no external requests.

Commands used:

```powershell
Get-ChildItem tests -Filter *.mjs |
  Where-Object { $_.Name -notmatch 'browser|playwright|serve|extract-i18n' } |
  ForEach-Object { node $_.FullName }
Push-Location worker
node test.mjs
Pop-Location
node scripts/illustrations/generate.mjs --dry-run
node tests/round9.mjs
git diff --check
```

Dry-run reports exactly **80 images / 40 pairs**, with no key and no network. `git diff --check` passed (only existing Git line-ending conversion notices for appended documentation).

## Browser evidence

The dedicated screenshot runner `node tests/round9-browser.mjs` could not launch local Chrome: `browserType.launch: spawn EPERM`. This is an environment launch restriction, not a passing Playwright run. Its code remains available for a normal local environment with `playwright-core` and Chrome installed.

Fallback verification used the connected Chrome browser and `tests/serve-round9.mjs`, bound to `127.0.0.1:5187`. This fixture serves only app files and an isolated real exercise-visual component, with no Kie/provider requests. At an actual **375 × 812** viewport:

- All **40 × 2 = 80** Start–Finish cases rendered two SVGs, no `undefined` text and no horizontal overflow. Per-case evidence: [checks.json](round9-screens/checks.json).
- Saved **20 JPG screenshots**: bench press, squat, push-up, plank and deadlift, each in Animation / Start–Finish and dark/light themes, under [round9-screens](round9-screens/).
- Visually inspected squat, flat bench press and deadlift; verified computed primary fill resolves to the theme token.
- Browser log collection contained one connection/receiving-end error from the browser integration; no app-module error was identified in that capture. This is not a claim of zero errors across every full-app route. Existing DOM route suites passed.

The fixture captures the actual visual and muscle-map components, not the full exercise-sheet chrome. The complete-app screenshot runner remains blocked as described above. Real physical mid-phone 60 fps, browser-level offline reload and live Kie generation/model schema are **not verified**. SVG-node reuse and VM service-worker tests are implementation/test evidence, not device performance proof.

## Scope discrepancy and remaining acceptance limits

The requested “incline dumbbell press” is **absent from the existing 40 animated exercises**. They contain `bench_press` (flat bench press with the existing weight prop). Earlier task rules require preserving poses, so no new incline pose/exercise was invented or silently substituted under that name. Screenshot filenames explicitly say `bench_press`. The exact incline screenshot and physical-phone performance acceptance remain open; the implementation and all requested non-browser tests are complete.

The optional list of 150 external DB prompt IDs was not included. Female variants are described but disabled, as requested. No image-generation outputs were created; `app/data/illustrations.json` remains `{}`.

## Protected boundaries

- `const VERSION = 'fitme-v1'` in `app/sw.js` is unchanged; only SHELL entries were added there.
- Repo-root `*.jpg` files were never read, moved, copied or served. JPG screenshots are newly captured files under `docs/round9-screens/`, not repo-root photos.
- No Kie API requests, provider credentials, generated exercise images, worker changes, migrations, commits, push or deploy.
- `docs/CODEX_TASKS_9B.md` appeared during the session; it was not read, modified or implemented. It is unrelated to this Round 9 change.
