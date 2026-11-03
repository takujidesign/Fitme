# Round 23 review artifacts

The ten `*.fixture.html` files are **DOM fixtures, not screenshots**. Each declares a 375px viewport and includes a visible notice. They cover the routine example, conflict warning, pinned Today timeline, change-time dialog and dependent-supplement toast in light and dark.

The required PNG screenshots are still missing: Chromium launch returned `spawn EPERM`; browser-host access was unavailable and native Chrome access was not approved. See `../round23-results/browser.log` and `../ROUND23_VALIDATION.md`.

Generate DOM fixtures with `node tests/round23-dom.mjs`. Once browser execution is available, run `node tests/round23-browser.mjs` for actual screenshots and browser assertions. No pixel-layout or browser-success claim is made from these HTML files.
