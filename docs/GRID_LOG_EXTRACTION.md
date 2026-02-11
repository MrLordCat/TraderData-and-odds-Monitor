# Grid Log Extraction — How It Works

Full pipeline for extracting live game stats from Grid (portal.grid.gg) for LoL, CS2, Dota 2.

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Grid (portal.grid.gg) — BrowserView in Electron         │
│                                                          │
│  Inject Bundle (5 scripts, executeJavaScript)            │
│  ┌────────────────────────────────────────────────┐      │
│  │ pako.min.js        — zlib decompression        │      │
│  │ inject-map.js      — roster/team mapping       │      │
│  │ inject-live-log.js — WebSocket intercept       │      │
│  │ inject-stats.js    — event parsing & stats     │      │
│  │ inject-spa-watch.js— URL change detection      │      │
│  └────────────────────────────────────────────────┘      │
│              │                                           │
│              │ window.postMessage / CustomEvent           │
│              ▼                                           │
│  statsContent.js (preload)                               │
│    ipcRenderer.send('lol-stats-raw', payload)            │
└──────────────┬───────────────────────────────────────────┘
               │ IPC
               ▼
┌──────────────────────────────────────────────────────────┐
│  Main Process                                            │
│  lolstats/index.js — createLolStatsModule()              │
│    handleRaw() → merge gameStats → emit to renderer      │
│              │                                           │
│              │ webContents.send('lol-stats-update')       │
│              ▼                                           │
│  stats_panel.js (renderer)                               │
│    renderLol() → ensureRows() → setBinary/setCount       │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Injection Pipeline

### 2.1 Bundle Assembly

`lolstats/index.js` → `buildBundle()` concatenates 5 files in order:
1. **Pako CDN fallback loader** — loads pako from CDN if local copy is corrupted
2. **pako.min.js** — zlib inflate for WebSocket binary frames
3. **inject-map.js** — parses roster/teams from Grid WebSocket
4. **inject-live-log.js** — intercepts WebSocket, decodes log entries
5. **inject-stats.js** — parses log text, builds per-game stats
6. **inject-spa-watch.js** — watches for URL changes (SPA navigation)

Bundle is injected via `view.webContents.executeJavaScript(bundle)`.

### 2.2 Re-injection Guard

Each script checks a flag (e.g. `window.__lolStatsInjected`) and exits early if already injected.

---

## 3. Inject Scripts (src/main/lolstats/inject/)

### 3.1 inject-map.js (~135 lines)

**Purpose:** Extract `{ playerNick → teamName }` mapping from Grid WebSocket.

**Mechanism:**
- Monkey-patches `WebSocket.prototype.send` to intercept connections
- Listens for messages with services `scoreboard`, `team`, `roster`, `color`
- Parses JSON with team arrays, extracts `teamName` + `players[].nick`
- Publishes mapping: `CustomEvent('lol-mapping-ready', { detail: {nick: teamName} })`
- Stores in `window.__lolPlayerToTeam` for debugging

**Grid data format:**
```json
{
  "service": "scoreboard",
  "body": [
    { "teamName": "T1", "players": [{"nick": "Faker"}, {"nick": "Zeus"}] },
    { "teamName": "Gen.G", "players": [{"nick": "Chovy"}, ...] }
  ]
}
```

### 3.2 inject-live-log.js (~45 lines)

**Purpose:** Intercept live event log from WebSocket and forward as DOM events.

**Mechanism:**
- Monkey-patches `WebSocket` constructor
- Listens for binary frames (`ArrayBuffer`/`Uint8Array`)
- Decompresses via `pako.inflate(arr, {to:'string'})` → JSON
- Extracts `sentenceChunks` (array of `{text}`) and `clockTime`
- Publishes: `CustomEvent('lol-live-log-update', { detail: { text, ts, raw } })`

**Raw Grid message format:**
```json
{
  "body": {
    "entryToAdd": {
      "sentenceChunks": [
        { "text": "Faker" },
        { "text": " killed " },
        { "text": "Chovy" }
      ],
      "clockTime": "12:34"
    }
  }
}
```

### 3.3 inject-stats.js (~485 lines)

**Purpose:** Main parser — builds per-game statistics from log events.

**Structure:**

