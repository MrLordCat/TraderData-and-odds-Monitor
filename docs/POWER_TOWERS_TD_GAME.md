# Power Towers TD - Roguelike Tower Defense Game

> Inspired by Power Towers TD custom map from Warcraft 3, evolved into a roguelike format.

## 🎯 Concept

### Core Idea
A Tower Defense game with a unique **energy system mechanic** — towers require energy to operate, and the player must balance between defense and energy production using various generators.

### Roguelike Elements
- **Procedural map generation** — spiral path with 2 loops
- **Meta-progression** — gems accumulate between runs
- **Permanent upgrades** — upgrades persist between games
- **Run-based gameplay** — each run has a beginning and end

### Art Style
2D graphics with emoji-based visuals and colored shapes (no sprites yet).

---

## 🎮 Gameplay (Implemented)

### Map & Terrain

#### Technical Specifications
| Property | Value | Notes |
|----------|-------|-------|
| **Map Size** | 2000×2000 px | 100×100 grid cells |
| **Grid Cell** | 20×20 px | Tower/building placement unit |
| **Viewport** | 400×400 px | Default canvas size |
| **Path Type** | Spiral | 2 loops, tightening toward center |

#### Terrain Types (Implemented)
```
Terrain Types:
├── 🟩 grass     - Default, buildable
├── 🛤️ path      - Enemy route, not buildable
├── ⛰️ hill      - Range bonus +20%
├── 🌲 forest    - Damage bonus +15%, range -10%
├── 💧 water     - Not buildable
├── ⚡ energy_node - Energy generation bonus
└── 💎 resource_vein - Gold bonus on kills
```

#### Map Generation
- **Spawn Point**: Edge of map (randomized)
- **Base Point**: Center of map
- **Path Algorithm**: Double-loop spiral from edge to center
- **Terrain**: Noise-based distribution with biome support

### Enemy System (Implemented)

#### Enemy Types
| Type | Emoji | Health | Speed | Reward | Notes |
|------|-------|--------|-------|--------|-------|
| Minion | 👾 | 20 | 40 px/s | 10g | Basic enemy |
| Scout | 🦎 | 20 | 80 px/s | 15g | Fast but fragile |
| Brute | 🐗 | 100 | 25 px/s | 30g | Slow tank |
| Swarmling | 🐜 | 15 | 60 px/s | 5g | Spawns in groups |
| Boss | 👹 | 1000 | 20 px/s | 200g | Every 10 waves |

#### Wave System
- **Auto-wave**: 15 seconds between waves
- **Difficulty scaling**: HP and speed increase per wave
- **Boss waves**: Every 10 waves
- **Enemy composition**: Mix varies by wave number

### Tower System (Implemented)

#### Single Tower Mechanic
Player builds **Base Towers** and upgrades them via:

```
🗼 Base Tower ─── Cost: 30 gold
      │
      ├──1️⃣ Choose Attack Type (required first)
      │      ├── 💥 Siege   (2x vs buildings/slow)
      │      ├── 🎯 Normal  (balanced)
      │      ├── ✨ Magic   (1.5x vs magic-weak)
      │      └── 🗡️ Piercing (ignores armor)
      │
      ├──2️⃣ Upgrade Stats
      │      ├── Damage (10 → +20%)
      │      ├── Range (60 → +15%)
      │      └── Fire Rate (1.0 → +10%)
      │
      └──3️⃣ Choose Element Path
             ├── 🔥 Fire    - Burn DoT, AoE damage
             ├── ❄️ Ice     - Slow, Freeze
             ├── ⚡ Lightning - Chain damage, fast attack
             ├── 🌿 Nature  - Poison, area control
             └── 💀 Dark    - True damage, lifesteal
```

#### Tower Stats
| Stat | Base Value | Notes |
|------|------------|-------|
| Damage | 10 | Multiplied by attack type & element |
| Range | 60 px | 3 grid cells |
| Fire Rate | 1.0/s | Attacks per second |
| Energy Cost | 2 | Per shot |

#### Tower XP System
- Towers gain XP for each enemy killed
- XP unlocks stat upgrades
- Visual level indicator (💎 gem count)

### Energy System (Implemented)

#### Architecture
```
⚡ Energy System
├── PowerNetwork     - Manages connections
├── PowerNode        - Base class for all energy entities
├── Generators       - Produce energy
├── Storage          - Battery, relay
└── Consumers        - Towers (via adapter)
```

#### Energy Buildings

