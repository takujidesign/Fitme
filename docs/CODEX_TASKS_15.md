# Round 15 tasks for Codex — real 3D animated exercises + fast library

Same rules as earlier CODEX_TASKS files (static ES modules, `L()` + i18n, `SHELL` without touching `VERSION`, 375 px, both themes, offline, tests). No worker changes expected. Do not push or deploy.

## 0. Sources and licences (hard rules)
- **3D character, rig and clips: mesh2motion, CC0 1.0** — from `AssiamahS/opengym3d` at a pinned commit: `motions/cc0/mesh2motion/human-base-animations.glb` (base human + Walk, Jog, Sprint …) and `human-addon-animations.glb` (Pushup, Jumping Jacks, Crawl, Meditate …). CC0 allows vendoring; still credit "3D character and motion: mesh2motion (CC0)".
- **opengym3d (MIT)**: its exercise keyframe JSONs (bone rotations) for exercises whose `movement` lane is keyframes-only may be adapted with the MIT notice (add `licenses/opengym3d-MIT.txt` and a credits line "3D keyframes adapted from opengym3d (MIT)").
- **Never use anything from the Mixamo lane** (`mixamo/*.fbx` — squat, plank, crunch, sit-up, curl, burpee, etc.); Adobe terms forbid redistributing those clips. Do not fetch the private `opengym3d-mocap` repo.
- **three.js** (MIT) for rendering: vendor a pinned build under `app/js/vendor/three/` with its licence (or import from jsDelivr at an exact version — jsDelivr is already allowed in the CSP). Load it **only** when a 3D view is opened.

Claude checked opengym3d's 42 exercise specs:
- CC0 mocap: `push_up` (Pushup), `jumping_jack` (Jumping Jacks), `jog` (Jog), `run` (Sprint), `walk` (Walk), `bear_crawl` (Crawl), `seated_meditation` (Meditate).
- Keyframes-only (MIT, adaptable): `bent_over_row`, `calf_raise`, `deadlift`, `dumbbell_shoulder_press`, `glute_bridge`, `good_morning`, `hammer_curl`, `high_knees`, `lateral_raise`, `lunge`, `overhead_press`, `overhead_tricep_extension`, `reverse_lunge`, `romanian_deadlift`, `sumo_squat`, `superman`, `wall_sit`.
- Mixamo (forbidden): `back_squat`, `bicep_curl`, `bicycle_crunch`, `burpee`, `clean_and_jerk`, `crunch`, `front_raise`, `jump_push_up`, `kettlebell_swing`, `overhead_squat`, `pistol_squat`, `plank`, `situp`, `snatch`, `squat`, `sumo_high_pull`.

## 1. Asset pipeline (`scripts/three-d/`)
- `build-rig.mjs` (Node, uses `@gltf-transform/core` + `functions`, MIT, devDependency in `scripts/package.json`): download the two CC0 GLBs at the pinned commit, keep one skinned human mesh + skeleton, keep only the clips we use, resample clips to 30 fps, quantise/compress (meshopt or Draco — the viewer must include the matching decoder), and write `app/3d/human.glb` (target ≤ 900 KB) plus `app/3d/clips/<name>.glb` or a single clips file (target total ≤ 600 KB). Record source URLs, commit and SHA-256 in `app/3d/SOURCES.json`.
- Material: one matte light-grey PBR material matching the round 14 3D images (roughness ~0.8, no texture), dark-grey shorts if the mesh has a separable region, otherwise none.

