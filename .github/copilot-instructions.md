# Copilot Project Instructions

Concise, project-specific guidance for AI assistants working in this Electron prototype. Focus on current reality—avoid inventing new patterns without matching existing style.

## 0. Terminal Rules
**CRITICAL: NEVER create new terminal instances.** Always reuse the existing active terminal.
- Combine all commands with `;` (e.g., `git add -A; git commit -m "msg"; git push`)
- If terminal appears busy, wait or ask user to confirm
- Creating new terminals causes Unicode bugs (cyrillic 'с' prefix)

## 1. Big Picture
Electron desktop app that:
- Opens multiple bookmaker sites as `BrowserView`s ("brokers") and extracts LoL match odds.
- Normalizes & aggregates odds into a dockable "board" panel.
- Provides an embedded / detachable stats panel and map selection sync.
- Includes **Auto trading** system with Excel integration via Python scripts.
- **Auto-update** system with dev/release channels via GitHub Releases.
- **Addon/Plugin system** for loading external modules (e.g., games, tools).
- Strong separation: main process = orchestration + layout + IPC modules; renderer = lightweight DOM + event wiring; extraction runs inside broker pages via preload/injected scripts.

## 2. Key Directories / Entry Points
```
src/
├── main/
│   ├── main.js                # Bootstrap, window creation, IPC init, global state, hotkeys
│   ├── preloads/              # Preload scripts
│   │   ├── main.js            # Main window preload (desktopAPI)
│   │   ├── broker.js          # Broker view preload (odds extraction, reload grace)
│   │   ├── credentials.js     # Credential auto-fill & capture helpers
│   │   ├── statsContent.js    # Stats panel preload (IPC forwarding, Grid theme CSS)
│   │   └── slot.js            # Empty slot placeholder preload
│   ├── lolstats/              # Grid stats module
│   │   ├── index.js           # createLolStatsModule() — injection, aggregation, history
│   │   └── inject/            # Scripts injected into Grid page (executeJavaScript)
│   │       ├── pako.min.js    # zlib inflate for WebSocket binary frames
│   │       ├── inject-map.js  # Roster/team mapping from Grid WebSocket
│   │       ├── inject-live-log.js  # WebSocket intercept, decompress, emit events
│   │       ├── inject-stats.js     # Event parsing, per-game stats, sound triggers (~485 lines)
│   │       ├── inject-multikill.js # (Legacy, logic merged into inject-stats.js)
│   │       └── inject-spa-watch.js # URL change detection for SPA navigation
│   └── modules/               # Feature managers and IPC submodules
│       ├── addonManager/      # Addon/plugin system (install, enable, load)
│       ├── board/             # Board panel manager
│       ├── brokerManager/     # Broker view lifecycle
│       ├── hotkeys/           # Unified hotkey manager (TAB/F1/F3)
│       ├── extensionBridge/    # WebSocket bridge for Edge extension (DS Uptime)
│       ├── dev/               # Dev tools (CSS watcher)
│       ├── ipc/               # IPC handlers (see section 4)
│       │   ├── autoPress.js   # Auto-press virtual key injection (F21-F24)
│       ├── layout/            # Layout preset system
│       ├── settingsOverlay/   # Settings modal (with warmup)
│       ├── splash/            # Splash screen with progress-based loading
│       ├── staleMonitor/      # Auto-refresh stale brokers
│       ├── stats/             # Stats panel manager
│       ├── updater/           # Auto-update system
│       ├── zoom/              # Zoom controls
│       ├── excelWatcher.js    # Watches Python's current_state.json
│       ├── excelExtractorController.js  # Spawns Python scripts
│       └── utils/constants.js # Shared numeric tunables
├── renderer/
│   ├── pages/                 # HTML pages
│   │   ├── index.html         # Main window
│   │   ├── settings.html      # Settings overlay (incl. Addons section)
│   │   ├── splash.html        # Splash screen with progress bar
│   │   ├── stats_panel.html   # Stats panel (Odds Board + Game Stats embedded)
│   │   ├── error.html         # Broker error/fallback page
│   │   ├── module_detach.html # Detached addon module window
│   │   └── slot.html          # Empty slot placeholder
│   ├── entries/               # Bundle entry points
│   │   ├── index.entry.js     # Main window entry
│   │   ├── settings.entry.js  # Settings overlay entry
│   │   ├── stats-panel.entry.js # Stats panel entry
│   │   └── error.entry.js     # Error page entry
│   ├── scripts/               # Page-specific JS
│   │   └── settings/          # Settings modules (modular structure)
│   │       ├── init.js        # Version display, DevTools buttons
│   │       ├── auto-settings.js # Auto trading settings
│   │       ├── broker-refresh.js # Broker refresh/stale settings
│   │       ├── heatbar.js     # Heat bar & animations config
│   │       ├── sounds.js      # Sound notification settings
│   │       ├── updater.js     # Updates section
│   │       ├── extension.js   # Edge Extension section
│   │       ├── game-selector.js # Game selector
│   │       ├── changelog.js   # Changelog tab (fetches from GitHub)
│   │       └── addons.js      # Addons management
│   ├── styles/                # CSS files
│   ├── auto/                   # Auto trading system (modular)
│   │   ├── loader.js          # Entry point, wiring, compat shims, UI init
│   │   ├── constants.js       # REASON, STATE, MODE, DEFAULTS, KEYS
│   │   ├── odds-store.js      # OddsStore — reactive odds aggregator
│   │   ├── guard-system.js    # GuardSystem — guard logic
│   │   ├── align-engine.js    # AlignEngine — alignment actions & cooldowns
│   │   └── auto-coordinator.js # AutoCoordinator — state machine
│   ├── core/                  # Shared logic (odds_core)
│   ├── ui/                    # UI components (toast, excel_status)
│   └── lolstats/              # LoL stats embeds
├── brokers/
│   ├── extractors/            # Modular extractor architecture
│   │   ├── base.js            # Shared utilities (deepQuery, normalizeGame, etc.)
│   │   ├── index.js           # Router/registry with EXTRACTOR_TABLE
│   │   ├── rivalry.js         # Rivalry extractor (~220 lines)
│   │   ├── bet365.js          # Bet365 extractor (~135 lines)
│   │   ├── gg.js              # GG.bet extractor
│   │   ├── thunderpick.js     # Thunderpick extractor (Bo1 support)
│   │   ├── betboom.js         # Betboom extractor (Russian, Bo1)
│   │   ├── pari.js            # Pari.ru extractor (Russian)
│   │   └── marathon.js        # Marathon extractor
│   └── mapNav.js              # Map navigation helpers
└── assets/                    # Fonts, images, sounds
    └── *.mp3                  # Sound notifications (GameOneStarted, FirstBlood, etc.)

resources/extensions/uptime/   # Edge extension for DS uptime tracking
├── manifest.json              # Extension manifest v3
├── content.js                 # Content script with OddsBridge WebSocket
├── uptimeEngine.js            # State machine (Active/Suspended tracking)
├── displayManager.js          # UI injection on DS page
├── popup.html/js              # Extension popup menu
└── background.js              # Service worker

Excel Extractor/               # Python integration (outside src/)
├── excel_watcher.py           # Reads Excel cells, writes current_state.json
└── excel_hotkey_controller.py # AHK-style hotkey automation

docs/                          # Documentation
├── ADDON_SYSTEM.md            # Addon system guide
├── AUTO_MODE.md               # Auto trading system docs
├── GRID_LOG_EXTRACTION.md     # Grid log extraction pipeline (stats, sounds)
└── addon-manifest-template.json
```

