"""Excel cell watcher - читает odds из Excel и пишет в current_state.json.

Запуск:
    python excel_watcher.py

Поведение:
    - Подключается к уже открытому Excel
    - Каждые INTERVAL секунд читает ячейки odds и template
    - Пишет состояние в current_state.json для использования программой

Для управления odds используйте excel_hotkey_controller.py (заменил AHK).
"""

import argparse
import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

try:
    import win32com.client  # type: ignore
except ImportError:
    win32com = None  # type: ignore

DEFAULT_FILE_PATH = Path(r"C:\Users\kristian.vlassenko\Documents\Esports Excel Trading 16.04 mod.xlsm")
SHEET_NAME = "InPlay FRONT"

# Ячейки для чтения
TEMPLATE_CELL = "C1"  # Имя шаблона (LoL Bo3, LoL Bo5, etc.)
STATUS_CELL = "C6"    # Статус (Trading/Suspended)
TEAM1_CELL = "K4"     # Название команды 1
TEAM2_CELL = "N4"     # Название команды 2

# Map Winner odds: (home, away) для каждой карты
MAP_CELL_PAIRS: List[tuple] = [
    ("M44", "N44"),    # Map 1
    ("M190", "N190"),  # Map 2
    ("M336", "N336"),  # Map 3
    ("M482", "N482"),  # Map 4
    ("M628", "N628"),  # Map 5
]

CELLS: List[str] = [TEMPLATE_CELL, STATUS_CELL, TEAM1_CELL, TEAM2_CELL] + [c for pair in MAP_CELL_PAIRS for c in pair]
INTERVAL = 0.1  # секунды между чтениями (100ms для быстрого отклика на хоткеи)
STATE_FILE = Path(__file__).parent / "current_state.json"


def ts() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def attach_excel_app():
    """Подключение к запущенному Excel."""
    if win32com is None:
        raise SystemExit("pywin32 не установлен. Установите: pip install pywin32")
    try:
        app = win32com.client.GetObject(Class="Excel.Application")
        return app
    except Exception:
        raise SystemExit("Excel не найден. Откройте книгу и повторите запуск.")


def find_workbook(app, path: Path):
    """Найти открытую книгу."""
    for wb in app.Workbooks:
        try:
            if Path(wb.FullName).resolve().samefile(path):
                return wb
        except:
            continue
    
    # Попробуем открыть если существует
    try:
        if path.exists():
            return app.Workbooks.Open(str(path))
    except:
        pass
    
    raise SystemExit(f"Книга {path} не найдена. Откройте её в Excel.")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Excel watcher: reads odds cells and writes current_state.json")
    p.add_argument("--file", default=os.environ.get("ODDSMONI_EXCEL_FILE", ""),
                   help="Путь к Excel файлу")
    p.add_argument("--sheet", default=SHEET_NAME, help="Имя листа")
    return p.parse_args()


def read_cells_batch(sheet, cells: List[str]) -> Dict[str, Any]:
    """Прочитать ячейки."""
    values = {}
    for c in cells:
        try:
            values[c] = sheet.Range(c).Value
        except:
            values[c] = None
    return values


def build_maps(full: dict) -> dict:
    """Построить структуру карт для JSON."""
    out = {}
    for idx, (c1, c2) in enumerate(MAP_CELL_PAIRS, start=1):
        out[str(idx)] = {
            "side1_cell": c1,
            "side2_cell": c2,
            "side1": full.get(c1),
            "side2": full.get(c2),
        }
    return out


def get_max_maps_from_template(template: str) -> int:
    """Определить максимум карт из имени шаблона."""
    if not template:
        return 5
    template_lower = template.lower()
    if 'bo1' in template_lower:
        return 1
    elif 'bo3' in template_lower:
        return 3
    elif 'bo5' in template_lower:
        return 5
    return 5  # по умолчанию


def diff_maps(prev_full: dict, cur_full: dict) -> List[int]:
    """Найти какие карты изменились."""
    changed = []
    for idx, (c1, c2) in enumerate(MAP_CELL_PAIRS, start=1):
        if prev_full.get(c1) != cur_full.get(c1) or prev_full.get(c2) != cur_full.get(c2):
            changed.append(idx)
    return changed


def write_state(timestamp: str, full: dict, changed: Optional[dict], first: bool, prev_full: Optional[dict]):
    """Записать состояние в JSON файл."""
    template_val = full.get(TEMPLATE_CELL)
    template_str = str(template_val).strip() if template_val else ""
    
    # Названия команд из K4/N4 (если пусто - Team 1/Team 2)
    team1_raw = full.get(TEAM1_CELL)
    team2_raw = full.get(TEAM2_CELL)
    team1_name = str(team1_raw).strip() if team1_raw else "Team 1"
    team2_name = str(team2_raw).strip() if team2_raw else "Team 2"
    if not team1_name:
        team1_name = "Team 1"
    if not team2_name:
        team2_name = "Team 2"
    
    template_changed = False
    if not first and prev_full:
        template_changed = prev_full.get(TEMPLATE_CELL) != full.get(TEMPLATE_CELL)
    
    payload = {
        "ts": timestamp,
        "initial": first,
        "cells": full,
        "maps": build_maps(full),
        "template": template_str,
        "maxMaps": get_max_maps_from_template(template_str),
        "team1Name": team1_name,
        "team2Name": team2_name,
    }
    
    if not first and prev_full:
        maps_changed = diff_maps(prev_full, full)
        if maps_changed:
            payload["mapsChanged"] = maps_changed
    
    if template_changed:
        payload["templateChanged"] = True
    
    if changed:
        payload["changed"] = changed
    
    # Атомарная запись
    tmp = STATE_FILE.with_suffix(".tmp")
    try:
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        tmp.replace(STATE_FILE)
    except Exception as e:
        print(f"[WARN] Не удалось записать {STATE_FILE}: {e}")


def main():
    args = parse_args()
    file_path = Path(args.file).expanduser() if args.file else DEFAULT_FILE_PATH
    sheet_name = args.sheet or SHEET_NAME

    print("[INFO] Excel watcher запущен...")
    print(f"[INFO] Файл: {file_path}")
    print(f"[INFO] Лист: {sheet_name}")
    print(f"[INFO] Ячейки: {', '.join(CELLS)}")
    
    app = attach_excel_app()
    wb = find_workbook(app, file_path)
    
    try:
        sheet = wb.Worksheets(sheet_name)
    except:
        raise SystemExit(f"Лист '{sheet_name}' не найден.")

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
        print("\n[INFO] Остановлено.")


if __name__ == "__main__":
    main()
