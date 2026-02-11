# Changelog

All notable changes to this project will be documented in this file.

## [0.4.3] - 2026-02-11

### ✨ New Features

- **CS2 Pistol Round stats** — new `1st Pistol` / `2nd Pistol` rows in Game Stats table; parsed from Grid logs (`"TeamName won Round 1/13"`) as binary metrics (✓/✗) (`pistolRound1`, `pistolRound13`)
- **Game-aware metrics filtering** — CS2 stats table now shows only relevant metrics (`killCount`, `pistolRound1`, `pistolRound13`); LoL/Dota2 show all metrics
- **Changelog tab in Settings** — fetches CHANGELOG.md from GitHub with markdown rendering
- **Patch update system** — updater detects re-uploaded release assets (same version, new asset ID) and shows "Patch available"; new `patch-release.yml` GitHub Actions workflow for manual patch deployment

### 🐛 Bug Fixes

- **Game start sound wrong number** — fixed off-by-one: Game 3 announced as "Game 2 Started", Game 2 as "Game 1"; root cause was `stats_sounds.js` counter desyncing during backlog replay; now passes explicit `gameNum` through the entire chain (inject-stats → preload → IPC → stats_sounds)
- **Animation suppression during Grid data load** — fixed animations still playing during initial log loading; empty snapshots no longer consume `_animSuppressFirstData` flag; added 12-second initial load phase with rolling +3s suppression extension
- **Grid light theme video player** — excluded video player from CSS filter inversion, added JS fullscreen detection for proper filter handling
- **Sound system: gameStart bypasses burst detection** — game start sounds now reliably fire even during event bursts; CS2 plays only gameStart sounds (per-game filtering)
- **Game 1 sound trigger** — triggers on "Series started" log event instead of ban phase detection
- **Cell animation glow** — subtler glow effect + fix for suppression bug (lastGameRendered not reset, +2s not chaining)
- **Thunderpick Game/Round tabs** — support Game/Round tab names alongside Map
- **Version comparison** — stable 0.4.1 now correctly detected as newer than dev 0.4.0

### 🎨 UI Improvements

- **M3 button/badge unification** — equalized heights, light badge contrast, table buttons pill shape
- **Odds Board controls** — unified to match Game Stats M3 btn-sm (pill, tokens, no border)
- **Game badge** — matches btn-sm M3 sizing (tokens, pill shape, no border)
- **Grid light theme** — multiple iterations (v3–v7): softer text, better card separation, brighter gold bars, vivid chart canvas

### 🔧 Improvements

- **Updater** — reduced API cache TTL from 5min to 30s for faster manual re-checks
- **Patch detection** — `installedAssetId` seeded on first launch; compared with remote asset ID on check

### 📚 Documentation

- **Grid log extraction pipeline** — new `docs/GRID_LOG_EXTRACTION.md`: full documentation of WebSocket interception, data parsing, stats aggregation, sound notification system
- **copilot-instructions.md** — updated: lolstats inject tree, GAME_METRICS, CS2 Pistol Rounds, Template Presets, Sound System, patch detection, `installedAssetId`
- **AUTO_MODE.md** — removed 516 lines of obsolete content; replaced with current DS Auto Mode docs

### 🧹 Cleanup

- **Dead code removal** — removed pending game start sound logic, simplified sound playback
- **Debug cleanup** — removed dead dbgLayout/dbgSide refs, fixed single-window layout bug, deleted temp CSS

## [0.4.1] - 2026-02-10

### ✨ New Features

- **Splash screen redesign** — canvas particle system (28 floating blue/purple dots drifting upward), glow + shimmer sweep on progress bar, logo float animation, fade transition on status text
- **Template presets (All / Mini)** — template dropdown in Game Stats controls row; Mini hides firstKill, firstTower, firstBaron, firstInhibitor, race5–20, towerCount, dragonOrders
- **Always-active smart reselect** — map reselect always active; switches to 3-second fast mode when odds are missing (`ca1a703`)
- **Backup suspend/resume retry signal** — configurable retry delay (100–700ms, default 800ms) for more reliable auto-press delivery (`a72d4fa`)
- **Auto debug logs in Board panel** — real-time auto-mode debug log viewer in board panel; old scattered debug logs removed (`166e0a5`)

