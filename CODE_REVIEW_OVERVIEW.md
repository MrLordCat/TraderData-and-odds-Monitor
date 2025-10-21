# Code Review Overview

This document summarizes the project architecture, responsibilities of key files, and the shared conventions. It aims to speed up onboarding and reviews.

## 1) Core constants (`modules/utils/constants.js`)

Exported values commonly used across the app:

- `VIEW_GAP` (8): Horizontal gap between broker BrowserViews and layout cells.
- `SNAP_DISTANCE` (12): Drag/resize snap threshold used by broker/layout managers.
- `STALE_MS` (5 * 60 * 1000): Odds staleness timeout (stale monitor / auto-refresh).
- `HEALTH_CHECK_INTERVAL` (60 * 1000): Broker health polling interval.
- `STATS_PANEL_WIDTH` (360): Base width for the docked/embedded stats panel.
- `STATS_VIEW_GAP` (4): Inner gap between stats subviews.

Keep new "magic numbers" here when possible.

## 2) Main process (`main.js`)

Responsibilities:

- App bootstrap, single-instance, global safety handlers (`unhandledRejection`, `uncaughtException`).
- Broker list `BROKERS` (id + URL) and per-broker last URLs via `electron-store`.
- Windows/views management: main window, docked odds board (`boardManager`), embedded/window stats (`statsManager`).
- Broker BrowserViews registry and active ids (shared via `{ value: ... }` refs).
- Odds cache `latestOddsRef` for re-renders after reconnect/reattach.
- Freshness & auto-reload: `brokerHealth`, `STALE_MS`, `HEALTH_CHECK_INTERVAL`; `staleMonitor` auto-reloads stuck brokers.
- Map/team reapply after navigations: `scheduleMapReapply(view)` with multiple delays (400/1400/3000/5000ms) to survive SPA/transitions.
- DataServices URL prompt (`dsPromptView`) with global blur/unblur.
- Hotkeys: window-level `before-input-event` (Space toggles stats; F12/Ctrl+F12 DevTools; Alt+C disables auto). Global shortcuts: `Control+Alt+L` (stats log) and `Num5` (auto toggle) with in-window fallback.
- Auto press injection (`send-auto-press`) using PowerShell helper (`sendKeyInject.ps1`): schedules F22 confirm for F23/F24.
- Central de-dup for F21 (suspend) requests: main collapses near-simultaneous initial and retry F21s coming from multiple windows.
- Managers init order: `layoutManager`, `brokerManager`, `boardManager`, `statsManager`, `upscalerManager`, `excelWatcher`.
- Modular IPC: `early`, `brokers`, `layout`, `settings`, `map`, `board`, `teamNames`, `autoRefresh`, `stats`, `upscaler`.
- Stats embedded vs window tracked in `statsState.mode` = `hidden|embedded|window`; embedding no longer removes broker views (prevents listener leaks).

Shared refs passed as `{ value: ... }`:

- `stageBoundsRef`: stage geometry (used by layout/stats)
- `activeBrokerIdsRef`: active brokers list
- `latestOddsRef`: last odds cache
- `lolTeamNamesRef`: team names
- `autoRefreshEnabledRef`: auto-refresh flag
- `quittingRef`: set on `before-quit` to stop background processes safely

Persistence keys (via `electron-store`): `disabledBrokers`, `layout`, `layoutPreset`, `lastUrls`, `lastMap`, `lolTeamNames`, `autoRefreshEnabled`, `mainBounds`, `siteCredentials`, `lastDataservicesUrl`, etc.

## 3) Broker manager (`modules/brokerManager/`)

Provides `createAll`, `addBroker`, `closeBroker`. Sets UA (CDP `Emulation.setUserAgentOverride`), navigation handlers, auto credentials, context menus (Back/Forward/Reload/DevTools/Inspect), frame CSS, z-order with layout/zoom/stats, view-level hotkeys (F12/F5/Ctrl+R/Space with editable guard). Uses 3-step reload retries and an error page fallback.

## 4) Layout manager (`modules/layout/`)

Applies presets like `2x3` or `1x2x2`, creates `slot-*` placeholders for empty cells, manages dock offsets (board/stats) via `setDockOffsets`, and exposes helpers like `sanitizeInitialBounds` and `clampViewToStage`.

## 5) Board manager (`modules/board/`)

Aggregates odds, computes best/mid/arb (excluding `dataservices`), and renders the dockable board BrowserView. Broadcasts odds updates to consumers.

## 6) Stats manager (`modules/stats/`)

Controls embedded/window/hidden modes, supports slots A/B plus the panel, and keeps stats on top with staggered timeouts.

## 7) Upscaler / FrameGen (`modules/upscaler/`)

Present (not removed). Currently injects only into slot A, guarded by `maybeInject(view, 'A')`.

## 8) Excel Watcher (`modules/excelWatcher.js` + `Excel Extractor/`)

Python-based watcher reads `current_state.json` and feeds odds as a pseudo-broker `excel`. The app can start/stop the watcher via the "S" button; status is shown in both odds board and stats. Last batch is cached into `latestOddsRef`.

## 9) Stale monitor (`modules/staleMonitor/`)

Periodically checks `brokerHealth[id].lastChange` / `lastRefresh` and calls `reloadIgnoringCache()` if `now - lastChange > STALE_MS` (when auto-refresh is enabled). See images under `image/CODE_REVIEW_OVERVIEW/` for visuals.

## 10) Zoom manager (`modules/zoom/`)

Wraps `webContents.setZoomFactor` and per-broker user prefs; attached to each view by `brokerManager`.

