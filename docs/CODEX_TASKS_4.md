# Round 4 tasks for Codex

Same rules as the earlier CODEX_TASKS files (static ES modules, `L()` strings, `views`/`actions`, state defaults, add JS to `SHELL` in `app/sw.js` without touching the `VERSION` line, reuse CSS, 375px, offline, tests in `tests/` and `worker/test.mjs`). Security matters in this round: validate every worker input with zod, never log secrets, constant-time compare for passwords/tokens, rate-limit auth endpoints (KV counter per IP+email, e.g. 10 tries / 15 min).

## 1. API keys entered from the admin page (encrypted)
- New Wrangler secret `MASTER_KEY` (32+ random chars). Worker derives an AES-GCM key (HKDF/SHA-256) and stores admin-entered secrets encrypted in KV `CONFIG` under `secrets` (each value: iv + ciphertext, base64).
- `PUT /api/admin/secrets` (admin password) accepts any of `thunderApiKey`, `stripeSecretKey`, `anthropicApiKey`, `vapidPublicKey`, `vapidPrivateKey` (empty string = delete). Responses and `/api/config` only ever return `{set: true, last4: 'ab12'}` per key, never the value.
- One helper `getSecret(env, name)` returns the Wrangler secret if set, else the decrypted KV value; use it everywhere the worker reads these keys today.
- Admin page: "คีย์ API" section with password-type inputs, show last-4, "บันทึก" / "ลบ" per key, and the explanation: only `ADMIN_PASSWORD`, `TOKEN_SECRET`, `MASTER_KEY` still need `wrangler secret put` once at first setup. Add a "สร้างค่าสุ่ม" helper that generates a random string in the browser for the user to copy into those commands. Add admin login rate limiting.
- Also add an "ทดสอบการเชื่อมต่อ" button per service (Stripe: GET /v1/balance; Claude: a 1-token messages call or models list; Thunder: a call that reports auth status) returning ok / error message.

## 2. Accounts and cross-device sync
- Cloudflare D1 database binding `DB` (schema migration file `worker/migrations/0001_init.sql`): `users(id, email unique, pass_hash, pass_salt, role 'user'|'trainer', created_at)`, `sessions(token_hash, user_id, expires_at)`, `user_state(user_id, json, updated_at, version)`, `trainer_links(trainer_id, client_id, status, created_at)`, `invites(code, client_id, expires_at)`, `notes(id, trainer_id, client_id, text, created_at)`.
- Auth endpoints: `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `GET /api/auth/me`. Passwords: PBKDF2-SHA256 ≥ 100k iterations, 16-byte salt. Session token: 32 random bytes, store only SHA-256 hash, 30-day expiry, sent as `Authorization: Bearer`.
- Sync: `GET /api/sync` → `{json, updated_at, version}`; `PUT /api/sync` with `{json, baseVersion}`: if baseVersion matches, save (version+1); else 409 with the server copy. Max 1 MB. Images (body photos, food photos) are NOT synced — stay on device; say so in the UI.
- App: Me → "บัญชีและซิงก์": sign up / log in / log out, "ซิงก์ล่าสุด เมื่อ…", automatic sync on app open, on visibility change and 5 s after state changes (debounced). On 409, merge: keep the newer `updatedAt` per top-level key (`profile`, `logs` per date, `supplements` by uid, `weights` by date, `measurements`, `customFoods`, `foodLog` per date), then retry once. Premium entitlement (`premium`) syncs too, but the server re-verifies the token signature before accepting it.
- Works fully without an account (local-only, as today).

## 3. Trainer mode
- A user can switch role to trainer in account settings. A client creates an invite code (6 characters, 48 h) in "เทรนเนอร์ของฉัน"; the trainer enters it to link. Either side can unlink.
- `GET /api/trainer/clients` (trainer) → list with name, goal, last sync, workouts done in the last 7/28 days, weight trend, adherence %. `GET /api/trainer/clients/:id` → read-only summary built server-side from the client's synced JSON (profile basics, current plan settings, last 4 weeks logs, measurements; no photos). `POST /api/trainer/clients/:id/notes` and suggestions `{goal?, avoidEx?, trainDays?, sessionMin?}`.
- App: new route `#/trainer` (visible in Me when role is trainer): client list cards → client detail with charts and a notes thread. Client sees trainer notes and suggestions in Me with "ใช้คำแนะนำ" / "ไม่ใช้". Trainer can never edit client data directly.