### 🐛 Bug Fixes

- **Pari.ru Bo1 (isLast) support** — match-level odds extraction when map=1 and isLast=true (`c08822c`)
- **Template persistence** — selected template (All/Mini) now saved in electron-store and restored on restart
- **Auto logs moved to dev console** — throttled download progress logging + retry logic fix (`6852aee`)
- **Suspend retry delay limits** — changed from default range to 700–1500ms (`eea1029`)

### 🎨 UI Improvements

- **LoL table cleanup** — removed netWorth, Atakhan, and Winner rows; winner coloring moved to team name headers via game data (`e344dc7`)
- **Game Stats button unification** — Manual mode changed from checkbox to toggle button; new compact row layout with Swap (⇄ icon), Manual, +Game, Template dropdown; removed lolStatus text element (`67d417b`, `c39e36c`)
- **Stats panel widened** — default width 360 → 385 px (+7%) with auto-migration for stored value (`9e8cf4a`)
- **Animation suppression on Grid load** — 5-second suppression on page load/refresh + 2-second extension from first data arrival; covers both heat bar bumps and cell pop animations (`d20b93f`)

### 🧹 Cleanup

- **Console.log cleanup** — removed all debug console.log/debug from stats panel sources (`a356cc0`)

## [0.4.0] - 2026-02-09

### 🐛 Bug Fixes

- **BetBoom: match-level odds leak after reload** — removed fallback to "Исход матча" when a specific map is requested; now returns `emptyResult()` instead of leaking match-level odds into the board
- **BetBoom: active tab verification** — extractor checks that the correct map tab is actually selected (`aria-checked`, `data-state`, CSS class) before extracting; returns empty if tab not yet switched
- **BetBoom: 3s reload grace period** — broker preload suppresses odds for 3 seconds after page reload/SPA navigation (`RELOAD_GRACE_MS`), giving time for `triggerMapChange` to switch to the correct tab
- **Map select labels** — shortened "Set N" → "N" in stats panel map selector for cleaner UI

### 📚 Documentation

- **copilot-instructions.md** — comprehensive update:
  - Added missing files to directory tree: `credentials.js`, `statsContent.js`, `extensionBridge/`, `dev/`, `entries/` (4 files), `error.html`, `module_detach.html`, `slot.html`, `broker-refresh.js`
  - Removed non-existent entries: `settings/index.js`, `ipc/statsDebug.js`
  - Added missing IPC modules: `board.js`, `brokerRefresh.js`, `early.js`, `extensionBridge.js`, `moduleDetach.js`
  - Added BetBoom reload protection section (tab verification, grace period, no match-level fallback)
  - Fixed rebroadcast timings: 400/1400ms → 400/1200ms
  - Added `brokerRefreshSettings`, `mapAutoRefreshEnabled` to persistence keys
  - Updated pitfalls: `emptyResult()` format, BetBoom-specific warnings
- **brokers/README.md** — replaced outdated reference to deleted `extractors.js` with modular `extractors/` architecture
- **docs/AUTO_MODE.md** — fixed architecture section: "single ~1200-line file" → 6 ES modules with file listing and line counts

### 🧹 Codebase Cleanup

- **Dead code removal**: Removed `api_helpers.js`, `board.css`, `extractors.js` wrapper, dead exports from `odds_board_shared.js`, dead IPC channels/handlers, stale comments and `if(false)` blocks (-563 lines)
- **Backward-compat shims removed**: `statsPanelToggle`, `statsPanelSetHidden` preload APIs; `setPanelHidden`/`togglePanelHidden`/`getPanelHidden` from stats manager; dead `stats-panel-set-hidden`/`stats-panel-toggle` IPC channels
- **Duplicates eliminated**: Triple `require('electron')` → single; duplicate `auto-mode-changed` IPC handlers merged; double `lolManualMode` change listener unified (was a bug — logic ran twice)
- **Auto-press IPC extracted**: `src/main/modules/ipc/autoPress.js` — virtual key injection logic moved out of `main.js` (main.js: 979 → 846 lines)
- **Auto Mode split into 6 ES modules**: `loader.js` (1401 lines) → `constants.js`, `odds-store.js`, `guard-system.js`, `align-engine.js`, `auto-coordinator.js`, `loader.js` (max 609 lines)
- **AutoCore removed**: Unused compatibility shim (only referenced in docs)

