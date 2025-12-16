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

import argparse
import os
import atexit
import subprocess
import time
from datetime import datetime
from pathlib import Path
from typing import List

try:
    import win32com.client  # type: ignore
except ImportError:
    win32com = None  # type: ignore

DEFAULT_FILE_PATH = Path(r"C:\\Users\\kristian.vlassenko\\Documents\\Esports Excel Trading 16.04 mod.xlsm")
SHEET_NAME = "InPlay FRONT"

# Logical mapping:
#   Template selector cell (Excel template name)
TEMPLATE_CELL = "C1"
#   Status cell (global trading / suspend indicator)
STATUS_CELL = "C6"
#   Map side pairs: (side1, side2)
MAP_CELL_PAIRS: list[tuple[str,str]] = [
    ("M44", "N44"),   # Map 1
    ("M190", "N190"), # Map 2
    ("M336", "N336"), # Map 3
    ("M482", "N482"), # Map 4
    ("M628", "N628"), # Map 5
]

# Flat list used for batch reading order (include template cell first so it's always present)
CELLS: List[str] = [TEMPLATE_CELL, STATUS_CELL] + [c for pair in MAP_CELL_PAIRS for c in pair]
INTERVAL = 0.5  # seconds
STATE_FILE = Path("current_state.json")  # файл, который всегда содержит актуальное состояние
CONFIG_INI = Path("config159.ini")       # AHK конфиг в той же папке, где и скрипт
AHK_DEFAULT_NAMES = ["script159_v2.ahk", "script159.ahk"]


def ts():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def sync_default_template(template_name: str):
    """Update DefaultTemplate in config159.ini [Global] section to match given template.
    Non-destructive line-based replace: preserves comments and order.
    """
    if not template_name:
        return
    # Resolve INI path relative to script location
    ini_path = CONFIG_INI
    try:
        base = Path(__file__).resolve().parent
        cand = base / CONFIG_INI
        if cand.exists():
            ini_path = cand
        else:
            ini_path = Path(CONFIG_INI)
    except Exception:
        ini_path = Path(CONFIG_INI)
    try:
        text = ini_path.read_text(encoding='utf-8')
    except Exception:
        return
    lines = text.splitlines()
    out = []
    in_global = False
    done = False
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if stripped.startswith('[') and stripped.endswith(']'):
            # Leaving [Global] without writing DefaultTemplate -> insert at end of section
            if in_global and not done:
                out.append(f"DefaultTemplate={template_name}")
                done = True
            in_global = (stripped.lower() == '[global]')
            out.append(line)
            i += 1
            continue
        if in_global and stripped.lower().startswith('defaulttemplate'):
            out.append(f"DefaultTemplate={template_name}")
            done = True
        else:
            out.append(line)
        i += 1
    # If file had no [Global] section at all
    if not any(l.strip().lower().startswith('[global]') for l in lines):
        out.insert(0, '[Global]')
        out.insert(1, f'DefaultTemplate={template_name}')
        done = True
    # If [Global] existed but we never wrote DefaultTemplate (empty section at EOF)
    if in_global and not done:
        out.append(f"DefaultTemplate={template_name}")
        done = True
    if done:
        try:
            ini_path.write_text("\n".join(out) + "\n", encoding='utf-8')
        except Exception:
            pass


def _resolve_ahk_script_path(arg_value: str | None) -> Path | None:
    try:
        if arg_value:
            p = Path(arg_value).expanduser()
            if p.exists():
                return p
    except Exception:
        pass
    try:
        base = Path(__file__).resolve().parent
        for name in AHK_DEFAULT_NAMES:
            cand = base / name
            if cand.exists():
                return cand
    except Exception:
        pass
    return None