## 3. Runtime Architecture / Data Flow
1. `bootstrap()` in `src/main/main.js` creates main window, instantiates managers, then `brokerManager.createAll()` builds Broker `BrowserView`s and applies layout preset.
2. Each broker view loads remote URL with dedicated persistent partition (`persist:<brokerId>`) and preload that extracts odds via IPC.
3. Odds updates broadcast via `webContents.send('odds-update', payload)` to main window / board / stats panel; board aggregates best, mid, arb calculations.
4. Layout presets convert pattern strings like `2x3` -> row distribution. Empty cells become `slot-*` BrowserViews.
5. **Excel Watcher** monitors `current_state.json` (produced by Python), broadcasts odds and team names to all views.
6. **Auto Mode** (`renderer/auto/loader.js`) handles automated trading logic with configurable tolerance and burst levels. Only stats_panel is the signal sender.
7. **Addon Manager** loads enabled addons at startup, injects sidebar modules into the sidebar loader.

## 4. IPC & Conventions
IPC is modular under `src/main/modules/ipc/*.js`:
- `addons.js` - Addon install/uninstall/enable/disable
- `brokers.js` - Broker lifecycle (add, close, refresh)
- `layout.js` - Layout preset management
- `map.js` - Map selection sync
- `teamNames.js` - Team name broadcast (now also from Excel K4/N4)
- `autoRefresh.js` - Auto-refresh toggle
- `mapAutoRefresh.js` - Periodic map rebroadcast
- `settings.js` - Settings overlay
- `stats.js` - Stats panel
- `swap.js` - Broker swap positions
- `excelExtractor.js` - Python script control
- `updater.js` - Auto-update system
- `theme.js` - Theme toggle (light/dark)
- `board.js` - Board panel IPC
- `brokerRefresh.js` - Broker refresh settings
- `early.js` - Early-init IPC handlers
- `extensionBridge.js` - DS extension bridge IPC
- `moduleDetach.js` - Addon module detach/attach