## 2. Animations for all 40 exercises
Priority per exercise:
1. CC0 clip where it exists (pushup, jumping_jack, jog, run_interval, walk; use the crawl/meditate clips only if one of our exercises matches).
2. Adapted opengym3d keyframes (MIT) where they match: db_row←bent_over_row, calf_raise, deadlift, shoulder_press←dumbbell_shoulder_press, bridge←glute_bridge, db_curl←hammer_curl (adjust grip), high_knees, lateral_raise, lunge, rdl←romanian_deadlift, triceps_ext←overhead_tricep_extension, superman; use wall_sit/sumo_squat/reverse_lunge/good_morning only as references for our own versions.
3. **Our own keyframes for everything else** (squat, goblet_squat, squat_jump, chair_squat, step_up, knee_pushup, wall_pushup, bench_press, lat_pulldown, plank, side_plank, crunch, leg_raise, mountain_climber, dead_bug, bird_dog, cat_cow, child_pose, forward_fold, quad_stretch, jump_rope, kegel, breathing): write `app/3d/keyframes/<id>.json` in the same bone-rotation format, derived from our corrected 2D poses in `app/js/exercises.js` (round 11) — map sagittal joint angles to the rig's bones and add the frontal-plane rotations the 2D data cannot express. These are our own work.
- Props as simple three.js primitives in the matching grey: bench (flat/incline), barbell + plates, dumbbells, kettlebell, cable stack + bar, mat, step box, wall, chair, jump rope. Attach handheld props to hand bones.
- **Muscle highlight**: compute per-vertex muscle regions from skin weights (bone → our muscle-map region ids) once at load, and tint primary muscles red / secondary orange with a soft emissive glow, using `exerciseMuscles()` from `app/js/muscle-map.js`. Pulse the glow subtly with the contraction phase.
- Pose checks reused from round 11 (`tests/poses.mjs` style) on sampled 3D bone positions: no foot below the floor, hands on the implement, joint limits, per-exercise invariants (plank line, triceps upper arm vertical, etc.).

## 3. 3D viewer in the app
- New view mode "3D" in the exercise sheet (and as the default when supported; setting "สไตล์ภาพท่า" from round 14 gains "3D เคลื่อนไหว"). Canvas sized to the sheet width, 1:1, transparent background over the theme surface.
- Controls: play/pause, speed 0.5× / 1× / 1.5×, drag to orbit (yaw ±180°, pitch limited), pinch/scroll zoom (clamped), double-tap to reset; camera presets front / side / 3/4. Show the movement arrows from round 9 as a 3D curve (optional toggle).
- Performance: lazy-load three.js + assets only on first 3D open; one shared renderer; pause rendering when the sheet closes, the tab is hidden, or the canvas is off-screen; cap DPR at 2; target 60 fps on mid phones, drop to 30 fps if frame time > 20 ms; dispose on close.
- Fallbacks: no WebGL, low-memory devices, Save-Data, or `prefers-reduced-motion` → the round 14 3D still images. Offline: cache `app/3d/*` after first load (runtime cache, not SHELL).
- Player: during a workout, the player figure area may use the 3D view when supported (keeps the HR/watch button from round 11 in the header).

## 4. Fast exercise library (Claude found this on the live site)
`#/library` renders all 1,453 merged exercises at once (~2,700 `<img>` elements in the DOM after opening). Make it fast:
- Windowed/paged rendering: first 40 cards, then append 40 more via an IntersectionObserver sentinel; reset on search/filter change; keep the "N / 1453" count accurate.
- Only visible cards create image elements; `loading="lazy"`, `decoding="async"`, fixed aspect boxes to avoid layout shift.
- Search/filter results must be identical to today (test comparing the filtered id list before and after for a set of queries/filters).
- Record DOM node count and time-to-first-library-render at 375 px before and after in the validation doc.

## Done when
- `app/3d/human.glb` + clips within size targets, sources and hashes recorded; no Mixamo-derived data anywhere (test scans `app/3d` and keyframe files for the forbidden clip names and fails if found).
- All 40 exercises animate in 3D with props and muscle glow; pose checks pass; screenshots (3/4 view, mid-rep) of bench press, squat, push-up, deadlift, plank, lateral raise, lunge, jumping jacks in both themes → `docs/round15-screens/`, plus a contact sheet of all 40.
- Fallbacks work (tests stub missing WebGL / reduced motion); 3D code is not loaded until the 3D view opens (test on the module graph).
- Library windowing in place with identical results; measurements recorded.
- Credits/THIRD_PARTY_NOTICES/README updated (mesh2motion CC0, opengym3d MIT, three.js MIT, gltf-transform MIT if vendored).
- No console errors; all existing tests pass. Leave changes uncommitted; do not push or deploy.