def _start_ahk_via_association(script_path: Path) -> tuple[int | None, str | None]:
    """Start AHK using Windows file association (like double click) and return PID."""
    try:
        cwd = str(script_path.parent)
        ps = (
            '$ErrorActionPreference = "Stop"; '
            f'$p = Start-Process -FilePath {str(script_path)!r} -WorkingDirectory {cwd!r} -PassThru; '
            'Write-Output $p.Id'
        )
        out = subprocess.check_output(
            ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps],
            stderr=subprocess.STDOUT,
            cwd=cwd,
            universal_newlines=True,
        )
        pid = int(str(out).strip())
        if pid > 0:
            return pid, None
        return None, f"AHK start returned invalid pid: {out!r}"
    except Exception as e:
        return None, str(e)


def _any_autohotkey_running() -> bool:
    """Return True if any AutoHotkey process exists.

    This intentionally does NOT try to match a specific PID/script.
    It's robust against file-association launchers that return a short-lived PID.
    """
    try:
        out = subprocess.check_output(
            ['tasklist', '/FO', 'CSV'],
            stderr=subprocess.STDOUT,
            universal_newlines=True,
        )
        low = out.lower()
        # Common binaries depending on AHK build
        return (
            'autohotkey.exe' in low
            or 'autohotkey64.exe' in low
            or 'autohotkeyu64.exe' in low
            or 'autohotkeyu32.exe' in low
            or 'autohotkey' in low
        )
    except Exception:
        return False


