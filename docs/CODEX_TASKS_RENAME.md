# Rename the app to "Fixmee"

The app is currently called "Fix me" (earlier "FitMe"). Rename every user-visible name to **Fixmee** (one word, capital F). The domain will be `fixmee.app`.

Change:
- All UI strings in Thai/English and the zh/ja/vi dictionaries (`app/js/i18n/*`), onboarding hero, headers, install banner, share card, PDF header and footer, ICS calendar name/PRODID/UIDs, notifications (push, LINE, win-back text, email subjects), Stripe product names, legal pages (privacy/terms: the service name), admin page texts, AI system prompts that mention the app name, Capacitor `appName` (keep `appId` but change to `app.fixmee` only if nothing depends on it), README, docs that describe the product.
- `app/index.html` `<title>`, `apple-mobile-web-app-title`, `<noscript>`, `manifest.webmanifest` name/short_name/description, icon titles.
- Package names where safe (`worker/package.json` name `fixmee-api`, `mobile/package.json`, `tests/package.json`).

Do NOT change (to avoid breaking existing users and the live deployment):
- localStorage keys (`fitme:v1`, `fitme:config:*`, `fitme:install-dismissed`, etc.), IndexedDB name `fitme`, Cache Storage names (`fitme-assets-v1`, the `fitme-v1` VERSION line in `app/sw.js`), KV keys, D1 table names, HKDF salt/info strings (`fitme-secrets-v1`), token formats, test fixture data formats.
- `worker/wrangler.toml` `name = "fitme-api"` and its bindings/IDs (the live worker URL depends on it), `CONFIG.API_BASE` in `app/js/config.js`, the GitHub repo name/URL.

Then run every test (`node tests/*.mjs` except Playwright ones, `cd worker && node test.mjs`) and update tests that assert the old name. Leave changes uncommitted if you cannot commit. Do not push.