### 🔧 Improvements

- **Python executable auto-detection**: `resolvePythonExe()` tries `python` first, falls back to `py` (Windows Launcher), caches result

## [0.3.0] - 2026-02-05

### ✨ New Features

- **Global Light/Dark Theme Toggle**
  - New theme toggle button in Stats Panel topbar (sun ☀️ / moon 🌙 icons)
  - Smooth theme transition animation (375ms)
  - Persisted in electron-store (`appTheme` key)
  - Synchronized across all windows/views via IPC broadcast
  - Full light theme support: all UI elements adapt to selected theme
  - Light theme elevations (softer shadows for light backgrounds)

- **Sound Notifications for LoL Match Events**
  - Audio alerts for: Game Start, First Blood, First Tower, First Baron, First Inhib, Quadra Kill, Penta Kill
  - Game start detection via ban phase (Grid sends start notification late)
  - **Freshness detection**: Only real-time events trigger sounds, not historical backlog
  - Settings UI: Enable/disable sounds, volume slider (0-100%)

- **Splash Screen with Smart Loading**
  - Progress bar shows loading status during startup
  - Task-based system: window creation, settings warmup, stats panel, animations
  - Eliminates "cold start" lag by pre-warming UI components
  - 8-second safety timeout ensures app always starts

### 🔧 Improvements

- **Heat Bar Ease-Out Decay**: Bar fades slower as it approaches zero
  - Quadratic curve: at full level 100% speed, at 50% → 36% speed, near zero → 15% speed
  - Makes small activity bumps significantly more visible and easier to track

- **Heat Bar Slider UI**: Replaced number inputs with intuitive sliders
  - Fade time: 1-10 seconds slider with real-time preview
  - Bump amount: 10-50% slider
  - Auto-migration: old values converted automatically

- **Sound Burst Detection**: Improved backlog detection for sound notifications
  - Detects rapid event bursts (5+ events in 500ms) as backlog loading
  - Deferred gameStart sound (400ms) cancelled if burst follows
  - Auto-disables sounds during burst, re-enables after 2 seconds
  - Prevents false positives when loading completed games

- **M3 Design System Integration**
  - `--gs-*` CSS variables mapped to M3 surface tokens
  - All buttons, inputs, table cells use theme-aware colors
  - Proper hover states visible in both light and dark themes

- **Performance Optimizations**
  - **Splash screen with smart loading**: Shows progress while warming up UI components
  - Pre-creates settings overlay, stats panel, and GPU layers before showing main window
  - Eliminates "cold start" lag on first theme toggle, tab switch, or settings open
  - Removed expensive blur filter from settings overlay
  - Theme transitions only on container elements (not individual cells)
  - `will-change` only on actively animating elements
  - Optimized cell glow animation (static blur instead of animated)

- **Settings Overlay**: Simplified architecture, backdrop handles dimming

### 🐛 Bug Fixes

- **Theme persistence**: Theme now saved and restored on app restart
- **Settings theme sync**: Settings overlay receives correct theme when opened
- **Slot views theme**: Empty slot placeholders adapt to light/dark theme
- **Main window background**: Fixed hardcoded dark background, now uses M3 tokens
- **Table header colors**: Fixed hardcoded dark colors in Game Stats table
- **Button hover visibility**: Fixed invisible hover states in light theme
- **Sound event duplication**: Fixed redundant `reinject()` call
- **Heat bar instant fade**: Migrated incorrectly stored decayPerSec values

### 🔧 Technical Details

- `src/main/modules/splash/index.js`: Splash screen manager with task-based loading
- `src/renderer/pages/splash.html`: Splash screen UI with progress bar
- `src/renderer/scripts/warmup.js`: Animation warm-up module for stats panel
- `src/main/modules/ipc/theme.js`: Theme IPC module (get/set/toggle handlers)
- `src/renderer/scripts/theme_toggle.js`: Unified theme logic with ipcRenderer fallback
- `src/renderer/scripts/theme_settings.js`: Theme sync for settings overlay
- `src/renderer/styles/m3-theme-transitions.css`: Theme transitions and light elevations
- `src/main/preloads/slot.js`: Added theme API for slot views
- `stats_sounds.js`: Sound notification module with freshness detection
- Theme support in: index, stats_panel, settings, slot pages