**Conventions:**
- Mutable shared objects passed as `{ value: ... }` refs (e.g. `stageBoundsRef`, `activeBrokerIdsRef`).
- IPC channels: `odds-update`, `excel-team-names`, `auto-toggle-all`, `auto-state-updated`, `ui-blur-on/off`, `theme-changed`.
- Avoid global shortcuts; use `before-input-event` handlers.

**Bo1 (isLast) flow:**
- Флаг `isLast` передаётся из broker.js preload → `triggerMapChange(host, map, { isLast })` и `collectOdds(host, map, game, { isLast })`.
- При map=1 и isLast=true используются матчевые рынки вместо карты 1.

## 5. Layout / View Management
- `layoutManager.applyLayoutPreset(id)` is idempotent; auto-creates slot placeholders.
- Preset syntax: `'2x3'` = 2 rows of 3, `'1x2x2'` = rows of 1, 2, 2 brokers.
- Board docking uses `layoutManager.setDockOffsets({ side, width })`.

## 6. Broker Extension Pattern
Extractors are modular under `src/brokers/extractors/`.

To add a bookmaker:
1. Add to `BROKERS` array in `src/main/main.js` (id + default URL).
2. Create `src/brokers/extractors/<broker>.js` implementing `extractFoo(mapNum, game, opts)` returning `{ odds:[s1,s2], frozen }`.
   - Import utilities from `./base.js`: `emptyResult()`, `deepQuery()`, `ordinalSuffix()`, etc.
3. Register in `src/brokers/extractors/index.js`:
   - Import: `const { extractFoo } = require('./foo');`
   - Add to `EXTRACTOR_TABLE`: `{ test: /foo\.com$/i, fn: extractFoo, passOpts: true }`
   - Add to `getBrokerId()` hostname mapping.
   - Export from `module.exports`.
4. Prefer stable selectors (data attributes) over brittle class names.

**passOpts flag:** If extractor needs `opts` (e.g., `opts.isLast` for Bo1), set `passOpts: true`.

**Bo1 handling (BetBoom, Thunderpick):**
- При `mapNum === 1 && opts.isLast === true` экстрактор возвращает матчевые коэффициенты ("Исход матча"/"Match Winner").
- mapNav.js при тех же условиях кликает вкладку "Матч"/"Main" вместо "Карта 1"/"Map 1".

**BetBoom reload protection:**
- Если запрашивается конкретная карта (mapNum ≥ 2 или mapNum=1 без isLast), фолбэк на матчевые коэффициенты **отключён** — возвращается `emptyResult()` вместо "Исход матча".
- Перед извлечением проверяется, что нужный таб карты **реально активен** (`aria-checked`, `data-state`, CSS-класс). Если таб ещё не выбран — `emptyResult()`.
- В broker.js preload: 3-секундная grace period после перезагрузки страницы (только для BetBoom), во время которой odds не отправляются — даёт время на переключение таба.

## 7. Stats / Board
- Stats modes: `hidden|embedded|window` in `statsState.mode`.
- Board docking manipulates stage via `layoutManager.setDockOffsets`.
- Stats panel receives odds via IPC, supports manual mode with stored game data.
- Full extraction pipeline documented in `docs/GRID_LOG_EXTRACTION.md`.

