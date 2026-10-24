# Round 15B — fix the animated 3D: hands, grips, poses, props, framing

Continue on branch `codex/round15` (commit 9d257b6). Same rules and licences as `docs/CODEX_TASKS_15.md` (CC0 mesh2motion + MIT opengym3d + our own keyframes; never Mixamo). Animated 3D is currently opt-in (`exerciseVisualStyle` default `'3d'` = still images); keep it opt-in until every check below passes, then the owner decides.

## Problems the owner and Claude saw in the browser (375 px)
1. **Hands are wrong everywhere** (owner screenshot): fingers stay splayed open in the bind pose; the barbell passes through/near the wrists instead of sitting in the palms (bench press, deadlift); dumbbells float beside the hand.
2. **Bench press**: the body is not lying along the bench (torso/head off the end, legs hanging behind); should be supine with head, upper back and glutes on the bench, feet flat on the floor either side, bar over the mid-chest at the bottom and above the shoulders at the top, forearms vertical.
3. **Deadlift**: bar is not in the hands and sits at knee height beside the legs; it must stay in contact with the hands, travel close to the shins/thighs, start at mid-shin with a hip hinge (flat back) and finish standing with the bar at the thighs.
4. **Plank** looks like crawling/lying; must be a straight line head–hips–heels on forearms (elbows under shoulders) or hands.
5. **Lateral raise** has no dumbbells; arms should rise to shoulder height with a slight elbow bend.
6. **Lunge** looks like walking; must be a split stance with the back knee lowering toward the floor and the front shin near vertical.
7. **Framing**: the figure fills < 50 % of the canvas; auto-frame the bounding box of the figure + props over the whole clip so it fills ~85 % of the canvas from the default 3/4 camera.

## Required fixes
- **Hand poses**: the rig has finger bones (`index/middle/ring/pinky_01..03_l/r`, `thumb_01..03_l/r`). Add named hand poses applied on top of every clip/keyframe: `grip_bar` (power grip: fingers curled ~70–90° per joint around a 3 cm cylinder, thumb wrapped opposite), `grip_db` (same around the dumbbell handle), `grip_kb`, `flat` (palm down on floor/wall/bench, fingers extended together), `fist` (running/high-knees), `relaxed` (default). Each exercise declares which hand pose each hand uses per phase.
- **Implement attachment**: compute a palm socket per hand (centre between `hand` and the `middle_01` base, offset toward the palm) and attach bars/dumbbells/kettlebells there so the handle passes through the curled fingers. For two-handed bars, solve the bar from both sockets (midpoint + direction) every frame and keep hands at the grip width; never let the implement pass through the body.
- **Body placement / IK**: add simple two-bone IK for arms and legs (three.js `CCDIKSolver` is MIT and fine, or analytic two-bone IK) to pin feet to the floor/step, hands to the floor/wall/bench/bar, and the body to the bench where required. Re-author the poses for bench press, deadlift, plank, lateral raise and lunge using these constraints; review every other exercise with the same constraints.
- **Geometric acceptance tests (Node, no WebGL)**: load `human.glb` with three.js in Node, sample 16 frames per exercise, and assert: palm-socket to handle-axis distance ≤ 2.5 cm for gripped implements; finger flexion in grip range when gripping; feet within 1 cm of floor/step when planted; hands within 2 cm of the surface for `flat`; bench press pelvis/upper-back/head within 3 cm of the bench top; plank head–hip–ankle angle 170–190°; lunge back-knee height ≤ 15 cm at the bottom; lateral-raise upper arm 75–100° from vertical at the top; no mesh-segment intersections between implement and body (bounding-sphere check); figure bounding box fills 80–90 % of the frame.
- **Visual evidence without a browser**: because Chromium cannot run in your sandbox, render frames off-screen in Node (e.g. `three` + `headless-gl`/`gl` package, MIT/BSD, devDependency in `scripts/`) or rasterise silhouettes via a software path, and write a contact sheet `docs/round15-screens/anim-contact.png` with start / mid / peak for all 40. If headless GL also cannot run, write the per-frame joint/handle coordinates to `docs/round15-screens/anim-geometry.json` and say so — Claude will review visually.

## Done when
- All geometric tests pass for all 40 exercises; contact sheet (or geometry dump) produced.
- No Mixamo data; licences and credits unchanged or updated.
- All existing tests pass. Leave changes uncommitted; do not push or deploy.