---

## [0.2.5] - 2026-01-31

### 🏗️ Major Refactor

- **Auto Mode completely rewritten**: Unified architecture in single `loader.js` (~1300 lines)
  - **OddsStore**: Centralized odds state management with OddsCore integration
  - **GuardSystem**: Unified guard logic with priority-based blocking (Excel > Market > Frozen > NoMID > ARB)
  - **AlignEngine**: Pulse-based alignment with configurable tolerance and cooldown
  - **AutoCoordinator**: State machine (idle → aligning → trading) with suspend/resume logic

### ✨ New Features

- **NO_MID Recovery**: Auto mode now properly recovers when MID returns after being suspended
  - Alignment continues while Excel is still suspended (frozen)
  - Resume signal sent only after alignment completes
  - Protects against premature interruption during recovery alignment
- **Pulse-Wait mechanism**: Auto now waits for Excel to update odds before sending next pulse
  - Prevents multiple pulses being sent before Excel can react
  - Eliminates oscillation caused by rapid-fire pulses
  - 3-second timeout fallback if Excel doesn't respond

### 🐛 Bug Fixes

- **Double-pulse oscillation**: Fixed issue where Auto sent multiple pulses without waiting for Excel to react
  - Root cause: step() was called every ~500ms without checking if Excel processed previous pulse
  - Solution: New pulse-wait mechanism tracks Excel odds changes before allowing next pulse
- **Alignment stuck after NO_MID**: Fixed issue where alignment would do only one step and freeze
  - Root cause 1: Cooldown not reset when starting alignment after suspend
  - Root cause 2: OddsStore subscription callback was interrupting recovery alignment
  - Root cause 3: Alignment interval was shorter than fire cooldown
- **Tolerance badge not showing**: Badge now displays on startup without requiring settings save
  - Added `__embeddedAutoSim` global object for compatibility with stats_embedded.js
  - IPC `auto-tolerance-get` now returns default value (1.5%) instead of null
- **Cooldown reset on alignment start**: Engine cooldown now properly reset to allow immediate actions
- **Alignment interval respects cooldown**: Uses `max(alignmentCheckIntervalMs, fireCooldownMs + 100)` to prevent spam

### ⚡ Improvements

- **User vs Auto suspend distinction**: Clear separation between user-initiated and auto-initiated suspends
  - User suspend (ESC in Excel): Auto waits for user to resume
  - Auto suspend (NO_MID, ARB spike): Auto self-resumes when condition clears
- **Suspend/Resume cooldown**: 3-second cooldown prevents rapid cycling
- **Grace period after resume**: 2-second grace ignores Excel-suspended state while Excel processes signal
- **Re-entrant notify guard**: Prevents recursive notification loops

### 🧹 Cleanup

- Removed legacy `auto_core.js`, `auto_hub.js`, `align_engine.js` modules
- Backward-compatible shims (AutoCore, AutoHub) for existing code
- Cleaner state management with single source of truth

---

## [0.2.4] - 2026-01-21

### ✨ New Features

- **DS Auto Mode**: Auto trading without Excel — uses DS extension as odds reference
  - Sends `adjust-up`/`adjust-down`/`commit` commands to extension
  - Enable via Settings → Auto Odds → "DS Auto Mode" checkbox
- **Bo1 (Best of 1) handling**: Proper Match Winner market support for BetBoom and Thunderpick
  - When map=1 and isLast=true, extractors use match odds instead of Map 1 odds
  - Map navigation stays on "Матч"/"Main" tab for Bo1 matches
- **Auto-resume on MID**: Auto mode automatically resumes when MID becomes available again
- **Heat bars in LoL stats table**: Visual activity indicators restored after Material You migration
- **Broker refresh settings**: New Settings section to configure broker auto-refresh behavior

### ⚡ Improvements

- **Settings UI refactored**: Split into modular structure (8 files) for better maintainability
- **Auto Odds settings reorganized**: Split into subsections for clarity
- **Map synchronization improved**: Atomic map config handling prevents race conditions
- **Force map reselect**: Immediate rebroadcast on auto-refresh enable
- **Yellow waiting state**: Now only shows for system suspends (not manual toggle)

### 🐛 Bug Fixes

