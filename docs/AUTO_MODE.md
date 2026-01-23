# Auto Mode (Auto Trading) – How It Works

This document describes the current Auto Mode implementation in OddsMoni and notes planned refactor changes where relevant.

Auto Mode is an **odds alignment loop**: it continuously compares a *reference price* (MID) with a *target price* (Excel odds or DS odds) and sends hotkey-style commands to adjust the target until it matches the reference within a configured tolerance.

> Note: Auto Mode currently aligns only the **min side** (the side with the lower MID odds). This is an intentional design choice in the current logic.

---

## 0) Architecture Review & Refactor Proposal

This section summarizes the problems in the current implementation and proposes a clean architecture for a full rewrite.

### 0.1 Current Problems ("костыли")

#### A. AutoHub is a 1050+ line monolith

`auto_hub.js` mixes too many responsibilities:

- Odds subscription (OddsCore bridge)
- Excel process status tracking
- DS Auto Mode (separate step loop)
- Three overlapping guard systems: `applyExcelGuard()`, `applyMarketGuard()`, `maybeAutoSuspendByDiff()`
- Alignment-before-resume flow (separate timer, counter, flags)
- Script/board map tracking
- 12+ settings channels
- Engine lifecycle + IPC broadcasting

**Result**: hard to reason about, easy to break.

#### B. AutoCore has mixed concerns

`auto_core.js` combines:

- State machine (active/waiting)
- Multiple cooldown systems (fire cooldown, pulse cooldown, adaptive wait)
- Key press scheduling
- Excel change detection + failure counter

These should be separate, composable pieces.

#### C. Duplicated state management

- `userWanted`, `lastDisableReason` tracked in both AutoCore and AutoHub
- localStorage persistence scattered across files
- `active` state synced via multiple IPC channels with subtle differences

#### D. Guard systems are tangled

Three separate guard functions that overlap:

| Guard | Trigger | Suspend reason | Resume condition |
|-------|---------|----------------|------------------|
| `applyExcelGuard` | `ex.frozen` | `excel-suspended` | `!ex.frozen` |
| `applyMarketGuard` | `!hasMid` or `arbProfitPct >= shockThreshold` | `no-mid` / `arb-spike` | MID restored or ARB gone |
| `maybeAutoSuspendByDiff` | `diffPct >= autoSuspendThresholdPct` | `diff-suspend` | `diffPct < threshold/2` |

Each has its own suspend/resume logic, F21 signaling, and IPC broadcast.

#### E. DS Auto Mode is tacked on

- Separate step loop (`dsAutoStep`) runs parallel to main engine
- Different timing constants (`dsAutoStepMs`, `dsAutoFireCooldownMs`)
- Duplicates min-side logic from AutoCore
- Not unified with Excel mode

#### F. IPC channel explosion

- 5+ broadcast channels for "Auto state": `auto-state-set`, `auto-active-set`, `auto-toggle-all`, `auto-set-all`, `auto-disable-all`
- Legacy handlers kept "for compatibility"
- Settings sync via 12+ individual channels

#### G. auto_trader.js contains business logic

- `computeWhyLines()` interprets engine state and guard reasons
- Reason code mapping duplicated
- Should be pure UI binding

---

### 0.2 Proposed Clean Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MAIN PROCESS                                │
├─────────────────────────────────────────────────────────────────────┤
│  AutoController                                                     │
│  ├─ owns global Auto ON/OFF state                                   │
│  ├─ handles hotkeys (F1/Numpad5)                                    │
│  ├─ executes key injection (F21-F24)                                │
│  └─ single IPC channel: 'auto-state' { active, mode, reason }       │
│                                                                     │
│  SettingsStore                                                      │
│  └─ single IPC channel: 'auto-settings' { tolerance, interval, … }  │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ IPC
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         RENDERER                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐             │
│  │  OddsStore   │   │  GuardSystem │   │  AlignEngine │             │
│  │  (records,   │──▶│  (Excel,     │──▶│  (state      │             │
│  │   derived)   │   │   Market,    │   │   machine,   │             │
│  └──────────────┘   │   Diff)      │   │   pulses,    │             │
│                     └──────────────┘   │   timing)    │             │
│                                        └──────────────┘             │
│                              │                │                     │
│                              ▼                ▼                     │
│                     ┌─────────────────────────────────┐             │
│                     │       AutoCoordinator           │             │
│                     │  ├─ single source of truth      │             │
│                     │  ├─ mode: 'excel' | 'ds'        │             │
│                     │  ├─ state: idle|aligning|trading│             │
│                     │  └─ emits: { state, reason }    │             │
│                     └─────────────────────────────────┘             │
│                                        │                            │
│                                        ▼                            │
│                     ┌─────────────────────────────────┐             │
│                     │        AutoUI (pure view)       │             │
│                     │  ├─ button, dots, status text   │             │
│                     │  └─ no business logic           │             │
│                     └─────────────────────────────────┘             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 0.3 Module Breakdown (Refactored)

