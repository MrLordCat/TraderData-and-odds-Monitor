# Power Towers TD - Roguelike Tower Defense Game

> Inspired by Power Towers TD custom map from Warcraft 3, evolved into a roguelike format.

## 🎯 Concept

### Core Idea
A Tower Defense game with a unique **energy system mechanic** — towers require energy to operate, and the player must balance between defense and energy production.

### Roguelike Elements
- **Procedural map generation** — each run is unique
- **Meta-progression** — XP accumulates between runs
- **Permanent upgrades** — skill tree for long-term development
- **Run-based gameplay** — each run has a beginning and end

### Art Style
2D graphics in a cartoon style inspired by Warcraft 3, but brighter and more modern.

---

## 🎮 Gameplay

### Map & Terrain

#### Technical Specifications
| Property | Value | Notes |
|----------|-------|-------|
| **Map Size** | 2000×2000 px | Large canvas for detailed textures |
| **Tower Size** | 20×20 px | Grid-aligned placement |
| **Grid Cell** | 20×20 px | Map divided into 100×100 cells |
| **Tile Size** | 20×20 px | Terrain tiles match tower grid |

> These dimensions are chosen for easier texture creation — sprites scale well at 20px base.

#### Map Grid
```
Map: 2000×2000 px = 100×100 grid cells
Each cell: 20×20 px

┌──────────────────────────────────────┐
│  100 cells wide (2000px)             │
│ ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐     │
│ │  │  │  │  │  │  │  │  │  │  │ ... │  100
│ ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤     │  cells
│ │  │🗼│  │  │🛤️│  │  │  │  │  │ ... │  tall
│ ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤     │  (2000px)
│ │  │  │  │🛤️│🛤️│🛤️│  │  │  │  │ ... │
│ └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘     │
└──────────────────────────────────────┘

🗼 = Tower (occupies 1 cell = 20×20px)
🛤️ = Path (enemies walk here)
```

#### Map Elements
```
Map Elements:
├── 🏰 Player Base (defended target)
├── 🛤️ Enemy Path (procedurally generated)
├── 🏔️ Mountains/Hills (range bonus for towers)
├── 🌲 Forests (hide towers, ambush damage bonus)
├── 💧 Lakes/Rivers (slow enemies, water tower synergy)
├── ⚡ Energy Nodes (energy generation bonus)
└── 💎 Resource Veins (extra gold)
```

### Enemy Waves
- **Armor Types:** Light, Medium, Heavy, Magic, Heroic
- **Shields:** Physical, Magical, Regenerating
- **Special Enemies:** Fast, Tanks, Flying, Bosses

### Tower System

#### Core Mechanic: Base Tower → 5 Upgrade Paths
Player builds a **single Base Tower** type. First upgrade choice determines the tower's attack type and entire upgrade branch.

```
🗼 Base Tower (Tier 0) ─── Cost: 50 gold
         │
         ├──🔥 Fire Path ──→ Burn damage, AoE
         │      ├── Tier 1: Flame Tower (single target burn)
         │      ├── Tier 2: Inferno Tower (AoE splash)
         │      └── Tier 3: Phoenix Spire (resurrection aura)
         │
         ├──❄️ Ice Path ──→ Slow, Freeze, Control
         │      ├── Tier 1: Frost Tower (slow enemies)
         │      ├── Tier 2: Blizzard Tower (AoE slow)
         │      └── Tier 3: Absolute Zero (freeze + shatter)
         │
         ├──⚡ Lightning Path ──→ Chain damage, Speed
         │      ├── Tier 1: Spark Tower (fast attacks)
         │      ├── Tier 2: Tesla Coil (chain lightning)
         │      └── Tier 3: Storm Nexus (area denial)
         │
         ├──🌿 Nature Path ──→ Poison, Healing, Summons
         │      ├── Tier 1: Thorn Tower (poison DoT)
         │      ├── Tier 2: Treant Tower (summon minions)
         │      └── Tier 3: World Tree (heal base + buff allies)
         │
         └──💀 Dark Path ──→ Lifesteal, Debuffs, True Damage
                ├── Tier 1: Shadow Tower (armor reduction)
                ├── Tier 2: Vampire Spire (lifesteal to base)
                └── Tier 3: Void Obelisk (true damage, execute)
```

