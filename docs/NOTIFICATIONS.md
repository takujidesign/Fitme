# Fixmee notifications: operation and phone checks

## What this audit established

The task reports that production PUSH KV contained zero devices on 2026-10-25. Production was not queried in this round. Code inspection found that `syncPush()` returned when no browser subscription existed, and did not compare its application-server key with the current VAPID key. Enabling reminders before the server was configured could therefore leave the device without a working registration indefinitely. A successful local permission grant alone was not evidence of server registration.

## End-to-end path

1. On startup, return to the foreground, and reconnecting online, enabled reminders with notification permission already granted fetch `/api/push/key`. This does not prompt for permission automatically.
2. `ensureSubscription()` creates a missing subscription and replaces one with an expired subscription or a different VAPID application-server key. The Enable button requests permission explicitly.
3. The app builds seven days of date-specific reminders from the same daily plan used by the timeline. Wake, water, meals, training-day workouts, supplement dose groups, sleep wind-down and bedtime have category controls. Existing medication, fasting and membership reminders remain supported. Quiet hours can cross midnight. Rest/override days do not send workout reminders; meal and supplement times respect the computed fasting window.
4. Changes to profile times, plan blocks, meal seed, supplements, foods, fasting, overrides, exercise swaps, readiness logs, language and preferences debounce a new registration by one second. Opening the app refreshes the eight-day KV lifetime even when the plan is unchanged.
5. `POST /api/push/subscribe` stores the endpoint, timezone, exact reminder array, registration timestamp, expiry and sent keys. Signed-in subscriptions retain account ownership. The random device ID is a device capability and must not be published. Server reminder reads require both the ID in the query and the matching `X-Push-Device` header; the response contains no endpoint or encryption keys.
6. The five-minute cron looks backward across its five-minute local-time window, including midnight and DST changes. Sent keys are retained to prevent duplicate delivery, including the repeated hour when DST ends. Category reminders use stable keys across schedule re-registration. A failed delivery is queued for the next tick, with a maximum one-hour retry horizon; 404/410 removes the device and account linkage. Success means acceptance by the push service, not proof that a phone displayed the notification. KV is eventually consistent; overlapping cron executions do not provide a transactional exactly-once guarantee.
7. If no refresh has occurred for six days, one reminder asks the user to reopen the app. This reminder is independent of the expired seven-day schedule. Records expire on day eight. Opening the app resets this refresh reminder.
8. The service worker displays title/body/icon/badge and a category tag. Clicking focuses and navigates an existing app window, or opens a new one. Routes are allowlisted, including `#/today`, `#/food`, `#/supps` and `#/player/YYYY-MM-DD`; an untrusted route falls back to Today.

Settings → Notifications distinguishes unsupported browsers, iPhone home-screen installation, denied permission, absent server configuration and inactive subscriptions. Active status checks server registration, displays its timestamp and reads back the exact stored reminder list. “Send test to myself” uses the existing test endpoint and reports push-service acceptance rather than asserting on-device delivery. Server or network failures are visible in the settings sheet.

## Android Chrome checklist

- Use HTTPS and Chrome with OS notifications enabled for Chrome/Fixmee.
- Open Fixmee, configure wake/meals/workout/supplements/sleep, and enable notifications from Settings.
- Grant browser permission. Confirm **Active**, a recent **Device registered at** timestamp, and the **Scheduled notifications** list with dates, times and routes.
- Send a test to yourself, put the app in the background, and verify the phone actually displays it. Tap it and check the route.
- Set the next category reminder several minutes ahead, outside quiet hours. Check delivery through the next five-minute cron tick and confirm no duplicate on the following tick.
- Repeat with meal times inside the IF window, each supplement dose time, and a training day. Change today to rest and confirm the stored workout reminder disappears.
- Change profile/fasting/supplement settings and wait at least one second. Close and reopen settings to read the updated server list.
- Remove the browser subscription, reopen the app with permission still granted, and confirm registration recovers. A VAPID rotation requires a newly registered subscription.

## iPhone home-screen checklist (iOS 16.4+)

- Open Fixmee in Safari, use Share → Add to Home Screen, and launch the installed app from its icon.
- Enable notifications by tapping the in-app button and grant the permission prompt. An ordinary Safari tab is not the installed push surface.
- Check OS Settings → Notifications and Focus modes. Confirm the app shows a registered device and the seven-day reminder list.
- Run the same self-test, category timing, quiet-hours, rest-day, settings-change and click-routing checks as Android.
- Open the installed app at least weekly. Verify the day-six refresh reminder on a test device that has not reopened the app, then reopen it to renew the device record.

## Owner diagnostics

Use Settings → Notifications → Scheduled notifications as the device-level check. The owner can separately run the existing `push-diagnostics` GitHub Actions workflow to inspect server readiness/device counts. Do not publish device IDs, push endpoints, tokens or secrets in screenshots or workflow output. A device count greater than zero plus a successful test request is still not a substitute for observing the notification on a real phone.

No workflow, production push, real provider, deployment or remote migration was invoked for this round. Phone checks remain manual.
