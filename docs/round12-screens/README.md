# Round 12 screen evidence

The `.jpg` files are Chrome screenshots of the actual local app using mocked API responses, at 375×812, in both themes. No real keys were enrolled. QR/manual TOTP keys shown are disposable test data. The language-toggle shots show the lower Setup section; setup-languages shows its upper section.

The `.html` files are separately generated DOM review fixtures. They are not browser screenshots and contain no active scripts or external requests. Regenerate with `node tests/round12.mjs`.

Screens: forgot, reset, sessions, verify-banner, admin-2fa, setup-languages, language-toggles × dark/light. Full validation boundaries are in `../ROUND12_VALIDATION.md`.
