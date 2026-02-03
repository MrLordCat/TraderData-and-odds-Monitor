# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### ✨ New Features
- **Sound notifications for LoL match events**
  - Plays audio for game start, first blood, first tower, quadra, penta kills
  - Game start detection via ban phase (Grid sends start notification late)
  - 5-second debounce for grouping ban events into phases
  - Settings UI for enabling/disabling sounds and adjusting volume (0-100%)
  - Automatic settings reload when user saves preferences
  - **Protection against historical log spam**: Ignores old events when Grid loads match history
    - 5-second grace period after initialization (no sounds during initial load)
    - Events older than 15 seconds are ignored (prevents sound shock from history dump)

### 🔧 Implementation Details
- `stats_sounds.js`: Core sound notification module (~300 lines)
  - Audio player pool with caching
  - Ban phase detection logic with debouncing
  - Integration with Grid live logs via 'lol-live-log-update' CustomEvent
  - Settings management (soundsEnabled, soundsVolume)
- `settings/sounds.js`: Settings module for sound preferences
- Settings IPC: 'settings-saved' broadcast to all windows on save
- Store keys: `soundsEnabled` (boolean), `soundsVolume` (0-100)

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
