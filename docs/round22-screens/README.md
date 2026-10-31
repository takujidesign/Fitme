# Round 22 screenshots

Run `node tests/round22-browser.mjs` from the repository root. It uses synthetic image data and mocked providers only. It captures 14 PNGs at 375 × 812: Gemini guide, BYOK/free/credits meal sheets, review, exhausted options and admin tiers, each in light/dark. It also tests the actual canvas JPEG encoder with EXIF input and logs input/output bytes in `image-check.json`.

This session cannot create real screenshots: Chrome launch is blocked by `spawn EPERM`. No HTML render or synthetic screenshot is presented as browser evidence. Capture and visual QA remain pending in an environment that permits Chrome subprocesses.
