# Round 10 tasks for Codex — free app, choose-your-AI, donations, ideas board, per-tab themes

Same rules as earlier CODEX_TASKS files (static ES modules in `app/`, `L()` + zh/ja/vi, new files in `SHELL` of `app/sw.js` without touching the `VERSION` line, 375px, both themes, offline, backward-compatible state, tests in `tests/` and `worker/*.test.mjs`). Worker: keep name/bindings/API URL; new migration `worker/migrations/0006_round10.sql` (applied later by the GitHub workflow — do not apply remotely). Deploys go through `.github/workflows/deploy-*.yml`; do not change them unless needed.

## 1. Free mode
- New admin setting `freeMode` (default **true**) in CONFIG. When on: every app feature is free — full plan length, PDF/ICS export, all days unlocked, no lock cards, no Pro upsell. `hasPro()` / `isLockedDay()` / `gateExport()` respect it. Pro packages are hidden from `#/pay`; existing paid entitlements keep working. Turning it off restores today's behaviour (keep all payment code).
- AI is the only thing that can cost money; see §2.

## 2. AI coach — four engines the user can choose
One AI surface built into the app (coach chat, meal-photo estimate, body review, plan review, supplement label read). Same UI for every engine; engine chosen in a new `#/ai-settings` screen (link from the coach header and Me → AI) and remembered per device. The existing structured outputs (meal items, body review, plan review, label product, plan suggestions) must be produced by every engine that can.

