# OddsMoni Desktop (Prototype)

Electron-based desktop app that opens multiple bookmaker sites as BrowserViews, extracts odds, and aggregates them into a dockable board with a lightweight embedded Stats panel (LoL-focused).

This is a development-oriented prototype with a clear separation between the main process (orchestration/layout) and renderer (light UI). No bundler; hot-edit friendly.

Fonts: Inter (via CSS), falling back to system fonts (system-ui, Segoe UI, Roboto, Helvetica Neue, Arial). Font binaries are not included in the repo.

## Background & Story

This project started as a small browser extension that collected the specific League of Legends stats I needed from portal.grid. The information on the site was either incomplete or shown in a way that didn’t fit my workflow, so the extension normalized and reshaped it.

Later I built another extension to scrape odds from multiple bookmakers and display them in one compact window instead of opening a dozen tabs that cover the entire screen. Over time, maintaining multiple extensions and adding the features I wanted became cumbersome. After finishing my studies at kood/, I decided I needed a full-fledged desktop application tailored to my workflow. That’s how this app was born. It’s still being refined and polished—and I’ve been building it in parallel with my day job.

## Guiding Principles

Because I frequently use an AI agent in VS Code, I optimized the codebase for:

- Modularity: small, focused modules and files to enable targeted, low-risk edits.
- Readability: clear separation between orchestration (main process) and lightweight UI (renderer).
- Replaceable parts: IPC modules and managers are kept decoupled to evolve independently.

## Key Capabilities (from the workflow)

- Collect and normalize odds from multiple bookmakers and show them side-by-side in a table/board.
- Gather the game data I care about for LoL and optionally open a second window dedicated to a stream.
- An Auto Trader that uses mid/average values across books as a baseline and automatically adjusts my odds.
  - It can act as an assistant or, in some scenarios, replace a manual trader.
  - It still requires further tuning and guardrails.

## Highlights

- Multiple brokers loaded into persistent BrowserViews with per-broker sessions.
- Aggregated odds board docked to the main window (left/right adjustable).
- Embedded Stats panel with two content slots (A/B) and a side panel.
- New: Stats side panel Hide/Unhide button in the top toolbar (visible only when Stats is open).
- Map sync and team names broadcast to brokers and the board.
- Optional Excel-based odds feed watcher and basic auto-alignment signaling.

## Quick Start

Prerequisites:
 
- Node.js 18+ (recommended)
- Windows 10/11 (primary dev target). macOS/Linux not validated.

Install and run (dev):

```powershell
npm install
npm run dev
```

Build portable artifacts (Windows):

```powershell
# Unpacked build directory
npm run dist

# Zip portable from dist/win-unpacked
npm run dist:zip

# Single portable zip (name/version inferred from package.json)
npm run dist:portable
```

## Using the App

Top toolbar groups:
 
- Brokers: add broker, apply layout presets, refresh all.
- Board: toggle dock side and resize with the vertical splitter.
- Stats: toggle Stats embedded view, and (when in Stats) show the Hide/Unhide Panel button.
- Dev/Settings: open DevTools for diagnostics; open UI settings.

Stats (embedded) at a glance:
 
- Two slots (A/B) for content like portal.grid.gg, twitch, or embedded LoL Stats.
- Side panel on the left or right with layout/source controls.
- Layout modes: split, vertical, focus A, focus B.
- Single-window mode to suspend the background slot when bandwidth/CPU constrained.
- New: Hide/Unhide side panel (top toolbar button appears only in Stats). State persists across sessions.

Board (odds):
 
- Docked to the side of the stage; move between left/right; resize with the splitter.
- Receives odds from brokers and from the optional Excel watcher.

## Hotkeys

- Space: toggle Stats embedded view (guarded to avoid capturing inside editable elements).
- F12: open DevTools for the active broker (fallback to main window if none).
- Ctrl+F12: open DevTools for the board view.
- Ctrl+Alt+L: open the Stats Log window.
- Numpad5: toggle Auto mode across views (fallback if global shortcut not registered).
- Alt+C: disable Auto across views.

Notes
 
- Global shortcuts are minimized; most keys are handled via per-window `before-input-event` to avoid unintended capture.

## Architecture (runtime overview)

- Main process (`main.js`): bootstraps the main window, creates broker views, applies layout, wires IPC modules.
- Modules (`modules/`):
  - `layout` – view layout orchestration and presets (e.g., `2x3`, `1x2x2`).
  - `brokerManager` – add/close brokers, per-broker sessions, extraction orchestration.
  - `board` – docked odds board manager.
  - `stats` – embedded Stats manager (A/B slots + panel); manages layout modes, panel side, and new hide/unhide logic.
  - `ipc/*` – modular IPC endpoints (stats, layout, brokers, map, settings, etc.).
  - `utils/constants.js` – common numeric tunables (gaps, panel widths, staleness MS, etc.).
- Renderer (`renderer/`): toolbar UI (`index.*`), board UI, settings UI, Stats panel UI.
- Preloads: `preload.js` bridges `desktopAPI` methods to renderer scripts.
- Extractors: bookmaker-specific DOM parsers live in `brokers/extractors.js`.

Data flow:
 
1. Brokers load in BrowserViews, extract odds, and publish via IPC.
2. Main distributes odds updates to the board and stats panel.
3. Stats aggregates additional LoL information and can embed its own odds board.

## Persistent Settings (electron-store keys)

Common keys (not exhaustive):
 
- `layoutPreset` – current broker layout string (e.g., `2x2`).
- `disabledBrokers`, `lastUrls` – per-broker controls and last visited URLs.
- `lastMap`, `isLast` – map selection and bet365 “match vs final” flag.
- `lolTeamNames` – team name overrides.
- `autoRefreshEnabled` – stale monitor auto-refresh.
- `statsLayoutMode` – `split` | `vertical` | `focusA` | `focusB`.
- `statsPanelSide` – `left` | `right`.
- `statsPanelHidden` – whether the Stats side panel is hidden (drives the Hide/Unhide button text).
- `statsSingleWindow` – single-window mode enabled.
- `statsUrls` – last selected URLs for slots A/B.
- `statsConfig` – visual config for stats animations & win/lose highlighting.

## Excel Extractor (optional)

An external Python script can feed odds to the app (embedded board & main board). The app manages basic start/stop and status reporting.

Tips:
 
- Ensure Python is installed and available as `python` in PATH.
- The app tries to locate `excel_watcher.py` in common folders (root and `Excel Extractor/`).
- On first run it will also try to set the default dump path to `current_state.json` next to the script.
- If `pywin32` is missing, use the settings in the board/UI to install dependencies (or install manually).

## Development

- No bundler/minifier; ASAR disabled to keep hot-edit friendly.
- `electron .` is used for both `start` and `dev`.
- uBlock Origin can be injected into specific sessions for ad-heavy sources; the project includes a local extension stub.

## Troubleshooting

- The Stats Hide/Unhide button is visible only when the app is in the embedded Stats mode; use the top “Stats” button first.
- If brokers stop updating, check the stale monitor auto-refresh setting.
- If DevTools don’t open for a specific view, use the general Dev button (main window) or Ctrl+F12 (board) or F12 fallback.
- If Excel watcher does not start, verify Python availability, script path, and that `pywin32` is installed.

## License

MIT

