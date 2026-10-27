# Round 19 visual validation

Chromium launch was blocked by `spawn EPERM`. No PNG screenshot is claimed.

The ten `*.fixture.html` files contain synthetic admin data at a 375 px container width in both themes. They are DOM artifacts, not proof of browser layout or screenshots.

Run `node tests/round19-browser.mjs` on a browser-capable machine after building SEO. It saves the requested eighteen PNGs here and two synthetic app gallery captures under `app/seo/screens/`. Rebuild SEO afterward to include the gallery. The runner uses mocked external services and an isolated browser context.