#### Regex Patterns (lines 11-27)
| Regex | Log Format | Purpose |
|-------|------------|---------|
| `RX_GAME_START` | `Game 1 started` | Game start |
| `RX_SERIES_START` | `Series started` | Series start |
| `RX_SERIES_END` | `Series ended` | Series end |
| `RX_KILL` | `Faker killed Chovy` | Kill event |
| `RX_TOWER` | `... destroyed tower` | Tower destroyed |
| `RX_INHIB` | `... destroyed inhibitor/fortifier` | Inhibitor destroyed |
| `RX_BARON` | `... slaybaron` | Baron slain |
| `RX_DRAGON` | `... slaydragon` | Dragon slain |
| `RX_DRAKE` | `... slay*drake` | Drake (alt. format) |
| `RX_BANNED` | `... banned ...` | Champion banned |
| `RX_GAME_END` | `Game 1 ended` | Game end |
| `RX_GAME_WIN_SINGLE` | `T1 won Game 1` | Game winner |
| `RX_ROUND_WIN` | `NAVI won Round 1` | Round winner (CS2) |

#### makeStats() — per-game data structure
```javascript
{
  firstKill: null, firstKillAt: '',     // binary: teamName
  killCount: {},                         // count: { teamName: N }
  race5/10/15/20: null, raceNAt: '',    // binary: first to N kills
  firstTower: null, firstTowerAt: '',    // binary
  towerCount: {},                        // count
  firstInhibitor: null, ...              // binary
  inhibitorCount: {},                    // count
  firstBaron: null, ...                  // binary
  baronCount: {},                        // count
  dragonCount: {}, dragonTimes: {},      // count + timestamps
  quadra: null, quadraAt: '',            // binary (multi-kill)
  penta: null, pentaAt: '',              // binary (multi-kill)
  pistolRound1: null, pistolRound1At: '', // binary (CS2: Round 1 winner)
  pistolRound13: null, pistolRound13At: '', // binary (CS2: Round 13 winner)
  winner: null, winAt: ''                // game winner
}
```

#### Metric Types
- **Binary** — stores `teamName` (who achieved it first): `firstKill`, `race5`, `firstTower`, `pistolRound1`, etc.
- **Count** — stores `{ teamName: number }`: `killCount`, `towerCount`, `dragonCount`, etc.

#### handleEntry(detail, entryKey) — main handler
1. Joins `sentenceChunks[].text` into `head` string
2. Checks series/game start/end, ban phase
3. Detects winner: `RX_GAME_WIN_SINGLE`
4. Detects round wins (CS2): `RX_ROUND_WIN` — Round 1 → `pistolRound1`, Round 13 → `pistolRound13`
5. Resolves actor (first chunk) → maps to team via `playerToTeam`
6. Parses kills, towers, barons, dragons, multi-kills

#### Sound Emission
- `playSound(type, entryKey)` → `window.postMessage({ source: 'lol-sound-event', type })`
- **Burst detection:** 5+ events in 500ms = suppress (except `gameStart`)
- **Backlog protection:** sounds disabled for 2s after page load
- **Freshness check:** `entryKey` + `FRESH_EVENT_WINDOW_MS (3s)` — sound only plays if event arrived recently

#### publish() — data broadcast
```javascript
window.postMessage({
  source: 'lol-live-stats',
  team1Name, team2Name,
  playerTeams: Object.fromEntries(playerToTeam),
  gameStats    // full object { '1': {...}, '2': {...} }
}, '*');
```
Called via debounce (`PUBLISH_DEBOUNCE_MS = 120ms`).

### 3.4 inject-spa-watch.js (~25 lines)

**Purpose:** Detect SPA navigations (Grid is a single page app).

**Mechanism:**
- `setInterval(800ms)` checks `location.pathname + search + hash`
- On URL change → `postMessage({ type: 'restart_data_collection' })`
- inject-stats.js listens for this message and resets `gameStats`, `mappingReady`, etc.

### 3.5 pako.min.js

Zlib library (inflate). Used by inject-live-log.js to decompress binary WebSocket frames.

---

## 4. Preload — statsContent.js

**Bridge between inject scripts (page world) and Main Process (IPC).**

Key responsibilities:
- `__oddsMoniLolEmit(slot, data)` → `ipcRenderer.send('lol-stats-raw', { slot, data })`
- Listens for `window.message` with `source: 'lol-live-stats'` and `lol-sound-event`
- Forwards sound events: `ipcRenderer.send('lol-sound-event', type)`
- Injects CSS for Grid Light Theme (filter inversion + re-inversion for media)
- Exposes `desktopAPI` for theme support

---

## 5. Main Process — lolstats/index.js

**`createLolStatsModule(persist)`** — central module.

