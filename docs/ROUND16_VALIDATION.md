# Round 16 validation

Date: 2026-10-24. Branch: `codex/round16`. Changes are uncommitted.

## Implemented

- Shared `app/js/image-upload.js`: WebP attempt with actual Blob MIME checking, JPEG fallback at qualities 0.85/0.80/0.75/0.70/0.65/0.60, then repeated dimension reduction until within the caller's byte cap. Handles null/throwing encoders and does not resize the original preview canvas.
- Both avatar and chat photo actions use this helper and send binary bodies with the actual Content-Type. HEIC/image decoding first tries createImageBitmap, then an Image loaded from an object URL; URLs are revoked on success and failure. This fallback still depends on the browser supporting the input format.
- Worker validates the declared WebP/JPEG MIME and matching RIFF/WEBP or FF D8 FF signature. Reads are bounded even without Content-Length. Caps remain 150,000 bytes for avatars and 1,000,000 bytes for chat photos. Invalid formats/magic return 415 `unsupported_image`; excessive size returns 413 `image_too_large`.
- Stored object extension and HTTP metadata match the image type. Avatar, chat and admin avatar-review responses use stored metadata with nosniff; old objects without metadata fall back to their extension. Existing authentication, visibility, conversation membership and chat expiry checks remain in place.
- Legacy WebP-only base64 JSON chat uploads remain supported for previously cached app versions. New clients send binary JPEG/WebP. No schema migration is needed.
- Handle input disables mobile capitalization/correction, supplies username autocomplete and a format hint, normalizes lowercase and whitespace with selection preservation, and uses inline accessible errors instead of native pattern validation. Submit normalizes again, so `Arm` saves as `arm`. Avatar selection is explicitly a non-submit button.
- Worker emits `handle_invalid`, `handle_reserved`, and `handle_taken`; only the handle uniqueness constraint is translated to a taken-name error. Other database failures are not misreported as name collisions.
- Central friendlyError maps specific image, verification, beta, handle and existing account/credit codes. Unmapped 4xx messages are preserved rather than replaced with the generic toast. The avatar upload now reads the server error body. Thai/English messages and supplemental zh/ja/vi translations were added.
- New app modules are included in the service-worker shell. The existing `const VERSION = 'fitme-v1'` line is unchanged.
- The optional live handle availability request was not added; authoritative validation occurs on save.

## Automated validation

All 39 requested test entrypoints passed (24 app, 15 worker). Each file was invoked separately with Node; worker files ran with `worker/` as the current directory. The initial Node child-process runner was blocked by Windows EPERM; a PowerShell loop succeeded after using a file URL for the import preload. These were test-runner setup issues, not product test failures.

A temporary fetch guard rejected unmocked non-loopback requests; tests retained their existing provider mocks. Local loopback was permitted for the existing round9 test. Browser/Playwright/serve scripts and extract-i18n were excluded as requested.

New regression tests cover WebP acceptance; JPEG fallback when the encoder returns PNG or throws; null encoder rejection; quality and dimension reduction; maxBytes; HEIC bitmap failure falling back to Image; object URL cleanup; lowercase/space normalization and caret; Arm save; short, reserved and taken inline errors; exact Thai messages and supplemental translations; real binary upload MIME/body; worker routes using local SQLite and mocked object storage; stored extension/MIME and nosniff reads; PNG and mismatched signatures; both size caps; legacy chat uploads; unauthenticated upload; email verification and beta error codes.

After the full sweep, the final encoder exception handling and additional assertions were verified again with `node tests/round16.mjs` and `node worker/round16.test.mjs` (both passed). `git diff --check` passed. Node printed its existing experimental SQLite warning.

| Test entrypoint | Result |
| --- | --- |
| `tests/poses.mjs` | PASS |
| `tests/round10.mjs` | PASS |
| `tests/round11.mjs` | PASS |
| `tests/round12.mjs` | PASS |
| `tests/round13.mjs` | PASS |
| `tests/round14.mjs` | PASS |
| `tests/round15.mjs` | PASS |
| `tests/round15b-geometry.mjs` | PASS |
| `tests/round15-poses.mjs` | PASS |
| `tests/round16.mjs` | PASS |
| `tests/round3.mjs` | PASS |
| `tests/round4.mjs` | PASS |
| `tests/round4-ui.mjs` | PASS |
| `tests/round5.mjs` | PASS |
| `tests/round5b.mjs` | PASS |
| `tests/round5c.mjs` | PASS |
| `tests/round6.test.mjs` | PASS |
| `tests/round6-offline.test.mjs` | PASS |
| `tests/round7.mjs` | PASS |
| `tests/round8.mjs` | PASS |
| `tests/round9.mjs` | PASS |
| `tests/settings.mjs` | PASS |
| `tests/test.mjs` | PASS |
| `tests/ui-test.mjs` | PASS |
| `worker/auth-errors.test.mjs` | PASS |
| `worker/round10.test.mjs` | PASS |
| `worker/round11.test.mjs` | PASS |
| `worker/round11-realtime.test.mjs` | PASS |
| `worker/round12.test.mjs` | PASS |
| `worker/round13.test.mjs` | PASS |
| `worker/round16.test.mjs` | PASS |
| `worker/round4.test.mjs` | PASS |
| `worker/round5.test.mjs` | PASS |
| `worker/round5b.test.mjs` | PASS |
| `worker/round5c.test.mjs` | PASS |
| `worker/round6.test.mjs` | PASS |
| `worker/round8.test.mjs` | PASS |
| `worker/round8-payments.test.mjs` | PASS |
| `worker/test.mjs` | PASS |

## Validation boundaries and workspace preservation

- No real iPhone/Safari, visual 375 px layout, or browser-console run was performed. DOM/unit tests do not establish those device-level results. HEIC fallback was tested with mocks, not a real HEIC photo.
- No real third-party services, deployment, push, commit, or remote migration was performed. No browser profile was created.
- Root-level JPG files were not read, moved or published. No RepDB data or images were added to the change.
- Pre-existing edits in `docs/round12-results/performance.json`, `docs/round12-screens/dark-admin-2fa.html`, and `docs/round12-screens/light-admin-2fa.html` were preserved. Existing documentation artifacts regenerated by tests were restored byte-for-byte to their pre-test state.
- Temporary runner, guard and log files were removed after recording these results.