#### Main Process

| Module | Responsibility |
|--------|----------------|
| `AutoController` | Global ON/OFF state, hotkeys, key injection, single `auto-state` channel |
| `SettingsStore` | Persist & broadcast settings via single `auto-settings` channel |

#### Renderer

| Module | Responsibility |
|--------|----------------|
| `OddsStore` | Subscribe to OddsCore, expose `records`, `derived` (MID, ARB) |
| `GuardSystem` | Unified guard logic with priority: Excel > Market > Diff |
| `AlignEngine` | Pure state machine: idle → aligning → trading; handles pulses, cooldowns |
| `AutoCoordinator` | Glue: reads OddsStore, applies GuardSystem, drives AlignEngine |
| `AutoUI` | Pure view binding: button, dots, reason badge, tooltip |

---

### 0.4 Key Design Decisions

1. **Single state channel**: `auto-state` replaces 5+ legacy channels.

2. **Unified guard system**: One function that returns `{ canTrade: bool, reason: string | null }` with priority order.

3. **AlignEngine is pure**: No IPC, no DOM, no OddsCore dependency. Receives `{ mid, target, tolerance }` and returns `{ action, key, pulses }`.

4. **Mode is explicit**: `mode: 'excel' | 'ds'` is a first-class property, not a bolt-on.

5. **Alignment is a state, not a side-effect**: `state: 'idle' | 'aligning' | 'trading'` with clear transitions.

6. **Settings are batched**: Single `auto-settings` object replaces 12+ individual channels.

7. **Reason codes are centralized**: One enum/map in `GuardSystem`, UI just displays.

---

### 0.5 Migration Path

1. **Phase 1**: Create new modules (`OddsStore`, `GuardSystem`, `AlignEngine`) alongside old code.
2. **Phase 2**: Wire `AutoCoordinator` to new modules, keep old IPC for backward compat.
3. **Phase 3**: Migrate UI to new `AutoUI`, remove legacy handlers.
4. **Phase 4**: Remove old `auto_core.js`, `auto_hub.js`, simplify main-process IPC.

---

### 0.6 File Structure (Proposed)

```
src/renderer/
├── auto/
│   ├── index.js              # exports AutoCoordinator
│   ├── OddsStore.js          # reactive odds state
│   ├── GuardSystem.js        # unified guards
│   ├── AlignEngine.js        # pure state machine
│   ├── AutoCoordinator.js    # glue module
│   └── constants.js          # reason codes, defaults
├── ui/
│   └── auto_ui.js            # pure view binding
└── core/
    └── (delete auto_core.js, auto_hub.js after migration)

src/main/modules/
├── auto/
│   ├── AutoController.js     # state + hotkeys + key injection
│   └── SettingsStore.js      # persistence
└── ipc/
    └── auto.js               # single 'auto-state' + 'auto-settings' handlers
```

---

## 1) High-level Architecture

Auto Mode is split across **main process** (Electron) and **renderer** (board / embedded stats views).

### Main process responsibilities

- Owns the **global Auto ON/OFF state** and broadcasts it via IPC.
- Handles **hotkeys**:
  - `F1` (window-focused) toggles Auto.
  - `Numpad5`/`Num5` (global) toggles Auto even when the app is not focused.
- Executes **key injection** (`F21`/`F22`/`F23`/`F24`) via a PowerShell `SendInput` helper.
- Provides IPC endpoints for Auto settings persistence (electron-store) and for DS extension bridge.