1. **Gemini with your own key (default, recommended)**
   - Step-by-step setup screen with screenshots-free text steps: open https://aistudio.google.com/app/apikey → Create API key → paste. "Test key" button.
   - Calls go **directly from the browser** to `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with header `x-goog-api-key` — never through our worker. Images as `inline_data` (base64, resized ≤1024 px). Structured output with `generationConfig.responseMimeType: "application/json"` and a JSON schema converted from our zod schemas; validate the reply in the app with the same zod/v4 schemas and show a friendly error on mismatch.
   - Model picker filled from `GET /v1beta/models` (only models supporting `generateContent`), default the newest "flash" model available; remember choice.
   - Key stored only in localStorage under a separate key (e.g. `fitme:gemini-key`), **excluded from backups, sync, telemetry and error reports**; "Remove key" button. Clear notice: free-tier Google keys may let Google use prompts to improve their products — don't send what you don't want shared; the app shows exactly what will be sent before the first call (and a "don't show again" toggle).
2. **On-device AI in Chrome (Gemini Nano)**
   - Feature-detect the built-in Prompt API (`globalThis.LanguageModel` with `availability()` / `create()` / `prompt()`); show the option only when available, with a download-progress state if the model must be fetched. Text-only tasks (coach chat, plan review, short tips); image features show "not supported on this engine — choose another".
3. **Claude with Fixmee credits** (existing round 8 system) — optional; uses `/api/ai/*` and the credit wallet unchanged. Shown with the credit balance. Admin can hide this engine (`aiEngines.claude=false`).
4. **Open in ChatGPT / Gemini (copy & paste)**
   - Builds the same prompt (profile, targets, today's plan/meals, exclusions, language) plus an instruction to end the answer with a fenced block labelled `FIXMEE` containing JSON in our schema.
   - "Open ChatGPT" → `https://chatgpt.com/?q=<encoded prompt>` (falls back to copy when the URL would exceed ~6,000 chars); "Open Gemini" → copies the prompt and opens `https://gemini.google.com/app`. For photo tasks tell the user to attach the photo there.
   - "Paste reply" sheet: user pastes the whole answer; the app extracts the `FIXMEE` block, validates it with zod and applies it (log meal, apply plan suggestion after confirmation, etc.); shows the human-readable part too.
- Coach header shows the active engine as a chip; switching engine never loses the chat history (stored locally, max 50 messages).
- `#/ai-summary`: a plain, readable page summarising today's profile, plan, meals and progress (no secrets), so Chrome's ChatGPT/Gemini side panels can read it; link "เปิดหน้าสรุปให้ AI อ่าน" from the coach.
- Tests: engine selection persists; Gemini request shape (mock fetch) incl. images and schema; key never appears in backup/sync payloads; Nano feature detection on/off; FIXMEE block extraction (valid, missing, malformed, extra text); ChatGPT URL length fallback.

## 3. Donations ("สนับสนุน Fixmee")
- New `#/support` page linked from Me and a small, dismissible card at the bottom of Today once a week (never blocking).
- **Thailand — PromptPay QR**: preset amounts 39 / 99 / 199 / custom; generate the PromptPay QR with the amount (reuse the existing QR code). Optional "แนบสลิปเพื่อรับป้ายผู้สนับสนุน" → existing Thunder `/v2/verify/bank` flow via a new worker endpoint `POST /api/donate/slip` (amount ≥ 1 THB, receiver check, slip replay protection like payments) → returns a signed supporter token (HMAC, like entitlement tokens) with amount and date.
- **International**: admin-configurable links shown as buttons — `donate.wiseUrl` (Wise payment link / Wise Business QuickPay) and `donate.stripeUrl` (Stripe Payment Link). Show only the ones set; if both are empty, hide the international section. No automatic verification for these; supporters can type a note and the admin can grant the badge manually from the admin page (by account email or a one-time code).
- Supporter perks (thank-you only, nothing locked): supporter badge on Me and share card, an extra "supporter" colour theme, and votes count ×2 on the ideas board. Thank-you screen with confetti (respect reduced motion).
- Donations are recorded in D1 (`donations` table: id, owner, amount, currency, method, created, note) and listed in the admin page with totals per month.

## 4. Ideas board ("เสนอฟีเจอร์")
- `#/ideas`: list of approved ideas sorted by votes (tabs: ยอดนิยม / ใหม่ / กำลังทำ / เสร็จแล้ว), vote button (one vote per account or per install id; supporters ×2), "เสนอไอเดีย" sheet (title ≤ 80, detail ≤ 1,000 chars, category: ออกกำลังกาย / อาหาร / อาหารเสริม / AI / อื่นๆ).
- Worker: `GET /api/ideas`, `POST /api/ideas` (rate-limited, 3 per day per owner, stored as `pending`), `POST /api/ideas/:id/vote` (idempotent toggle), admin `GET/PUT /api/admin/ideas` to approve/reject/merge and set status `planned` / `in_progress` / `done`. Only `approved+` ideas are public. Text is escaped everywhere.
- Migration `0006_round10.sql`: `ideas`, `idea_votes`, `donations`, `supporters` tables.

## 5. Per-tab accent themes + modern effects
- Accent per main tab, light and dark (WCAG AA for text on accent and accent text on background):
  - วันนี้ Today: dark `#C6F432` / light `#5B7F00`
  - ออกกำลัง Train: dark `#FF8A3D` / light `#C2410C`
  - อาหาร Food: dark `#34D399` / light `#047857`
  - อาหารเสริม Supps: dark `#B197FC` / light `#6D28D9`
  - ฉัน Me: dark `#4CC3FA` / light `#0369A1`
  - Sub-routes inherit their parent tab's accent (e.g. `#/player`, `#/library`, `#/training-settings` → Train; `#/recipes`, `#/food-log` → Food; `#/ai-*`, `#/support`, `#/ideas`, `#/tools`, `#/admin` → Me).
- Implement as CSS custom properties on `<html data-tab="…">` (`--accent`, `--accent-on`, `--accent-soft`, `--accent-glow`) used by the tab bar, primary buttons, rings, progress bars, chips `.on`, focus rings, links and section icons. Status colours (danger/warning) and muscle highlight colours do not change.
- Modern effects (all GPU-friendly, ≤ 200 ms, disabled under `prefers-reduced-motion`, no layout thrash):
  - Frosted-glass bottom tab bar (`backdrop-filter: blur`) with a sliding pill indicator that moves to the active tab and an accent glow under the active icon; icon bounce on tap.
  - Smooth accent cross-fade when switching tabs (use the View Transitions API when supported, else CSS transitions on the custom properties via `@property`).
  - Soft accent-tinted radial glow at the top of each page background (subtle, both themes).
  - Card entrance stagger (opacity + 8 px translate), button press scale 0.97, ripple on primary buttons, animated ring fill and number count-up on Today, skeleton shimmer while loading, `navigator.vibrate(10)` on key actions where supported.
  - Confetti burst on workout complete, PR and donation thank-you.
- Fix the IF card copy seen in the owner's screenshot: it shows "ช่วงกิน 08:00–18:00" then "ช่วงกิน · 14:10" and "ก่อนเริ่ม IF". Show one title ("ช่วงกิน 08:00–18:00"), one status line ("เหลือ 6:05 ชม. ก่อนปิดช่วงกิน" or "อีก 2:10 ชม. เริ่มกินได้"), and the ring.

## Done when
- Free mode on: no lock or Pro upsell anywhere; exports work without payment; turning it off restores locks (test).
- All four AI engines selectable; Gemini BYOK and copy/paste flows covered by tests; Nano hidden when unavailable; Claude engine still charges credits.
- Donation page works with PromptPay QR; slip endpoint tested (valid, replay, wrong receiver, amount); Wise/Stripe buttons appear only when configured.
- Ideas board: submit (pending), admin approve, vote toggle, supporter ×2, rate limit — worker tests.
- Screenshots of Today, Train, Food, Supps, Me in both themes (showing accents and the tab bar), plus `#/ai-settings`, `#/support`, `#/ideas` saved to `docs/round10-screens/`.
- No console errors; all existing tests pass; `cd worker && npx wrangler deploy --dry-run` bundles (or report the sandbox block). Leave changes uncommitted; do not push or deploy.