- **Auto mode pause toggle**: Clicking Auto button when paused now properly disables it (was trying to enable instead)
- **Excel team names priority**: Excel K4/N4 team names now have priority over grid-detected names
- **Blocking states reset**: Fixed "stuck" Auto mode by resetting wait states on enable
- **Map force flag**: Properly passed through broadcastMapConfig to broker views
- **Heat bars visibility**: Fixed CSS and module loading for stats activity bars

### 🧹 Cleanup

- Removed deprecated code (openStatsLogWindow, contrast stubs, theme stubs, openAddBrokerDialog)
- Removed debug logs from broker.js, mapNav.js, stats_activity.js, stats_panel.js
- Removed automatic extension update dialog (manual updates from Settings only)
- Updated electron-builder to v24.13.3

---

## [0.2.3] - 2026-01-14

### ✨ New Features

- **DS/Excel Odds Mismatch Alert**: DS odds row pulses red when different from Excel for >5 seconds
  - Numeric comparison (1.4 == 1.40) to avoid false positives
  - Auto-clears when odds match again
- **Edge Extension v1.3.0**: Complete upTime tracking extension for DS page
  - Popup menu with Connect, Check Updates, Reload, Reset buttons
  - Modern soft UI design with gradients
  - Auto-update via GitHub (direct fetch, no OddsMoni dependency)
  - Improved uptime algorithm: deducts suspend time when game ends in Suspended state
- **Extension Settings Section**: New "Edge Extension" card in Settings → Updates
  - Shows extension status and version
  - "Open Extension Folder" button for easy installation

### 🐛 Bug Fixes

- **Extension context invalidated**: Wrapped chrome.storage calls in try-catch with `safeStorageSet()` helper
- **Popup duplicate variable**: Fixed `updateStatus` element vs function naming conflict
- **Connection errors**: Better error handling showing "Refresh DS page" message

### 🧹 Cleanup

- **Removed legacy files**: Deleted unused `renderer/board.js` and `renderer/stats_embedded.js`
- **Removed empty folder**: Deleted legacy `renderer/` directory

### 🔧 Technical

- **WebSocket bridge**: Extension connects to OddsMoni on port 9876
- **Uptime calculation**: Tracks Active/Suspended states, calculates percentage excluding last suspend
- **stats_embedded.js**: DS mismatch logic with setTimeout-based detection

---

## [0.2.2]

### 🐛 Bug Fixes

- Minor stability improvements

---

## [0.2.1]

### 🐛 Bug Fixes

- **Numpad hotkeys**: Fixed scan code detection to distinguish numpad from regular keys
  - Numpad0/1/-/+ no longer interfere with other applications (YouTube, etc.)
  - Regular number keys and -/= now work correctly everywhere
- **CSS paths**: Fixed broken import paths for shared styles
  - `odds_board_shared.css` now loads correctly in board and stats panel
  - `m3-tokens.css` path fixed in sidebar
  - `common.css` path fixed in lolstats
- **Fonts**: Replaced missing local Inter font files with Google Fonts CDN

---

## [0.2.0]

### 🏗️ Project Restructure

- **React-like folder structure**: Reorganized entire codebase into `src/` directory
  - `src/main/` — Main process (main.js, modules, preloads)
  - `src/renderer/` — Renderer (pages, scripts, styles, core, ui, sidebar)
  - `src/brokers/` — Broker extractors and map navigation
  - `src/assets/` — Static assets (icons)
- **Cleaner imports**: All paths updated to new structure
- **Better separation**: Clear distinction between main/renderer code

### ✨ New Auto Settings

- **Shock threshold**: Configurable ARB protection (40-120%, default 80%)
  - Replaces hardcoded 5% constant — now user-adjustable
- **Stop on no MID**: Toggle to disable Auto when MID data unavailable
- **Burst L3 toggle**: Enable/disable highest burst level independently
- **Fire cooldown**: Configurable minimum delay between keypresses (100-3000ms)
- **Max Excel wait**: Timeout for Excel change in adaptive mode (500-5000ms)
- **Pulse gap**: Delay between burst pulses (20-200ms)
- **All settings connected**: Settings now properly sync to Auto engine in real-time

### 🐛 Bug Fixes

