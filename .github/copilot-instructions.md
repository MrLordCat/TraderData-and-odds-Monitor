# Copilot Project Instructions

Concise, project-specific guidance for AI assistants working in this Electron prototype. Focus on current reality—avoid inventing new patterns without matching existing style.

## 1. Big Picture
Electron desktop app that:
- Opens multiple bookmaker sites as `BrowserView`s ("brokers") and extracts LoL match odds.
- Normalizes & aggregates odds into a dockable "board" panel.
- Provides an embedded / detachable stats panel and map selection sync.
- Includes **Auto trading** system with Excel integration via Python scripts.
- **Auto-update** system with dev/release channels via GitHub Releases.
- Strong separation: main process = orchestration + layout + IPC modules; renderer = lightweight DOM + event wiring; extraction runs inside broker pages via preload/injected scripts.

## 2. Key Directories / Entry Points
```
├── main.js                    # Bootstrap, window creation, IPC init, global state, hotkeys
├── modules/                   # Feature managers and IPC submodules
│   ├── board/                 # Board panel manager
│   ├── brokerManager/         # Broker view lifecycle
│   ├── hotkeys/               # Unified hotkey manager (TAB/F1/F3)
│   ├── ipc/                   # IPC handlers (see section 4)
│   ├── layout/                # Layout preset system
│   ├── settingsOverlay/       # Settings modal
│   ├── staleMonitor/          # Auto-refresh stale brokers
│   ├── stats/                 # Stats panel manager
│   ├── updater/               # Auto-update system
│   ├── excelWatcher.js        # Watches Python's current_state.json
│   ├── excelExtractorController.js  # Spawns Python scripts
│   └── utils/constants.js     # Shared numeric tunables
├── renderer/                  # UI HTML/CSS/JS
│   ├── board.*                # Dockable odds board panel
│   ├── stats_panel.*          # Stats panel (manual/live modes)
│   ├── settings.*             # Settings overlay
│   ├── core/                  # Shared logic (auto_core, auto_hub, odds_core)
│   ├── ui/                    # UI components (toast, excel_status, api_helpers)
│   └── sidebar/               # NEW: Modular sidebar system (see section 13)
├── brokers/
│   ├── extractors.js          # DOM parsers per bookmaker
│   └── mapNav.js              # Map navigation helpers
├── Excel Extractor/           # Python integration
│   ├── excel_watcher.py       # Reads Excel cells, writes current_state.json
│   └── excel_hotkey_controller.py  # AHK-style hotkey automation
├── preload.js                 # Main window preload (desktopAPI)
├── brokerPreload.js           # Broker view preload (odds extraction)
└── slotPreload.js             # Empty slot placeholder preload
```

## 3. Runtime Architecture / Data Flow
1. `bootstrap()` in `main.js` creates main window, instantiates managers, then `brokerManager.createAll()` builds Broker `BrowserView`s and applies layout preset.
2. Each broker view loads remote URL with dedicated persistent partition (`persist:<brokerId>`) and preload that extracts odds via IPC.
3. Odds updates broadcast via `webContents.send('odds-update', payload)` to main window / board / stats panel; board aggregates best, mid, arb calculations.
4. Layout presets convert pattern strings like `2x3` -> row distribution. Empty cells become `slot-*` BrowserViews.
5. **Excel Watcher** monitors `current_state.json` (produced by Python), broadcasts odds and team names to all views.
6. **Auto Core** (`renderer/core/auto_core.js`) handles automated trading logic with configurable tolerance and burst levels.

## 4. IPC & Conventions
IPC is modular under `modules/ipc/*.js`:
- `brokers.js` - Broker lifecycle (add, close, refresh)
- `layout.js` - Layout preset management
- `map.js` - Map selection sync
- `teamNames.js` - Team name broadcast (now also from Excel K4/N4)
- `autoRefresh.js` - Auto-refresh toggle
- `mapAutoRefresh.js` - Periodic map rebroadcast
- `settings.js` - Settings overlay
- `stats.js`, `statsDebug.js` - Stats panel
- `swap.js` - Broker swap positions
- `excelExtractor.js` - Python script control
- `updater.js` - Auto-update system

**Conventions:**
- Mutable shared objects passed as `{ value: ... }` refs (e.g. `stageBoundsRef`, `activeBrokerIdsRef`).
- IPC channels: `odds-update`, `excel-team-names`, `auto-toggle-all`, `auto-state-updated`, `ui-blur-on/off`.
- Avoid global shortcuts; use `before-input-event` handlers.

## 5. Layout / View Management
- `layoutManager.applyLayoutPreset(id)` is idempotent; auto-creates slot placeholders.
- Preset syntax: `'2x3'` = 2 rows of 3, `'1x2x2'` = rows of 1, 2, 2 brokers.
- Board docking uses `layoutManager.setDockOffsets({ side, width })`.

