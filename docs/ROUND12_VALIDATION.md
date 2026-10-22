# Round 12 validation — 2026-10-22

Branch: `codex/round12`. Changes are **uncommitted**. No push, deployment, remote migration, paid AI call or real third-party API call was made. Repo-root JPG files were never opened, moved or published. The `const VERSION = 'fitme-v1'` line is unchanged. Existing Worker name/bindings/API URL and release workflows are unchanged.

## Result and limits

- **30/30 requested Node test files passed**: 18 app suites and 12 Worker suites. Per-suite exit codes: `round12-results/suites.json`; detailed output: adjacent text files. Experimental SQLite warnings were suppressed in the final sweep; earlier focused runs showed only the normal Node warning.
- **3,024 unique browser route/layout cases**: 63 route states × 4 widths (320, 375, 768, 1280) × TH/EN × light/dark × tab/single/random accents. No horizontal document overflow, and no app `error`/`unhandledrejection` events recorded. `round12-results/browser-matrix.json` contains the observed headings and individual cases; `browser-errors.json` is empty. Parameterized/restricted routes include their mocked empty/error/redirect states, not a complete successful workflow for each route.
- **14 JPEG screenshots** in `round12-screens/`: forgot/reset, verification banner, sessions, admin 2FA, setup and language toggles, in both themes at 375×812. These are actual app screenshots with local mock APIs. The adjacent HTML files are separate happy-dom-generated review fixtures, **not** screenshot evidence. TOTP keys in screenshots are disposable locally generated test keys and were never enrolled in a real account.
- First-load static JS graph: **331,640 gzip bytes**, 109 static modules, below both 350,000 bytes and 350 KiB. Before lazy translation loading: 443,106 bytes. Each resource is gzipped independently; dynamic imports and service-worker installation traffic are excluded. This is not a network trace or Lighthouse run. No 4× CPU-throttled long-task measurement was available.
- **Worker bundle verification BLOCKED**: `node node_modules/wrangler/bin/wrangler.js deploy --dry-run --outdir .round12-dry-run` with metrics disabled failed with `spawn EPERM`. No bundle-success claim and no deployment attempt without `--dry-run`.
- **The entire interactive checklist in C is not fully verified.** All requested automated suites and the route/layout matrix ran. Camera, voice, wake lock, complete player interaction sequences, real-browser offline service-worker lifecycle, every XSS field/IDOR resource pair, every destructive admin action and every onboarding step/validation boundary were not exhaustively driven in the browser. Those remain explicit follow-up checks in `TEST_PLAN.md`; this report does not label all of C PASS.

## A. Security implementation and regression evidence

