# renderer/core

Shared hubs (pure logic) consumed by UI scripts.

- `odds_core.js`: Aggregates broker odds into records; computes derived mid/arb.
- `auto_core.js`: Per-view auto engine; steps odds presses; uses providers.
- `auto_hub.js`: Central orchestrator for auto engines; guards (excel/market/shock); cross-window sync.
- `auto_ipc.js`: Thin wrapper to call main IPC for auto presses.

Key points:

- No DOM parsing here — only logic and IPC.
- Guards use F21 (suspend) with a single retry; main dedupes duplicates across windows.
