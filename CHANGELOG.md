# Changelog

All notable changes to this project will be documented in this file.

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
