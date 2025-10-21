# renderer

UI scripts and assets for the main window, stats, and the odds board.

- `index.*`: Main window shell and toolbar.
- `board.*`: Dockable odds board; aggregates best/mid/arb, controls.
- `stats_*`: Embedded stats panel and related UI pieces.
- `core/`: Odds/Auto hubs consumed by UI scripts (no DOM parsing here).
- `lolstats/`: Internal stats utilities.
- `ui/`: Generic UI helpers (folder reserved for future components).

Notes:

- Use `window.desktopAPI` bridge from preloads for IPC; avoid direct `ipcRenderer` in UI scripts.
- The odds/auto logic is centralized in `renderer/core` and fed by main via IPC.
