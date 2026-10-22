# Round 11 validation

Branch: `codex/round11`. Changes are intentionally uncommitted. No push, deployment, remote migration, remote lifecycle update, payment, or live provider verification was performed. Repository-root JPG files were not opened, moved, processed or published. The service-worker VERSION line remains exactly as it was.

## Implementation

| Area | Changes |
| --- | --- |
| Exercise figures | Shortest-arc angle interpolation with `longArc`; mixed IK/angle endpoints resolve consistently. Corrected triceps, child pose, quad stretch, deadlift, side plank, crunch, jog/run, mountain climber and walking knee direction. Props render in the shared renderer; heart-rate connection is in a player-header sheet. |
| Illustrations | Six built-in image-generation calls produced start/finish pairs for goblet squat, bridge, triceps extension, dumbbell row, crunch and brisk walk. Twelve 768×768 WebP files are referenced by the manifest. Existing ignored artwork was preserved. |
| Profiles/friends | Age confirmation at registration and social profile setup; handle validation/uniqueness/reserved words; crop/resize/avatar replacement; privacy; profile links/QR; invitations, opt-in suggestions, request lifecycle, block/report/mute; gym and activity statistics/badges. |
| Chat | Authenticated friend/group conversations, text/replies/reactions/share kinds, bounded photo uploads and expiry, read preferences, mute, unread counts, typing, authenticated WebSocket tickets, hibernating Durable Object invalidation, five-second polling fallback, new-message push, 180-day retention and one-hour deletion window. Privacy text explicitly says encryption at rest, not end-to-end. |
| Gyms | Cached weekly Overpass directory refresh, approved-gym nearby list, optional Leaflet map, Google Maps links, user submission/moderation, distance/accuracy/cooldown gates, gym detail/visits/streak/friend presence, home gym. Check-ins persist the gym/time and optional workout date, not the submitted user coordinates. |
| Activities | Friends-only 7/30-day duels; both-party buddy consent/revocation and scheduled nudges; seven-day recap with image/chat sharing; shared workout lists, rest deadlines and participant results through authenticated conversation routes and Durable Object invalidation. |
| Guidance | Six-step accessible tour, checklist progress ring, first-use tips, page help entry points and 25 authored FAQs in Thai/English/Chinese/Japanese/Vietnamese. |
| Me/settings | Grouped rows, existing progress widgets preserved on a separate destination, free-mode payment visibility, conditional Claude usage row, central friendly API/network errors, backup/restore/reset effects. |
| Admin | Authenticated navigation, UTC today/7/30 metrics and small meter charts, setup, member management/export/deletion, report actions, avatar review, gym moderation/edit/merge, content drafts/approval, announcements, rate-limited broadcast, feature flags, audit/error/session views and optional TOTP. Existing finance, AI, video and shop controls are reused. |
| Colours | Per-tab/single/random OKLCH palettes, contrast adjustment, tab locks, five saved palettes, daily generation, account sync and three supporter gradient palettes. |

## Automated validation

The complete requested Node suite was run with a preloaded network guard. Individual tests replace fetch with mocks; loopback access is allowed for existing local HTTP fixtures. No real Overpass, Google/map-tile, Gemini, OpenAI, Anthropic, Thunder, Wise or Stripe requests were made.

Reproduction:

```powershell
npm ci --prefix tests
python tests/support/run-round11.py
node tests/support/render-poses.mjs
```

The runner executes every `tests/*.mjs` except scripts named for browser/serve/extract-i18n and files importing Playwright. It then executes `worker/test.mjs` and every `worker/round*.test.mjs`, with the Worker directory as their working directory. Full per-script output is in [test-results.json](round11-screens/test-results.json).

- Pose tests cover **40 exercises / 810 sampled poses**, each keyframe and eight intermediate samples per transition: finite geometry, segment lengths and connections, knee bend direction, elbow/knee flexion, hand/foot floor bounds, hip/shoulder projection bounds, grip alignment, and movement-specific invariants. These are 2-D rig regression checks, not clinical validation of human motion. Squat tracking uses a documented 20 px sagittal ankle-to-knee bound; it cannot assess frontal-plane valgus.
- Palette tests exercise **1,000 seeds in both themes**, requiring 4.5:1 text/accent and accent/background contrast, plus locked-tab and exact saved-palette restoration checks.
- Worker tests use in-memory SQLite and mock KV/R2/providers. They cover age/handles/privacy, friendships/blocking, chat membership/rate/deletion, report queue/audit, avatar type/size/replacement, expired-photo access and cleanup, retention, gym approval, check-in gates, duels, mutual buddy consent, shared session access/timer/results, admin search/credits/dashboard, recipe publication and RFC 6238/admin TOTP login.
- Registration fixtures in earlier Worker tests now explicitly confirm age 16+, reflecting the new registration contract. The existing BLE UI test opens the new header heart-rate sheet before checking its controls.