Key main-process files:

- src/main/main.js (auto state + hotkeys + `send-auto-press` IPC)
- src/main/modules/ipc/settings.js (Auto settings persistence + live broadcast)
- src/main/modules/hotkeys/index.js (window-level hotkey manager)
- src/main/modules/ipc/extensionBridge.js (DS Auto Mode IPC)

### Renderer responsibilities

- `AutoHub` coordinates data, guards, and per-view engine wiring.
- `AutoCore` is the engine that decides when/how to press keys.
- `auto_trader.js` binds UI elements (Auto button, dots, tooltip).
- Settings UI uses `settings/auto-settings.js` to push config into the app.

Key renderer files:

- src/renderer/core/auto_hub.js
- src/renderer/core/auto_core.js
- src/renderer/scripts/auto_trader.js
- src/renderer/scripts/settings/auto-settings.js

---

## 2) Data Model & Inputs

Auto logic operates on **normalized records** produced by the odds aggregation layer.

### MID (reference)

- MID is derived from bookmaker records by `OddsCore.computeDerivedFrom(records)`.
- `AutoHub` uses `state.derived.mid` when `state.derived.hasMid === true`.

### Excel record (target in “normal” mode)

- In Excel mode, Auto aligns **Excel odds** to MID.
- AutoHub accesses Excel record as `state.records['excel']`.
- Excel record can be marked `frozen` (suspended) which triggers Auto pause.

### DS record (target in “DS Auto Mode”)

- When DS Auto Mode is enabled, Auto aligns **DS odds** to MID and sends commands to the Edge extension.
- DS record is taken from `state.records['ds']`.
- DS record can be `frozen` (suspended) which pauses DS Auto.

---

## 3) User Controls

### 3.1 Auto toggle

Users can toggle Auto in three ways:

- Click the Auto button in the board view / embedded stats.
- Press `F1` while the app window is focused.
- Press `Numpad5` globally (works even without focus).

The toggle ultimately becomes a **main-process broadcast**:

- IPC channel: `auto-state-set` with payload `{ active, userWanted, manual }`

Renderer-side `AutoHub` listens to that and decides whether Auto can actually enable.

### 3.2 “Paused but user wanted ON”

When Auto is disabled by a **system guard** (no MID, arb spike, diff suspend, Excel suspended, etc.) it may remain in a **waiting** state:

- `engine.state.active === false`
- `engine.state.userWanted === true`
- `engine.state.lastDisableReason !== 'manual'`

UI shows this as a special “waiting” state (yellow).

Clicking Auto while in that waiting state is treated as “turn OFF completely” (clears `userWanted`).

Planned refactor note:

- Hotkeys (`F1`, `Numpad5`) must behave the same as clicking the Auto button: if Auto is in a “paused/waiting” state, toggling should **fully disable** Auto (clear `userWanted`) rather than just flipping `active`.

---

## 4) Core Algorithm (Excel Mode)

Implemented in `AutoCore.createAutoEngine()`.

### 4.1 Preconditions

Each engine step requires:

- `tolerancePct` is a number
- `stepMs` is a number
- `adaptive` is boolean
- `burstLevels` is a non-empty array

If config is missing, engine shows status like:

- `Set Auto config in Settings`

If input data is missing:

- `Нет данных`

### 4.2 Min-side selection

Auto aligns only the **min side**:

- `sideToAdjust = (mid[0] <= mid[1]) ? 0 : 1`

### 4.3 Diff calculation

Diff is percent distance between target (Excel) and reference (MID):

- `diffPct = |ex[sideToAdjust] - mid[sideToAdjust]| / mid[sideToAdjust] * 100`

If `diffPct <= tolerancePct`, engine is “Aligned” and does nothing.

### 4.4 Direction

Direction is based on whether Excel is below or above MID:

- If `ex < mid` → `direction = 'raise'`
- Else → `direction = 'lower'`

### 4.5 Burst pulses

Planned refactor target (simplified):

- Burst is always an integer in range **1..3**.
- Burst is computed from `diffPct` using a single step parameter (instead of multiple burst levels).

Suggested formula:

