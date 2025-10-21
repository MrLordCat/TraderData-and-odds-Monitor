# modules

Feature managers and IPC submodules for the Electron main process.

Highlights:

- `index.js`: Module bootstrap and exports.
- `brokerManager/` + `brokerManager.js`: Create/manage BrowserViews for brokers; partitions, preloads, lifecycle.
- `board/`: Aggregation and odds board orchestration.
- `stats/`: Stats panel/window manager; embedded/window modes.
- `ipc/`: Isolated IPC channels (brokers, layout, map, settings, stats, etc.).
- `utils/`: Shared helpers (`constants.js`, `odds.js`, `views.js`).
- `staleMonitor/`: Detects stale brokers/odds and signals.
- `zoom/`: Per-view zoom handling and persistence.
- `external/`, `dev/`, `hotkeys/`: Aux features. (OCR removed)

Key points:

- Keep initialization order (brokers → layout → map → teamNames → autoRefresh → stats).
- Cross-module mutable state is passed via `{ value: ... }` refs.
- Use `electron-store` for small persistent settings.
