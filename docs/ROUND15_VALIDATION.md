# Round 15 validation — 2026-10-24

Branch: `codex/round15`. Changes are uncommitted. No push, deployment, migration, worker change, paid API call, or production operation.

**Status: implementation and non-browser tests completed; the browser acceptance checks remain outstanding.** This report does not claim that every “Done when” criterion has been demonstrated. Chromium launch from Playwright failed with `spawn EPERM`; a subsequent shell launch/connection did not expose a working debugging endpoint, and automatic approval review rejected the combined retry as “blocked by policy”. No actual 375px WebGL screenshots, browser console clean bill, real first-paint timings, or phone FPS measurements were obtained.

## Sources and build

- Pinned upstream: `AssiamahS/opengym3d@ea3a60130fdcfb3c4771e44d09f84ebab4ee9bae`.
- The build downloads only the two public `motions/cc0/mesh2motion/human-{base,addon}-animations.glb` files, the upstream licence notices, and twelve allowlisted keyframes-only MIT specs. It rejects unexpected movement lanes. No FBX, Mixamo-lane asset, private mocap repository, RepDB dataset or RepDB image was downloaded or added.
- `app/3d/SOURCES.json` records source URLs, commit, byte counts and SHA-256 for inputs and generated assets. Source and output hashes are covered by tests.
- `scripts/three-d/build-rig.mjs` uses pinned glTF Transform 4.2.1, meshoptimizer 0.24.0 and three.js 0.180.0 development dependencies. It retains one skinned human, removes all unused animation channels/samplers, strips textures, applies a matte grey material, simplifies/quantizes the mesh, and uses required meshopt compression. The matching decoder is vendored.
- Animation tracks are sampled at 30 Hz, with quaternion slerp and glTF cubic-spline evaluation where applicable.
- `human.glb`: **52,600 bytes**, below the 900 KB target. Five animation GLBs combined: **320,812 bytes**, below the 600 KB target.
- The model does not have a separate shorts material/region; no invented shorts mesh was added.
- Complete notices are in `licenses/opengym3d-MIT.txt`, `licenses/mesh2motion-CC0.txt` and `app/js/vendor/three/LICENSE-*.txt`. Credits, README and third-party notices were updated.

Rebuild:

```text
npm ci --prefix scripts
node scripts/three-d/build-rig.mjs
```

## Motion coverage and viewer

| Lane | Count | Coverage |
| --- | ---: | --- |
| CC0 clips | 5 | pushup, jumping_jack, jog, run_interval, walk |
| Adapted MIT keyframes | 12 | db_row, calf_raise, deadlift, shoulder_press, bridge, db_curl, high_knees, lateral_raise, lunge, rdl, triceps_ext, superman |
| Original Fixmee keyframes | 23 | All remaining original exercises, derived from round 11 solved 2D joint directions, with frontal-plane mapping, side-plank roll and shared goblet-grip IK |

Each generated JSON records its provenance. MIT adaptation includes a supinated curl grip, a less extreme dumbbell-row elbow fold, and bridge arms resting alongside the trunk. Blender Z-up aim directions and canonical local rotations are retargeted to the CC0 glTF rig. Original directions are mapped to sagittal/frontal 3D planes. Skin-clearance radii supplement the joint floor checks.

The viewer includes primitive props, hand-parented weights/bars, skin-weight-based regional red/orange highlighting and pulsing emission, play/pause, 0.5/1/1.5 speed, constrained orbit and zoom, double-tap/reset, front/side/3/4 presets, and optional movement-path arrows. Muscle territories are schematic skin-weight regions, not a medical anatomy segmentation. Static holds retain their poses while the highlight pulses.

New installations default to animated 3D; saved 3D-still/illustration/2D preferences remain valid. The viewer loads through dynamic import only when selected. One viewer owns the renderer at a time. Closing/detaching aborts pending loading and disposes resources; rendering stops for hidden tabs and off-screen canvases. DPR is capped at 2 and sustained frame delays trigger a 30 FPS target. These policies are implemented, but real-device performance is unmeasured.

Missing WebGL2, reduced motion, Save-Data and reported memory below 4 GB select still-image fallback. Missing/broken assets fall back without an unhandled loader rejection. Optional workout-player 3D was not enabled; its existing figure and HR/watch header remain unchanged.

The service worker's `const VERSION = 'fitme-v1'` line is unchanged. Lazy 3D module paths are listed for the existing shell completeness contract but explicitly excluded from installation, along with the three.js vendor modules. Viewed modules, GLBs and keyframe JSONs use runtime asset caching. No `app/3d/*` file is precached.

## Tests

The requested non-browser suite completed with **35/35 runner files exiting 0**: 22 app runners and 13 worker runners. `worker/test.mjs` was run from `worker/`, followed by every `worker/round*.test.mjs`. Browser/Playwright/serve scripts and `extract-i18n` were excluded from this sweep.