#### Attack Types & Armor Matrix
| Tower Type | Damage Type | Strong vs | Weak vs | Special |
|------------|-------------|-----------|---------|---------|
| 🔥 Fire | Magical | Heavy, Undead | Fire Immune | Burn DoT |
| ❄️ Ice | Magical | Light, Flying | Ice Immune | Slow/Freeze |
| ⚡ Lightning | Physical | Medium, Mech | Grounded | Chain hits |
| 🌿 Nature | Poison | Organic, Light | Undead, Mech | Heal/Summon |
| 💀 Dark | True | All equal | Holy | Debuffs |

#### Tower Stats
Each tower has:
- **Damage** — base damage per hit
- **Attack Speed** — attacks per second
- **Range** — targeting radius
- **Energy Cost** — energy consumed per shot
- **Special Ability** — unique effect (unlocked at Tier 2+)

### Energy System

```
⚡ Energy
├── Generators (produce energy)
├── Batteries (store energy)
├── Grid (transmit energy to towers)
└── Consumers (towers)

Towers without energy = don't fire!
```

---

## 🃏 Card System

### Core Mechanic
Every **10 waves**, player is offered **3 random cards** to choose from. Cards provide powerful effects that shape the run.

```
┌─────────────────────────────────────────────────────────────┐
│                    WAVE 10 COMPLETE!                        │
│                   Choose your reward:                       │
│  ┌─────────┐      ┌─────────┐      ┌─────────┐            │
│  │ 🔥 RAGE │      │ 💰 GREED│      │ ⚡ SURGE│            │
│  │         │      │         │      │         │            │
│  │ +25%    │      │ +50%    │      │ -20%    │            │
│  │ Tower   │      │ Gold    │      │ Energy  │            │
│  │ Damage  │      │ per Wave│      │ Cost    │            │
│  │         │      │         │      │         │            │
│  │ [Pick]  │      │ [Pick]  │      │ [Pick]  │            │
│  └─────────┘      └─────────┘      └─────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### Card Types

#### 🟢 Common Cards (60% drop rate)
| Card | Effect |
|------|--------|
| Quick Hands | +10% attack speed |
| Fortify | +15 base HP |
| Efficiency | -10% energy cost |
| Prospector | +20% gold income |
| Eagle Eye | +1 tower range |

#### 🔵 Rare Cards (30% drop rate)
| Card | Effect |
|------|--------|
| Elemental Mastery | +25% damage for one element |
| Battery Overcharge | +50% energy capacity |
| Chain Reaction | 20% chance for double damage |
| Midas Touch | Enemies drop 2x gold |
| Regeneration | Base heals 1 HP per wave |

#### 🟣 Epic Cards (9% drop rate)
| Card | Effect |
|------|--------|
| Arcane Amplifier | Towers gain +1 Tier abilities |
| Time Warp | Enemies move 30% slower |
| Gold Rush | Start each wave with +100 gold |
| Shield Generator | Base gains regenerating shield |
| Synergy | Same-type towers buff each other |

#### 🟠 Legendary Cards (1% drop rate)
| Card | Effect |
|------|--------|
| Infinity Engine | Energy is unlimited this run |
| Death's Touch | All towers deal true damage |
| The Gambler | Every 5 waves, get extra card |
| Ancient Power | Unlock hidden Tier 4 upgrades |
| Second Chance | Revive once if base destroyed |

### Card Synergies
Cards can combine for powerful effects:
- **Elemental Set** (3 same-element cards) → +50% element damage
- **Economy Set** (3 gold cards) → Double all gold effects
- **Power Set** (3 damage cards) → Unlock "Rampage" ability

---

## 🎲 Roguelike Meta-System

### Progression Currency
- **XP (Experience Points)** — earned from:
  - Killed enemies
  - Completed waves
  - Achievements
  - Play style bonuses

### Skill Tree (Talent Tree)
```
🌳 Skill Tree
├── 🗡️ Offense
│   ├── +5% tower damage
│   ├── +10% attack speed
│   └── Unlock new tower type
├── 🛡️ Defense
│   ├── +10 base HP
│   ├── +5% armor
│   └── Emergency shield
├── ⚡ Energy
│   ├── +10% generation
│   ├── +20% capacity
│   └── Grid efficiency
├── 💰 Economy
│   ├── +10% gold per wave
│   ├── -5% tower cost
│   └── Passive income
└── 🎲 Luck
    ├── Rare event chance
    ├── Better rewards
    └── Bonus modifiers
