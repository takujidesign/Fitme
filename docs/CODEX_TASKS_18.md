# Round 18 — iPhone push delivery, accounts that really keep data, logout/switch, app updates, own-key AI, daily menu editor

Same rules as earlier CODEX_TASKS files. Worker: keep name/bindings/API URL; migration `0011_round18.sql` only if needed. Mock every third-party service in tests. Deploys go through GitHub workflows — do not push or deploy.

## Facts Claude checked on production (2026-10-27)
- Push: **1 device registered** (`web.push.apple.com`, tz Asia/Bangkok, 122 reminders) but **0 deliveries ever**; the in-app "ส่งทดสอบถึงตัวเอง" shows only "Request failed". Push encryption/VAPID were only ever tested against mocks. Claude has just deployed logging of the push service's status/reason (`record.lastError`) and the self-test now returns it (`push_rejected`), but the root cause is not known yet.
- Accounts: 2 users, 2 `user_state` rows, version up to 44, but the **largest stored state is only 1,702 bytes** and `health_daily` is empty. The owner deleted and reinstalled the iPhone app and lost everything.

## 1. Make Web Push actually deliver (Apple, Google, Mozilla)
- Verify `encryptPush` against **RFC 8291 Appendix A** (exact test vector: given keys, salt and plaintext → exact ciphertext/body) and the RFC 8188 record layout (single record, `rs` 4096, padding delimiter 0x02). Fix any mismatch.
- Verify the VAPID JWT (RFC 8292): ES256 signature in raw r||s form verifies with the public key; `aud` = push service origin; `exp` ≤ 12 h ahead; `sub` = `mailto:<contact>` or `https://fixmee.app`; header `Authorization: vapid t=<jwt>, k=<65-byte uncompressed P-256 public key, base64url, no padding>`; `TTL`, `Urgency: normal`, `Content-Encoding: aes128gcm`. Add unit tests that decrypt our own payload with an independent implementation in the test (e.g. Node `crypto` ECDH + HKDF + AES-128-GCM) to prove interoperability.
- Apple specifics: `web.push.apple.com` returns 400/403 with a JSON `reason` (e.g. BadJwtToken, BadWebPushTopic, ExpiredProviderToken); map known reasons to Thai/English explanations in the app; never send a `Topic` header longer than 32 URL-safe chars.
- Self-test and scheduled sends must surface the stored `lastError` in Settings → การแจ้งเตือน ("บริการ Push ปฏิเสธ: <reason>").
- After the fix, the owner will press "ส่งทดสอบถึงตัวเอง" on the iPhone; the `push-diagnostics` workflow shows deliveries/lastError.

## 2. Accounts must really keep (and restore) data
- Find why `user_state` stays ~1.7 KB: check `syncCopy` / `clean` / server-side `syncCopy` and the merge rules — which keys are dropped, whether logs/foodLog/supplements/weights/measurements/customFoods/challenges/settings/notifications preferences/training settings/food prefs/colours/exercise style are included, and whether per-key `updatedAt` merging can let a fresh device overwrite the server.
- **Reinstall / new device flow**: the first onboarding screen offers "มีบัญชีอยู่แล้ว? เข้าสู่ระบบเพื่อกู้ข้อมูล". When a device with pristine local state (never onboarded, or onboarded < 10 min ago with no logs) signs in, the **server state wins completely** (no merge of fresh defaults over real data). Show a confirm when both sides have real data: keep server / keep this device / merge.
- Sync status visible in Me → บัญชี: last successful sync time, size, number of items per category, "ซิงก์ตอนนี้".
- Photos (body/meal/avatar) are stored locally in IndexedDB; say so clearly, and add optional encrypted cloud backup of body photos to R2 (user opt-in, per-photo, deletable) — or at minimum make the full JSON backup include them as data URLs with a size warning.
- Tests: fresh device login restores every key; two devices edit different keys → both kept; same key → newest wins; pristine device never overwrites server; restore after reinstall (clear storage → login → state equal to server).

## 3. Logout and switch account (owner: "หน้าโปรไฟล์ไม่มีปุ่ม logout")
- Me → profile header and Me → บัญชี: "ออกจากระบบ" with a choice: "ลบข้อมูลบนเครื่องนี้ด้วย" (default on for shared devices) or keep local copy. Logging out revokes the session server-side (`/api/auth/logout`) and clears the token, push device link, Gemini/OpenAI/Kie keys (optional prompt), and in-memory caches.
- Logging in to a **different** account never merges the previous account's local data into the new one: load the new account's server state (offer to keep the previous data as a local JSON backup file first).
- Tests: logout clears token and revokes session; login as B after A shows only B's data; keep-local option works.