| Method | Purpose |
|--------|---------|
| `init(view, slot, emit)` | Injects bundle into view, stores emit callback |
| `reinject(view)` | Re-injects bundle (after reload) |
| `handleRaw(data)` | Merges incoming gameStats, detects winners, saves history |
| `snapshot()` | Returns current snapshot for initial send |
| `reset()` | Clears gameStats, broadcasts restart to all views |
| `dispose()` | Cleanup |

**Aggregation:** `handleRaw()` merges incoming `gameStats` with existing data (per-game merge), detects winners → records to history (max 200 games).

**Emit callback:** calls `sendFn({ ...aggregate, history })` → main process routes this to stats_panel via IPC.

---

## 6. Renderer — stats_panel.js

### 6.1 Game-Aware Metrics

```javascript
const GAME_METRICS = {
  lol: null,    // null = all metrics visible
  cs2: ['killCount', 'pistolRound1', 'pistolRound13'],
  dota2: null   // null = all metrics visible
};
```

`applyGameMetrics(game)` hides table rows not in the `allowed` list.

### 6.2 Metric Arrays

```javascript
BINARY_METRICS = ['firstKill','race5','race10','race15','race20','firstTower',
                  'firstInhibitor','firstBaron','quadra','penta',
                  'pistolRound1','pistolRound13'];

COUNT_METRICS = ['killCount','towerCount','inhibitorCount','baronCount','dragonCount'];

metricLabels = {
  firstKill: 'First Blood', killCount: 'Kills',
  race5-20: 'Race N',
  firstTower: 'First Tower', towerCount: 'Towers',
  firstInhibitor: 'First Inhib', inhibitorCount: 'Inhibitors',
  firstBaron: 'First Baron', baronCount: 'Barons',
  dragonCount: 'Dragons', dragonOrders: 'Dragon Orders',
  quadra: 'Quadra', penta: 'Penta',
  pistolRound1: '1st Pistol', pistolRound13: '2nd Pistol'
};
```

### 6.3 Rendering

- **setBinary(field, filledSet):** If `gameStats[game][field]` === team1 → `✓/✗`, otherwise `✗/✓`
- **setCount(field):** Numeric values from bucket `{ teamName: count }`
- Unfilled binary metrics display as `✗/✗`
- **Template presets:** `All` (all metrics visible) / `Mini` (hides firstKill, towers, races, dragonOrders)

---

## 7. Sound System

### Sound Event Flow
```
inject-stats.js: playSound('firstBlood')
  → window.postMessage({ source: 'lol-sound-event', type: 'firstBlood' })
  → statsContent.js preload catches → ipcRenderer.send('lol-sound-event', type)
  → main/modules/stats/index.js → routes to stats_panel webContents
  → stats_sounds.js: triggerSound('firstBlood')
  → new Audio('assets/FirstBlood.mp3').play()
```

### Per-Game Sound Filtering
```javascript
// stats_sounds.js
const CS2_ALLOWED = new Set(['gameStart']);  // CS2 = gameStart only
// window.__gridGame is set by stats_panel.js when game is detected from Grid URL
if (game === 'cs2' && !CS2_ALLOWED.has(soundType)) return;
```

### Available Sounds
| Type | File | Trigger |
|------|------|---------|
| `gameStart` | `GameOneStarted.mp3` — `GameFiveStarted.mp3` | Ban phase / Game N started |
| `firstBlood` | `FirstBlood.mp3` | First kill |
| `firstTower` | `FirstTower.mp3` | First tower destroyed |
| `firstBaron` | `FirstBaron.mp3` | First baron slain |
| `firstInhibitor` | `FirstInhibitor.mp3` | First inhibitor destroyed |
| `quadraKill` | `QuadraKill.mp3` | Quadra kill |
| `pentaKill` | `PentaKill.mp3` | Penta kill |

---

## 8. Adding a New Metric — Checklist

1. **inject-stats.js:**
   - Add regex if a new log pattern is needed
   - Add field to `makeStats()` (binary: `field: null, fieldAt: ''` or count: `field: {}`)
   - Add parsing in `handleEntry()` — after team resolution

2. **stats_panel.js:**
   - Add to `BINARY_METRICS` or `COUNT_METRICS`
   - Add to `metricsOrder`
   - Add to `metricLabels`
   - Add to `GAME_METRICS` (if game-specific)
   - Add `setBinary()` or `setCount()` call in `renderLol()`
   - Add to `filledBinary` fallback `✗` list (for binary metrics)
   - Add to `renameTeamInternal()` if binary

3. **Build:** `node scripts/build-renderer.js`