```

---

## 🏗️ Technical Architecture

### ⚠️ Version Control
**IMPORTANT:** Game version changes only on explicit request from the developer.
Current version: **0.1.0**

### Modular Design Philosophy

The game follows a **strict modular architecture**. Each feature is isolated in its own module with:
- Clear interface (input/output)
- Single responsibility
- Loose coupling via EventBus
- Easy to modify/replace independently

**Core** acts as the orchestrator — it connects all modules but doesn't contain business logic.

### Module Structure

```
addons-dev/power-towers/
├── manifest.json              # Addon metadata
├── index.js                   # Entry point (exports for sidebar)
│
├── core/                      # 🎯 GAME CORE
│   ├── game-core.js           # Main engine - game state, events, API
│   ├── game-core-modular.js   # Alternative modular implementation
│   ├── config.js              # Global constants (GRID_SIZE, etc.)
│   ├── event-bus.js           # Event system for communication
│   │
│   ├── entities/              # 📦 Game entities
│   │   ├── tower.js           # Tower class, TOWER_PATHS definitions
│   │   ├── enemy.js           # Enemy class
│   │   └── projectile.js      # Projectile class
│   │
│   └── systems/               # ⚙️ Game systems
│       ├── camera.js          # Viewport, scrolling, zoom, coordinate transforms
│       ├── economy.js         # Gold management
│       ├── energy-system.js   # Energy production & consumption
│       └── wave-system.js     # Wave spawning logic
│
├── modules/                   # 📦 FEATURE MODULES (planned)
│   │
│   ├── combat/                # ⚔️ Combat (planned)
│   ├── economy/               # 💰 Economy (planned)
│   ├── enemies/               # 👾 Enemies (planned)
│   ├── energy/                # ⚡ Energy (planned)
│   ├── map/                   # 🗺️ Map (planned)
│   ├── menu/                  # 📋 Menu (planned)
│   ├── player/                # 🎮 Player (planned)
│   ├── towers/                # 🗼 Towers (planned)
│   │
│   └── game-panel/            # 🖥️ UI Module (sidebar integration)
│       ├── index.js           # SidebarModule - entry point, launcher/detach
│       ├── templates.js       # HTML templates (launcher & game screens)
│       ├── styles.js          # CSS styles (launcher & game modes)
│       └── game-controller.js # Game logic, canvas, events, UI handling
│
├── renderer/                  # 🎨 RENDERING
│   └── game-renderer.js       # Main canvas renderer (map, towers, enemies)
│
└── assets/                    # 🎨 GRAPHICS (future)
    ├── sprites/
    ├── tiles/
    └── ui/
```

### Game Panel Module Architecture

The `game-panel` module is split into focused files for maintainability (max ~500 lines per file):

| File | Purpose | Lines |
|------|---------|-------|
| `index.js` | SidebarModule class, launcher button, detach handling | ~120 |
| `templates.js` | HTML templates for launcher and game UI | ~130 |
| `styles.js` | CSS styles for both modes | ~140 |
| `game-controller.js` | All game logic: canvas, events, tower placement, UI | ~450 |

**Key APIs used:**
- `GameCore` - game state, `on()` event subscription, `selectTower()`, `canPlaceTower()`
- `GameRenderer` - `render()`, `setHover()`, `clearHover()`
- `Camera` - `screenToWorld()`, `centerOn()`, `zoomBy()`, `pan()`, `setViewportSize()`
- `GameEvents` - `GAME_TICK`, `STATE_CHANGE`, `TOWER_PLACED`, `WAVE_COMPLETE`, `GAME_OVER`

### Module Communication

Modules communicate via **EventBus** — no direct calls between modules:

```javascript
// ❌ Wrong: Direct coupling
towerModule.onDamageDealt = (dmg) => economyModule.addGold(dmg * 0.1);