| Finding | Implementation | Evidence |
| --- | --- | --- |
| Password reset | `POST /api/auth/forgot`, `#/forgot`, `#/reset/<token>`, reset API; 32 random bytes; SHA-256-only storage; 30-minute TTL; atomic mutation + token consumption; all user sessions revoked | New Worker suite covers identical known/unknown responses, digest storage, TTL, expiry, replay, password login and revoked sessions; new app suite renders/actions with mock API |
| Email verification | Registration sends single-use 24-hour link; generic duplicate registration response; login remains available; verify/resend routes and account banner; 3 resend attempts/hour/account | Worker tests cover registration enumeration, verification replay, TTL, resend limit, unverified publication/chat/avatar gates and private account access |
| Registration/login abuse + Turnstile | Atomic D1 caps: 5 registration attempts/IP/day, 20 login attempts/IP/15 min; forgot 10/IP/hour and 3/email/hour; Turnstile on register, forgot, ideas and reports; encrypted secret and public site key in Setup | Worker tests cover cap concurrency, cross-email IP cap, cross-IP email cap, missing/failed/successful mocked siteverify; challenge UI uses explicit rendering and timeout/cancel cleanup |
| Sessions and suspension | Current-password change revokes other sessions; logout-all; active sessions expose created/last-used/family/current, never bearer hashes; migration trigger revokes sessions on suspension; common user authentication rejects suspended users, including AI/credits; socket-ticket redemption checks suspension | Worker tests cover wrong/correct current password, preserving current session, revoking other/all sessions, suspension login/AI rejection, metadata privacy; existing social/AI suites pass |
| Admin 2FA | Browser-generated base32 secret, local QR/manual key, code-confirmed enrolment; AES-GCM CONFIG storage; env override; 8 hashed single-use recovery codes; current-code disable; admin sessions revoked after changes; generic secret-write API rejects TOTP modification | Worker tests cover invalid code, encryption, session revocation, recovery use/replay, disable, environment override and audit; DOM/browser screens cover setup and manual key |
| Headers/CSP | `app/_headers`; existing `web/deploy.mjs` recursive copy already includes it; explicit Turnstile origins; no inline scripts/event attributes found in authored app sources; API nosniff/HSTS/no-store; API allows captcha header | New app assertions and source scan; Worker header assertions. The configured map origin must replace `MAP_TILE_HOST.invalid` in both connect/img directives before map deployment |
| Account enumeration | Existing and new registrations return the same response when Resend is configured; existing owner receives a link; forgot delivery failures do not disclose existence | Exact JSON response equality tests |
| VAPID subject | Existing runtime admin-contact lookup retained; subscription/scheduled preflight now accepts configured contact email when fallback var is absent | Existing push suite plus regression of surrounding auth/config. No real push delivery tested |

Migration `0008_round12.sql` adds token, verification, session-activity, atomic-rate-limit and admin-recovery tables plus suspension revocation trigger. Local SQLite test databases apply migrations 0001–0008 with foreign keys enabled. No D1 binding was contacted. Legacy sessions without activity metadata display unknown timestamps/family until activity is available; they remain compatible.

Email verification is skipped only when Resend has no key; Setup warns. If a key is set, configure the verified sender in Growth before launch. Failed delivery remains generic to avoid enumeration. Turnstile skips when either key is absent and Setup warns. No key value or TOTP suffix is returned by public config. Expired auth tokens/rate buckets are pruned on security activity.

## B. Launch helpers

- Setup: Turnstile keys; verification/2FA warnings; contact email; existing PromptPay/receiver fields; 1-baht QR preview with input-driven refresh and self-test note; VAPID generation; explicit test push to this device; explicit Resend test to contact address; map URL; per-language toggles. Provider tests were mocked only.
- TH/EN always available; ZH/JA/VI default off, labelled Beta. Both onboarding and language sheet filter disabled choices. Saved disabled language falls back to English with a notice. Translation dictionaries now load on demand; the existing dictionary-completeness test explicitly awaits all three dictionaries, preserving its assertions. New account/security strings have ZH/JA/VI dictionaries.
- Public `GET /api/health`: independent read-only D1/KV/R2 probes with one-second timeouts. It bypasses the normal KV-backed domain bootstrap, so hung CONFIG cannot prevent the health timeout. Tests exercise successful, missing and hung bindings at helper and HTTP levels.
- Privacy/terms: chat/photo retention, check-in location, AI data routing, cross-border recipients, rights and retention table added; legal-draft banner retained. `PDPA_RECORD.md` records sensitive health data/explicit consent and clearly leaves owner/counsel decisions open. README documents health, launch configuration, migration, env override and CSP tile placeholder.

## C. Sweep status

See `TEST_PLAN.md` for the complete supplied scenarios. PASS below means the named automated coverage passed, not that every manual subcase in that section has been exercised.

