"""Excel Odds Hotkey Controller - Python replacement for AHK to control odds via hotkeys.

Hotkeys:
    NumpadSub (Numpad-) -> PreviousOddsHome (decrease home odds)
    NumpadAdd (Numpad+) -> NextOddsHome (increase home odds)
    Numpad0 -> Send Update (Add-in button)
    Numpad1 -> Suspend current map (CurrentMapSuspend button)
    F21 -> Suspend + Send Update (auto mode trigger)
    F22 -> Send Update only (auto mode confirm)
    F23 -> PreviousOddsHome (external trigger)
    F24 -> NextOddsHome (external trigger)
    Ctrl+Esc or Ctrl+C -> Exit

Map selection is synchronized from Odds Board via template_sync.json.
Manual map switching via Numpad* is disabled - map follows Board selection.

Reads current map from template_sync.json.
Detects max maps from template (C1): Bo1=1, Bo3=3, Bo5=5.
Blocks changes to cells with WIN/LOSE values.

Map Winner rows:
    Map 1: row 44
    Map 2: row 190  
    Map 3: row 336
    Map 4: row 482
    Map 5: row 628

Run:
    python excel_hotkey_controller.py
"""

import json
import time
import sys
import re
from pathlib import Path
from typing import Optional, List
from queue import Queue, Empty
import win32com.client
import win32gui
import win32con
import win32api
import pythoncom

# Try to import keyboard (requires: pip install keyboard)
try:
    import keyboard
except ImportError:
    print("ERROR: keyboard library required")
    print("Install: pip install keyboard")
    sys.exit(1)

# Configuration
SHEET_NAME = "InPlay FRONT"
TEMPLATE_CELL = "C1"  # Template name cell (LoL Bo3, LoL Bo5, etc.)
SYNC_FILE = Path(__file__).parent / "template_sync.json"
STATUS_FILE = Path(__file__).parent / "hotkey_status.json"  # Written by this script for Electron to read

# Map Winner rows (1-indexed)
MAP_WINNER_ROWS = {
    1: 44,   # Map 1 Winner
    2: 190,  # Map 2 Winner
    3: 336,  # Map 3 Winner
    4: 482,  # Map 4 Winner
    5: 628,  # Map 5 Winner
}

# Values that block cell modification
BLOCKED_VALUES = {'WIN', 'LOSE', 'win', 'lose', 'Win', 'Lose'}