- **Double F21 fix**: Increased debounce from 250ms to 800ms, removed retry logic
- **ARB suspend threshold**: Now uses user setting instead of hardcoded 5%
- **Stop on no MID**: Now respects the toggle setting (was always stopping before)
- **Settings sync**: All Auto settings now properly initialize and update the engine

### ⚡ Improvements

- **Python exit hotkey**: Changed from ESC to Ctrl+Esc (blocks Windows Start menu)
- **Workflow changelog**: Release notes now automatically extracted from CHANGELOG.md

### 🔧 Technical

- **auto_core.js**: Added burst3Enabled, pulseGapMs to engine state
- **auto_hub.js**: Added setShockThreshold(), setStopOnNoMid() functions
- **IPC handlers**: New channels for all Auto settings (shock-threshold, burst3-enabled, stop-no-mid, fire-cooldown, max-excel-wait, pulse-gap)

---

## [0.1.7]

### ✨ New Features

- **Update badge notification**: Settings button now shows a red pulsing badge when update is available (replaces popup overlay)
- **Always-on stale broker refresh**: Brokers without odds updates for 3+ minutes are automatically refreshed

### ⚡ Improvements

- **Faster Excel sync**: Reduced polling interval from 2s to 200ms for near-instant odds display
- **Python script optimization**: Removed manual map cycling (Numpad*) — map now follows Odds Board selection only
- **Settings UI**: Added visual card styling to settings sections for better readability
- **Cleaner codebase**: Removed 6 redundant wrapper files, updated imports to direct paths
- **IPC synchronization**: Fixed channel naming between preload.js and desktop_api_shim.js

### 🐛 Bug Fixes

- **Updater detection**: Fixed manual check not finding available updates
- **ZIP extraction**: Replaced PowerShell with adm-zip for reliable update extraction
- **Settings overlay z-index**: Fixed overlay not appearing over sidebar/stats panel

### 🧹 Removed

- **Auto refresh checkbox**: Removed from toolbar — stale refresh is now always enabled
- **Update popup overlay**: Replaced with badge notification system

### 🔧 Technical

- **STALE_MS**: Changed from 5 to 3 minutes
- **adm-zip**: Added as dependency for pure JavaScript ZIP extraction

---

## [0.1.2]

### ✨ New Features

- **Excel team names**: Team names now automatically read from Excel cells K4/N4 via Python watcher
- **Silent auto-updater**: Update window no longer flashes during background updates

### 🐛 Bug Fixes  

- **Settings panel order**: Fixed sections randomly reordering on each open (removed JS masonry, pure CSS columns now)
- **Team names broadcast**: Fixed team names not reaching stats panel BrowserView
- **Excel watcher logging**: Added verbose mode and rebroadcast on stats panel load

### 🌐 Localization

- **Python scripts**: Translated all Russian text to English in excel_watcher.py

### 🔧 Build

- **Release workflow**: Dev build no longer triggers when creating release tags

---

## [0.0.7]

### 🚀 New Features

- **Script Map indicator**: Badge near S button shows Python controller's current map; red border warns when script map differs from board map
- **Auto Suspend by diff%**: New intelligent suspension — pauses Auto when Excel vs Mid diff exceeds threshold; auto-resumes at half threshold
- **Auto Suspend threshold setting**: Configurable in Settings with description

### ⚡ Improvements

- **Unified Excel status module**: Shared `excel_status.js` handles both board and embedded stats panels — eliminates code duplication
- **Locked odds fallback**: When bookmaker shows '-' on one side but valid odds on the other (e.g. 1 vs 14.5), '-' is replaced with '1'
- **Auto status display fix**: No longer shows "BLOCKED" when Auto is already active

### 🧹 Removed

- **R button (Auto Resume)**: Removed entirely — Auto Suspend by diff% now handles resume automatically
- **F2 hotkey**: No longer toggles auto-resume (feature removed)
- **autoResume logic**: Cleaned from auto_core.js, auto_hub.js, auto_trader.js, preload.js, desktop_api_shim.js

### 📝 Documentation

- Updated hotkeys README (removed F2)
- Updated CODE_REVIEW_OVERVIEW.md with new Auto Suspend description

---

## [0.0.6]

### 🏗️ Architecture