- `burstPulses = clamp(1, 3, max(1, floor(diffPct / pulseStepPct)))`

Where:

- `pulseStepPct` is configurable (planned range **8%..15%**).
- Example: with `pulseStepPct = 8`, `diffPct = 16%` ⇒ `burstPulses = 2`.

Timing / overload protection:

- Pulses are spaced out by a fixed delay to avoid overloading Excel processing.
- Planned value: **500ms between pulses**.

### 4.6 Key mapping (directional keys)

The engine emits directional presses with `F23` / `F24` and confirms with `F22`.

Current mapping used by AutoCore:

- For `sideToAdjust === 0`:
  - `raise` → `F24`
  - `lower` → `F23`
- For `sideToAdjust === 1`:
  - `raise` → `F23`
  - `lower` → `F24`

This mapping is tailored to the current external automation/hotkey layer.

### 4.7 Confirm

AutoCore schedules `F22` itself after pulses:

- confirm delay = `pulseGapMs*(pulses-1) + confirmBase`
- In current config `confirmBase` defaults to 100ms.

Important:

- AutoCore sends its presses with `noConfirm:true` so the main-process auto-confirm feature does NOT duplicate confirms.

Planned refactor target:

- Add a confirm retry: if after **3 seconds** the odds still do not match DS (beyond tolerance), send an additional `F22` confirm.
  - Goal: reduce “missed confirm” cases.
  - The “still not match DS” check should be rate-limited so it does not spam `F22`.

### 4.8 Cooldowns / adaptive waiting

There are three independent “wait” mechanisms:

- **Fire cooldown**: prevents repeating the same side+key too frequently.
  - `fireCooldownMs` defaults to 900ms.

- **Pulse cooldown (Excel change observation)**: after firing N pulses, wait for Excel odds to change approximately N times.
  - Needs `pulseCooldownChangesNeeded = pulses`.
  - Times out after `pulseCooldownMaxDelayMs` (default 1000ms).

- **Adaptive mode waiting** (current implementation): wait for Excel odds to change after an adjustment.
  - It polls until Excel snapshot changes or `maxAdaptiveWaitMs` (default 1600ms).
  - If Excel does not change within the timeout, it increments `excelNoChangeCount`.
  - After `maxExcelNoChangeAttempts` (currently 2), Auto is suspended with reason `excel-no-change`.

Planned refactor note (key-repeat throttling):

- Today, limiting can be unreliable because Windows key repeat can generate many signals if a key is held.
- The goal is to **throttle** the effective processing rate to prevent a backlog/queue in Excel (and in the Python/automation chain).
- This may require changes on the Python side (or wherever the “Excel command queue” is actually handled) so repeated signals are collapsed or ignored while a previous one is still being processed.

---

## 5) Guards / Suspension Logic (AutoHub)

AutoHub applies several “system guards” around the engine.

### 5.1 Excel extractor availability (hard block)

Auto is blocked if Excel mode is active but the Python Extractor is not ready:

- Status unknown (`excel-unknown`)
- Not running (`excel-off`)
- Starting (`excel-starting`)
- Installing deps (`excel-installing`)

In this case AutoHub will refuse enabling and UI shows “Auto: BLOCKED …”.

### 5.2 Map mismatch (hard block)

Auto is blocked if both script map and board map are known and they differ:

- `scriptMap !== boardMap`

Planned refactor clarification:

- If board is set to **Match**, Excel is treated as **Map 1** (no exception). In other words, Match maps to Excel map 1 for mismatch validation.

Reason code: `map-mismatch`.

### 5.3 Excel suspended (soft suspend)

If Excel record is marked `frozen` while Auto is active:

- Auto is turned OFF (systemSuspend)
- `userWanted` is preserved as `true`
- reason: `excel-suspended`

When Excel becomes unfrozen:

- Auto can resume automatically if `userWanted` was true and reason matches.

### 5.4 Market guard: no MID / ARB spike

AutoHub can suspend Auto when:

- **No MID** (if enabled):
  - Setting: `autoStopOnNoMid` (default true)
  - Reason: `no-mid`


Planned refactor target (ARB Spike):

