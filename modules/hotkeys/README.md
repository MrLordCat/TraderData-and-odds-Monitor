# modules/hotkeys

Hotkey helpers and configuration for main/board windows and broker BrowserViews.

## Unified hotkey manager

Implemented in [modules/hotkeys/index.js](modules/hotkeys/index.js).

Window-active hotkeys:
- `Tab` — toggle between Brokers and Stats
- `F1` — toggle Auto mode (broadcast `auto-toggle-all`)
- `F2` — toggle Auto Resume after Suspend (broadcast `auto-resume-set`)
- `F3` — start Excel/Python extractor script

Notes:
- These are attached via `before-input-event` on BrowserViews so they work even when focus is inside a broker page.
- Global `Num5` hotkey is managed in `main.js` (works outside the app if OS registration succeeds).