// ✅ Correct: Event-based
eventBus.on('enemy:killed', ({ reward }) => {
  eventBus.emit('economy:add-gold', { amount: reward });
});
```

### Module Interface Pattern

Each module exports a standard interface:

```javascript
// modules/towers/index.js
class TowerModule {
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    this.towers = [];
  }
  
  // Lifecycle
  init() { /* subscribe to events */ }
  update(deltaTime) { /* per-frame logic */ }
  reset() { /* clear state */ }
  destroy() { /* cleanup */ }
  
  // Public API
  placeTower(gridX, gridY, path) { }
  upgradeTower(towerId) { }
  sellTower(towerId) { }
  
  // State for renderer
  getRenderData() { return this.towers; }
}
```

### Core Orchestration

GameCore connects all modules:

```javascript
class GameCore {
  constructor() {
    this.eventBus = new EventBus();
    
    // Initialize modules
    this.modules = {
      map: new MapModule(this.eventBus, CONFIG),
      towers: new TowerModule(this.eventBus, CONFIG),
      enemies: new EnemyModule(this.eventBus, CONFIG),
      combat: new CombatModule(this.eventBus, CONFIG),
      energy: new EnergyModule(this.eventBus, CONFIG),
      economy: new EconomyModule(this.eventBus, CONFIG),
      progression: new ProgressionModule(this.eventBus, CONFIG),
      cards: new CardModule(this.eventBus, CONFIG),
    };
  }
  
  start() {
    Object.values(this.modules).forEach(m => m.init());
  }
  
  update(deltaTime) {
    Object.values(this.modules).forEach(m => m.update(deltaTime));
  }
}
```

### Data Storage

```javascript
// electron-store keys for the game
{
  "powerTowers": {
    "xp": 15000,
    "level": 12,
    "unlockedTalents": ["offense_1", "defense_1", "energy_2"],
    "statistics": {
      "gamesPlayed": 47,
      "highestWave": 35,
      "totalEnemiesKilled": 12580,
      "totalPlayTime": 36000000
    },
    "settings": {
      "soundEnabled": true,
      "musicVolume": 0.7,
      "sfxVolume": 0.8,
      "showDamageNumbers": true
    },
    "achievements": ["first_win", "wave_20", "no_damage_wave"]
  }
}
```

### Architectural Patterns (project compliance)

1. **GameCore as singleton** — all logic in sidebar, broadcast to all renderers
2. **Detachable window** — display only via IPC
3. **Event-driven** — eventBus for module communication
4. **Factory functions** — for creating enemies, towers, etc.

---

## 🧩 Modular Content Architecture

### Design Philosophy
The game is built with **extensibility first** — adding new towers, enemies, cards, or mechanics should require **minimal code changes**.

### Data-Driven Design
All game content is defined in JSON files, not hardcoded:

```javascript
// data/towers.json — Adding a new tower path is just adding JSON
{
  "paths": {
    "fire": {
      "name": "Fire Path",
      "icon": "🔥",
      "damageType": "magical",
      "strongVs": ["heavy", "undead"],
      "weakVs": ["fire_immune"],
      "tiers": [
        {
          "tier": 1,
          "name": "Flame Tower",
          "cost": 100,
          "damage": 15,
          "attackSpeed": 1.0,
          "range": 3,
          "energyCost": 5,
          "special": null,
          "sprite": "tower_fire_t1"
        },
        // ... more tiers
      ]
    },
    // Adding new path = just add new key here
    "arcane": { ... }
  }
}
```

### Plugin System for Content Packs

```
content-packs/
├── base/                    # Core game content (always loaded)
│   ├── manifest.json
│   ├── towers.json
│   ├── enemies.json
│   ├── cards.json
│   └── sprites/
│
├── expansion-undead/        # Example: Undead expansion pack
│   ├── manifest.json        # Declares dependencies, version
│   ├── towers.json          # New tower paths (Holy, Necro)
│   ├── enemies.json         # Undead enemy types
│   ├── cards.json           # Undead-themed cards
│   ├── mechanics.js         # NEW: Custom mechanics (resurrection)
│   └── sprites/
│
└── expansion-tech/          # Example: Technology expansion
    ├── manifest.json
    ├── towers.json          # Mech towers
    ├── enemies.json         # Robot enemies  
    └── sprites/