App runners: `poses`, `round3`, `round4`, `round4-ui`, `round5`, `round5b`, `round5c`, `round6.test`, `round6-offline.test`, `round7`, `round8`, `round9`, `round10`, `round11`, `round12`, `round13`, `round14`, `round15`, `round15-poses`, `settings`, `test`, `ui-test` (all `.mjs`).

Worker runners: `test`, `round4.test`, `round5.test`, `round5b.test`, `round5c.test`, `round6.test`, `round8.test`, `round8-payments.test`, `round10.test`, `round11.test`, `round11-realtime.test`, `round12.test`, `round13.test` (all `.mjs`).

New coverage:

- `tests/round15.mjs`: 42 query/filter parity combinations using the unchanged original predicate; first 40/next 40/reset/stop behavior; fallback capability stubs; all 40 manifest entries; provenance allowlist and forbidden-lane marker scans; hashes and size caps; static-import traversal proving the renderer is not in the initial module graph; real service-worker install/runtime-cache logic with mocked network and offline replay.
- `tests/round15-poses.mjs`: loads and decodes the actual compressed GLBs with the vendored loader/decoder, evaluates **1,125 sampled poses**, checks finite transforms, hand/foot/toe floor clearance, elbow/knee flexion bounds, plank/side-plank alignment, vertical overhead triceps upper arms, shared goblet grip and dumbbell attachment. This is skeletal validation, not exhaustive skin self-intersection or human form certification.
- Existing round 9/14 image fallback, language/theme DOM tests and offline tests pass.
- Small fixes made after the full sweep were rechecked with the relevant 3D pose test and CPU render. Test-generated round 12 documents were restored to their original contents; they are not part of this change.

## Library measurements

The renderer preserves filtering/order/count and appends 40 cards through an IntersectionObserver sentinel, with a button fallback. A new search/filter resets paging. Image elements are created only for appended cards, with lazy loading, asynchronous decoding and fixed dimensions/aspect boxes.

The browser comparison could not run. The following is a **happy-dom construction benchmark**, configured at 375×812, using the actual old/new rendering code, the 40 original plus 876 vendored Free Exercise DB exercises, and the real local illustration manifest. It is not the live 1,453-entry RepDB merge and does not measure layout, network or first paint. No RepDB content was saved for benchmarking.

| Results subtree | Before | After |
| --- | ---: | ---: |
| Cards initially created | 916 | 40 |
| Image elements | 1,786 | 40 |
| DOM elements | 6,328 | 203 |
| Median construction time, five runs | 91.17 ms | 2.75 ms |

Raw measurements: `docs/round15-screens/library-dom.json`. Reproduction: save `git show HEAD:app/js/views/library.js` to a temporary file, set `ROUND15_BASELINE` to that path, and run `node scripts/three-d/benchmark-library.mjs`.

## Visual artifacts and remaining acceptance work

`node scripts/three-d/render-review.mjs` produced 40 **CPU-projected skinned-mesh previews** at phase 0.4, with the 3/4 camera and props. `docs/round15-screens/contact-sheet.html` and `contact-sheet-cpu.png` show all 40. They were visually inspected; this review exposed floor/prop issues beyond the skeletal tests and informed the corrections. The renderer is an SVG triangle projection, so its shading, transparency and occlusion are not equivalent to WebGL.

**Still required in a browser-enabled environment:**

1. Run `node tests/round15-browser.mjs` with Playwright Core installed in `tests/`. Capture bench press, squat, push-up, deadlift, plank, lateral raise, lunge and jumping jacks in both actual app themes at 375px.
2. Check actual shader compilation, console output, interaction, lifecycle transitions and the still-image fallbacks in Chrome/mobile browsers.
3. Measure first-library-render time and DOM count on the full runtime 1,453-entry merge; verify paging while scrolling/searching. Do not save or publish the RepDB payload/images.
4. Measure 60/30 FPS behavior and resource disposal on a mid-range phone. Review the remaining motion/prop fidelity throughout each repetition, not only the sampled midpoint.

`tests/round15-browser.mjs` contains the browser capture/measurement workflow. The current `browser-block.txt` records the blocked session; it is not a passing result. All task-created browser profile directories, including the attempted CDP profile, were removed. Cleanup was confirmed after a path-checked Node removal; shell cleanup commands had been rejected by automatic approval review.

Root `*.jpg` files were not read, moved or published. No RepDB data or images were added. No commits, pushes or deployments were made.


## Round 15B - 2026-10-24

Implemented on the existing `codex/round15` branch. The earlier Round 15 text above is historical: the current default remains `exerciseVisualStyle: '3d'` (still images). Animated 3D stays opt-in; no default activation was made.

### Motion and attachment changes