### Settings effect matrix

| Setting | Verified effect |
| --- | --- |
| Language | Visible Me strings and `<html lang>` change. |
| Theme/accent | Theme dataset and CSS accent variable change. |
| Plan duration | Generated plan range has 7/30/60/90 days. |
| Food exclusions | Excluded food category is absent from allowed meal ingredients. |
| Fasting | Day timeline contains the fasting event. |
| Supplements | Day schedule includes the supplement. |
| Training preferences | Avoided exercise is absent from the generated session. |
| Reminder time | Reminder plan uses the chosen workout time. |
| Offline assets | Mock video responses enter the cache; deletion empties it. Existing service-worker tests also verify shell/offline behavior and that API responses are never cached. |
| Medical/medications | Training restrictions, medical notes, medication timeline and interaction warnings change. |
| Consent withdrawal | Current health consent becomes false. |
| Backup/restore | Export excludes Gemini key; restored profile matches the backup. |
| Delete all | State/account/logs reset, local AI key removed, image-store clear invoked. |
| Profile targets | Weight changes recalculate energy targets. |
| Me rows | Actions resolve, duplicates absent, free-mode pay/win-back hidden, Claude-only row conditional. |

## Visual evidence

- [poses.png](round11-screens/poses.png): actual SVG renderer, start/mid/peak for all 40 exercises; rasterized with Resvg. Peak selection follows the renderer's movement-arrow peak.
- [mobile-review.png](round11-screens/mobile-review.png): contact sheet of the requested 18 screenshots; individual `*-light.png` and `*-dark.png` files are 375×812.
- Screenshots use **synthetic data on a loopback-only mock server**, with external connections prohibited by CSP. Motion is disabled in this review fixture so images capture settled layouts. Check-in captures the list/search entry state; no real geolocation, map provider, payment, service test or cloud account was exercised.
- Playwright could not launch Chrome (`spawn EPERM`). The connected Chrome browser was used for local visual inspection/capture instead. Full-window browser screenshots were cropped to the known 375 px iframe; no product image was involved in that crop.
- The mock server's `error`/`unhandledrejection` recorder observed no application exceptions during the inspected screens. The browser console retained three “Could not establish connection. Receiving end does not exist.” messages without an application stack; their source was not established. These are preserved in [browser-console.json](round11-screens/browser-console.json), so this is **not** a claim of an entirely clean browser console.

## Illustration provenance

Only the requested six missing exercises used built-in image generation. Each generation requested two clearly separated start/finish panels in the existing clean anatomical fitness-illustration style, consistent character/clothing, plain background and no captions. Exercise-specific instructions emphasized goblet grip and squat depth, a straight shoulder–hip–knee bridge, overhead triceps upper-arm stability, a neutral-back row, shoulder-blade-only crunch movement, and a natural short walking stride. Generated poses were visually inspected. WebP conversion/cropping produced the two panels per exercise without replacing pre-existing ignored files. Manifest entries identify the tool and creation date.

## Runtime and release boundaries

- Wrangler dry-run was attempted with telemetry disabled and failed in its launcher with **`spawn EPERM`**. Worker bundling is therefore **not verified** in this sandbox; Node syntax/module execution and mocked tests are separate evidence.
- Durable Object hibernation, real push delivery, R2 lifecycle execution, real uploads, location accuracy, configured map tiles and provider credentials require a separately authorized deployed environment. The JSON lifecycle proposal has not been applied.
- The shared-training screen shares the workout list/rest deadline and records each person's submitted result. It does not automatically advance or force the other participant's normal solo player.
- Active-user dashboard counts are based on recent account sync; they are not unique website visitors. Dashboard date windows are UTC. Buddy nudges depend on recently synced plans/logs and both-party consent.
- Existing finance/AI/content controls are reused inside the admin navigation; they are not replacements for live payment or provider verification.
- Local cached recipe overrides refresh when the recipe view is first loaded in a page session. Administrative content updates are not pushed into already-open exercise/recipe views.

## Final verification

- Requested suite: **28 scripts passed, 0 failed**, including the additional mocked Durable Object test. See the machine-readable results for exact script names and timings.
- `git diff --check`: passed (Git emitted line-ending conversion notices only).
- New/changed application and Worker modules: Node syntax checks passed; the Worker test suites import and execute the route graph against mocks.
- Service-worker shell includes the new application modules and vendored map assets; the unchanged VERSION line was checked against the branch diff.
- Six generated exercise pairs: **12 WebP files, 768×768 each, 184,744 bytes total**. [Illustration review sheet](round11-screens/illustrations-review.png).
- All changes remain on `codex/round11`, uncommitted. No push/deploy/remote migration or lifecycle change was made.
