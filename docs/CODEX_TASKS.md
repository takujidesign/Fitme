# Tasks for Codex (Fixmee)

Read README.md first. The app is static ES modules in `app/` (no build step), backend in `worker/src/index.js` (Cloudflare Worker).
Match the existing code style: bilingual strings via `L('ไทย','English')`, views register `views.x` and `actions['x']` in `app/js/views/*.js`, state via `getState/setState` in `app/js/store.js`. Add new JS files to the `SHELL` list in `app/sw.js`. Do not commit secrets. Work on branch `codex/admin-ai-figure`, one commit per task.

## 1. Admin page (`#/admin`)
- Worker: add `GET /api/config` (public) and `PUT /api/admin/config` (header `Authorization: Bearer <ADMIN_PASSWORD>`, new secret). Store JSON in KV binding `CONFIG` (add to wrangler.toml, commented id). Fields: `promptpayId`, `promptpayName`, `receiverName`, `products` (thb, usd, days, exports, names, descriptions), `freePlanDays`, `freeSupplements`. Worker must use KV `products`/`receiverName` when present, falling back to the hard-coded `PRODUCTS`.
- Also return `secrets: {thunder: bool, stripe: bool, anthropic: bool, token: bool}` (only whether each is set, never values).
- App: on start, if `CONFIG.API_BASE` is set, fetch `/api/config` and merge into `CONFIG` (cache last value in localStorage for offline).
- New view `app/js/views/admin.js`: password field (kept in sessionStorage only), form to edit the fields above, status chips for the secrets, Save button. Not linked from the tab bar; reachable via `#/admin` and a small link at the bottom of the Me page.
- API keys stay as `wrangler secret` values; the admin page explains this and shows the commands.

## 2. AI coach (replace "label reader" focus)
Worker: `POST /api/ai/plan-review` and `POST /api/ai/body` (Pro token required, same check as `analyzeLabel`). Use `@anthropic-ai/sdk` `client.messages.parse` with `zodOutputFormat`, model `claude-opus-5-5`, `output_config.effort: 'medium'`, like the existing `analyzeLabel`.
- **plan-review**: input = profile, targets, today's meals/supplements (send JSON, no photos). Output: short Thai+English advice list, suggested swaps (food ids from `app/js/foods.js`), warnings. Show in Food page as an "AI โค้ช" card with a button.
- **body**: input = 1-3 body photos (front/side/back) + height/weight/age/sex. Output: visual body-fat range (e.g. 15-19%), posture notes, which muscle groups look under-developed, suggested `goal` and focus groups. Must state it is a rough visual estimate. UI in Me → Body photos: "วิเคราะห์รูปร่างด้วย AI" button, explicit consent dialog first (photos are sent to the server/Claude, not stored), recommend wearing shorts/sports bra. Apply suggested goal/focus only when the user taps "ใช้คำแนะนำนี้".
- Workout generator (`app/js/workout.js`): accept optional `profile.focus` (array of groups) and give those groups one extra exercise per session.
- Keep label reading as is.

## 3. More realistic exercise figure
Keep the existing skeleton/IK and all pose data in `app/js/exercises.js` (do not re-author poses). Replace only the drawing in `renderPose` (`app/js/figure.js`):
- Draw each segment as a tapered capsule polygon (thicker at the joint near the body: thigh 15→10, shin 10→7, upper arm 10→8, forearm 8→6), torso as a shaped polygon (wide chest/shoulders, narrower waist, hips), neck, head with a slight jaw shape, hands and shoes as small rounded shapes.
- Soft shading with SVG linearGradient per segment (light from top-left), far-side limbs darker, a soft ground shadow ellipse under the feet that follows the hips' x.
- Highlighted muscles (`ex.hl`) tinted lime with a subtle glow filter.
- Keep it fast: no per-frame DOM rebuild of `<defs>`; build defs once per SVG. Check every exercise renders (front and side views) and the print PDF still looks right.

## Done when
- `python -m http.server 5173 --directory app` runs with no console errors on every route.
- `cd worker && npx wrangler deploy --dry-run` succeeds.
- README updated (admin page, new secrets, AI coach).