**Game-Aware Metrics (GAME_METRICS):**
- Stats table adapts to detected game (LoL, CS2, Dota 2) via URL detection on portal.grid.gg
- `detectGameFromUrl()` parses `/lol/`, `/cs2/`, `/dota2/` from Grid URL
- `GAME_METRICS = { lol: null, cs2: ['killCount','pistolRound1','pistolRound13'], dota2: null }`
- `null` = all metrics visible; array = only listed metrics shown
- Game badge in toolbar shows detected game with M3 colors
- `window.__gridGame` exposed for per-game sound filtering

**CS2 Pistol Rounds:**
- `pistolRound1` = winner of Round 1 (1st pistol round)
- `pistolRound13` = winner of Round 13 (2nd pistol round)
- Parsed from Grid logs: `"TeamName won Round N"` via `RX_ROUND_WIN` regex
- Binary metrics — displayed as ✓/✗ like firstKill
- Labels: `'1st Pistol'` / `'2nd Pistol'`

**Template Presets:**
- `All` — all metrics visible (default)
- `Mini` — hides firstKill, towers, races, dragonOrders for compact view
- `TEMPLATE_MINI_HIDE` array controls which metrics Mini hides
- Persisted in `lolStatsSettings` (electron-store)

**Activity Heat Bar:**
- Visual indicator of team activity in LoL stats table
- UI setting: "Fade time (sec)" = seconds until full decay (e.g., 2 = 2 seconds)
- Internal: `decayPerSec = 1 / fadeTimeSec` (stored in `gsHeatBar`)
- Quadratic ease-out decay: faster at full level, slower near zero (15% speed at minimum)
- Auto-migration: values > 1 are converted (old format was direct decayPerSec)

## 7.1 Theme System
Global light/dark theme with smooth transitions.

**Architecture:**
- `src/main/modules/ipc/theme.js` - IPC handlers (theme-get, theme-set, theme-toggle)
- `src/renderer/scripts/theme_toggle.js` - Unified theme logic for stats_panel
- `src/renderer/scripts/theme_settings.js` - Theme sync for settings overlay
- `src/renderer/styles/m3-tokens.css` - M3 Design System tokens
- `src/renderer/styles/m3-theme-transitions.css` - Theme transitions and light elevations

**Theme Storage:** `appTheme` key in electron-store ('dark' | 'light')

**Theme Sync Flow:**
1. User clicks toggle → `theme-toggle` IPC → store updated
2. Main process broadcasts `theme-changed` to all webContents
3. Each window/view receives and applies `data-theme` attribute

**CSS Variables:**
- `--gs-*` variables mapped to M3 surface tokens
- All UI elements use theme-aware colors
- Transitions only on container elements (375ms ease-out)

## 7.2 Splash Screen & Warm-up
Eliminates "cold start" lag by pre-warming animations before showing main window.

**Architecture:**
- `src/main/modules/splash/index.js` - Task-based loading manager
- `src/renderer/pages/splash.html` - Progress bar UI
- `src/renderer/scripts/warmup.js` - Animation warm-up for stats panel

**Loading Flow:**
1. `bootstrap()` creates splash window first (main window hidden)
2. Tasks registered: main window load, settings warmup, stats panel load, animation warmup
3. Each task runs sequentially with progress updates
4. Theme transition is triggered with hidden opacity to compile CSS
5. After all tasks complete, splash fades out, main window shows

**Warm-up Tasks:**
- Creating main window (10%)
- Preparing settings overlay (creates BrowserView early)
- Initializing stats panel (waits for did-finish-load)
- Warming up animations (runs theme toggle with opacity:0)

**Safety:** 8-second timeout forces main window show if warmup hangs.

## 8. Auto Trading System (Modular)
Auto Mode is split into ES modules under `src/renderer/auto/`.

### Architecture
- **constants.js** (~90 lines): REASON, STATE, MODE, DEFAULTS, KEYS, REASON_LABELS
- **odds-store.js** (~130 lines): `createOddsStore()` — subscribes to OddsCore, tracks all broker odds, derives MID/ARB
- **guard-system.js** (~100 lines): `createGuardSystem()` — guard logic with priority: Excel > Market > Frozen > NoMID > ARB
- **align-engine.js** (~85 lines): `createAlignEngine()` — computes alignment actions and manages cooldowns
- **auto-coordinator.js** (~610 lines): `createAutoCoordinator()` — state machine (idle → aligning → trading), step loop, suspend/resume
- **loader.js** (~175 lines): Entry point — imports modules, wires them, registers globals, compat shims (AutoHub), UI init
- **AutoHub shim**: `setScriptMap` / `setBoardMap` used by `excel_status.js` (kept for compatibility)

