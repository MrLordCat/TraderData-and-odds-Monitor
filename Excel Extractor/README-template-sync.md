# Template sync + coordinate learning (AHK v1)

This adds automatic template creation and coordinate writing into `config159.ini` driven by Excel's cell C1 (exported via `template_sync.json`).

## Files

- `script159.ahk` — AHK v1 script. Run it to enable hotkeys.
- `template_sync.json` — produced by the Electron app next to `current_state.json`. Contains `{ template, map, ts }`.
- `config159.ini` — will be updated with new template sections and coordinates.

## Hotkeys (read from INI)

- Ctrl + `LBKey2` (default: Ctrl+NumpadSub): write `LB{map}` using current mouse position.
- Ctrl + `RBKey2` (default: Ctrl+NumpadAdd): write `RB{map}` using current mouse position.
- Ctrl + `TemplateSwitchKey` (default: Ctrl+NumpadDiv): ensure section exists for current template (create if missing).
- Ctrl + NumpadMult: re-derive `Modes` from template name (Bo1/Bo2/Bo3/Bo5 ⇒ 1/2/3/5) and seed LB/RB placeholders.

## Autocreation rules

- Section name is taken from `template` (C1). Invalid characters are stripped.
- If section is missing: it is created, `Modes` is derived from name (BoN).
- Section is appended to `[Global].Templates` if not present (no duplicates).
- When writing a specific `LBx`/`RBx`, the script ensures `Modes >= x`.

## Requirements

- AutoHotkey v1 (classic). If you are on AHK v2, request the v2 version.
- The Electron app (desktop) should be running the Excel Extractor so that `template_sync.json` is present.

## How to run

Double-click `script159.ahk` or start it from AutoHotkey. The tray balloon will confirm writes.