```

### Manifest File Structure

```json
// content-packs/expansion-undead/manifest.json
{
  "id": "expansion-undead",
  "name": "Rise of the Undead",
  "version": "1.0.0",
  "author": "GameDev",
  "description": "Adds undead enemies, holy/necro towers, and resurrection mechanics",
  "requires": {
    "base": ">=1.0.0"
  },
  "provides": {
    "towerPaths": ["holy", "necromancy"],
    "enemyTypes": ["skeleton", "zombie", "lich", "death_knight"],
    "cards": ["resurrection", "holy_light", "soul_harvest"],
    "mechanics": ["resurrection"]
  },
  "loadOrder": 100
}
```

### Extensible Mechanics System

```javascript
// core/mechanics/mechanic-registry.js
const mechanicRegistry = new Map();

/**
 * Register a new game mechanic
 * Content packs can add custom mechanics without modifying core
 */
function registerMechanic(id, handler) {
  mechanicRegistry.set(id, handler);
}

// Example: Resurrection mechanic from undead expansion
registerMechanic('resurrection', {
  // When enemy dies
  onEnemyDeath: (enemy, context) => {
    if (enemy.hasTag('undead') && Math.random() < 0.3) {
      context.spawnEnemy({
        ...enemy,
        hp: enemy.maxHp * 0.5,
        resurrected: true
      });
    }
  }
});

// Core game calls all registered mechanics
function processEnemyDeath(enemy) {
  for (const [id, mechanic] of mechanicRegistry) {
    if (mechanic.onEnemyDeath) {
      mechanic.onEnemyDeath(enemy, gameContext);
    }
  }
}
```

### Event Hooks for Extensions

```javascript
// Core provides hooks that extensions can listen to
const GameEvents = {
  // Wave events
  WAVE_START: 'wave:start',
  WAVE_END: 'wave:end',
  WAVE_CLEAR: 'wave:clear',
  
  // Combat events
  ENEMY_SPAWN: 'enemy:spawn',
  ENEMY_DAMAGE: 'enemy:damage',
  ENEMY_DEATH: 'enemy:death',
  TOWER_ATTACK: 'tower:attack',
  TOWER_BUILT: 'tower:built',
  TOWER_UPGRADED: 'tower:upgraded',
  
  // Economy events
  GOLD_EARNED: 'economy:gold_earned',
  GOLD_SPENT: 'economy:gold_spent',
  
  // Card events
  CARD_OFFERED: 'card:offered',
  CARD_PICKED: 'card:picked',
  
  // Energy events
  ENERGY_PRODUCED: 'energy:produced',
  ENERGY_CONSUMED: 'energy:consumed',
  
  // Game state
  GAME_START: 'game:start',
  GAME_OVER: 'game:over',
  GAME_WIN: 'game:win'
};

// Extension example: Achievement tracker
eventBus.on(GameEvents.ENEMY_DEATH, (data) => {
  achievements.track('kills', data.enemy.type);
});
```

### Content Loader

```javascript
// core/content-loader.js
class ContentLoader {
  constructor() {
    this.loadedPacks = new Map();
    this.towers = {};
    this.enemies = {};
    this.cards = {};
  }
  
  /**
   * Load content pack from directory
   */
  async loadPack(packPath) {
    const manifest = await this.loadJSON(`${packPath}/manifest.json`);
    
    // Check dependencies
    for (const [dep, version] of Object.entries(manifest.requires || {})) {
      if (!this.loadedPacks.has(dep)) {
        throw new Error(`Missing dependency: ${dep}`);
      }
    }
    
    // Merge content (later packs override earlier)
    if (await this.exists(`${packPath}/towers.json`)) {
      const towers = await this.loadJSON(`${packPath}/towers.json`);
      this.towers = deepMerge(this.towers, towers);
    }
    
    if (await this.exists(`${packPath}/enemies.json`)) {
      const enemies = await this.loadJSON(`${packPath}/enemies.json`);
      this.enemies = deepMerge(this.enemies, enemies);
    }
    
    if (await this.exists(`${packPath}/cards.json`)) {
      const cards = await this.loadJSON(`${packPath}/cards.json`);
      this.cards = deepMerge(this.cards, cards);
    }
    
    // Load custom mechanics (if any)
    if (await this.exists(`${packPath}/mechanics.js`)) {
      const mechanics = require(`${packPath}/mechanics.js`);
      mechanics.register(mechanicRegistry);
    }
    
    this.loadedPacks.set(manifest.id, manifest);
    console.log(`[ContentLoader] Loaded: ${manifest.name} v${manifest.version}`);
  }
  
