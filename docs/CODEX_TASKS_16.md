# Round 16 — iPhone fixes: profile photo upload and @handle

Same rules as earlier CODEX_TASKS files. Deploys happen via GitHub workflows — do not push or deploy.

## 1. Profile photo upload fails on iPhone (owner screenshot: "ทำรายการไม่สำเร็จ กรุณาลองใหม่" after "ใช้รูปนี้")
Cause (Claude): `actions['avatar-pick']` in `app/js/views/social.js` encodes with `canvas.toBlob(resolve,'image/webp',.8)`. Safari/iOS cannot encode WebP and silently returns a PNG blob; the worker (`POST /api/profile/avatar` in `worker/src/social.js`) requires `Content-Type: image/webp`, ≤ 150 KB and the `RIFF…WEBP` magic, so it returns 415/413 and the app shows a generic error. `actions['chat-photo']` (line ~72) has the same pattern — fix both.
- Client: shared helper `encodeImage(canvas, {maxBytes})` that tries WebP, checks `blob.type`, falls back to JPEG (quality stepping 0.85 → 0.6 until ≤ maxBytes), and finally reduces dimensions if still too big. Send the real `Content-Type`.
- Server: accept `image/webp` **and** `image/jpeg` for avatars and chat photos; verify magic bytes for the declared type (`RIFF….WEBP` or `FF D8 FF`); keep the size caps (avatar 150 KB, chat photo existing cap); store with the right extension/content type; serve with the stored content type and `nosniff`. Reject anything else with a specific code (`unsupported_image`, `image_too_large`).
- Also handle HEIC input: `createImageBitmap` can fail on some iOS versions for HEIC — fall back to loading via `<img>` + object URL before drawing to the canvas.
- Errors: show a specific Thai/English message for each code (wrong type, too large, not signed in, email not verified, beta disabled) instead of "ทำรายการไม่สำเร็จ".
- Tests (worker + app): WebP accepted, JPEG accepted, PNG rejected with `unsupported_image`, wrong magic for declared type rejected, oversize rejected; client helper falls back to JPEG when `toBlob` returns PNG (mock), and respects maxBytes.

## 2. @handle rejects "Arm" (owner screenshot: native tooltip "ตรงกับรูปแบบที่ขอ")
Cause: `<input name="handle" pattern="[a-z0-9_.]{3,20}">` is lowercase-only while iOS auto-capitalises the first letter; the browser's native validation blocks submit with a meaningless message. The server already lower-cases.
- Input: `autocapitalize="none" autocomplete="username" autocorrect="off" spellcheck="false" inputmode="text"`, convert to lowercase as the user types (keep caret position), strip spaces, and show a hint under the field: "a–z, 0–9, _ และ . ยาว 3–20 ตัว (ตัวพิมพ์เล็ก)".
- Replace native `pattern` validation with our own inline error text under the field (Thai/English), including reserved/taken handles from the server (`handle_taken`, `handle_reserved`, `handle_invalid` codes — add them to the worker if missing).
- Optional live availability check (debounced 400 ms) using an existing or new `GET /api/profile/handle?h=` endpoint, rate-limited.
- Tests: "Arm" becomes "arm" and saves; "ar" shows length error; reserved/taken show their messages; server returns the codes.

## 3. Generic error toasts
Search the app for places that show the generic "ทำรายการไม่สำเร็จ กรุณาลองใหม่" for 4xx responses and pass through the server's specific code/message (mapped to Thai/English) where one exists.

## Done when
- All tests above pass plus every existing test; no console errors. Leave changes uncommitted; do not push or deploy.