| Building | Icon | Cost | Generation | Notes |
|----------|------|------|------------|-------|
| Base Generator | ⚡ | 50g | 5/tick | Stable, no terrain requirement |
| Bio Generator | 🌳 | 80g | 8/tick | +bonus per nearby tree |
| Wind Turbine | 💨 | 100g | 12/tick | Needs mountains, unstable |
| Solar Panel | ☀️ | 90g | 10/tick | Biome-dependent efficiency |
| Water Generator | 💧 | 120g | 15/tick | Needs water, AoE bonus |
| Battery | 🔋 | 60g | 0 | Storage: 200, decay 1%/tick |
| Power Relay | 📡 | 40g | 0 | 2 input, 2 output channels |

#### Power Network
- Buildings connect via channels (range-based)
- Energy flows: Generator → Battery/Relay → Tower
- Each tower has PowerConsumer adapter
- No passive energy regeneration (disabled)

#### Channel System
```
Connection Flow:
Generator (output:1) ──→ Relay (input:2, output:2) ──→ Tower
     │                                                    │
     └─────────────────→ Battery (input:1) ───────────────┘
```

### Economy (Implemented)

| Source | Amount |
|--------|--------|
| Starting Gold | 200 |
| Enemy Kill | 5-200g (by type) |
| Wave Bonus | 10g per wave completed |

### Menu System (Implemented)

#### Screens
```
📋 Menu Screens
├── 🎮 Start     - New game button
├── 🔧 Upgrades  - Permanent upgrades
├── 💡 Tips      - Game hints
└── ⚙️ Settings  - Options
```

#### Permanent Upgrades
| Upgrade | Max Level | Cost | Bonus |
|---------|-----------|------|-------|
| Starting Gold | 10 | 100 gems | +50g per level |
| Starting Lives | 5 | 150 gems | +1 life per level |
| Tower Damage | 10 | 200 gems | +5% per level |
| Energy Regen | 5 | 175 gems | +10% per level |

---

## 🚀 Game Startup Flow

### Overview
The game follows a specific initialization sequence from sidebar launch to wave start:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. SIDEBAR (Attached Mode)                                                  │
│    └─► "Launch Game" button → IPC 'module-detach' → Opens new window       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. DETACHED WINDOW                                                          │
│    └─► GamePanelModule.onMount() → GameController.init()                   │
│        └─► Shows Menu Screen (screen-menu)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. MENU SCREEN                                                              │
│    └─► "Start Game" button → showScreen('game') → initializeGame()         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. GAME SCREEN (Prep Phase)                                                 │
│    └─► GameCore created, map generated                                     │
│    └─► running=false, firstWaveStarted=false                               │
│    └─► Player can build towers & energy buildings                          │
│    └─► Energy system WORKS (update runs even before wave)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. START WAVE                                                               │
│    └─► "Start Wave" button → game.startWave()                              │
│        ├─► running=true, firstWaveStarted=true                             │
│        ├─► Emit GAME_START event                                           │
│        ├─► Start gameLoop() (60 FPS)                                       │
│        └─► Emit 'wave:start' → EnemiesModule.startNextWave()               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. GAME LOOP (Active)                                                       │
│    └─► Every frame: update modules → emit GAME_TICK → render               │
│    └─► Auto-wave: every 15 seconds emit 'wave:start'                       │
│    └─► Button becomes Pause/Resume toggle                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detailed Flow

#### Step 1: Launch from Sidebar
```javascript
// modules/game-panel/index.js (Attached Mode)
// When "Launch Game" clicked:
ipcRenderer.invoke('module-detach', { 
  moduleId: 'game-panel',
  modulePath: modulePath,
  title: 'Power Towers TD',
  width: 800, height: 950
});
```

#### Step 2: Window Initialization
```javascript
// modules/game-panel/index.js (Detached Mode)
onMount(container) {
  this.gameController = new GameController({ GameCore, GameRenderer, ... });
  this.gameController.init(container);  // → shows Menu screen
}
```

#### Step 3: Menu → Game Screen
```javascript
// modules/game-panel/game-controller.js
setupScreenNavigation(container) {
  // "Start Game" button has data-screen="game"
  btn.addEventListener('click', () => {
    this.showScreen('game');
    if (!this.game) {
      this.initializeGame();  // Create GameCore
    }
  });
}
```