  /**
   * Load all packs in order
   */
  async loadAllPacks(packsDir) {
    const packs = await this.discoverPacks(packsDir);
    
    // Sort by loadOrder
    packs.sort((a, b) => (a.loadOrder || 0) - (b.loadOrder || 0));
    
    for (const pack of packs) {
      await this.loadPack(pack.path);
    }
  }
}
```

### Adding New Content — Quick Reference

| What to Add | Where | Code Changes Needed |
|-------------|-------|---------------------|
| New tower path | `towers.json` | None (data-driven) |
| New enemy type | `enemies.json` | None (data-driven) |
| New card | `cards.json` | None (data-driven) |
| New terrain | `terrain.json` | None (data-driven) |
| New mechanic | `mechanics.js` | Register hook only |
| New UI element | `ui-extensions/` | Minimal (slot system) |
| New game mode | `modes/` | Implement mode interface |

### Example: Adding a New Tower Path in 5 Minutes

```json
// Just add to towers.json:
{
  "paths": {
    "existing_paths": "...",
    
    "water": {
      "name": "Water Path",
      "icon": "💧",
      "damageType": "magical",
      "strongVs": ["fire", "earth"],
      "weakVs": ["lightning"],
      "color": "#3498db",
      "tiers": [
        {
          "tier": 1,
          "name": "Splash Tower",
          "cost": 100,
          "damage": 12,
          "attackSpeed": 0.8,
          "range": 3,
          "energyCost": 6,
          "special": "splash_damage",
          "specialParams": { "radius": 1, "falloff": 0.5 },
          "sprite": "tower_water_t1"
        },
        {
          "tier": 2,
          "name": "Tidal Tower",
          "cost": 200,
          "damage": 25,
          "attackSpeed": 0.7,
          "range": 4,
          "energyCost": 10,
          "special": "wave_push",
          "specialParams": { "pushDistance": 2 },
          "sprite": "tower_water_t2"
        },
        {
          "tier": 3,
          "name": "Tsunami Spire",
          "cost": 400,
          "damage": 50,
          "attackSpeed": 0.5,
          "range": 5,
          "energyCost": 20,
          "special": "flood",
          "specialParams": { "duration": 5, "slowPercent": 80 },
          "sprite": "tower_water_t3"
        }
      ]
    }
  }
}
```

**Result:** New water path appears in game, fully functional, no code changes!

---

## 📋 Development Plan

### Phase 1: Skeleton (MVP)
**Goal:** Basic game loop

- [ ] Create `power-towers` module structure
- [ ] Basic `GameCore` with tick system
- [ ] Simple 2D Canvas renderer
- [ ] Straight path (no generation)
- [ ] Base Tower + 1 upgrade path (Fire)
- [ ] 1 enemy type (basic walker)
- [ ] Wave system (start → enemies → end)
- [ ] Basic UI (HP, gold, wave, energy)
- [ ] Data-driven tower/enemy loading from JSON

**Estimated:** 1-2 weeks

### Phase 2: Core Mechanics
**Goal:** Full single-run gameplay

- [ ] Procedural map generation
- [ ] Terrain types with effects
- [ ] All 5 tower paths (Fire, Ice, Lightning, Nature, Dark)
- [ ] 5+ enemy types with different armor
- [ ] Energy system (generators, grid)
- [ ] Economy balancing
- [ ] **Card system** (basic implementation)
- [ ] Card selection UI every 10 waves
- [ ] 15+ common/rare cards
- [ ] Enhanced UI with tooltips

**Estimated:** 2-3 weeks

### Phase 3: Roguelike Meta
**Goal:** Long-term progression

- [ ] XP system
- [ ] Skill tree (unlocks via XP)
- [ ] Achievements
- [ ] Player statistics
- [ ] Persistence in electron-store
- [ ] Epic/Legendary cards
- [ ] Card synergies

**Estimated:** 1-2 weeks

### Phase 4: Content & Polish
**Goal:** Complete game

- [ ] Tier 3 upgrades for all paths
- [ ] 20+ enemy types
- [ ] Bosses (every 10 waves)
- [ ] Special map events
- [ ] Sprites and animations
- [ ] Sound and music
- [ ] Detachable window with full UI
- [ ] 50+ total cards

**Estimated:** 3-4 weeks

### Phase 5: Content Pack System
**Goal:** Extensible modding support

- [ ] Content loader from JSON packs
- [ ] Manifest system for packs
- [ ] Mechanic registry for custom hooks
- [ ] UI for enabling/disabling packs
- [ ] Example expansion pack
- [ ] Documentation for modders

**Estimated:** 1-2 weeks

---

## 🔧 Technical Requirements

### Rendering
- **Canvas 2D** — primary option (matches current game module)
- **PixiJS** — option for more complex graphics (if needed)
- **Target FPS:** 60 (requestAnimationFrame)

### Dimensions
- **Embedded (sidebar):** ~280x280px (like current game)
- **Detached (window):** ~800x600px minimum, scalable

### Performance
- Maximum ~100 enemies on screen
- Maximum ~50 towers
- Object pooling for reuse

### Compatibility
- Electron 38+
- Node.js CommonJS (require/exports)
- Vanilla JS (no React/Vue)

---

## 📁 File Structure to Create

```
src/renderer/sidebar/modules/power-towers/
├── index.js                 # SidebarModule class
├── styles.css               # All module styles
│
├── core/
│   ├── game-core.js         # Main game engine (singleton)
│   ├── config.js            # Game constants
│   ├── content-loader.js    # Load JSON content packs
│   ├── mechanic-registry.js # Extensible mechanics system
│   ├── map-generator.js     # Procedural map creation
│   ├── pathfinding.js       # Enemy path calculation
│   ├── entity-pool.js       # Object pooling
│   │
│   ├── systems/
│   │   ├── wave-system.js   # Wave spawning logic
│   │   ├── energy-system.js # Energy production/consumption
│   │   ├── economy.js       # Gold management
│   │   ├── combat.js        # Damage calculation
│   │   └── card-system.js   # Card draw, selection, effects
│   │
│   ├── entities/
│   │   ├── base-tower.js    # Base tower (pre-upgrade)
│   │   ├── tower.js         # Upgraded tower class
│   │   ├── enemy.js         # Enemy base class
│   │   ├── projectile.js    # Projectile class
│   │   └── generator.js     # Energy generator
│   │
│   └── progression/
│       ├── xp-manager.js    # XP tracking
│       ├── skill-tree.js    # Talent system
│       └── achievements.js  # Achievement tracking
│
├── renderer/
│   ├── game-renderer.js     # Main canvas renderer
│   ├── card-ui.js           # Card selection overlay
│   ├── layers/
│   │   ├── terrain-layer.js # Ground tiles
│   │   ├── entity-layer.js  # Enemies, towers
│   │   ├── fx-layer.js      # Effects, particles
│   │   └── ui-layer.js      # HUD overlay
│   └── sprites/
│       └── sprite-manager.js
│
├── content-packs/
│   └── base/                # Core game content
│       ├── manifest.json    # Pack metadata
│       ├── towers.json      # All 5 tower paths
│       ├── enemies.json     # Enemy definitions
│       ├── cards.json       # All cards by rarity
│       ├── terrain.json     # Terrain types
│       └── talents.json     # Skill tree
│
├── detach/
│   ├── window.html
│   ├── window.js
│   ├── window.css
│   └── preload.js
│
└── assets/
    ├── sprites/
    │   ├── towers/          # Tower sprites by path
    │   ├── enemies/
    │   └── effects/
    ├── tiles/
    ├── cards/               # Card art
    └── ui/
