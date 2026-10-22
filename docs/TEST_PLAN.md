# Round 12 test plan

All providers must be mocked. Never open repo-root JPG files. No remote migrations or deployment.

## Required scenarios

1. **Onboarding**: every step in 5 languages (only enabled ones visible), back/forward, validation of age/height/weight extremes, edit mode from Me, consent screens.
2. **Today**: day navigation, rings and counters, readiness check-in, "today not ok", sleep log, IF card states (before window, inside, after, no fasting), timeline check-offs, checklist card, weekly support card dismissal.
3. **Train**: week strip, calendar (month change, day override, vacation), session list, swap sheet, library search/filters (lazy JSON), Start–Finish/illustration/animation toggles for all 40, player (all steps, rest timer, pause/resume, skip, voice toggle, wake lock, finish screen, PR toast, confetti), free workout logging, programs, training settings (style/equipment/days/length/muscle focus/prefer/avoid) → plan regenerates.
4. **Food**: meal plan per diet/exclusions/allergies/fasting, swaps, recipes (scaling, add to plan, meal prep → shopping list), shopping list check-offs/share, barcode flow with mocked camera, manual food log, custom foods, water +250.
5. **Supplements**: add/edit/delete, label scan via each AI engine (mocked), schedule times, interactions warnings, pregnancy/breastfeeding notes.
6. **AI**: all four engines incl. switching mid-chat, key test/remove, schema mismatch errors, FIXMEE paste flow, credits (Claude) empty → sheet, `#/ai-summary`.
7. **Social**: register/verify/login/logout, profile/handle/avatar, privacy levels, friends request lifecycle, block/report, feed reactions/comments, chat (1:1, group invite, reactions, replies, photo expiry, delete for everyone, mute, unread badge, WebSocket and polling fallback), check-in (distance, accuracy, cooldown, visibility), gym submission, duels, buddy, recap share, train-together.
8. **Me/settings**: rerun `tests/settings.mjs`; backup → restore round-trip equality (except excluded keys); delete all data.
9. **Donate/ideas**: PromptPay QR amount encoding (EMVCo CRC), slip flow (mock Thunder: valid, duplicate, wrong receiver, wrong amount), Wise/Stripe buttons visibility, ideas submit → pending → admin approve → vote ×1/×2.
10. **Admin**: login/2FA/recovery code, every section loads, every destructive action confirms and writes audit log, broadcast rate limit, setup checklist tests (mocked).
11. **Cross-cutting**: no console errors on every route × enabled languages × both themes × accent modes at 320/375/768/1280 px; keyboard navigation and focus visible; offline mode (SW cache) for Today/Train/Food; old saved states from rounds 1–11 load without errors (fixtures); XSS payloads (`<img src=x onerror=alert(1)>`, `"><svg onload=…>`, `javascript:` links) in every user-generated field (name, handle, bio, chat, idea, report, gym name, custom food, recipe, note) render as text everywhere including admin pages; IDOR checks — user A cannot read/modify user B's profile (beyond privacy), chats, check-ins, credits, sessions, donations.
12. **Performance**: Lighthouse-style budget checks you can run locally (JS transferred for first load ≤ 350 KB gzip excluding lazy chunks; no long task > 200 ms on Today in a 4× CPU-throttled run if you can measure), images lazy, exercise DB lazy.


## Execution and evidence

Run every top-level `tests/*.mjs` except browser/Playwright/serve/extract-i18n scripts, then `worker/test.mjs` and every `worker/round*.test.mjs`. Round 12 tests add auth/session/2FA/provider mocks, language gating, screen DOM, escaping, security-header checks and the static first-load gzip budget.

Do not equate DOM rendering with a browser pass. Actual viewport/theme/accent layout, keyboard/focus, camera/voice/wake lock, offline browser lifecycle and 4x CPU timing require an available browser. Record PASS, FAIL or BLOCKED per validation row. New-screen HTML fixtures are review aids, not screenshots. See ROUND12_VALIDATION.md for results and limitations.
