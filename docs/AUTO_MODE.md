# Auto Mode (Auto Trading) – How It Works

This document describes the **refactored** Auto Mode implementation in OddsMoni.

Auto Mode is an **odds alignment loop**: it continuously compares a *reference price* (MID) with a *target price* (Excel odds or DS odds) and sends hotkey-style commands to adjust the target until it matches the reference within a configured tolerance.

> Note: Auto Mode aligns only the **min side** (the side with the lower MID odds). This is an intentional design choice.

---

## 0) Architecture Overview (Implemented)

The Auto Mode has been split into **ES modules** under `src/renderer/auto/`. This modular structure replaces the previous scattered implementation across `auto_core.js`, `auto_hub.js`, and `auto_trader.js`.

### 0.1 Key Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `OddsStore` | `odds-store.js` (~130 lines) | Subscribes to OddsCore, tracks all broker odds, derives MID/ARB |
| `GuardSystem` | `guard-system.js` (~100 lines) | Unified guard logic with priority: Excel > Market > Frozen > NoMID > ARB |
| `AlignEngine` | `align-engine.js` (~85 lines) | Pure function: computes action based on MID vs target, manages cooldowns |
| `AutoCoordinator` | `auto-coordinator.js` (~610 lines) | Main coordinator: state machine, step loop, suspend/resume logic |
| `Constants` | `constants.js` (~90 lines) | REASON, STATE, MODE, DEFAULTS, KEYS, REASON_LABELS |
| `Loader` | `loader.js` (~175 lines) | Entry point: imports modules, wires them, registers globals, compat shims (AutoHub), UI init |

### 0.2 State Machine

```
        ┌─────────┐
        │  IDLE   │◄────── disable() / guard hard block
        └────┬────┘
             │ enable() + canTrade
             ▼
        ┌─────────┐
        │ALIGNING │◄────── startAlignment()
        └────┬────┘
             │ finishAlignment(success)
             ▼
        ┌─────────┐
        │ TRADING │──────► step() loop runs here
        └─────────┘
```

### 0.3 Signal Sender Architecture

**Critical**: Only the stats_panel window sends signals to prevent duplicates.

```javascript
const isStatsPanel = locationHref.includes('stats_panel.html');
const isSignalSender = isStatsPanel;
```

- `sendKeyPress()` and `sendSignal()` only execute if `isSignalSender = true`
- Other windows (settings, etc.) only display state, don't control Auto
- OddsStore reactive subscription only runs for signal sender

### 0.4 User vs Auto Suspend

The system distinguishes between **user-initiated** and **auto-initiated** suspends:

| Type | Trigger | `userSuspended` | `userWanted` | Resume |
|------|---------|-----------------|--------------|--------|
| User suspend | User presses suspend hotkey | `true` | `true` | Auto resumes when user lifts suspend (frozen → false) |
| User disable | User presses F1/Numpad5 to turn off | `false` | `false` | User must press F1/Numpad5 again |
| Auto suspend | ARB spike, etc. | `false` | `true` | Auto resumes when condition clears |

**Key behaviors:**
- When user suspends during active Auto → Auto **pauses** (doesn't send duplicate signal)
- When user lifts suspend → Auto **resumes** (doesn't send duplicate signal)
- When user presses F1/Numpad5 while paused → Auto **disables** completely
- `userSuspended` flag is cleared when Auto is disabled

### 0.5 Guard System Priority

Guards are checked in order, first match wins:

1. **Excel Unknown** (hard block) - Excel status not yet known
2. **Excel Installing** (hard block) - Excel script being installed
3. **Excel Starting** (hard block) - Excel script starting up
4. **Excel Off** (hard block) - Excel script not running
5. **DS Not Connected** (hard block, DS mode only) - Extension not connected
6. **Map Mismatch** (hard block, Excel mode only) - Script map ≠ board map
7. **Excel Frozen** (soft suspend, user-initiated) - User pressed suspend in Excel
8. **No MID** (hard block) - Cannot start Auto without MID
9. **ARB Spike** (soft suspend) - Arbitrage opportunity detected

**Hard block** = Cannot enable Auto, must wait for condition to clear
**Soft suspend** = Auto pauses, resumes automatically when condition clears

### 0.6 Cooldown System

To prevent rapid suspend/resume cycling:

```javascript
const SUSPEND_RESUME_COOLDOWN_MS = 3000;
let lastSuspendTs = 0;
let lastResumeTs = 0;
```

- After suspend: wait 3 seconds before allowing resume
- After resume: wait 3 seconds before allowing suspend (unless user-initiated)

### 0.7 File Structure (Current)

```
src/renderer/
├── auto/
│   ├── loader.js             # Entry point, wiring, compat shims (~175 lines)
│   ├── constants.js          # REASON, STATE, MODE, DEFAULTS, KEYS (~90 lines)
│   ├── odds-store.js         # OddsStore — reactive odds aggregator (~130 lines)
│   ├── guard-system.js       # GuardSystem — guard logic (~100 lines)
│   ├── align-engine.js       # AlignEngine — alignment actions & cooldowns (~85 lines)
│   └── auto-coordinator.js   # AutoCoordinator — state machine (~610 lines)
└── core/
    └── odds_core.js          # OddsCore (unchanged)

src/main/
├── main.js                   # Hotkey handlers, broadcasts 'auto-toggle-all'
└── modules/
    ├── hotkeys/index.js      # F1 handler
    └── ipc/settings.js       # Auto settings persistence
```

### 0.8 Main Process Integration

Main process handles:
- **Hotkeys**: F1 (window-level), Numpad5 (global)
- **Broadcast**: `auto-toggle-all` event to all renderer windows
- **Key injection**: F21/F22 via PowerShell SendInput

**Important**: Main process does NOT track Auto state. Renderer is the source of truth.

```javascript
// main.js - toggleAutoState()
function toggleAutoState() {
  // Just broadcast toggle, don't track state
  // Renderer handles toggle logic (enable vs disable)
  broadcastToAllViews('auto-toggle-all');
}
```

---

## 1) DS Auto Mode

When Excel is not available, Auto can work directly with the DS extension:
- Enable via Settings → Auto Odds → "DS Auto Mode" checkbox
- Requires DS extension connected (green status indicator)
- Compares MID (from brokers) with DS odds
- Sends `adjust-up`/`adjust-down` + `commit` commands to extension via WebSocket bridge

### DS Auto Commands
| Command | Action |
|---------|--------|
| `adjust-up` | Increase DS odds |
| `adjust-down` | Decrease DS odds |
| `commit` | Confirm current DS odds |
| `suspend` | Suspend DS trading |
| `trade` | Execute trade |

---

## 2) Settings (electron-store)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `autoTolerancePct` | number | 2 | Tolerance threshold (%) |
| `autoSuspendThresholdPct` | number | 10 | Auto-suspend on large diff (%) |
| `autoBurstLevels` | array | [1,2,3] | Burst pulse configuration |
| `dsAutoModeEnabled` | boolean | false | Enable DS Auto Mode |

---

## 3) Key Injection (Main Process)

**File:** `src/main/modules/ipc/autoPress.js`

Virtual key injection via PowerShell `SendInput` script (`sendKeyInject.ps1`):
- F21 = adjust down
- F22 = adjust up
- F23 = commit
- F24 = trade

Features:
- Dedup logic prevents rapid duplicate presses
- Auto-confirm after key injection
- No terminal window flash (hidden PowerShell)