```

---

## 📝 Open Questions

1. **Graphics engine:** Canvas 2D or add PixiJS?
2. **Map size:** Fixed or scalable?
3. **Multiplayer:** Planned for future?
4. **Monetization:** IAP needed or completely free?
5. **Localization:** English only or multi-language?

---

## 🎨 Style References

- Warcraft 3 (heroes, buildings — more cartoon style)
- Kingdom Rush (TD reference)
- Slay the Spire (roguelike meta-progression)
- Bloons TD (simple but addictive gameplay)

---

## 🚀 Getting Started

### Step 1: Create base module structure
Copy the existing `game` module as template and rename to `power-towers`.

### Step 2: Implement GameCore skeleton
- Tick loop (100ms interval)
- State management
- Broadcast system for renderers

### Step 3: Basic Canvas renderer
- Draw grid
- Placeholder sprites (colored rectangles)
- Path visualization

### Step 4: First playable
- Spawn enemies on timer
- Place one tower
- Tower shoots enemies
- Enemies reach base = lose HP

---

## 💻 Modular Architecture (Implemented)

### Version Control
> **ВАЖНО:** Версия игры остаётся `0.1.0` до явного указания на изменение. Изменять версию только по запросу!

### Current File Structure
```
addons-dev/power-towers/
├── manifest.json              # Addon manifest (version: 0.1.0)
├── index.js                   # Entry point
│
├── core/
│   ├── config.js              # Game constants (MAP_WIDTH: 2000, GRID_SIZE: 20)
│   ├── event-bus.js           # EventBus for module communication
│   ├── game-core.js           # Legacy game engine
│   ├── game-core-modular.js   # NEW: Modular orchestrator
│   │
│   ├── entities/              # Legacy entity classes
│   │   ├── tower.js
│   │   ├── enemy.js
│   │   └── projectile.js
│   │
│   └── systems/               # Legacy systems + camera
│       ├── wave-system.js
│       ├── energy-system.js
│       ├── economy.js
│       └── camera.js          # Viewport/zoom system
│
├── modules/                   # NEW: Modular architecture
│   ├── map/
│   │   └── index.js           # MapModule - terrain, path, buildable cells
│   │
│   ├── towers/
│   │   └── index.js           # TowersModule - tower creation, upgrades, targeting
│   │
│   ├── enemies/
│   │   └── index.js           # EnemiesModule - spawning, movement, waves
│   │
│   ├── combat/
│   │   └── index.js           # CombatModule - projectiles, damage, effects
│   │
│   ├── economy/
│   │   └── index.js           # EconomyModule - gold management
│   │
│   ├── energy/
│   │   └── index.js           # EnergyModule - energy regeneration
│   │
│   ├── player/
│   │   └── index.js           # PlayerModule - lives, XP, level
│   │
│   ├── menu/
│   │   └── index.js           # MenuModule - screens, permanent upgrades
│   │
│   └── game-panel/
│       └── index.js           # SidebarModule integration
│
└── renderer/
    └── game-renderer.js       # Canvas renderer with camera support