- Instead of using `arbProfitPct`, detect a rapid odds move on any bookmaker.
- If within **1 second** a bookmaker’s odds jump by more than **80%**, Auto enters suspend.
  - (Exact definition should be explicit in code: per-side, per-market, or min-side only.)
- Resume condition: when bookmakers re-align such that the **min odds on one side** differ by less than **15%** (planned configurable parameter).

When conditions recover, AutoHub resumes **through an alignment stage** (see next).

### 5.5 Alignment before resume

When resuming after `no-mid` or `arb-spike`, AutoHub starts a special flow:

- Temporarily turns the engine ON
- Sets reason `aligning`
- Periodically checks if Excel is aligned to MID within tolerance
  - up to 30 attempts (~15s)
- If aligned: enters trading mode and sends `F21` with reason `market:resume`
- If it times out: forces resume anyway (`timeout-forced`)
- If alignment fails: suspends again (`align-failed`)

### 5.6 Diff-based auto suspend

Planned refactor target (reworked suspend-by-shock):

- The diff-based guard will be replaced.
- When bookmaker odds change sharply (but MID is available), Auto should:
  1) enter a temporary **Auto-suspend** state,
  2) run an alignment phase (bring target odds back to MID within tolerance),
  3) exit suspend automatically once stable/aligned.

Goal: protect from sudden market changes while still converging back to a safe aligned state.

### 5.7 F21 signaling

AutoHub can send `F21` as a “suspend/resume signal” to the external automation layer.

There is an internal debounce inside AutoHub (800ms).
The main process also adds global de-duplication:

- initial F21 de-dup window: 300ms
- retry F21 de-dup window: 400ms

Planned refactor target:

- If a suspend signal was sent but Excel did not apply it (for any reason), retry once after **1 second**.
- Apply the same rule for resume/un-suspend.
- Goal: protect against “missed signal” failures.

---

## 6) Target Selection: Excel vs DS

Planned refactor target:

- Excel and DS become two **mutually exclusive** mode buttons directly on the Odds Board.
- Clicking one makes it active (highlighted) and deactivates the other.
- This selection is removed from Settings.

In DS mode, DS replaces Excel as the target.

### Requirements (DS mode)

- DS mode selected on the board
- DS extension bridge connected
- Auto engine must be active (Auto ON)

### Algorithm

- Uses the same **min-side** logic as Excel mode.
- Uses `tolerancePct` from the shared engine (fallback 1% if missing).
- Computes diff between DS odds (target) and MID (reference).
- If diff > tolerance, sends one of:
  - `adjust-up` (raise)
  - `adjust-down` (lower)
- Then sends `commit` after 200ms.

Timing:

- DS step interval: 800ms
- DS command cooldown: 1200ms

Commands are sent via:

- IPC `ds-auto-command` (main process forwards to extension bridge)

---

## 7) Settings (Refactor Target)

Settings are stored in `electron-store` and broadcast live to all views.

### Core alignment settings

- `autoTolerancePct` (float, clamped **1..10**)
- `autoIntervalMs` (int, clamped 120..10000)

Planned refactor target:

- Adaptive mode becomes always-on and is removed from Settings.

### Burst / timing settings

Planned refactor target:

- Replace multi-level burst configuration with a single parameter:
  - `pulseStepPct` (int/float, clamped **8..15**) – every step adds one pulse (capped to 3).
- Keep pulse spacing as overload protection:
  - Planned: fixed **500ms** between pulses.

### Protection settings

- `autoSuspendThresholdPct` (int, default 40, clamped 15..80)
- `autoShockThresholdPct` (int, default 80, clamped 40..120)
- `autoStopOnNoMid` (bool, default true)
- `autoResumeOnMid` (bool, default true)

### DS Auto Mode

Planned refactor target:

- DS/Excel selection is removed from Settings and moved to the board UI.

---

## 8) IPC Channels (Most Relevant)

### Auto state

- `auto-state-set` (main → all) `{ active, userWanted?, manual? }`
- `auto-active-set` (broadcast helper; used to converge late-loaded views)
- `auto-state-get` (renderer → main) returns `{ active }`

### Auto settings live updates

Note:

- The list below reflects **current** IPC channels.
- Planned refactor removes several settings (and their update channels), e.g. multi-level burst config and the explicit adaptive toggle.

- `auto-tolerance-updated`
- `auto-interval-updated`
- `auto-adaptive-updated`
- `auto-burst-levels-updated`
- `auto-burst3-enabled-updated`
- `auto-fire-cooldown-updated`
- `auto-max-excel-wait-updated`
- `auto-pulse-gap-updated`
- `auto-suspend-threshold-updated`
- `auto-shock-threshold-updated`
- `auto-stop-no-mid-updated`
- `auto-resume-on-mid-updated`

Planned refactor target (reduced settings):

- Keep only the channels that correspond to the final Settings surface.
- Channel names are **suggested** (final names should match whatever is implemented in `src/main/modules/ipc/settings.js`).

- `auto-tolerance-updated`
- `auto-interval-updated`
- `auto-pulse-step-updated` (new; replaces burst levels and pulse gap settings)
- `auto-suspend-threshold-updated` (if kept)
- `auto-shock-threshold-updated` (if kept)
- `auto-stop-no-mid-updated`
- `auto-resume-on-mid-updated`

### Key injection

- `send-auto-press` (renderer → main, invoke)
- `auto-press` (main → views, broadcast as log/trace)

### DS bridge

- `ds-auto-mode-get` / `ds-auto-mode-set`
- `ds-auto-mode-updated`
- `ds-auto-command`
- `ds-connection-status`

---

## 9) Key Injection Pipeline (Main process)

The renderer calls `send-auto-press` with payload like:

- `{ side, key: 'F23'|'F24'|'F22'|'F21', direction, diffPct, noConfirm, retry }`

Main resolves to Windows virtual keys:

- `F21` → `0x84`
- `F22` → `0x85`
- `F23` → `0x86`
- `F24` → `0x87`

Then it:

- Broadcasts `auto-press` for visibility.
- Writes a file signal: `src/main/auto_press_signal.json` (for external AHK-style watchers).
- Executes `src/main/sendKeyInject.ps1` with the VK.

De-duplication:

- F21 initial/retry buckets (300/400ms windows)
- F23/F24/F22 near-simultaneous de-dup (25ms) to avoid double-sends from multiple sources.

Auto-confirm:

- If `noConfirm` is false and key is F23/F24, main schedules `F22` after 100ms.
- AutoCore normally sets `noConfirm:true` and schedules `F22` itself.

---

## 10) Practical “How To Use”

### Current behavior (today)

#### Excel-based Auto (typical)

1. Start the Python Excel Extractor (UI “S” / `F3`).
2. Ensure board map matches script map (avoid `map-mismatch`).
3. Configure Auto settings (Tolerance, Interval, Burst Levels, etc.).
4. Toggle Auto ON (button / `F1` / `Numpad5`).
5. Watch Auto status and reason badge if it pauses.

#### DS Auto Mode

1. Connect the Edge extension bridge.
2. Enable DS Auto Mode in Settings.
3. Toggle Auto ON.

### Planned refactor target

#### Excel-based Auto

1. Select **Excel** on the Odds Board (Excel and DS are mutually exclusive).
2. Start the Python Excel Extractor.
3. Ensure board map matches script map (`map-mismatch`).
4. Configure minimal Auto settings (Tolerance, Interval, Pulse Step).
5. Toggle Auto ON.

#### DS-based Auto

1. Connect the Edge extension bridge.
2. Select **DS** on the Odds Board.
3. Toggle Auto ON.

---

## 11) Refactor Notes (What To Preserve)

If you plan a full refactor, these behaviors are “contract-like” today:

- Single shared engine concept (board + embedded should stay in sync).
- System suspends preserve `userWanted` so Auto can resume.
- Guards are centralized in AutoHub (Excel suspended / no MID / ARB spike / diff-suspend).
- Alignment-before-resume flow (prevents resuming into a bad state).
- Key injection is centralized in main process with de-duplication.

Recommended refactor boundaries:

- Keep AutoCore as a pure state machine (no IPC, no DOM).
- Keep AutoHub as the only place that talks to OddsCore records and applies guards.
- Keep UI wiring (auto_trader.js) dumb and declarative.