class ExcelOddsHotkeyController:
    """Hotkey controller for Excel odds management."""
    
    def __init__(self):
        self._xl = None
        self._wb = None
        self._ws = None
        self._odds_home: List = []
        self._odds_away: List = []
        self._current_map = 1
        self._max_maps = 5  # Updated from template
        self._connected = False
        self._command_queue = Queue()  # Command queue for main thread execution
        self._running = True
        # Key hold state tracking - prevent repeat until odds change
        self._key_held = {}  # key_name -> {'snapshot': (home, away), 'pending': bool}
        self._last_odds_snapshot = None  # (home, away) tuple for current map
        
    def connect(self) -> bool:
        """Connect to Excel (call only from main thread!)."""
        try:
            pythoncom.CoInitialize()
            self._xl = win32com.client.GetActiveObject("Excel.Application")
            self._wb = self._xl.ActiveWorkbook
            self._ws = self._wb.Worksheets(SHEET_NAME)
            
            # Load odds tables
            self._load_odds_tables()
            
            # Detect max maps from template
            self._update_max_maps()
            
            print(f"[OK] Connected to: {self._wb.Name}")
            self._connected = True
            self.write_status()  # Write initial status for Electron
            return True
        except Exception as e:
            print(f"ERROR connecting to Excel: {e}")
            return False
    
    def _load_odds_tables(self):
        """Load ODDSHOME and ODDSAWAY tables."""
        try:
            home_range = self._wb.Names('ODDSHOME').RefersToRange
            self._odds_home = [cell.Value for cell in home_range if cell.Value is not None]
            
            away_range = self._wb.Names('ODDSAWAY').RefersToRange
            self._odds_away = [cell.Value for cell in away_range if cell.Value is not None]
        except Exception as e:
            print(f"Warning: Could not load odds tables: {e}")
    
    def _get_template_name(self) -> str:
        """Get template name from cell C1."""
        try:
            value = self._ws.Range(TEMPLATE_CELL).Value
            return str(value).strip() if value else ""
        except:
            return ""
    
    def _update_max_maps(self):
        """Update max maps based on template."""
        template = self._get_template_name().lower()
        if 'bo1' in template:
            self._max_maps = 1
        elif 'bo3' in template:
            self._max_maps = 3
        elif 'bo5' in template:
            self._max_maps = 5
        else:
            self._max_maps = 5  # Default
        print(f"[i] Template: {self._get_template_name()} -> Max maps: {self._max_maps}")
    
    def _find_odds_index(self, value, odds_list: List) -> int:
        """Find index of value in odds list."""
        if value in odds_list:
            return odds_list.index(value)
        for i, v in enumerate(odds_list):
            if isinstance(v, (int, float)) and isinstance(value, (int, float)):
                if abs(v - value) < 0.001:
                    return i
        return -1
    
    def write_status(self):
        """Write current status to hotkey_status.json for Electron to read."""
        try:
            current_map = self.read_current_map()
            status = {
                'ts': time.time(),
                'currentMap': current_map,
                'maxMaps': self._max_maps,
                'connected': self._connected,
                'template': self._get_template_name() if self._connected else '',
            }
            STATUS_FILE.write_text(json.dumps(status), encoding='utf-8')
        except Exception as e:
            pass  # Silent fail - file is optional
    
    def read_current_map(self) -> int:
        """Read current map from template_sync.json (synced from Odds Board)."""
        try:
            if SYNC_FILE.exists():
                data = json.loads(SYNC_FILE.read_text(encoding='utf-8'))
                map_num = data.get('map', 1)
                if isinstance(map_num, int) and 1 <= map_num <= self._max_maps:
                    return map_num
        except:
            pass
        return self._current_map
    
    def get_row_for_current_map(self) -> int:
        """Get row for current map."""
        map_num = self.read_current_map()
        self._current_map = map_num
        return MAP_WINNER_ROWS.get(map_num, 44)
    
    def get_current_odds(self, row: int) -> tuple:
        """Get current odds for row."""
        try:
            home = self._ws.Cells(row, 13).Value  # M column
            away = self._ws.Cells(row, 14).Value  # N column
            return home, away
        except:
            return None, None
    
    def _update_odds_snapshot(self):
        """Update odds snapshot for key hold detection."""
        row = self.get_row_for_current_map()
        self._last_odds_snapshot = self.get_current_odds(row)
    
    def _check_key_hold_allowed(self, key_name: str) -> bool:
        """Check if key press is allowed (first press or odds changed since last press).
        
        For held keys: only allow repeat if odds have changed since the key was first pressed.
        This prevents sending many signals when holding a key - only one per odds change.
        """
        row = self.get_row_for_current_map()
        current_odds = self.get_current_odds(row)
        
        if key_name not in self._key_held:
            # First press - allow and record snapshot
            self._key_held[key_name] = {'snapshot': current_odds, 'pending': True}
            return True
        
        held_state = self._key_held[key_name]
        
        # Key is being held - check if odds changed since last action
        if held_state['pending']:
            # Still waiting for odds to change after previous action
            if current_odds != held_state['snapshot']:
                # Odds changed - allow next action and update snapshot
                held_state['snapshot'] = current_odds
                return True
            else:
                # Odds haven't changed yet - block
                return False
        else:
            # Key was released and pressed again - treat as new press
            held_state['snapshot'] = current_odds
            held_state['pending'] = True
            return True
    
    def _key_released(self, key_name: str):
        """Mark key as released."""
        if key_name in self._key_held:
            self._key_held[key_name]['pending'] = False

    def is_cell_blocked(self, row: int) -> bool:
        """Check if cell is blocked (WIN/LOSE)."""
        home, away = self.get_current_odds(row)
        # Check both values
        home_str = str(home).strip().upper() if home else ""
        away_str = str(away).strip().upper() if away else ""
        return home_str in {'WIN', 'LOSE'} or away_str in {'WIN', 'LOSE'}
    
    def previous_odds_home(self) -> bool:
        """Decrease home odds (PreviousOddsHome)."""
        row = self.get_row_for_current_map()
        
        # Check for WIN/LOSE
        if self.is_cell_blocked(row):
            home, away = self.get_current_odds(row)
            print(f"[BLOCKED] Map {self._current_map}: Cell locked (WIN/LOSE): Home={home}, Away={away}")
            return False
        
        current, _ = self.get_current_odds(row)
        
        if current is None:
            print(f"[X] Could not read M{row}")
            return False
        
        idx = self._find_odds_index(current, self._odds_home)
        if idx < 0:
            print(f"[X] Value {current} not found in ODDSHOME")
            return False
        
        if idx <= 0:
            print(f"[!] Map {self._current_map}: Already at minimum ({current})")
            return False
        
        new_value = self._odds_home[idx - 1]
        
        # Block WIN/LOSE - only manual input allowed
        if str(new_value).upper() in {'WIN', 'LOSE'}:
            print(f"[BLOCKED] Map {self._current_map}: Cannot set {new_value} via hotkey (manual only)")
            return False
        
        self._ws.Cells(row, 13).Value = new_value
        
        new_home, new_away = self.get_current_odds(row)
        print(f"[-] Map {self._current_map} (row {row}): {current} -> {new_value} | Away: {new_away}")
        return True
    
    def next_odds_home(self) -> bool:
        """Increase home odds (NextOddsHome)."""
        row = self.get_row_for_current_map()
        
        # Check for WIN/LOSE
        if self.is_cell_blocked(row):
            home, away = self.get_current_odds(row)
            print(f"[BLOCKED] Map {self._current_map}: Cell locked (WIN/LOSE): Home={home}, Away={away}")
            return False
        
        current, _ = self.get_current_odds(row)
        
        if current is None:
            print(f"[X] Could not read M{row}")
            return False
        
        idx = self._find_odds_index(current, self._odds_home)
        if idx < 0:
            print(f"[X] Value {current} not found in ODDSHOME")
            return False
        
        if idx >= len(self._odds_home) - 1:
            print(f"[!] Map {self._current_map}: Already at maximum ({current})")
            return False
        
        new_value = self._odds_home[idx + 1]
        
        # Block WIN/LOSE - only manual input allowed
        if str(new_value).upper() in {'WIN', 'LOSE'}:
            print(f"[BLOCKED] Map {self._current_map}: Cannot set {new_value} via hotkey (manual only)")
            return False
        
        self._ws.Cells(row, 13).Value = new_value
        
        new_home, new_away = self.get_current_odds(row)
        print(f"[+] Map {self._current_map} (row {row}): {current} -> {new_value} | Away: {new_away}")
        return True
    
    def click_suspend_button(self) -> bool:
        """Click CurrentMapSuspend button (toggle suspend/trade), then auto-send update."""
        try:
            ole = self._ws.OLEObjects('CurrentMapSuspend')
            btn = ole.Object
            old_caption = btn.Caption
            btn.Value = not btn.Value  # Toggle = single click
            new_caption = btn.Caption
            print(f"[SUSPEND] {old_caption} -> {new_caption}")
            
            # Auto-send update after 100ms
            time.sleep(0.1)
            self.click_send_update_button()
            
            return True
        except Exception as e:
            print(f"[X] Suspend button error: {e}")
            return False
    
    def click_send_update_button(self) -> bool:
        """Click Send Update button in Add-in panel (via PostMessage, no cursor move)."""
        try:
            # Find Excel window
            excel_hwnd = win32gui.FindWindow('XLMAIN', None)
            if not excel_hwnd:
                print("[X] Excel window not found")
                return False
            
            # Find ExcelTradingAddIn WebView
            addin_hwnd = None
            def find_addin(hwnd, _):
                nonlocal addin_hwnd
                title = win32gui.GetWindowText(hwnd)
                if 'ExcelTradingAddIn' in title:
                    addin_hwnd = hwnd
                    return False
                return True
            
            win32gui.EnumChildWindows(excel_hwnd, find_addin, None)
            
            if not addin_hwnd:
                print("[X] Add-in panel not found")
                return False
            
            # Send Update button position (relative to panel)
            btn_x = 55
            btn_y = 280
            
            # Send click via PostMessage (no cursor movement)
            lParam = win32api.MAKELONG(btn_x, btn_y)
            win32gui.PostMessage(addin_hwnd, win32con.WM_LBUTTONDOWN, win32con.MK_LBUTTON, lParam)
            time.sleep(0.05)
            win32gui.PostMessage(addin_hwnd, win32con.WM_LBUTTONUP, 0, lParam)
            
            print("[UPDATE] Clicked Send Update button")
            return True
        except Exception as e:
            print(f"[X] Send Update error: {e}")
            return False
    
    def show_status(self):
        """Show current status."""
        # Update max_maps in case template changed
        self._update_max_maps()
        
        print("\n" + "="*50)
        print("Excel Odds Hotkey Controller - Status")
        print("="*50)
        print(f"Workbook: {self._wb.Name}")
        print(f"Template: {self._get_template_name()}")
        print(f"Current map: {self.read_current_map()} (max: {self._max_maps})")
        print()
        for map_num, row in MAP_WINNER_ROWS.items():
            if map_num > self._max_maps:
                continue  # Don't show maps beyond limit
            home, away = self.get_current_odds(row)
            marker = ">>>" if map_num == self._current_map else "   "
            blocked = " [BLOCKED]" if self.is_cell_blocked(row) else ""
            print(f"{marker} Map {map_num} (row {row}): Home={home}, Away={away}{blocked}")
        print("="*50)
        print("Hotkeys: Numpad- (prev), Numpad+ (next), Numpad0 (update), Numpad1 (suspend)")
        print("         F21 (suspend+update), F22 (update), F23 (prev), F24 (next), Ctrl+Esc (exit)")
        print("Map selection synced from Odds Board (no manual override)")
        print()
    
    # Hotkey handlers - only add command to queue!
    def on_hotkey_prev(self):
        """Handler for Numpad- / F23."""
        self._command_queue.put('prev')
    
    def on_hotkey_next(self):
        """Handler for Numpad+ / F24."""
        self._command_queue.put('next')
    
    def on_hotkey_suspend(self):
        """Handler for Numpad1 - suspend current map."""
        self._command_queue.put('suspend')
    
    def on_hotkey_send_update(self):
        """Handler for Numpad0 - send update."""
        self._command_queue.put('send_update')
    
    def on_hotkey_exit(self):
        """Handler for Ctrl+Esc."""
        self._running = False
        self._command_queue.put('exit')
    
    def process_commands(self):
        """Process commands from queue (called in main thread)."""
        try:
            while True:
                cmd = self._command_queue.get_nowait()
                # Handle both tuple and string commands
                # Format: cmd or (cmd,) or (cmd, key_name) for hold-aware commands
                if isinstance(cmd, tuple):
                    cmd_name = cmd[0]
                    key_name = cmd[1] if len(cmd) > 1 else None
                else:
                    cmd_name = cmd
                    key_name = None
                
                if cmd_name == 'prev':
                    # For manual keys with hold tracking
                    if key_name and not self._check_key_hold_allowed(key_name):
                        continue  # Skip - waiting for odds change
                    self.previous_odds_home()
                elif cmd_name == 'next':
                    if key_name and not self._check_key_hold_allowed(key_name):
                        continue
                    self.next_odds_home()
                elif cmd_name == 'key_up':
                    # Key released - mark in state
                    if key_name:
                        self._key_released(key_name)
                elif cmd_name == 'suspend':
                    self.click_suspend_button()
                elif cmd_name == 'send_update':
                    self.click_send_update_button()
                elif cmd_name == 'exit':
                    pass  # Just exit loop
        except Empty:
            pass  # Queue empty - normal
    
    def run(self):
        """Start hotkey controller."""
        print("\n" + "="*50)
        print("Excel Odds Hotkey Controller")
        print("="*50)
        
        if not self.connect():
            print("Failed to connect to Excel. Make sure Excel is open.")
            return
        
        print()
        print("Hotkeys active:")
        print("  Numpad-  -> Decrease Home odds (PreviousOddsHome)")
        print("  Numpad+  -> Increase Home odds (NextOddsHome)")
        print("  Numpad0  -> Send Update (Add-in)")
        print("  Numpad1  -> Suspend current map")
        print("  F21      -> Suspend + Update (auto mode)")
        print("  F22      -> Send Update (auto confirm)")
        print("  F23      -> Decrease (external trigger)")
        print("  F24      -> Increase (external trigger)")
        print("  Ctrl+Esc -> Exit (blocks Windows Start menu)")
        print()
        print(f"Template: {self._get_template_name()}")
        print(f"Current map: {self.read_current_map()} (max: {self._max_maps})")
        print("Waiting for hotkeys...")
        print()
        
        # ============================================
        # COMBINED HOTKEY HOOK - handles numpad (by scan code) and F-keys (by name)
        # Scan codes: Numpad0=82, Numpad1=79, Numpad-=74, Numpad+=78
        # Regular keys have different scan codes (0=11, 1=2, -=12, +=13)
        # ============================================
        NUMPAD_SCAN_CODES = {
            82: 'numpad0',   # Numpad0
            79: 'numpad1',   # Numpad1
            74: 'numpad_minus',  # Numpad-
            78: 'numpad_plus',   # Numpad+
        }
        
        def on_hotkey_hook(e):
            """Combined hook for numpad keys (by scan code) and F-keys (by name)."""
            
            # Handle NUMPAD keys by scan code (to distinguish from regular keys)
            if e.scan_code in NUMPAD_SCAN_CODES:
                key_name = NUMPAD_SCAN_CODES[e.scan_code]
                
                if e.event_type == 'down':
                    if key_name == 'numpad0':
                        self._command_queue.put('send_update')
                    elif key_name == 'numpad1':
                        self._command_queue.put('suspend')
                    elif key_name == 'numpad_minus':
                        self._command_queue.put(('prev', 'num_minus'))
                    elif key_name == 'numpad_plus':
                        self._command_queue.put(('next', 'num_plus'))
                elif e.event_type == 'up':
                    if key_name == 'numpad_minus':
                        self._command_queue.put(('key_up', 'num_minus'))
                    elif key_name == 'numpad_plus':
                        self._command_queue.put(('key_up', 'num_plus'))
                
                # Suppress numpad keys (return False to block propagation)
                return False
            
            # Handle F21-F24 keys by name
            # F23/F24 track press/release for hold prevention
            if e.name == 'f23':
                if e.event_type == 'down':
                    self._command_queue.put(('prev', 'f23'))
                else:
                    self._command_queue.put(('key_up', 'f23'))
            elif e.name == 'f24':
                if e.event_type == 'down':
                    self._command_queue.put(('next', 'f24'))
                else:
                    self._command_queue.put(('key_up', 'f24'))
            elif e.name == 'f21':
                if e.event_type == 'down':
                    self._command_queue.put(('suspend',))
            elif e.name == 'f22':
                if e.event_type == 'down':
                    self._command_queue.put(('send_update',))
            
            # Allow all other keys to pass through
            return True
        
        keyboard.hook(on_hotkey_hook, suppress=True)
        
        keyboard.add_hotkey('ctrl+esc', self.on_hotkey_exit, suppress=True)
        
        # Write initial status
        self.write_status()
        last_status_write = time.time()
        
        try:
            # Main loop - process commands in main thread
            while self._running:
                self.process_commands()
                # Periodic status write (every ~1s)
                now = time.time()
                if now - last_status_write >= 1.0:
                    self.write_status()
                    last_status_write = now
                time.sleep(0.05)  # 50ms polling
        except KeyboardInterrupt:
            print("\nExit by Ctrl+C...")
        finally:
            print("Shutting down...")
            keyboard.unhook_all()
            self.disconnect()
    
    def disconnect(self):
        """Disconnect from Excel."""
        try:
            if self._xl:
                self._xl.Interactive = True
                self._xl.ScreenUpdating = True
            self._ws = None
            self._wb = None
            self._xl = None
            self._connected = False
            pythoncom.CoUninitialize()
        except:
            pass


def main():
    controller = ExcelOddsHotkeyController()
    controller.run()


if __name__ == "__main__":
    main()
