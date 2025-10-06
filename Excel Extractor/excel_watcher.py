"""Simplified Excel cell watcher.

Запуск без аргументов:
    py excel_watcher.py

Поведение по умолчанию:
    - Подключается (attach-only) к уже открытому экземпляру Excel
    - Ищет книгу по фиксированному пути FILE_PATH
    - Использует лист SHEET_NAME
    - Каждые INTERVAL секунд (0.5) читает ячейки CELLS одним batched Range
    - Выводит текущее состояние и только изменения (CHG) в консоль
    - Файл логов не пишет

Изменить набор можно отредактировав константы ниже.
"""

import time
from datetime import datetime
from pathlib import Path
from typing import List

try:
    import win32com.client  # type: ignore
except ImportError:
    win32com = None  # type: ignore

FILE_PATH = Path(r"C:\\Users\\kristian.vlassenko\\Documents\\Esports Excel Trading 16.04 mod.xlsm")
SHEET_NAME = "InPlay FRONT"

# Logical mapping:
#   Status cell (global trading / suspend indicator)
STATUS_CELL = "C6"
#   Map side pairs: (side1, side2)
MAP_CELL_PAIRS: list[tuple[str,str]] = [
    ("M44", "N44"),   # Map 1
    ("M190", "N190"), # Map 2
    ("M336", "N336"), # Map 3
]

# Flat list used for batch reading order
CELLS: List[str] = [STATUS_CELL] + [c for pair in MAP_CELL_PAIRS for c in pair]
INTERVAL = 0.5  # seconds
STATE_FILE = Path("current_state.json")  # файл, который всегда содержит актуальное состояние


def ts():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def attach_excel_app():
    if win32com is None:
        raise SystemExit("pywin32 (win32com) не установлен. Установите: pip install pywin32")
    try:
        app = win32com.client.GetObject(Class="Excel.Application")
        return app
    except Exception:
        raise SystemExit("Не найден запущенный Excel. Откройте книгу вручную и повторите запуск.")


def find_workbook(app, path: Path):
    for wb in app.Workbooks:
        try:
            if Path(wb.FullName).resolve().samefile(path):
                return wb
        except Exception:
            continue
    raise SystemExit(f"Книга {path} не найдена среди открытых. Откройте её в Excel.")


def read_cells_batch(sheet, cells: List[str]):
    # Batch Range: e.g. "M44,N44,M190,..."
    ref = ",".join(cells)
    rng = sheet.Range(ref)
    # If multiple single cells separated by commas -> returns a tuple of Ranges; safer to read individually
    values = {}
    try:
        for c in cells:
            try:
                values[c] = sheet.Range(c).Value
            except Exception:
                values[c] = None
    except Exception:
        for c in cells:
            values[c] = None
    return values


def build_maps(full: dict) -> dict:
    """Build structured maps object: { '1': {'side1': v, 'side2': v}, ... }"""
    out: dict[str, dict] = {}
    for idx, (c1, c2) in enumerate(MAP_CELL_PAIRS, start=1):
        out[str(idx)] = {
            "side1_cell": c1,
            "side2_cell": c2,
            "side1": full.get(c1),
            "side2": full.get(c2),
        }
    return out

def diff_maps(prev_full: dict, cur_full: dict) -> list[int]:
    """Return map indices (1-based) that changed (any side value differ)."""
    changed_indices: list[int] = []
    for idx, (c1, c2) in enumerate(MAP_CELL_PAIRS, start=1):
        if prev_full.get(c1) != cur_full.get(c1) or prev_full.get(c2) != cur_full.get(c2):
            changed_indices.append(idx)
    return changed_indices

def write_state(timestamp_str: str, full: dict, changed: dict | None, first: bool, prev_full: dict | None):
    """Атомарно перезаписывает JSON файл актуального состояния.

    Структура файла:
    {
      "ts": <время последнего события>,
      "initial": true/false,
      "cells": { ... все ячейки ... },
      "changed": { ... только изменившиеся ... } (отсутствует если initial или нет изменений)
    }
    """
    payload = {
        "ts": timestamp_str,
        "initial": first,
        "cells": full,
        "maps": build_maps(full),
    }
    # Add which maps changed (if not initial)
    if not first and prev_full is not None:
        map_changed = diff_maps(prev_full, full)
        if map_changed:
            payload["mapsChanged"] = map_changed
    if changed:
        payload["changed"] = changed
    tmp = STATE_FILE.with_suffix(STATE_FILE.suffix + ".tmp")
    try:
        with tmp.open("w", encoding="utf-8") as f:
            import json as _json
            _json.dump(payload, f, ensure_ascii=False, indent=2)
        tmp.replace(STATE_FILE)
    except Exception as e:
        # Не прерываем основной цикл, просто выводим предупреждение один раз.
        print(f"[WARN] Не удалось записать {STATE_FILE}: {e}")


def main():
    print("[INFO] Excel watcher start (attach-only, console only)...")
    print(f"[INFO] File: {FILE_PATH}")
    print(f"[INFO] Sheet: {SHEET_NAME}")
    print(f"[INFO] Cells: {', '.join(CELLS)}")
    app = attach_excel_app()
    wb = find_workbook(app, FILE_PATH)
    try:
        sheet = wb.Worksheets(SHEET_NAME)
    except Exception:
        raise SystemExit(f"Лист '{SHEET_NAME}' не найден. Проверьте имя.")

    prev = None
    try:
        while True:
            current = read_cells_batch(sheet, CELLS)
            if prev is None:
                now = ts()
                print(f"{now} INIT: " + ", ".join(f"{k}={current[k]}" for k in CELLS))
                write_state(now, current, None, first=True, prev_full=None)
            else:
                changed = {k: v for k, v in current.items() if prev.get(k) != v}
                if changed:
                    now = ts()
                    print(f"{now} CHG: " + ", ".join(f"{k}={changed[k]}" for k in changed))
                    write_state(now, current, changed, first=False, prev_full=prev)
            prev = current
            time.sleep(INTERVAL)
    except KeyboardInterrupt:
        print("\n[INFO] Stopped by user.")


if __name__ == "__main__":
    main()