def _stop_pid(pid: int | None):
    if not pid:
        return
    try:
        subprocess.Popen(
            ['taskkill', '/PID', str(pid), '/T', '/F'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass


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

    # If the workbook isn't open yet but exists on disk, try opening it.
    try:
        if path.exists():
            return app.Workbooks.Open(str(path))
    except Exception:
        pass

    raise SystemExit(f"Книга {path} не найдена среди открытых. Откройте её в Excel или выберите правильный файл.")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Excel watcher: reads odds cells and writes current_state.json"
    )
    p.add_argument(
        "--file",
        dest="file",
        default=os.environ.get("ODDSMONI_EXCEL_FILE", ""),
        help="Path to Excel workbook (.xlsm/.xlsx). If omitted, uses ODDSMONI_EXCEL_FILE or DEFAULT_FILE_PATH.",
    )
    p.add_argument("--sheet", dest="sheet", default=SHEET_NAME, help="Worksheet name")
    p.add_argument(
        "--no-ahk",
        dest="no_ahk",
        action="store_true",
        help="Do not launch AHK helper script.",
    )
    p.add_argument(
        "--ahk",
        dest="ahk",
        default=os.environ.get("ODDSMONI_AHK_SCRIPT", ""),
        help="Path to .ahk script. If omitted, tries Excel Extractor/script159_v2.ahk.",
    )
    return p.parse_args()


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

def write_state(timestamp_str: str, full: dict, changed: dict | None, first: bool, prev_full: dict | None, ahk_status: dict | None = None):
    """Атомарно перезаписывает JSON файл актуального состояния.

    Структура файла:
    {
      "ts": <время последнего события>,
      "initial": true/false,
      "cells": { ... все ячейки ... },
      "changed": { ... только изменившиеся ... } (отсутствует если initial или нет изменений)
    }
    """
    # Derive template string and whether it changed
    try:
        template_val = full.get(TEMPLATE_CELL)
        template_str = str(template_val).strip() if template_val is not None else ""
    except Exception:
        template_str = ""
    template_changed = False
    try:
        if not first and prev_full is not None:
            template_changed = prev_full.get(TEMPLATE_CELL) != full.get(TEMPLATE_CELL)
    except Exception:
        template_changed = False

    payload = {
        "ts": timestamp_str,
        "initial": first,
        "cells": full,
        "maps": build_maps(full),
        "template": template_str,
    }
    if isinstance(ahk_status, dict):
        payload["ahk"] = ahk_status
    # Add which maps changed (if not initial)
    if not first and prev_full is not None:
        map_changed = diff_maps(prev_full, full)
        if map_changed:
            payload["mapsChanged"] = map_changed
    if template_changed:
        payload["templateChanged"] = True
        # Try to sync DefaultTemplate in config159.ini so AHK picks the same template
        try:
            sync_default_template(template_str)
        except Exception as _e:
            # non-fatal
            pass
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
    args = parse_args()
    file_path = Path(args.file).expanduser() if args.file else DEFAULT_FILE_PATH
    sheet_name = args.sheet or SHEET_NAME

    ahk_state = {
        "enabled": not bool(getattr(args, 'no_ahk', False)),
        "running": False,
        "pid": None,
        "error": None,
        "script": None,
        "managed": False,
    }
    prev_ahk_sig: str | None = None

    # Start AHK helper early (optional). It runs independently; we monitor PID.
    try:
        if not getattr(args, 'no_ahk', False):
            ahk_script = _resolve_ahk_script_path(str(getattr(args, 'ahk', '') or '').strip() or None)
            if ahk_script is None:
                ahk_state.update({"running": False, "pid": None, "error": "AHK script not found", "script": None})
            else:
                ahk_state["script"] = str(ahk_script)
                pid, err = _start_ahk_via_association(ahk_script)
                if pid:
                    ahk_state.update({"running": True, "pid": pid, "error": None, "managed": True})
                else:
                    ahk_state.update({"running": False, "pid": None, "error": err or "AHK launch failed"})
    except Exception as e:
        ahk_state.update({"running": False, "pid": None, "error": str(e)})

    def _cleanup():
        # Best-effort cleanup: if we started AHK, try to stop it.
        try:
            if ahk_state.get('managed') and ahk_state.get('pid'):
                _stop_pid(int(ahk_state.get('pid') or 0) or None)
        except Exception:
            pass

    atexit.register(_cleanup)

    if not file_path.exists():
        raise SystemExit(f"Excel file not found: {file_path}")

    print("[INFO] Excel watcher start (attach-only, console only)...")
    print(f"[INFO] File: {file_path}")
    print(f"[INFO] Sheet: {sheet_name}")
    print(f"[INFO] Cells: {', '.join(CELLS)}")
    app = attach_excel_app()
    wb = find_workbook(app, file_path)
    try:
        sheet = wb.Worksheets(sheet_name)
    except Exception:
        raise SystemExit(f"Лист '{sheet_name}' не найден. Проверьте имя.")

    prev = None
    try:
        while True:
            # Refresh AHK status
            try:
                alive = _any_autohotkey_running()
                prev_running = bool(ahk_state.get('running'))
                if alive:
                    ahk_state.update({"running": True})
                else:
                    ahk_state.update({"running": False})
                    if prev_running:
                        # Transition: running -> not running
                        if ahk_state.get('error') is None:
                            ahk_state["error"] = "AHK exited"
            except Exception:
                pass
            try:
                cur_sig = f"{int(bool(ahk_state.get('enabled')))}|{int(bool(ahk_state.get('running')))}|{ahk_state.get('pid') or ''}|{ahk_state.get('error') or ''}"
            except Exception:
                cur_sig = None

            current = read_cells_batch(sheet, CELLS)
            if prev is None:
                now = ts()
                print(f"{now} INIT: " + ", ".join(f"{k}={current[k]}" for k in CELLS))
                write_state(now, current, None, first=True, prev_full=None, ahk_status=ahk_state)
                # Initial sync of DefaultTemplate
                try:
                    tpl_init = str(current.get(TEMPLATE_CELL) or '').strip()
                    if tpl_init:
                        sync_default_template(tpl_init)
                except Exception:
                    pass
            else:
                changed = {k: v for k, v in current.items() if prev.get(k) != v}
                # Write state either on cell changes OR AHK status changes
                ahk_changed = (cur_sig is not None and cur_sig != prev_ahk_sig)
                if changed or ahk_changed:
                    now = ts()
                    if changed:
                        print(f"{now} CHG: " + ", ".join(f"{k}={changed[k]}" for k in changed))
                    write_state(now, current, changed if changed else None, first=False, prev_full=prev, ahk_status=ahk_state)
                    prev_ahk_sig = cur_sig
            prev = current
            time.sleep(INTERVAL)
    except KeyboardInterrupt:
        print("\n[INFO] Stopped by user.")


if __name__ == "__main__":
    main()
