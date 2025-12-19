# Changelog

All notable changes to this project will be documented in this file.

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