### IPC (main process)
- **ipc/autoPress.js**: Virtual key injection (F21-F24) via SendInput PowerShell script, dedup logic, auto-confirm

### Signal Sender Architecture
**Critical**: Only stats_panel window sends signals to prevent duplicates:
```javascript
const isStatsPanel = locationHref.includes('stats_panel.html');
const isSignalSender = isStatsPanel;  // Only stats_panel controls Auto
```

### User vs Auto Suspend
| Type | Trigger | `userSuspended` | `userWanted` | Resume |
|------|---------|-----------------|--------------|--------|
| User suspend | User presses suspend | `true` | `true` | Auto resumes when user lifts suspend |
| User disable | F1/Numpad5 to turn off | `false` | `false` | User must press F1/Numpad5 again |
| Auto suspend | ARB spike, etc. | `false` | `true` | Auto resumes when condition clears |

### Guard Priority (first match wins)
1. Excel Unknown (hard block)
2. Excel Installing (hard block)
3. Excel Starting (hard block)
4. Excel Off (hard block)
5. DS Not Connected (hard block, DS mode)
6. Map Mismatch (hard block, Excel mode)
7. Excel Frozen (soft suspend, user-initiated)
8. No MID (hard block)
9. ARB Spike (soft suspend)

### Cooldown System
- `SUSPEND_RESUME_COOLDOWN_MS = 3000` - prevents rapid suspend/resume cycling
- 200ms throttle on OddsStore subscription

Key settings (stored in electron-store):
- `autoTolerancePct` - Tolerance threshold (%)
- `autoSuspendThresholdPct` - Auto-suspend on large diff
- `autoBurstLevels` - Burst pulse configuration
- `dsAutoModeEnabled` - DS Auto Mode (work without Excel)

### DS Auto Mode (without Excel)
When Excel is not available, Auto can work directly with DS extension:
- Enable via Settings → Auto Odds → "DS Auto Mode" checkbox
- Requires DS extension connected (green status indicator)
- Compares MID (from brokers) with DS odds
- Sends `adjust-up`/`adjust-down` + `commit` commands to extension

## 9. Excel / Python Integration
- **excel_watcher.py**: Reads Excel cells (including K4/N4 for team names), writes `current_state.json`.
- **excel_hotkey_controller.py**: Sends keystrokes to Excel for automated adjustments.
- **excelWatcher.js** (main process): Watches JSON file, broadcasts to all views.
- **excelExtractorController.js**: Spawns/manages Python processes.

Team names flow: Excel K4/N4 → Python → JSON → excelWatcher.js → IPC `excel-team-names` → stats_panel.js

## 10. Hotkeys
- **F1**: Toggle Auto mode (handled by `modules/hotkeys/index.js`)
- **F3**: Toggle Excel script (Python controller)
- **Tab**: Toggle stats panel
- **Numpad5**: Global toggle Auto (via `globalShortcut.register`)
- **F12**: DevTools for active broker


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
- `soundsEnabled`, `soundsVolume` - Sound notification settings
- `lolStatsSettings` - Stats panel state (metricVisibility, metricOrder, template)
- `appTheme` - Theme preference ('dark' | 'light')
- Updater: `lastUpdateCheck`, `updateChannel`
- Addons: `enabledAddons` (array of addon IDs)
- Broker refresh: `brokerRefreshSettings` (staleReloadEnabled, staleMissingTimeoutMin, staleUnchangedTimeoutMin)
- Map auto refresh: `mapAutoRefreshEnabled`

Always wrap fragile calls in `try/catch`.

## 12.1 Sound Notifications
Audio notifications for game events (stats_panel only). Supports LoL, CS2, Dota 2.