```

### Module Communication Pattern
```javascript
// All modules communicate via EventBus
// No direct module-to-module dependencies

// Example: Tower attacks enemy
TowersModule:   emit('combat:tower-attack', { damage, targetId })
CombatModule:   on('combat:tower-attack') → creates projectile
CombatModule:   emit('enemy:damage', { enemyId, damage })
EnemiesModule:  on('enemy:damage') → reduces health
EnemiesModule:  emit('enemy:killed', { reward })
EconomyModule:  on('enemy:killed') → adds gold
```

### Event Categories
| Module | Events Emitted | Events Listened |
|--------|---------------|-----------------|
| MapModule | `map:generated` | `GAME_START`, `map:regenerate` |
| TowersModule | `tower:built`, `tower:sold`, `tower:upgraded`, `combat:tower-attack` | `tower:build-request`, `tower:sell-request` |
| EnemiesModule | `enemy:spawned`, `enemy:killed`, `enemy:escaped`, `wave:started`, `wave:complete` | `wave:start`, `enemy:damage`, `map:generated` |
| CombatModule | `enemy:damage` | `combat:tower-attack` |
| EconomyModule | `economy:updated`, `economy:wave-bonus` | `economy:gain`, `economy:spend`, `wave:complete` |
| EnergyModule | `energy:updated` | `energy:spend`, `energy:gain`, `enemy:killed` |
| PlayerModule | `player:updated`, `player:level-up`, `GAME_OVER` | `player:damage`, `enemy:killed`, `wave:complete` |
| MenuModule | `menu:updated`, `GAME_START`, `menu:gems-earned` | `menu:open`, `menu:start-game`, `GAME_OVER` |

### Using Modular vs Legacy
```javascript
// In game-core-modular.js
class GameCore {
  constructor() {
    this.useModularArchitecture = true; // Toggle modular vs legacy
    
    if (this.useModularArchitecture) {
      this.initModules();  // Initialize all modules
    } else {
      this.initLegacy();   // Use old systems
    }
  }
}
```

---

*Document created: 27.12.2025*
*Last updated: Module architecture implemented*
*Version: 1.0*
