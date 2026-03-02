# MyTarkov Session Handoff (2026-02-26)

## Update (2026-03-02)
- Android fallback strategy was changed by product decision:
  - No longer relies on background Turnstile token flow for player search/binding.
  - Android player search is now **AccountID-only**.
  - Android binding adds a visible Tarkov.dev players WebView flow:
    - User searches/clicks into player profile page.
    - App detects AccountID from URL and prompts confirm-bind.
- iOS behavior preserved:
  - Keeps existing player-name search flow (with Turnstile logic).
  - Also supports AccountID direct lookup in search.

## User Focus This Round
- Stabilize Android Turnstile token capture.
- Keep zero-interaction flow (no user operation, no visible token page).
- Prefer "token usable then do not refresh" behavior.

## What Was Updated
- Platform split implementation:
  - `app/(tabs)/search/index.tsx`
    - Android: player search accepts numeric AccountID only.
    - iOS: player search supports name and AccountID.
    - Turnstile modal is disabled on Android for search.
  - `components/AccountBindingPanel.tsx`
    - Android: adds `WebView` modal to `https://tarkov.dev/players?gameMode=regular`.
    - Detects AccountID from player profile URL and shows confirm-bind alert.
    - Android manual input path changed to numeric AccountID flow.
    - Turnstile modal usage disabled on Android binding.
  - `components/PlayerSearchTokenBootstrap.tsx`
    - Runs on iOS only; Android returns `null` (stops background token retries/log spam).

- Android default token engine switched back to WebView for stability:
  - `constants/turnstile.ts` -> `ANDROID_TURNSTILE_ENGINE = 'webview'`
  - Gecko path is still preserved and can be re-enabled by config.

- Token bootstrap strategy changed to "missing token only":
  - `components/PlayerSearchTokenBootstrap.tsx`
  - No periodic forced refresh when token exists.
  - Added exponential retry backoff when token capture fails and token is missing.
  - Resume/background checks now only trigger refresh if token is absent.

- Warmup logic now validates using existing token (instead of no-token call):
  - `services/tarkovApi.ts` (`warmupPlayerSearch`)
  - If warmup gets `401`, stale token is cleared automatically.
  - Missing token warmup is skipped cleanly.

- WebView token script tuned closer to tarkov.dev behavior:
  - `components/TurnstileTokenWebViewModal.tsx`
  - Removed aggressive execute/reset forcing.
  - Widget options now prefer `appearance: interaction-only` + auto retry/refresh.
  - Silent mode now uses off-screen full-size WebView (not full-screen translucent overlay), reducing visible遮挡 and tiny-render issues.
  - Engine plan simplified to off-screen retries with shorter per-engine timeout.

- Gecko branch remains isolated and was also adjusted:
  - `components/TurnstileTokenGeckoModal.tsx`
    - Reduced Gecko attempt timeout for faster fallback.
  - `android/app/src/main/java/app/rork/a7h6fk58er3zhn93sir4sv/turnstile/GeckoTurnstileTokenModule.kt`
    - GeckoView changed from 2x2 to off-screen near-full-size viewport.
    - Manual widget render changed to `interaction-only`, removed forced execute loop.

## Validation Status (Latest)
- `bunx tsc --noEmit`: **pass**
- `android :app:assembleDebug`: **pass**
- `adb install -r app-debug.apk` + launch: **pass**

## Rollback Path
- Toggle Android engine quickly in `constants/turnstile.ts`:
  - `'webview'` (current default)
  - `'gecko'` (kept for experimentation)
- Gecko native code remains isolated under:
  - `android/app/src/main/java/app/rork/a7h6fk58er3zhn93sir4sv/turnstile/`

## Reminder
- Keep Russian (`ru`) as first-class localization support in future edits.
- Do **not** use `Get-Content` for repo browsing in this environment (it can freeze editor); use `rg`, `cmd /c type`, or small node readers instead.