## 4. App updates that actually apply (owner: "แอปอัปเดตไม่ได้")
- On every launch and on `visibilitychange` → `registration.update()`. When a new SW is waiting, show the update toast; tapping it posts `{type:'SKIP_WAITING'}`, the SW calls `skipWaiting()`, the page reloads once on `controllerchange` (guard against reload loops). If the user ignores it, apply automatically on the next cold start.
- iOS standalone: also check `/sw.js` version vs the running version (expose `VERSION` via a `GET` message) and force the update path if they differ; never serve stale `index.html` (network-first for navigations with a 3 s timeout, cache fallback offline).
- Show the app version (short SHA from the SW VERSION) and "ตรวจหาอัปเดต" button in Me → เกี่ยวกับ.
- Tests: waiting worker → toast → message → reload once; version mismatch triggers update; offline uses cache.

## 5. Own-key AI: Gemini, OpenAI, Kie (users pay their own provider)
- Own-key engines are free for us, so they must **not** be blocked by beta mode's `ai` flag: add a separate flag `byok` (default **on**). Claude credits stay behind `ai` (off in beta).
- Engines: existing **Gemini** BYOK; add **OpenAI** (direct browser `fetch` to `https://api.openai.com/v1/responses` or `/v1/chat/completions` with `Authorization: Bearer <user key>`, JSON-schema structured output, vision for photos; model picker filled from `GET /v1/models` filtered to chat/vision-capable models) and **Kie** (`https://api.kie.ai`, using its chat/LLM endpoint per its docs — make the endpoint path and model configurable in admin; if the browser call is blocked by CORS, fall back to a worker pass-through `POST /api/ai/byok/kie` that forwards the user's key in a header, **never stores or logs it**, strips it from errors, and is rate-limited).
- Keys stored only on the device (localStorage, excluded from sync/backup/telemetry), per-provider "ทดสอบคีย์" and "ลบคีย์". CSP `connect-src` adds `https://api.openai.com` and `https://api.kie.ai`.
- **Admin referral/affiliate links**: admin page → AI → per-provider "ลิงก์สมัคร (affiliate)" URL fields. The key setup guide shows "สมัคร/รับคีย์ที่นี่" using the admin link when set (else the official page), with the disclosure "ลิงก์แนะนำ — ผู้ดูแลอาจได้รับค่าตอบแทนเมื่อคุณสมัคร".
- Setup guides for each provider (like the Gemini guide: steps, pricing note, data-use note, troubleshooting by error code).
- Tests: byok allowed while `ai` is off; key never in sync/backup; OpenAI request shape (mocked) incl. image input and schema; Kie direct + proxy fallback (mocked), proxy does not log or persist the key; affiliate link + disclosure rendering.

## 6. Daily menu editor (owner: "อยากให้มีการป้อนเมนูอาหารแต่ละวันได้")
- Food → each day: "เมนูของฉัน" mode alongside the generated plan. Per meal (breakfast/lunch/dinner/snacks, respecting meals-per-day and IF window) the user can add items by search (FOODS DB + custom foods + recipes + Open Food Facts barcode) with portion in grams/servings, or a free-text dish with manual calories/macros.
- Live totals vs the day's targets (kcal, protein, carbs, fat) with colour cues; "คัดลอกไปวันอื่น" (one day or a date range), "บันทึกเป็นเทมเพลต" / apply template, "ใช้แผนอัตโนมัติแทน" to revert.
- The custom menu drives the timeline, shopping list and meal reminders for that day; marking a meal eaten logs it to the food log.
- Synced with the account (part of 2). Tests: add/edit/remove items, totals, copy to range, template apply, reminders/shopping list use the custom menu.

## Done when
- All sections implemented with the tests above; all existing tests pass; worker dry-run bundles (or report the sandbox block).
- `docs/ROUND18_VALIDATION.md` explains the sync size root cause and the push findings (RFC vectors pass/fail and what was fixed).
- Screenshots (375 px, both themes): logout dialog, sync status, update toast/version, AI provider list with affiliate links, OpenAI/Kie setup, daily menu editor → `docs/round18-screens/`.
- Leave changes uncommitted; do not push or deploy.
