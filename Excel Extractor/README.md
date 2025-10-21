# Excel Extractor

Python-based watcher that reads odds from an Excel-exported JSON (`current_state.json`) and streams data to the app.

Files:

- `excel_watcher.py`: Main watcher script.
- `requirements.txt`: Python deps.
- `current_state.json`: Live snapshot of odds/state written by external tools.
- `template_sync.json`: Template for sync format; used by `excel_watcher.py`.
- `config159.ini`: Example config for the watcher.

Notes:

- App controls the watcher with the "S" button (start/stop) and shows status on both main board and stats.
- Shocks/suspends use Excel values as inputs for guards.