#### Step 4: Game Initialization (Prep Phase)
```javascript
// modules/game-panel/game-controller.js
initializeGame() {
  this.game = new this.GameCore();  // Creates all modules
  this.camera = new this.Camera();
  this.renderer = new this.GameRenderer(this.canvas, this.camera);
  
  // Center camera on base
  const basePos = waypoints[waypoints.length - 1];
  this.camera.centerOn(basePos.x, basePos.y);
  
  this.setupGameEvents();  // Subscribe to GAME_TICK, etc.
  this.renderGame();       // Initial render
}

// core/game-core-modular.js - GameCore constructor
initModules() {
  this.modules = {
    menu, map, towers, enemies, combat, 
    damageNumbers, economy, energy, player
  };
  
  // Initialize all modules
  for (const module of Object.values(this.modules)) {
    module.init();
  }
  
  // Generate map (creates terrain, path, waypoints)
  this.modules.map.generateMap();
  
  // Set starting resources
  this.modules.economy.gold = CONFIG.STARTING_GOLD;  // 400
  this.modules.player.lives = CONFIG.STARTING_LIVES; // 20
  
  // Game NOT running yet!
  this.running = false;
  this.firstWaveStarted = false;
}
```

**Important:** During prep phase:
- `running = false` — no game loop
- `firstWaveStarted = false`
- Energy module STILL updates (buildings work)
- Player can build towers and energy buildings
- Enemies do NOT spawn

#### Step 5: Start Wave
```javascript
// modules/game-panel/ui-events.js
toggleGame() {
  // First click: start wave
  if (!this.game.firstWaveStarted) {
    this.game.startWave();
    this.elements.btnStart.textContent = '⏸ Pause';
    return;
  }
  // After: toggle pause/resume
}

// core/game-core-modular.js
startWave() {
  if (!this.running) {
    this.running = true;
    this.paused = false;
    this.firstWaveStarted = true;
    this.autoWaveTimer = 0;
    this.lastTick = performance.now();
    
    this.eventBus.emit(GameEvents.GAME_START, this.getState());
    this.gameLoop();  // Start the loop!
  }
  
  this.eventBus.emit('wave:start');  // Trigger enemy spawning
}

// modules/enemies/index.js
init() {
  this.eventBus.on('wave:start', () => this.startNextWave());
}

startNextWave() {
  this.currentWave++;
  this.waveInProgress = true;
  const waveEnemies = this.generateWaveComposition(this.currentWave);
  this.spawnQueue.push(...waveEnemies);
  this.eventBus.emit('wave:started', { wave: this.currentWave });
}
```

#### Step 6: Game Loop
```javascript
// core/game-core-modular.js
gameLoop() {
  if (!this.running || this.paused) return;
  
  const deltaTime = (now - this.lastTick) / 1000;
  
  this.update(deltaTime);
  this.eventBus.emit(GameEvents.GAME_TICK, { deltaTime, state });
  
  this.animationId = requestAnimationFrame(() => this.gameLoop());
}

update(deltaTime) {
  // Always update energy (even during menu)
  this.modules.energy.update(deltaTime);
  
  // Auto-wave timer (15 seconds)
  if (this.firstWaveStarted) {
    this.autoWaveTimer += deltaTime;
    if (this.autoWaveTimer >= 15) {
      this.autoWaveTimer = 0;
      this.eventBus.emit('wave:start');  // Next wave!
    }
  }
  
  // Update combat modules
  this.modules.enemies.update(deltaTime);
  this.modules.towers.update(deltaTime, enemies);
  this.modules.combat.update(deltaTime, enemies);
  // ...
}
```

### State Diagram

```
              ┌──────────────────────────────────────────┐
              │              MENU SCREEN                 │
              │  running=false, firstWaveStarted=false   │
              └─────────────────┬────────────────────────┘
                                │ "Start Game" click
                                ▼
              ┌──────────────────────────────────────────┐
              │           PREP PHASE (Game Screen)       │
              │  running=false, firstWaveStarted=false   │
              │  - Build towers ✓                        │
              │  - Build energy buildings ✓              │
              │  - Energy system works ✓                 │
              │  - Enemies do NOT spawn                  │
              └─────────────────┬────────────────────────┘
                                │ "Start Wave" click
                                ▼
              ┌──────────────────────────────────────────┐
              │              ACTIVE GAME                 │
              │  running=true, firstWaveStarted=true     │
              │  - Enemies spawn                         │
              │  - Towers attack                         │
              │  - Auto-wave every 15s                   │
              │  - Button = Pause/Resume                 │
              └─────────────────┬────────────────────────┘
                                │ Lives = 0
                                ▼
              ┌──────────────────────────────────────────┐
              │              GAME OVER                   │
              │  gameOver=true, running=false            │
              │  - Show overlay                          │
              │  - "Try Again" → restart                 │
              └──────────────────────────────────────────┘
```

### Key Events During Startup