## 6. Broker Extension Pattern
To add a bookmaker:
1. Add to `BROKERS` array in `main.js` (id + default URL).
2. In `brokers/extractors.js`: implement `extractFoo(mapNum)` returning `{ odds:[s1,s2], frozen }`.
3. Add `test` regex + `fn` entry in `EXTRACTOR_TABLE`; update `getBrokerId` hostname mapping.
4. Prefer stable selectors (data attributes) over brittle class names.

## 7. Stats / Board
- Stats modes: `hidden|embedded|window` in `statsState.mode`.
- Board docking manipulates stage via `layoutManager.setDockOffsets`.
- Stats panel receives odds via IPC, supports manual mode with stored game data.

## 8. Auto Trading System
- **Auto Core** (`renderer/core/auto_core.js`): Single shared engine for board + embedded stats.
- **Auto Hub** (`renderer/core/auto_hub.js`): Coordinates engine instances, broadcasts state.
- **Auto Trader** (`renderer/auto_trader.js`): UI bindings for Auto button, status indicators.
- **Excel Status** (`renderer/ui/excel_status.js`): Shared module for Excel status display.

Key settings (stored in electron-store):
- `autoTolerancePct` - Tolerance threshold (%)
- `autoSuspendThresholdPct` - Auto-suspend on large diff
- `autoBurstLevels` - Burst pulse configuration

## 9. Excel / Python Integration
- **excel_watcher.py**: Reads Excel cells (including K4/N4 for team names), writes `current_state.json`.
- **excel_hotkey_controller.py**: Sends keystrokes to Excel for automated adjustments.
- **excelWatcher.js** (main process): Watches JSON file, broadcasts to all views.
- **excelExtractorController.js**: Spawns/manages Python processes.

Team names flow: Excel K4/N4 → Python → JSON → excelWatcher.js → IPC `excel-team-names` → stats_panel.js

## 10. Hotkeys
- **F1**: Toggle Auto mode (handled by `modules/hotkeys/index.js`)
- **F3**: Toggle Excel script (Python controller)
- **Tab/Space**: Toggle stats panel
- **Numpad5**: Global toggle Auto (via `globalShortcut.register`)
- **F12**: DevTools for active broker
- **Ctrl+F12**: DevTools for board

Hotkeys managed in `modules/hotkeys/index.js` via `before-input-event`. Avoid duplicate handlers!

## 11. Auto-Update System
- **modules/updater/**: Manages GitHub Releases auto-update.
- **modules/ipc/updater.js**: IPC handlers for update UI.
- Channels: `dev` (dev-latest tag) and `release` (v* tags).
- Silent background updates (no terminal window flash).
- GitHub Actions: `.github/workflows/release.yml`, `dev-build.yml`.

## 12. Persistence & Safety
electron-store keys:
- `disabledBrokers`, `layoutPreset`, `lastUrls`, `lastMap`
- `lolTeamNames`, `autoRefreshEnabled`
- `autoTolerancePct`, `autoSuspendThresholdPct`, `autoBurstLevels`
- `gsHeatBar`, `statsConfig`, `lolManualData`
- Updater: `lastUpdateCheck`, `updateChannel`

Always wrap fragile calls in `try/catch`.

## 13. Sidebar Module System (NEW)
Modular architecture for sidebar panels in `renderer/sidebar/`:

```
sidebar/
├── core/
│   ├── sidebar-base.css    # Shared styles
│   ├── sidebar-base.js     # Base class & registry
│   └── sidebar-loader.js   # Dynamic loader
├── modules/
│   ├── toolbar/            # Top toolbar (order: 0)
│   ├── sources-layout/     # Sources list (order: 5)
│   └── odds-board/         # Odds table (order: 10)
└── sidebar.html            # Container
```

Creating a module:
```javascript
const { SidebarModule, registerModule } = require('../../core/sidebar-base');
class MyModule extends SidebarModule {
  static id = 'my-module';
  static title = 'My Module';
  static order = 50;
  getTemplate() { return '<div>Content</div>'; }
  onMount(container) { super.onMount(container); }
}
registerModule(MyModule);
```

## 14. Build / Run / Dist
- Dev: `npm run dev` (no bundler, ASAR disabled)
- Portable: `npm run dist:portable`
- Unpacked: `npm run dist:dir`
- GitHub Actions auto-builds on push to main (dev) and tags (release)

## 15. Common Pitfalls
- Don't remove `views[id]` without destroying `webContents` & updating `activeBrokerIdsRef`.
- Respect IPC initialization order (some depend on managers existing).
- Don't duplicate hotkey handlers (causes double toggle).
- Extraction functions must fail soft (return `['-','-']`).
- Keep delayed rebroadcasts (400/1400ms) for SPA transitions.
- Dev build won't trigger on release tags (tags-ignore in workflow).

## 16. Code Style
- CommonJS `require/module.exports` (no ES modules).
- Defensive `try/catch` everywhere.
- Verbose mode via `verbose` parameter for debugging.
- CSS variables for theming (`--sidebar-*`, `--board-*`).
- IPC channel naming: `noun-verb` (e.g. `broker-opened`, `auto-toggle-all`).

Keep instructions concise; update this file when structural changes occur.
