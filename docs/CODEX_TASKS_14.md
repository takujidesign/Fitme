# Round 14 tasks for Codex — RepDB library merge + 3D-style illustrations

Same rules as earlier CODEX_TASKS files (static ES modules, `L()` + i18n, `SHELL` without touching `VERSION`, 375 px, both themes, offline, tests). No worker changes expected. Deploys happen via GitHub workflows — do not push or deploy.

## 0. RepDB licence — hard rules (read `https://github.com/RepDB/exercise-dataset/blob/main/LICENSE-DATA.md`)
- Free for in-app use **with a visible attribution link**: "Exercise data by RepDB (repdb.co)" → `https://repdb.co/` on `#/credits`, in `THIRD_PARTY_NOTICES.md`, in the README, and a small "RepDB" source line on every exercise sheet that shows RepDB data.
- **No redistribution as a dataset.** This repository is public, so **do not commit RepDB's JSON, images, or any converted/derived copy of the dataset** (no `app/data/repdb*.json`, no downloaded images). Load RepDB at runtime from RepDB's own published repository at a pinned commit through jsDelivr: `https://cdn.jsdelivr.net/gh/RepDB/exercise-dataset@<commit>/exercises.json` and `…@<commit>/<images.flat.* path>`. Pin the commit SHA in `app/js/repdb.js`; verify the JSON `schema_version` (currently 3) and fail soft (hide RepDB entries) if it changes.
- The app may cache what a user has viewed (service-worker runtime cache, like Free Exercise DB images) — that is in-app use.
- **No generative-AI derivation.** RepDB images must never be given to any image model as input, reference or style guide (this includes part B of this round). Keep RepDB images visually separate from our own illustrations.
- Do not use anything from `premium-samples/` (paid evaluation only).
- Our repo may contain only our own work: the mapping code, our Thai (and zh/ja/vi) names/instructions keyed by RepDB id (write these yourself; do not machine-copy their English text into a committed file), and the merge/dedupe table.

## A. Merge RepDB (650 exercises) into the exercise library
- `app/js/repdb.js`: lazy-load RepDB JSON when the library opens (never on app start), map to our library schema at runtime: id `repdb:<id>`, names (en/de/es from RepDB, th from our own `app/data/repdb-names-th.json` for the most common ~200 ids, others fall back to English), category, force, mechanic, difficulty → level, body_part, primary/secondary muscles → our muscle-map region ids (write a complete mapping table and a test that every RepDB muscle value maps to ≥ 1 region), MET, is_bodyweight/equipment, instructions and tips (shown in the user's language when we have it, else English), image URLs.
- **Dedupe with Free Exercise DB and our 40 animated exercises**: build a committed alias table (`app/data/exercise-aliases.json`, our own work) linking equivalent exercises across sources (normalised names + manual pairs for common ones: push-up, squat, plank, lunge, deadlift, bench press, rows, curls, presses, stretches …). In the library one card per exercise; the sheet shows the best visual in this order: our 3D-style illustration (part B) → our animated figure → RepDB image → Free Exercise DB photos; a small source chip shows which.
- Library filters/search work across all sources (Thai and English search, muscle, equipment, level, category, source). Show the total count.
- Planner / swap / free workout logging / PRs work with `repdb:` ids exactly like Free Exercise DB ids (equipment/level/avoid rules apply; muscle volume heatmap counts them).
- Offline: RepDB JSON cached after first load; viewed images cached; when offline and never loaded, the library shows the other sources and a note.
- Performance: JSON (~2.3 MB) fetched only on library open, parsed in a microtask-friendly way (or a Web Worker) so the UI stays responsive; images lazy-loaded.

## B. 3D-style illustrations for the main exercises (Codex built-in image generation)
The owner wants the look of a clean 3D render (reference described in words — do **not** use any external image as input): a smooth, matte **light-grey 3D mannequin** with sculpted but simplified anatomy (no face details, no hair, no clothing except optional dark grey shorts), soft studio lighting, very light grey seamless background with a soft floor shadow, equipment rendered in the same matte grey (bench, dumbbells, barbell, cable stack, mat, box, wall, chair), and the **target muscles glowing red/orange** (soft emissive glow) — primary muscles strong red, secondary lighter orange. Camera: 3/4 view at about chest height, whole body and equipment in frame, same focal length and mannequin proportions in every image. No text, logos, arrows or watermarks.
- Generate **Start** and **Finish** for all 40 animated exercises in `app/js/exercises.js` (80 images; static holds may reuse one image for both). Pose accuracy first: check each image yourself against the exercise cues (e.g. incline dumbbell press: Start = dumbbells beside the chest on an incline bench, elbows bent ~90°; Finish = arms extended above the upper chest). Regenerate anything with wrong anatomy (extra/missing limbs or fingers), wrong equipment, wrong pose, wrong muscles glowing, text artefacts, or a style that does not match the set.
- Save as WebP 768×768 (quality ~80, ≤ 90 KB each) to `app/img/ex3d/<id>-start.webp` / `-finish.webp`. Add `app/data/illustrations-3d.json` (`{ id: { start, finish, style: "3d", tool: "Codex image generation", created } }`).
- App: 3D images become the default illustration for those 40 exercises (the round 9/11 flat illustrations stay as fallback; add a per-user "สไตล์ภาพท่า: 3D / ภาพวาด / แอนิเมชัน" setting in the theme sheet). Start/Finish side by side, tap or auto-alternate every 1 s, optional movement arrows overlay, lazy-load, not in `SHELL`, cached when viewed.
- Credits/THIRD_PARTY_NOTICES: "ภาพ 3D ของท่าหลักสร้างด้วย AI (OpenAI image generation ผ่าน Codex)".
- Contact sheet `docs/round14-screens/ex3d.html` (or PNG grid) of all images for the owner to review; list any exercise you could not get right.

## Done when
- Library shows Free Exercise DB + RepDB + our exercises, deduped, with correct counts; search/filters/planner/logging work with RepDB ids (tests with a small mocked RepDB JSON fixture — do not commit the real file).
- `git ls-files` contains no RepDB JSON or images (add a test that scans the repo for RepDB image filenames / the dataset's `schema_version` blob and fails if found).
- Attribution visible on credits, README, notices and every RepDB-sourced sheet.
- 80 (or documented fewer) 3D images exist, consistent, correct poses; setting switches styles; fallbacks work.
- Screenshots at 375 px both themes: library list with source chips, a RepDB exercise sheet, 3D Start/Finish for incline/bench press, squat, push-up, deadlift, plank → `docs/round14-screens/`.
- No console errors; all existing tests pass. Leave changes uncommitted; do not push or deploy.