## 11) Settings / Overlay (`modules/settingsOverlay/`)

Renders `renderer/settings.html` as a BrowserView overlay with UI blur (`ui-blur-on/off`). Controls theme/contrast, layout presets, enable/disable brokers, and live auto settings.

Recent: Auto settings use 0.1 precision (step) for tolerance/shock/burst. Safe defaults allow running auto when only tolerance is set.

## 12) IPC modules (`modules/ipc/`)

Channels include:

- `brokers` (add/close/refresh/list)
- `layout` (apply preset/update stage)
- `map` and `mapAutoRefresh` (LoL map selection/refresh)
- `teamNames` (persist/broadcast team names)
- `board` (dock interactions)
- `autoRefresh`
- `stats` and `statsDebug`
- `upscaler`
- `early` (early channels before full init)

## 13) Extractors (`brokers/extractors.js`)

- `getBrokerId(host)`: hostname -> broker id
- `collectOdds(host, desiredMap)`: selects extractor; returns `{ broker, odds:[o1,o2], frozen, ts, map }`
- `deepQuery(selector, root)`: shadow DOM query helper (used e.g. in Rivalry)

Guidelines: maximize resilience to DOM changes, use fallbacks, and return `['-','-']` on failure. `frozen` is derived from structural cues (pointer-events/opacity/classes/text). Strict map-market policy applied to several brokers (don’t swap to match-winner if a specific map market is absent).

## 14) Preloads

`preload.js`, `brokerPreload.js`, `slotPreload.js`, `addBrokerPreload.js`, `statsContentPreload.js` expose `window.desktopAPI` for safe IPC. `contextIsolation: true`.

Recent: added aliases for Excel Extractor status (`getExcelExtractorStatus`, `onExcelExtractorStatus`) to unify board/stats.

## 15) Renderer (`renderer/`)

- `index.*`: main window shell
- `board.*`: dockable odds board UI
- `stats_*`: stats panel scripts (activity, collapse, config, theme, map, embedded)
- `add_broker.*`: add-broker dialog (slot placeholder)
- `settings.*`: settings overlay
- `ds_url.*`: DataServices URL prompt
- Global styles: `common.css`, `main.css`, `toolbar.css`, etc.

Recent: odds board shows engine-effective tolerance (badge) and auto status; S-button starts/stops Python watcher and mirrors state from main.

## 16) Map & team names

Persist `lastMap`, `lolTeamNames`, and bet365-specific `isLast`. Rebroadcast after navigations with duplicated delays; send immediately on `dataservices` attach.

## 17) Safety & robustness

- Broad `try/catch` usage to avoid process crashes.
- Limited global shortcuts to reduce conflicts with other apps.
- `partition: 'persist:<brokerId>'` for per-broker sessions; `dataservices` handled as a special case.

## 18) Adding a new broker

1. List `{ id, url }` in `BROKERS` (`main.js`).
2. Implement `extract<Name>` in `brokers/extractors.js`; register `{ test, fn }` in `EXTRACTOR_TABLE`.
3. Extend `getBrokerId` if a new hostname mapping is needed.
4. Preserve fallback behavior and soft failures (`['-','-']`).

## 19) New panels / dock offsets

Use `layoutManager.setDockOffsets({ side:'right', width })` (as board/stats do) rather than hardcoding margins.

## 20) Key shared structures

- `views`: broker/slot BrowserView registry
- `BROKERS`: static broker definitions
- `latestOddsRef.value`: broker odds cache
- `brokerHealth`: last change/reload times
- `loadFailures`: page load retry counter
- `statsState`: current stats mode
- `stageBoundsRef.value`: stage size/position

## 21) Logs & diagnostics

- Auto presses: `auto_press_debug.json`, `auto_press_confirm_debug.json`, `auto_press_signal.json`
- Renderer -> main log forwarder: `renderer-log-forward`
- DevTools: F12 (active broker) or Ctrl+F12 (board webContents)

Recent shock diagnostics: detailed log includes prev/cur odds, per-side jumps, min-line jump, whether min-line switched, and threshold. F21 payload also carries `diffPct`.

## 22) Risks / watch-outs

- Listener leaks when removing/adding BrowserViews incorrectly — avoided by not removing brokers when embedding stats.
- Fragile selectors in extractors — maintain multi-layer fallbacks.
- Asynchronous CSS blur — clear on prompt close (await `__dsBlurKeyPromise`).
- Multiple timeouts for map/team replay — do not shorten without testing slow/SPAs.

## 23) Auto trading: hubs, guards, and de-dup

- OddsCore hub: aggregates broker odds and computes derived values (mid/arb).
- AutoCore engine: per-view auto with providers reading from shared state, no DOM parsing.
- AutoHub orchestrator: creates engines per view, applies guards, syncs ON/OFF and Auto-Resume across windows.
- Guards:
  - Excel suspend/resume: turns engines off/on; sends F21 (suspend) with one retry after 500ms if still trading.
  - Market guard: suspend on missing mid or `arbProfitPct >= 5%`; resume when market OK.
  - Shock guard: triggers only on the minimum odds line jump meeting threshold; logs details; sends F21.
- Main-level F21 de-dup: collapses near-simultaneous initial F21 and their retries coming from multiple windows (board + embedded stats).
- Settings: live updates via IPC; tolerance/shock/burst precision 0.1; safe defaults allow running with tolerance only.
- UI: engine-effective tolerance badges and auto status text on board and stats; explicit suspend reasons and retry labels in logs/UI.

Keep this file updated whenever core managers, IPC modules, or critical constants change.
