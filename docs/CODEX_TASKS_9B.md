# Round 9B — generate the exercise illustrations with Codex image generation (no kie.ai)

The owner decided not to use kie.ai. Use your own built-in image generation tool to create the illustrations for Part B of `docs/CODEX_TASKS_9.md`. Keep the kie script in the repo as an optional alternative, but the default source is now Codex.

## Generate
- For each of our 40 exercises in `app/js/exercises.js`, generate a **Start** and a **Finish** image (80 total) from `scripts/illustrations/prompts.json` (create/refresh it if needed).
- One consistent style for all images: anatomical fitness illustration, muscular light-grey figure with visible muscle definition, black shorts, barefoot, plain white background, clean 3/4 view, simple white/black equipment, the exercise's target muscles shaded red, no text, no arrows, no logos, no watermark, no real person likeness, same figure proportions and camera distance in every image, square 1:1.
- Pose accuracy matters more than detail: start/finish must match the movement (e.g. incline dumbbell press: Start = dumbbells beside the chest on an incline bench, elbows bent; Finish = arms extended above the chest). Check each image yourself; regenerate any with wrong anatomy (extra limbs/fingers), wrong equipment, wrong pose, text artifacts, or a style that does not match the others. Static holds (plank, wall sit, stretches) may use the same pose for both frames — then generate one image and use it for both.
- Save as WebP 768×768, quality ~80 (target ≤ 90 KB each) to `app/img/ex/<id>-start.webp` and `app/img/ex/<id>-finish.webp`. If you cannot convert to WebP in the sandbox, save optimised PNG/JPEG and note it.
- Write `app/data/illustrations.json` with an entry per approved exercise: `{ "start", "finish", "source": "ai", "tool": "Codex image generation", "created" }`. Leave out any exercise you could not get right and list it in the validation doc.

## App and docs
- The app code from round 9 should already display approved illustrations (Start/Finish side by side, alternating, fallback to the animated figure). Verify it with the real images at 375px in both themes; images must lazy-load and not be in `SHELL`.
- Credits page and `THIRD_PARTY_NOTICES.md`: "ภาพประกอบท่าออกกำลังกายสร้างด้วย AI (OpenAI image generation ผ่าน Codex)"; remove the kie.ai wording from the app (keep it only in the README's optional section).
- Save screenshots of 6 exercise sheets showing the illustrations to `docs/round9-screens/`.
- Add a contact-sheet page `docs/round9-screens/illustrations.html` (or a PNG grid) of all 80 images for the owner to review.

## Done when
- 80 images (or fewer with a documented list) exist, consistent in style, correct poses, total size reported.
- All tests pass, no console errors. Leave changes uncommitted; do not push or deploy.

## Fixes from Claude's review of round 9 (do these too)
- Start–Finish view of the animated figure is far too small (figure ~25% of frame width, highlights barely visible). Crop the viewBox to the figure + equipment bounds so the figure fills ~85% of each frame; same for the exercise sheet animation.
- Muscle map uses yellow/gold for target muscles; use the same red tokens as the figure (`--muscle-primary` red, `--muscle-secondary` light red) in both themes, and make the non-target regions lighter so the red stands out.
- The "Animation / Start–Finish" toggle should be the app's segmented control style (`.seg` chips), not two large outline buttons.