**Architecture:**
- `src/main/lolstats/inject/inject-stats.js` (~485 lines) - Event detection, ban phase tracking, backlog protection
- `src/main/preloads/statsContent.js` - IPC forwarding (`lol-sound-event`)
- `src/main/modules/stats/index.js` - Routes sound events to stats_panel (with pending queue)
- `src/renderer/scripts/stats_sounds.js` - Audio playback (~207 lines)
- `src/renderer/scripts/settings/sounds.js` - Settings UI module

**Sound Assets (`src/assets/`):**
- `GameOneStarted.mp3` — `GameFiveStarted.mp3` (game start per map)
- `FirstBlood.mp3`, `FirstTower.mp3` (early game events)
- `FirstBaron.mp3`, `FirstInhibitor.mp3` (late game objectives)
- `QuadraKill.mp3`, `PentaKill.mp3` (multi-kills)

**Event Flow:**
1. inject-stats.js parses Grid live logs → detects event (ban phase, kills, objectives)
2. `playSound(type, entryKey)` → postMessage to statsContent.js preload
3. statsContent.js → IPC `lol-sound-event` → main process stats/index.js
4. If panel not ready → queue in `pendingSoundEvents`, create panel
5. stats_panel webContents.send → stats_sounds.js `triggerSound()`

**Ban Phase Detection (Game Start):**
- `RX_BANNED` regex detects champion bans
- `lastCompletedGame` tracks finished games (via `RX_GAME_END`)
- `banPhaseTriggered` prevents duplicate sounds within same phase
- When ban detected after game end → triggers next game start sound

**Burst Detection:**
- `isInEventBurst()`: 5+ events in 500ms = suppress (backlog replay)
- `gameStart` sounds **bypass** burst detection (have own dedup via `banPhaseTriggered`)
- `recentEventTimestamps[]` tracks arrival times, cleaned each check

**Freshness Check (entryKey):**
- `eventReceiveTimestamps` maps `entryKey → Date.now()` on arrival
- `FRESH_EVENT_WINDOW_MS = 3000` — sound plays only if event arrived recently
- Allows sounds during initial `soundsEnabled=false` period if event is genuinely fresh

**Backlog Protection:**
- `soundsEnabled = false` during initial Grid load
- Enabled after 2-second delay (`SOUND_ENABLE_DELAY_MS`)
- Prevents spam from historical events when loading match in progress

**Per-Game Sound Filtering:**
- `window.__gridGame` set by stats_panel.js when game detected from Grid URL
- `CS2_ALLOWED = new Set(['gameStart'])` — CS2 plays only gameStart sounds
- LoL / Dota 2: all sounds enabled (no filter)
- Check in `triggerSound()`: if cs2 && !CS2_ALLOWED.has(type) → skip

**Settings (electron-store):**
- `soundsEnabled` (boolean, default: true)
- `soundsVolume` (0-100, default: 70)

## 13. Extension Bridge (DS Uptime)
WebSocket bridge for Edge extension communication:

**Architecture:**
- `src/main/modules/extensionBridge/index.js` - WebSocket server on port 9876
- Extension connects, sends odds updates with broker id `'ds'`
- Odds flow: Extension → WebSocket → `onOddsUpdate` → broadcast to all views
- DS Auto Mode: OddsMoni → `sendAutoCommand()` → WebSocket → Extension → simulate clicks

**Extension Files (`resources/extensions/uptime/`):**
- `content.js` - OddsBridge class, connects to OddsMoni, sends odds, handles auto commands
- `uptimeEngine.js` - Tracks Active/Suspended states, calculates uptime %
- `displayManager.js` - Injects UI overlay on DS page
- `popup.js` - Extension popup with Connect, Check Updates, Reload buttons

**DS Auto Mode Commands:**
- `auto-command` message from OddsMoni triggers `executeAutoCommand()` in extension
- Supported commands: `adjust-up`, `adjust-down`, `commit`, `suspend`, `trade`
- Extension simulates mouse clicks on DS page buttons or keyboard events

**DS Mismatch Detection:**
- `stats_embedded.js` tracks Excel odds changes
- If DS odds differ from Excel for >5 seconds → red pulse animation
- Numeric comparison (parseFloat) to avoid 1.4 vs 1.40 false positives

**Extension Installation:**
- Manual: Load unpacked from `resources/extensions/uptime/`
- Settings → Updates → Edge Extension → Open Extension Folder

## 14. Addon System (for external plugins)
External modules loaded from `%APPDATA%/oddsmoni/addons/<addon-id>/`.