- `app/js/three-motion.js` adds the six named hand poses (`grip_bar`, `grip_db`, `grip_kb`, `flat`, `fist`, `relaxed`). Finger rotations replace the source finger transforms on every sampled frame, including CC0 clips. Grips use 80-degree phalange flexion with opposing thumb flexion; flat fingers are aligned together. Both hands resolve a pose from the exercise/phase contact declarations covering all 40 exercises.
- Palm sockets are measured from the loaded rig, halfway between the wrist and middle-finger base, offset 18 mm toward the palm. Dumbbell shafts run across the palm. The kettlebell handle's top tangent, rather than its empty hole, meets the socket. Two-handed bars use the sockets' midpoint and direction every frame.
- Original analytic two-bone IK preserves limb lengths, clamps unreachable targets, and uses pole vectors to control elbow/knee bending. Root compensation brings retargeted support points into reach. Floor, wall and step contact phases are declared for the whole catalog, including alternating and landing contacts.
- Bench press is authored supine along the bench, with supported pelvis/back/head, feet either side, fixed-width grip, a chest-to-shoulder bar path and vertical forearms. Deadlift has a flat-back hinge, mid-shin start, standing finish and a bar path adjusted to clear the knees/thighs while preserving grip width. Plank has extended legs and forearm support with elbows under shoulders. Lateral raise has both dumbbells, a slight elbow bend and shoulder-height peak. Lunge uses fixed split-stance feet, a nearly vertical front shin and a low rear knee.
- Reviewed the remaining exercises in the contact sheet. Additional corrections include floor-hand reach, calf-raise toe support, step support, the bird-dog reaching arm, the supporting side-plank hand, and cable-bar head clearance.
- `app/js/three-viewer.js` fits the default 3/4 camera to the actual skinned vertices and props sampled over 32 phases of the entire clip, targeting 85% of the frame. Front/side presets and reset reuse the same envelope; zoom limits scale with the fitted distance. The camera is stable during playback.

### Validation and evidence

- **Full requested sweep: 36/36 runner files passed** (23 top-level app tests and 13 worker tests). Excluded browser/Playwright/serve runners and `extract-i18n` as requested. `worker/test.mjs` and every `worker/round*.test.mjs` ran with `worker/` as the working directory. Raw per-run exit codes, timings and output: `docs/round15-screens/round15b-tests.json`.
- After the final hand/handle refinements, focused rechecks passed: `node tests/round15b-geometry.mjs` (**11,249 checks, 640 frames, all 40 exercises**), `node tests/round15-poses.mjs` (**1,125 samples, zero issues**), and `node tests/round15.mjs` (licences/hashes, lazy loading, fallback policy, paging and offline contracts).
- The new geometric runner loads the real compressed `human.glb` and clips without WebGL. It checks socket-to-handle-axis distance <= 25 mm, 70-90 degree finger flexion, declared planted-foot/step contacts within 10 mm, flat-hand surface contacts within 20 mm, bench support within 30 mm, straight plank alignment (170-190 degrees), forearm support, rear-lunge knee <= 150 mm, front-shin alignment, lateral-raise angle (75-100 degrees), vertical bench forearms, fixed deadlift grip width, implement clearance and 80-90% camera extent.
- Surface checks use calibrated skin-contact offsets from the skeleton (including 10 mm under the toe marker and bench back/head/pelvis radii). Implement collision checks use torso/head spheres plus spheres sampled along upper-arm, thigh and calf segments; intentional hand contact is excluded. These are geometric proxies, not exhaustive triangle-level collision detection or anatomical certification.
- `node scripts/three-d/render-animation.mjs` creates **`docs/round15-screens/anim-contact.png`**, a 1920 x 7000 contact sheet with start / mid / peak for all 40 exercises (120 frames). `anim-contact.html` provides a local viewer. Software rendering projects the actual deformed mesh and props into shaded SVG triangles and rasterizes with the already-installed Sharp dependency. No headless GL installation or browser profile was needed.
- **`docs/round15-screens/anim-geometry.json`** also records 16 phases per exercise, with joints, both palm sockets, handle axes/centres and the fitted camera. The software contact sheet was visually inspected. This evidence is not a browser/WebGL screenshot; shader, browser interaction and device FPS validation remain separate from these non-browser checks.

Reproduce:

```text
node tests/round15b-geometry.mjs
node tests/round15-poses.mjs
node tests/round15.mjs
node scripts/three-d/render-animation.mjs
```

### Boundaries and cleanup

No new motion assets, upstream downloads or dependencies were required. Existing CC0/MIT provenance, hashes, credits and licences remain unchanged; no forbidden motion lane was used. `app/sw.js` was not changed, including `const VERSION = 'fitme-v1'`. Root JPG contents were never read, moved or published. No RepDB data or images were saved or committed. No browser/profile was created. Temporary review images were removed; unrelated test-generated Round 12 artifacts were restored byte-for-byte from their pre-test contents. All changes are uncommitted; no push or deployment occurred.