| Phase | Event | Triggered By | Handlers |
|-------|-------|--------------|----------|
| Init | `map:generated` | MapModule.generateMap() | EnemiesModule (receives waypoints) |
| Start Wave | `GAME_START` | GameCore.startWave() | MenuModule, TowersModule |
| Start Wave | `wave:start` | GameCore.startWave() | EnemiesModule.startNextWave() |
| Each Frame | `GAME_TICK` | GameCore.gameLoop() | GameController (render + UI update) |
| Wave Spawn | `wave:started` | EnemiesModule | UI (wave counter) |

---

## 🏗️ Technical Architecture (Current)

### File Structure
```
addons-dev/power-towers/
├── manifest.json              # Version: 0.1.0
├── index.js                   # Entry point
│
├── core/                      # Core systems
│   ├── config.js              # Constants (MAP: 2000, GRID: 20)
│   ├── event-bus.js           # EventBus for modules
│   ├── game-core-modular.js   # Main orchestrator
│   ├── attack-types.js        # Siege/Normal/Magic/Piercing
│   └── tower-upgrades.js      # Upgrade definitions
│
├── modules/                   # Feature modules
│   ├── map/                   # Map generation
│   │   ├── index.js           # MapModule
│   │   ├── map-generator.js   # Spiral path generator
│   │   ├── noise-generator.js # Terrain noise
│   │   ├── seeded-random.js   # Seeded RNG
│   │   └── generator-config.js
│   │
│   ├── towers/                # Tower system
│   │   ├── index.js           # TowersModule
│   │   ├── tower-factory.js   # Tower creation
│   │   ├── tower-stats.js     # Stat calculation
│   │   ├── tower-combat.js    # Targeting & attack
│   │   └── tower-upgrade-handlers.js
│   │
│   ├── enemies/               # Enemy system
│   │   └── index.js           # EnemiesModule, ENEMY_TYPES
│   │
│   ├── combat/                # Combat system
│   │   ├── index.js           # CombatModule, projectiles
│   │   └── damage-numbers.js  # Floating damage text
│   │
│   ├── economy/               # Gold management
│   │   └── index.js           # EconomyModule
│   │
│   ├── energy/                # Energy system ⚡
│   │   ├── index.js           # EnergyModule
│   │   ├── power-network.js   # PowerNetwork class
│   │   ├── power-node.js      # PowerNode base class
│   │   ├── generators.js      # All generator types
│   │   ├── storage.js         # Battery, PowerTransfer
│   │   ├── building-defs.js   # Building configurations
│   │   ├── building-manager.js # Placement & management
│   │   └── upgrade-system.js  # Building upgrades
│   │
│   ├── player/                # Player state
│   │   └── index.js           # PlayerModule (lives, XP)
│   │
│   ├── menu/                  # Menu system
│   │   └── index.js           # MenuModule, MENU_SCREENS
│   │
│   └── game-panel/            # UI Module
│       ├── index.js           # SidebarModule
│       ├── templates.js       # HTML (toolbar with towers + energy)
│       ├── styles.js          # CSS
│       ├── game-controller.js # Main controller
│       ├── canvas-events.js   # Mouse/keyboard handling
│       ├── game-events.js     # Game event bindings
│       ├── ui-events.js       # UI button handlers
│       ├── tower-tooltip.js   # Tower info popup
│       └── tower-upgrades-ui.js # Upgrade panel
│
└── renderer/
    └── game-renderer.js       # Canvas renderer
```

### Module Communication

All modules communicate via **EventBus** — no direct dependencies:

```javascript
// Example: Tower kills enemy
TowersModule:   kills enemy, stores lastHitTowerId
EnemiesModule:  emit('enemy:killed', { enemyId, killerId, reward })
TowersModule:   on('enemy:killed') → add XP to tower
EconomyModule:  on('enemy:killed') → add gold
```

### Key Events
| Event | Data | Description |
|-------|------|-------------|
| `GAME_START` | - | Game begins |
| `GAME_OVER` | { won } | Game ends |
| `wave:started` | { wave } | Wave spawns |
| `wave:complete` | { wave } | Wave cleared |
| `tower:built` | { tower } | Tower placed |
| `tower:updated` | { tower } | Tower stats changed |
| `enemy:killed` | { reward, killerId } | Enemy died |
| `enemy:escaped` | { enemy } | Enemy reached base |
| `economy:updated` | { gold } | Gold changed |
| `energy:stats-updated` | { generation, storage } | Energy state |
| `power:network-state` | { connections } | Network updated |