| Area | Automated evidence executed | Remaining boundary |
| --- | --- | --- |
| Onboarding | Existing UI/settings/old-state suites; five-language DOM; enabled-language filtering; TH/EN browser routes | Every step, extreme values and back/forward sequence not exhaustively browser-driven |
| Today | Existing planning/readiness/fasting/logging/round10 tests; responsive route matrix | Complete date/time-dependent visual state sequence not exhaustively driven |
| Train | Pose suites; rounds 3/6/7/9; settings; all route states | Full player timing/voice/wake-lock/finish sequence needs interactive device checks |
| Food | Meal/allergy/exclusion/fasting, recipe/barcode/custom-food suites | Camera permission and complete shopping/share browser sequence remain |
| Supplements | Existing schedule/interaction/condition tests; mocked AI/schema suites | Every add/edit/delete and every engine's label workflow not exhaustively browser-driven |
| AI | Round 8/10 mocks: engines, structured replies, credits, FIXMEE and key exclusion; AI routes | Complete mid-chat switching/paste browser flow remains |
| Social | Worker rounds 11/realtime/12: membership, privacy, block/report, chat/expiry, check-in, new auth gates; app routes | Cross-device WebSocket/polling interaction not exercised against a real Worker |
| Me/settings | `tests/settings.mjs`; existing backup/sync/privacy tests; browser route | Native share/file-picker and full backup/restore UI remain |
| Donate/ideas | Existing mocked Thunder amount/receiver/duplicate, moderation/vote tests; PromptPay logic; new verification/Turnstile gates | No real payment or provider call; full UI donation sequence remains |
| Admin | Existing moderation/audit/broadcast tests; new 2FA/recovery/encrypted-config/email mocks; setup/System/member/safety/gym/dashboard routes | Every destructive action's dialog and audit pair not individually browser-driven |
| Cross-cutting | 3,024 route/layout cases; existing XSS/privacy/IDOR/legacy-state suites; new account escaping/session tests; no inline event attributes found | Not an exhaustive XSS/IDOR matrix across every field/resource; keyboard focus and real-browser offline lifecycle remain |
| Performance | Static JS gzip budget passes; existing lazy exercise/image/offline tests | No CPU-throttled Today trace or live Lighthouse |

## Bugs found and fixed during this round

1. New verification gating initially rejected anonymous idea submission even when Resend was absent. It now preserves the earlier skipped-verification mode; the unchanged Round 10 regression suite passes.
2. The initial static JS graph exceeded the budget (443,106 bytes). On-demand translation loading reduced it to 331,640 bytes; a measured graph regression test enforces the limit.
3. Health initially followed normal KV-backed domain configuration, which could hang before its probe timeout. Health now runs independently; an HTTP-level hung-KV regression passes.
4. Existing VAPID setup preflight still required the fallback var even with an admin contact address. It now respects the configured runtime contact address.

## Reproduction

```powershell
Get-ChildItem tests -Filter *.mjs |
  Where-Object Name -NotMatch 'browser|playwright|serve|extract-i18n' |
  ForEach-Object { node $_.FullName }
cd worker
node test.mjs
Get-ChildItem -Filter 'round*.test.mjs' | ForEach-Object { node $_.FullName }
```

`tests/round12.mjs` regenerates HTML review fixtures and the gzip result. `tests/serve-round12.mjs` serves only those allowlisted fixtures on loopback. `tests/serve-round12-app.mjs` serves the actual app on loopback with local API responses and restrictive CSP blocking external resources. The connected Chrome browser was used for screenshots and DOM geometry; no production tab was opened or modified. All service responses during tests were mocks. Browser extension logging included a connection diagnostic; app error-event logs are independently empty, so this is not a claim that all browser console messages were absent.

Headless Chrome did not produce a screenshot; the connected-browser fallback succeeded. Temporary headless profile `tests/.round12-chrome/` remains because automatic approval review rejected its deletion with `blocked by policy`. Do not include that crash/profile folder in a later commit. `docs/LAUNCH_CHECKLIST.md` appeared separately during this session and was left untouched.

No release readiness claim: review the open C scenarios, complete owner configuration/legal decisions, run an allowed Worker dry-run, and review the uncommitted changes before a separately authorized release.