- **Single shared AutoCore engine**: Consolidated dual engines (board + embedded stats) into one shared instance
  - Eliminates duplicate key presses at the source
  - All views now share single engine state
  - `notifyAllUIs()` broadcasts state changes to all registered UI callbacks

### 🐛 Bug Fixes

- **Fixed burst pulses being blocked**: Reduced IPC deduplication window from 100ms to 25ms
  - Burst pulses (~55ms apart) now pass through correctly
  - Only true duplicates (<25ms) are suppressed
- **IPC deduplication kept as safety net**: Fallback protection in case of edge cases

---

## [0.0.5]

### ⚡ Improvements

- **Pulse cooldown system**: After sending N pulses, system now waits for N odds changes (or min 300ms) before sending new pulses — prevents over-correction
- **Updated burst threshold ranges**:
  - L1: 7% – 15% (was 2% – 10%)
  - L2: 10% – 20% (was 7% – 20%)
  - L3: 20% – 40% (was 10% – 30%)

### 🐛 Bug Fixes

- **ESC exit handling**: When hotkey controller exits (ESC), watcher now properly stops and Auto mode disables correctly in Odds Board

---

## [0.0.4]

### 🚀 New Features

- **Python-only hotkey controller**: Replaced AHK with pure Python using `keyboard` library
  - F21-F24 virtual key support via `keyboard.hook()` for auto mode
  - Numpad0/1 key suppression to prevent digit typing
  - WIN/LOSE protection: hotkeys cannot override WIN/LOSE values
- **Auto pip install**: Dependencies automatically installed on first launch (pywin32, openpyxl, watchdog, keyboard)
- **Broker wake-up loop**: Periodic `collect-now` signal every 2s to prevent Chromium throttling

### ⚡ Improvements

- **Background throttling disabled**: Added `backgroundThrottling: false` to board and stats views for instant odds updates
- **Shared Excel status module**: New `renderer/ui/excel_status.js` eliminates code duplication
- **Tooltip behavior**: Shows only on hover, hides immediately on mouseleave
- **Removed AHK from status display**: UI now shows Python-only status

### 🐛 Bug Fixes

- Fixed duplicate tooltips (removed native HTML `title` attribute from Auto buttons)
- Fixed slow odds appearing in stats board when switching views
- Fixed broker views "sleeping" when main window loses focus

### 🧹 Code Quality

- Removed AHK status tracking (no longer needed)
- Centralized Excel status button logic into shared module
- Added keyboard package to requirements.txt

---

## [0.0.3] - 2024-12-18

### 🚀 New Features

- **Per-broker swap**: Swap odds sides (Team 1 ↔ Team 2) individually for any broker with cross-view sync
- **Unified hotkey manager**: Consistent keyboard shortcuts across all views (board, stats, main)
- **Excel Extractor improvements**:
  - Failure protection with auto-suspend on stale data
  - AHK process monitoring without PID coupling
  - Mini-toast notifications for status changes
- **Stats panel cover**: Loading overlay during initialization for cleaner UX

### ⚡ Improvements

- **Auto Trader refactored**: Unified logic for board and embedded panels (single script)
- **Auto Resume disabled by default**: Better user control on app launch
- **Broadcast utilities**: Shared IPC helpers reduce code duplication
- **Focus handling**: Improved hotkey responsiveness after window load
- **OddsBoardShared module**: Centralized odds rendering with swap support
- **Odds deduplication**: Brokers only send updates when odds actually change (reduced IPC traffic)
- **desktopAPI shim**: Unified polyfill for views without preload.js

### 🐛 Bug Fixes

- Fixed false "AHK exited" alerts
- Fixed Auto blocking when Excel Extractor status missing
- Fixed Auto config not applying from Settings
- Fixed overlay/cover view attachment issues
- Fixed hotkeys not responding after load

### 🧹 Code Quality

- Removed deprecated auto_press debug files
- Removed legacy auto_trader_board.js and auto_trader_embedded.js (unified into auto_trader.js)
- Russian hints translated to English
- Removed unused README and image files

---

## [0.0.2] - 2024-12-XX

Initial tracked release with core functionality:

- Multi-broker BrowserView grid with layout presets
- Docked board panel with odds aggregation
- Stats panel with LoL live data integration
- Auto Trader with burst levels and adaptive mode
- Excel Extractor integration (Python + AHK)
- Map selection sync across all brokers
