# Copilot Project Instructions

Concise, project-specific guidance for AI assistants working in this Electron prototype. Focus on current reality—avoid inventing new patterns without matching existing style.

## 1. Big Picture
Electron desktop app that:
- Opens multiple bookmaker sites as `BrowserView`s ("brokers") and extracts LoL match odds.
- Normalizes & aggregates odds into a dockable "board" panel.
- Provides an embedded / detachable stats panel and map selection sync.
- Strong separation: main process = orchestration + layout + IPC modules; renderer = lightweight DOM + event wiring; extraction runs inside broker pages via preload/injected scripts.

## 2. Key Directories / Entry Points
- `main.js` – bootstrap, window creation, IPC module initialization, global state refs, hotkeys.
- `modules/` – feature managers (layout, brokerManager, stats, board, settingsOverlay, staleMonitor, zoom) and IPC submodules under `modules/ipc/*`.
- `renderer/` – UI HTML/CSS/JS for main window (`index.*`), board (`board.*`), settings overlay, stats panels, slots, and error overlay.
- `brokers/extractors.js` – DOM parsers per bookmaker + generic dispatcher (`collectOdds`). This file encodes bookmaker-specific resilience rules (don’t casually refactor selectors—comments explain invariants).
- Preloads: `preload.js`, `brokerPreload.js`, `addBrokerPreload.js`, etc. Define `window.desktopAPI` bridge handlers used across renderer scripts.
- `modules/utils/constants.js` centralizes shared numeric tunables (SNAP, VIEW_GAP, STALE_MS, etc.). Reference instead of re-defining magic numbers.

## 3. Runtime Architecture / Data Flow
1. `bootstrap()` in `main.js` creates main window, instantiates managers, then `brokerManager.createAll()` builds Broker `BrowserView`s (skipping disabled ones) and applies layout preset.
2. Each broker view loads remote URL with a dedicated persistent partition (`persist:<brokerId>`) and a preload that periodically extracts odds (see IPC modules; extraction logic lives in loaded page context calling back through preload IPC -> main -> board/stats renderers).
3. Odds updates broadcast via `webContents.send('odds-update', payload)` to main window / board / stats panel; board aggregates best, mid, arb calculations.
4. Layout presets convert pattern strings like `2x3` -> row distribution. Empty grid cells become temporary `slot-*` BrowserViews (`slotPreload.js`) hosting add-broker controls.
5. Map selection + team names + auto-refresh state persist in `electron-store` and rebroadcast after navigations (`scheduleMapReapply`).

## 4. IPC & Conventions
- IPC is modular: look under `modules/ipc/*.js` (e.g. `brokers.js`, `layout.js`, `map.js`, `settings.js`, `teamNames.js`, `autoRefresh.js`, `stats.js`). Add new IPC in a new file; initialize it inside `bootstrap()` after required managers exist (respect ordering used now: broker, layout, map, teamNames, autoRefresh, stats).
- Mutable shared objects passed as `{ value: ... }` refs so modules can observe updated state without circular requires (e.g. `stageBoundsRef`, `activeBrokerIdsRef`). Maintain this pattern when exposing new cross-module mutable state.
- When sending UI blur or overlay events, follow existing channel names: `ui-blur-on` / `ui-blur-off`, `stats-state-updated`, `odds-update`.
- Avoid adding global shortcuts; prefer `before-input-event` handlers on windows or specific BrowserViews (see space/F12 logic) to prevent unintended capture.

## 5. Layout / View Management
- `layoutManager.applyLayoutPreset(id)` is idempotent; call after adding/removing brokers rather than manually resizing views.
- New preset semantics: `'1x2x2'` = rows with 1, then 2, then 2 brokers. Function will auto-create slot placeholders for empty cells; do NOT manually add slot views.
- Always let `sanitizeInitialBounds` supply starting bounds when adding a broker outside preset application.

## 6. Broker Extension Pattern
To add a bookmaker:
1. Append static definition to `BROKERS` array in `main.js` (id + default URL).
2. Add extraction logic in `brokers/extractors.js`: implement `extractFoo(mapNum)` returning `{ odds:[s1,s2], frozen }`; add a `test` regex + `fn` entry in `EXTRACTOR_TABLE` and ensure `getBrokerId` maps hostname -> id.
3. Prefer robust structural cues (data attributes, stable words) over brittle class names; mirror existing extractor style & defensive returns (`['-','-']`).

## 7. Stats / Board
- Stats embedded vs window modes tracked in `statsState.mode` (`hidden|embedded|window`). Toggling does NOT remove broker views anymore (prevents listener leaks)—preserve this.
- Board docking manipulates effective stage via `layoutManager.setDockOffsets`; if introducing new side panels reuse this offset mechanism instead of hardcoding margins.
	(Upscaler removed)

## 8. Persistence & Safety
- Use `electron-store` via shared `store` instance (prefer storing small JSON). Keys already in use: `disabledBrokers`, `layout`, `layoutPreset`, `lastUrls`, `lastMap`, `lolTeamNames`, `autoRefreshEnabled`, credentials, etc.—reuse if extending semantics.
- Wrap potentially fragile calls in `try/catch` (pattern is consistent across codebase) instead of central error boundary—follow style for resilience.

## 9. Hotkeys & Input
- Space toggles stats (throttled 500ms) unless focus is in editable inside a broker view (checked via injected JS). Preserve editable guard when adjusting key handling.
- F12 opens DevTools for active broker (first active) or main window fallback.

## 10. Build / Run / Dist
- Dev run: `npm install` then `npm run dev` (alias to `electron .`). No bundler/minifier step; ASAR disabled (`asar:false`) for live-reload friendly edits.
- Portable artifacts via `npm run dist:portable`; raw unpacked dir via `npm run dist`.
- Keep added runtime files inside `build.files` allowlist or they won’t ship.

## 11. Common Pitfalls / Gotchas
- Don’t remove `views[id]` without also destroying its `webContents` & updating `activeBrokerIdsRef` (see `closeBroker`).
- Avoid re-ordering IPC initialization: some depend on `boardManager` / `statsManager` existence.
- Do not reintroduce removing broker views when embedding stats—enforced comment explains listener leak fix.
- Extraction functions must fail soft (return placeholders) to avoid breaking aggregation loops.
- For map/team name rebroadcast after navigation, keep duplicate delayed sends (e.g. [400,1400] ms) – they handle SPA transitions.

## 12. Adding New Features (Pattern Examples)
- New side utility panel: create manager -> allocate dock width -> call `layoutManager.setDockOffsets({ side:'right', width })` -> send renderer updates via IPC module.
- New persistent UI setting: use `store.get('key', default)` on load; expose get/set via new IPC channel; mirror preview events `*-preview` and commit events `*-saved` if live updating styles.

Keep instructions concise; update this file when structural changes occur (new managers, IPC modules, or layout semantics).
