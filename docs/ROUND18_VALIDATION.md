# Round 18 validation

Date: 2026-10-27. Branch: `codex/round18`. Changes are **uncommitted**.

All six implementation areas have code and automated coverage. **Browser screenshots and the Wrangler bundle remain blocked by this environment. Live iPhone delivery and real provider interoperability are not claimed.**

## Boundaries

- No commit, push, deployment, remote migration, real push delivery, paid AI request, provider model-list request, or other third-party application API call was made. Public protocol/API documentation was read for implementation references.
- Repo-root `*.jpg` files were not read, moved, or published. No RepDB data or images were added or committed.
- `const VERSION = 'fitme-v1'` and its deployment comment remain byte-for-byte unchanged. New modules are in the service-worker shell.
- Worker name, bindings, API base, release workflows and existing migrations are unchanged. This round needs no migration.
- Pre-existing edits were preserved in `docs/round12-results/performance.json`, `docs/round12-screens/dark-admin-2fa.html`, and `docs/round12-screens/light-admin-2fa.html`. Other old generated test fixtures were restored to their original contents.
- The attempted temporary browser profile is absent after cleanup.
- `.tmp/round18/` contains this run's test logs and runner files. Automatic command policy rejected deletion of that exact directory (`blocked by policy`), so those non-profile artifacts remain uncommitted. No alternate deletion method was used after rejection.

## 1. Web Push findings