**Channels:** `dev` (pre-release builds) and `release` (stable tags).
- Channel selector in Settings → Addons
- Dev channel: `addon-<id>-dev` tags (prerelease)
- Release channel: `addon-<id>-v*` tags

**Structure:**
```
addon-id/
├── manifest.json    # {id, name, version, main, sidebarModules[]}
├── index.js         # Main entry (optional)
└── modules/         # Sidebar modules
    └── my-panel/
        ├── index.js
        └── styles.css
```

**Key files:**
- `src/main/modules/addonManager/index.js` - Install, uninstall, enable/disable, update
- `src/main/modules/ipc/addons.js` - IPC handlers
- `src/renderer/scripts/settings.js` - Addons UI in Settings
- `addon-registry.json` - Available addons list (fallback for release channel)
- `.github/workflows/build-addon.yml` - Addon build & release workflow

**API (via desktopAPI):**
- `addonsGetInfo()` - Get installed addons
- `addonsFetchAvailable()` - Fetch from GitHub releases
- `addonsInstall(id, url)` - Download & install
- `addonsUninstall(id)` - Remove addon
- `addonsSetEnabled(id, bool)` - Toggle
- `addonsCheckUpdates()` - Check for updates
- `addonsUpdate(id)` - Update addon to latest
- `addonsGetChannel()` / `addonsSetChannel(ch)` - Get/set update channel
- `addonsGetEnabledPaths()` - For sidebar loader

**Version format:**
- Release: `1.0.0`
- Dev: `0.1.0-dev.abc1234` (base version + commit hash)

See `docs/ADDON_SYSTEM.md` for full documentation.

## 15. Power Towers TD (Example Addon)
Located in `addons-dev/power-towers/`:
- Roguelike Tower Defense game with energy system
- Tower paths: Fire 🔥, Ice ❄️, Lightning ⚡, Nature 🌿, Dark 💀
- Menu system with Start/Upgrades/Tips/Settings screens
- Detachable game panel (800x950)

Structure:
```
power-towers/
├── manifest.json
├── index.js                 # Addon entry
├── core/                    # Game logic
│   ├── config.js            # Constants (GRID_SIZE, MAP_WIDTH, etc.)
│   ├── game-core.js         # GameCore class (state, events, API)
│   ├── event-bus.js         # Event system
│   ├── entities/            # Tower, Enemy, Projectile classes
│   └── systems/             # Camera, Economy, Energy, Wave systems
├── renderer/
│   └── game-renderer.js     # Canvas rendering
└── modules/
    └── game-panel/          # SidebarModule (split for maintainability)
        ├── index.js         # Entry point, detach handling
        ├── templates.js     # HTML templates
        ├── styles.js        # CSS styles
        └── game-controller.js  # Game logic, canvas, events
```

## 16. Build / Run / Dist
- Dev: `npm run dev` (no bundler, ASAR disabled)
- Portable: `npm run dist:portable`
- Unpacked: `npm run dist:dir`
- GitHub Actions auto-builds on push to main (dev) and tags (release)
- Addon builds: push to `addons-dev/**` triggers dev release

## 17. Common Pitfalls
- Don't remove `views[id]` without destroying `webContents` & updating `activeBrokerIdsRef`.
- Respect IPC initialization order (some depend on managers existing).
- Don't duplicate hotkey handlers (causes double toggle).
- Extraction functions must fail soft (return `emptyResult()` → `{ odds: ['-','-'], frozen: false }`).
- Keep delayed rebroadcasts (400/1200ms) for SPA transitions.
- BetBoom has a 3s reload grace period (`RELOAD_GRACE_MS`) to suppress stale match-level odds after page reload. Don't remove it.
- BetBoom extractor verifies active tab before extracting — do NOT add fallback to match-level odds for specific map requests.
- Dev build won't trigger on release tags (tags-ignore in workflow).
- Addons install to userData, not project directory.
- Addon updates require force-refresh to get latest downloadUrl (handled automatically).
- Cache errors on restart are normal (previous process releasing files).

## 18. Code Style
- **File Size Limit:** If a file exceeds ~500 lines, split it into smaller modules.
- Extract templates, styles, and handlers into separate files for maintainability.
- Use folder structure: `module-name/index.js` + `templates.js` + `styles.js` + `handlers.js`
