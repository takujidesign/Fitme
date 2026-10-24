# Round 14 validation — 2026-10-24

Branch: `codex/round14`. Changes are intentionally uncommitted. No push, deployment, worker mutation, or root JPG access was performed.

## A. Runtime RepDB integration

- Pinned upstream commit: `b407c5951a027a27817fb2a5cee9ec9feffc4dc7`; verified schema version 3 and 650 entries from the published endpoint. The JSON was inspected in memory, never saved in this repository.
- Lazy module worker fetch/parsing starts when the library opens. Mapping yields every 30 rows. Runtime Cache Storage retains the first successful response; failure or an unsupported schema hides RepDB entries and displays the unavailable/offline note. Other sources render independently.
- All observed primary/secondary muscle values map to existing regions. These are necessarily coarse regions: e.g. hip flexors map to the upper-leg/quads region and lateral deltoids to the existing shoulder/rear-delts region.
- 208 originally authored Thai names, verified against upstream IDs; remaining names/instructions fall back to available source languages or English. No copied upstream descriptions are committed.
- 44 manual equivalence groups plus conservative English-name/equipment matching. Live merged library: **1,453 cards** (40 built-in + 876 Free Exercise DB + 650 RepDB, minus 113 duplicate entries); without RepDB: 898.
- Cross-source search, filters, counts, source attribution, retained exercise IDs, planner/swap, equipment/level/avoid checks, logging/PRs and muscle accounting covered by focused tests. Synthetic fixtures are invented, not extracts of the real dataset.
- Attribution appears on credits, README, third-party notices and RepDB-sourced exercise sheets. Standalone dataset/artwork is not vendored; the requested application screenshots include runtime-rendered source artwork. No `premium-samples` resources were used.

## B. Original 3D illustrations

All image generation used Codex's built-in image generation with text prompts only. No RepDB image, external reference image, or root JPG was supplied to any model. Generated output was converted to 768 × 768 WebP at quality 80 (bounded to 90,000 bytes). Static holds reuse the same original output for Start and Finish.

Final coverage: **40/40 exercises enabled, 80 WebP files**, all 768 × 768 and within the size limit; total **1,128,682 bytes**, maximum **26,352 bytes**. The review gallery is [ex3d.html](round14-screens/ex3d.html); asset dimensions/sizes are in [asset-checks.json](round14-screens/asset-checks.json). Exact final text prompts: [prompts-3d.json](../scripts/illustrations/prompts-3d.json).

Every Start/Finish image was visually reviewed in four contact sheets, with individual inspection of final corrections. Regenerated problems included invented machines/benches, shoes, incorrect muscle emphasis, behind-neck pulldown, hanging instead of lying leg raise, and incorrect floor poses. The final set depicts the intended movements; no exercise is withheld. Remaining illustration limitations: independently generated pairs have small camera/body-scale differences (most noticeably pulldown front/rear views), and internal pelvic-floor/diaphragm activity is shown schematically rather than as a visible movement. These are educational illustrations, not identical-camera motion-capture frames. Holds deliberately repeat one frame. The final walking finish depicts a foot swinging above the floor; the start depicts heel contact.

The default is 3D, with per-user 3D / flat / animation preference in the theme sheet. Start/Finish images support tapping, one-second alternation, optional arrows, reduced-motion handling, lazy loading and 3D → flat → animation fallback. Image assets are not in the service-worker shell. The line `const VERSION = 'fitme-v1'` is unchanged.

## Automated validation

All **33 required test runners passed**: every `tests/*.mjs` runner excluding browser/Playwright/serve and extract-i18n scripts, plus `worker/test.mjs` and every `worker/round*.test.mjs`. Full command names, exit codes and output: [tests.json](round14-results/tests.json).

After installing the final 40-entry asset manifest, `node tests/round14.mjs`, `node tests/round9.mjs`, and `node scripts/illustrations/review-3d.mjs` passed again. Round 14 verifies enabled manifest paths and WebP signatures/size; the review script verifies actual pixel dimensions for all 80 files. Round 12's regenerated historical reports were restored to their original bytes/line endings to avoid unrelated changes.

Round 14 additionally checks schema failures, enum mapping, Thai coverage, deduplication, filter rules, persistence/planner/calories, PRs/muscle recovery, image URL allowlisting, offline cache reuse, visual preferences/fallbacks, attribution, unchanged SW version, and a tracked/untracked repository licence guard. The guard checks JSON blobs and suspicious upstream artwork paths without opening any root JPG.

## Browser evidence

- Fourteen real Chrome screenshots at 375 × 812, both themes: library, RepDB sheet, bench press, squat, push-up, deadlift and plank. See [browser-results.json](round14-screens/browser-results.json) and the JPGs in the same directory.
- All ten original-exercise checks loaded both images without horizontal overflow. RepDB sheet showed one visible attribution line; live library count was 1,453.
- App `error`/`unhandledrejection` collection was empty. The connected Chrome session did emit extension-style `Could not establish connection. Receiving end does not exist.` diagnostics; therefore this is not a claim that every browser console channel was empty.
- The optional Playwright capture script could not launch because `playwright-core` is not installed. Captures were completed through connected Chrome instead. No throwaway browser profile was created.
- Cleanup completed: temporary viewport override reset, agent-created Chrome tab closed, localhost QA server stopped. `git diff --check` passed; the branch remains `codex/round14`, with all work uncommitted.
- Browser navigation used a localhost server exposing only `app/`; repository-root JPGs were never served. Screenshots containing RepDB artwork were saved directly without feeding them to an image model.

## Boundaries

These results validate local implementation, mocked integration tests and the local browser UI with live public CDN content. No production, deployment, payment or authenticated server integration was exercised. Runtime caching was tested with controlled cache/fetch fixtures; screenshots are online browser evidence, not proof of a full airplane-mode browser run.