`worker/round18.test.mjs` tests the **actual** `encryptPush` implementation using the public keys, private key, auth secret, salt and raw plaintext from [RFC 8291 Appendix A](https://www.rfc-editor.org/rfc/rfc8291.txt). Header and ciphertext both match exactly. The 86-byte header contains record size 4096 and the 65-byte uncompressed sender key. The final plaintext delimiter is `0x02`.

Independent Node `createECDH`, `hkdfSync`, and `createDecipheriv('aes-128-gcm')` decrypt both the fixed vector and a newly generated random payload. The existing encryption algorithm was correct; **no AES/HKDF mismatch was found**. The optional deterministic inputs/raw bytes are a test seam, not an HTTP API.

VAPID tests verify raw 64-byte `r || s` ES256 signatures with Node crypto, the Apple/Google/Mozilla origin audiences, one-hour expiry (below twelve hours), a valid fallback subject, and a 65-byte public key. Production headers now explicitly include `Urgency: normal`, TTL and `aes128gcm`; the public key is canonical unpadded base64url. No `Topic` header is sent. Missing/invalid subject falls back to `https://fixmee.app`, and malformed public-key length/prefix is rejected.

Scheduled failures retain status/reason, including a transport-failure category; re-registration preserves diagnostics. The reminders response exposes `lastError`, Settings displays it, and known Apple JWT/topic/expiry reasons have Thai/English explanations. Self-test success clears the previous error. Mocked rejection and recovery tests exercise the real scheduled/self-test paths and assert their headers and payloads.

**Production cause remains unproven:** the supplied observation of zero deliveries does not identify the returned Apple error, and live delivery was expressly excluded. The configured repository subject already was `https://fixmee.app`; the fallback change alone is not evidence that it fixes that production incident. After an independently authorized release, the owner should use the iPhone self-test and inspect `push-diagnostics` for accepted delivery/`lastError`.

## 2. Account data and the small-state investigation

There is **no 1.7 KB truncation** in `syncCopy`/`clean`. The original allowlist already included profile, logs (including nested meal logs), supplements, weights, measurements, custom foods, challenges, colours and several other categories. Client and server use the same wire-format module. Training and food preferences mostly live inside `profile` and were already included. Photos/image references and credentials are deliberately excluded.

Verified defects and fixes:

1. The allowlist omitted onboarding state, language/theme/exercise visual preference, voice/rest settings, notification preferences, meal overrides/prep, shopping checks, and generic settings. These now travel with account state, along with daily menus/templates. Device push identity and permission remain local. Food-log statistics count the actual nested entries.
2. Sign-in immediately called the normal timestamp merge. Newly completed onboarding could give default profile values a newer timestamp than the real server profile. First-login restoration now pulls before writing: never-onboarded devices, or onboarding under ten minutes old without logs, choose the server wholesale. Legacy server profiles without `onboarded` become usable after restore. This path performs no state PUT.
3. Normal sync awaited health refresh **before** uploading account state. A health endpoint failure aborted the whole backup. Health refresh is now independent; a regression test proves profile upload still succeeds with a mocked health 503.
4. Kept local data had no reliable owner boundary. The previous account ID now persists across logout. Switching accounts loads only the new account's state and clears old image data/push subscription, with an optional prior-account JSON export.

Both sides with real data show explicit server/device/merge choices; dismissing the chooser cancels sign-in rather than silently replacing data. Normal sync retains version-conflict handling and preserves edits made during requests. Different top-level keys survive, and newer timestamps win for the same key; logs/menu records also merge by record identity.

These defects explain missing settings, possible default overwrites, and stalled uploads. **They do not establish which event produced the specific production 1,702-byte row.** Neither that row nor its prior client/network history was read. Empty `health_daily` is separate from local workout/food logging and alone does not prove that those logs were dropped.

Account UI shows last success, UTF-8 payload size, per-category counts and Sync now. Full JSON backup includes referenced local body, meal and supplement photos as data URLs, displays a size warning, restores them into IndexedDB, and excludes account/entitlement/provider credentials. Cloud R2 photo backup was not added; this implements the explicitly permitted full-JSON alternative. Existing avatars use the existing social service rather than the local body-photo store.

## 3. Logout and account switch

Logout is visible in the Me header and Account screen. The dialog defaults to deleting local data and AI keys; the user can keep either. The real `/api/auth/logout` path is exercised against local SQLite and revokes the session. Local token, social/health state, push link/subscription and image URL cache are cleared as applicable. Offline logout still clears the local bearer, but cannot guarantee immediate server revocation while disconnected.

Tests cover keep-local logout, clearing all three provider keys, reinstall/clear-state restoration, and A → B with no A profile/chat/photos leaking into B.

## 4. Updates

Launch and visible-page wake call `registration.update()`. A newly waiting worker creates a toast; applying posts `SKIP_WAITING`, and `controllerchange` reloads once. An already waiting worker applies on the next cold start. A message channel obtains the running `VERSION`; a no-store `/sw.js` comparison requests the update path on mismatch. Me shows the reported version and a manual check button. Navigations have a three-second network timeout and offline cache fallback.

Tests execute the real page update functions and SW handlers for waiting/toast/message, cold start, version mismatch, single reload, version reporting and offline navigation. Physical iOS installation/update behaviour still needs browser/device validation.

## 5. BYOK

`byok` defaults on independently of beta's `ai` flag. Claude credits remain gated by `ai`. Settings stays reachable to switch away from a disabled Claude engine. Gemini uses the BYOK gate; OpenAI and Kie are integrated into the existing common AI output validation.

- OpenAI: direct Chat Completions request, image parts, strict JSON-schema output, live-on-user-action model list filtered to chat/vision model families, and a per-device model choice. Optional schema fields use nullable transport fields and are normalized back to the existing validator.
- Kie: documented OpenAI Responses protocol, default path `/openai/v1/responses`; admin-configurable Responses path and default model. A browser `TypeError` triggers the requested Worker fallback. The proxy fixes the origin to `https://api.kie.ai`, rejects arbitrary paths, disallows redirects, limits body size and requests (30/IP/hour), forwards only the supplied key in Authorization, and returns sanitized output/errors. Tests confirm keys do not enter database rows or errors.
- Keys remain separate localStorage entries, outside state sync/backups. Each provider has test/remove controls and setup guidance. Tests and model loading only call providers when the user explicitly uses those controls.
- Admin AI has HTTPS affiliate fields for all three providers. Guides use the configured link or official key page and disclose compensation when a referral link is present. CSP includes both new API origins.

References: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Kie protocol overview](https://docs.kie.ai/ai-agent/overview), [Kie getting started](https://docs.kie.ai/getting-started). Model availability, CORS and actual provider schema support remain unverified live; unsupported model/schema responses show an error rather than silently accepting malformed results.

## 6. Daily menu

Food → My menu snapshots the selected day's generated plan into an editable menu. It supports food/custom-food search, recipes, explicit Open Food Facts barcode lookup, gram/serving portions, manual dishes/macros, portion edits, removal, live totals/target colours, date-range copying, saved templates, and returning to the automatic plan.

The existing meal-slot builder supplies meal count and IF-compatible timing. Recipe selections expand into ingredient portions. `dayMeals` is the integration point, so timeline, shopping and reminders consume the same menu. Eaten meals write an immutable macro snapshot into the food log and are counted once; unchecking removes that entry. Menus/templates sync with account data; returning to automatic uses a null marker so an older remote menu is not resurrected.

Optional provider/menu screens load on demand to preserve the existing startup budget, rather than raising it. Latest static-graph check: **124 modules, 357,124 gzip bytes**, below **358,400 bytes (350 KiB)**. This is a static transfer-size check, not a browser CPU measurement. Thai/English UI and additional zh/ja/vi strings are included.

## Validation results

**43/43 requested test files passed**, with network disabled by `tests/support/no-network.mjs` unless an individual test supplies a mock. Results are recorded in [round18 test results](round18-screens/test-results.json). The final sync/chooser/menu refinements also passed `tests/round18.mjs` and `tests/round4.mjs` afterward.

| Scope | Result |
|---|---|
| All 26 top-level app `.mjs` test files excluding browser/Playwright/serve/extract-i18n | PASS |
| Worker `test.mjs`, all 15 `round*.test.mjs`, and `auth-errors.test.mjs` | PASS (17 files) |
| RFC vector + independent decrypt + VAPID verification | PASS |
| Actual SW handlers and page update lifecycle | PASS under VM/DOM mocks |
| Restore/reinstall/account isolation/backup photos | PASS under local state, IndexedDB and HTTP mocks |
| Kie proxy rate limit, redaction; server logout | PASS with local SQLite and mocked transport |
| `git diff --check` | PASS |
| Wrangler `deploy --dry-run` | BLOCKED: `spawn EPERM`; no bundle proof |
| Playwright 375px screenshots | BLOCKED: `spawn EPERM` |
| Native hidden Chrome launch fallback | Rejected by automatic command policy: `blocked by policy` |

Reproduction commands (PowerShell):

```powershell
Get-ChildItem tests -Filter *.mjs |
  Where-Object Name -NotMatch 'browser|playwright|serve|extract-i18n' |
  ForEach-Object { node --import ./tests/support/no-network.mjs $_.FullName }
Push-Location worker
node --import ../tests/support/no-network.mjs test.mjs
Get-ChildItem -Filter round*.test.mjs |
  ForEach-Object { node --import ../tests/support/no-network.mjs $_.FullName }
node --import ../tests/support/no-network.mjs auth-errors.test.mjs
Pop-Location
node tests/round18-browser.mjs
```

The browser script serves **only `app/`**, mocks external page requests, uses an isolated profile, and removes it in `finally`. It must run in an environment permitted to launch a browser. No production session is needed.

## Visual evidence still outstanding

`docs/round18-screens/` contains **14 labelled HTML DOM fixtures**, covering sync status, logout dialog, update toast/version, provider list/referrals, OpenAI setup, Kie setup, and daily menu in both themes. **They are not screenshots and do not prove actual 375px layout or overflow.** `browser-block.txt` preserves the launch failure. Real screenshots, physical iPhone delivery/update and live provider calls remain the outstanding validation boundaries.
