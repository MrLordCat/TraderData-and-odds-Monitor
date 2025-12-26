# modules/ipc

Modular IPC channels. Each file registers handlers/listeners for a feature and broadcasts updates to views.

Files:

- `brokers.js`: Broker lifecycle, odds extraction, and events.
- `layout.js`: Layout preset application and dock offsets.
- `map.js`, `mapAutoRefresh.js`: LoL map selection and refresh.
- `settings.js`: Persistent settings get/set and preview events.
- `teamNames.js`: Team names persistence and broadcasts.
- `autoRefresh.js`: Periodic reloads with guards.
- `stats.js`, `statsDebug.js`: Stats panel/window state and diagnostics.


Notes:

- Initialize IPC modules in `bootstrap()` following the existing order.
- Prefer narrow channels per feature over a single large IPC file.