### Game Loop
```javascript
// 60 FPS target
gameLoop(currentTime) {
  deltaTime = currentTime - lastTick
  
  // Update all modules
  modules.map.update(deltaTime)
  modules.towers.update(deltaTime)    // Targeting, attacks
  modules.enemies.update(deltaTime)   // Movement
  modules.combat.update(deltaTime)    // Projectiles
  modules.energy.update(deltaTime)    // Power flow
  modules.player.update(deltaTime)    // Auto-wave timer
  
  // Render
  renderer.render()
}
```

### Camera System
```javascript
Camera {
  x, y              // World position
  zoom              // 0.5 - 2.0
  viewportWidth/Height
  
  screenToWorld(sx, sy)  // Click → grid coords
  worldToScreen(wx, wy)  // Grid → canvas coords
  centerOn(x, y)         // Move camera
  zoomBy(factor)         // Zoom in/out
}
```

---

## 🖥️ UI Layout (Current)

### Toolbar (Single Row)
```
┌────────────────────────────────────────────────────────┐
│ 🗼 30   ⚡ 50  🌳 80  💨 100  ☀️ 90  💧 120  🔋 60  📡 40 │
│ Tower  Base  Bio   Wind  Solar Water Battery Relay    │
└────────────────────────────────────────────────────────┘
```

### Game Area
```
┌─────────────────────────────────────────┐
│  Wave: 5   💰 250   ❤️ 20      │  ← Stats bar
├─────────────────────────────────────────┤
│                                         │
│         🛤️ Spiral Path                  │
│            (enemies)                    │
│                 🗼 Tower                │
│              ⚡ Generator               │
│                                         │
│                 🏰                       │  ← Base (center)
└─────────────────────────────────────────┘
```

### Tower Tooltip
```
┌──────────────────────┐
│ 🗼 Tower (Lvl 3)     │
│ ❤️ 100/100           │
│ 💥 25 dmg  📐 80 rng │
│ ⚡ 2/shot  🔥 Fire   │
├──────────────────────┤
│ [Upgrade] [Sell: 15] │
└──────────────────────┘
```

---

## 🎮 Controls

| Action | Control |
|--------|---------|
| Place tower/building | Left-click on empty cell |
| Select tower | Left-click on tower |
| Deselect | Left-click on empty / Right-click |
| Pan camera | Middle-drag / Right-drag |
| Zoom | Scroll wheel |
| Exit placement mode | Right-click |

---

## 📋 Development Status

### ✅ Implemented
- [x] Modular architecture with EventBus
- [x] Map generation with spiral path
- [x] Terrain types with bonuses
- [x] Single tower system (Base → Attack Type → Element)
- [x] Tower XP and level system
- [x] 5 enemy types with wave scaling
- [x] Combat system with projectiles
- [x] Damage numbers (floating text)
- [x] Complete energy system
  - [x] 5 generator types with terrain dependencies
  - [x] Battery with decay
  - [x] Power relay with multi-channel
  - [x] Tower power integration
- [x] Economy module (gold)
- [x] Player module (lives, game over)
- [x] Menu system with permanent upgrades
- [x] Camera with zoom/pan
- [x] UI toolbar (towers + energy)
- [x] Tower tooltip with upgrades panel
- [x] Detachable game window

### 🚧 Planned
- [ ] Card system (every 10 waves)
- [ ] More enemy types
- [ ] Boss mechanics
- [ ] Sprite graphics
- [ ] Sound effects
- [ ] Achievement system
- [ ] Content pack system

---

## 📊 Configuration Reference

### config.js
```javascript
CONFIG = {
  // Map
  MAP_WIDTH: 2000,
  MAP_HEIGHT: 2000,
  GRID_SIZE: 20,
  
  // Display
  CANVAS_WIDTH: 400,
  CANVAS_HEIGHT: 400,
  TARGET_FPS: 60,
  
  // Game Balance
  STARTING_GOLD: 200,
  STARTING_LIVES: 20,
  STARTING_ENERGY: 50,
  MAX_ENERGY: 100,
  ENERGY_REGEN: 0,  // disabled
  
  // Tower
  BASE_TOWER_COST: 30,
  TOWER_BASE_DAMAGE: 10,
  TOWER_BASE_RANGE: 60,
  TOWER_BASE_FIRE_RATE: 1.0,
  TOWER_BASE_ENERGY_COST: 2,
  
  // Wave
  WAVE_DELAY_MS: 3000,
  SPAWN_INTERVAL_MS: 800,
  ENEMIES_BASE_COUNT: 5,
  ENEMIES_PER_WAVE: 2
}
```

---

*Document updated: 30.12.2025*
*Game Version: 0.1.0*