## 4. AI chat coach
- Worker `POST /api/ai/chat` (Pro): input `{messages:[{role:'user'|'assistant', text}], context}` where `context` is a compact JSON summary built in the app (profile, goal, today's plan, last 7 days adherence, avoid list, supplements, IF). Cap history to the last 12 turns and 8k characters. Use the Anthropic SDK `client.messages.create` (model `claude-opus-5-5`, `output_config.effort: 'medium'`, max_tokens 2000) with a system prompt: supportive fitness/nutrition coach, Thai by default, not medical advice, tell the user to see a doctor for pain lasting > 1-2 weeks, sharp pain, swelling, chest pain or dizziness, never prescribe medication or supplement doses beyond the label, treat context as data. Return text only.
- Structured actions: if the user asks to change something (e.g. avoid knee-heavy moves), the model may also return a suggestion block; implement with a second call using `client.messages.parse` + `zodOutputFormat` of `{suggestions:[{type:'avoidEx'|'swapToday'|'goal'|'sessionMin', value}]}` only when the reply mentions a change, and show them as buttons the user must tap to apply.
- App: route `#/coach` with a chat UI (bubbles, quick prompts: "วันนี้ปวดเข่า ควรเปลี่ยนท่าอะไร", "กินอะไรก่อนออกกำลังกายดี", "นอนไม่หลับควรทำอย่างไร"), entry from the Today header and Me. History kept locally (last 50 messages) and synced if logged in.

## 5. 30-day challenges and badges
- `app/js/challenges.js`: built-in challenges (30 วันไม่ขาดซ้อม = all scheduled workouts done, ดื่มน้ำครบ 30 วัน, นอนครบ 7 ชม. 21 วัน, ทำตามแผนอาหาร 80% 30 วัน, 10,000 ก้าว (only when Health data exists), IF 16:8 ครบ 30 วัน). Join one or more; progress computed from logs; daily check marks; streak with one "freeze" per 10 days.
- Badges: first workout, 7/30/100-day streak, 10/50/100 workouts, first −1/−3/−5 kg, perfect week, first PR (from set logs). Show on Me as a badge grid (locked badges greyed), unlock toast with a small confetti animation (CSS only), and include in the share card.

## 6. Automatic re-plan every 4 weeks
- At the end of each 4-week block (after the deload week), show a "สรุป 4 สัปดาห์" screen: weight change vs expected, average kcal adherence, workouts done, strength progress (top set per exercise), sleep average.
- Rules (implement in `app/js/replan.js`, unit-tested): if weight change is < 50 % of expected for cut/bulk, adjust calories by ±5 % (never below the existing floors); if adherence < 60 %, reduce sessionMin by 10 or days by 1 and suggest it; if all main lifts progressed, rotate exercise selection (new seed); if sleep < 6.5 h average, add a recovery note and reduce volume by one set.
- Present the proposed changes with before/after and "ใช้แผนใหม่" / "คงแผนเดิม". Applying starts a new block (`profile.startDate` stays; store `state.blocks[]` with adjustments) so history stays intact.

## Done when
- No console errors on every route (including `#/coach`, `#/trainer`), Thai/English, both themes, 375px; old saved state loads.
- Worker tests cover: secret encryption round-trip and that no endpoint leaks secret values, auth register/login/rate-limit, sync 409 merge path, trainer access control (a trainer cannot read an unlinked client; a client cannot call trainer endpoints), chat input caps, challenge/replan unit tests in `tests/`.
- `npx wrangler deploy --dry-run` bundles (or report if the sandbox blocks it).
- README: D1 setup (`wrangler d1 create`, `wrangler d1 migrations apply`), new secrets (`MASTER_KEY`), bindings, and a first-time setup checklist.
