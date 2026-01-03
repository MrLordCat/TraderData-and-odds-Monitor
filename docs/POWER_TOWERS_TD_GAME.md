# Power Towers TD - Roguelike Tower Defense Game

> Inspired by Power Towers TD custom map from Warcraft 3, evolved into a roguelike format with **WebGL rendering**, **elemental abilities**, and **unified building system**.

## 🎯 Concept

### Core Idea
A Tower Defense game with a unique **energy system mechanic** — towers require energy to operate, and the player must balance between defense and energy production using various generators.

### Roguelike Elements
- **Procedural map generation** — spiral path with 2 loops, biome system
- **Meta-progression** — gems accumulate between runs
- **Permanent upgrades** — upgrades persist between games
- **Run-based gameplay** — each run has a beginning and end

### Art Style
**WebGL-rendered** 2D graphics with Warcraft 3 inspired visuals:
- Procedural terrain with biome colors and decorations
- WC3-style towers with platforms, crystals, and turrets
- Multi-cell energy buildings with unique visuals per type
- Particle effects for attacks and abilities

---

## 🎮 Gameplay (Implemented)

### Map & Terrain

#### Technical Specifications
| Property | Value | Notes |
|----------|-------|-------|
| **Map Size** | 2000×2000 px | Configurable via CONFIG |
| **Grid Cell** | 20×20 px | Tower/building placement unit |
| **Visual Padding** | 10% | Wall boundary around playable area |
| **Path Type** | Spiral | 2 loops, tightening toward center |

#### Biome System (6 types)
```
Biome Types:
├── 🟩 Plains   - Default, balanced
├── 🌲 Forest   - Damage +15%, green terrain
├── 🏜️ Desert   - Range +10%, sandy terrain
├── 💧 Water    - Not buildable, blue terrain
├── ⛰️ Mountains - Slow enemies +20%
└── 🔥 Burned   - Dark terrain, fire bonus
```

### Enemy System

#### Enemy Types (from CONFIG)
| Type | Emoji | Health | Speed | Reward | XP |
|------|-------|--------|-------|--------|-----|
| Minion | 👾 | 20 | 40 px/s | 10g | 1 |
| Scout | 🦎 | 20 | 80 px/s | 15g | 2 |
| Brute | 🐗 | 100 | 25 px/s | 30g | 3 |
| Swarmling | 🐜 | 15 | 60 px/s | 5g | 1 |
| Boss | 👹 | 1000 | 20 px/s | 200g | 10 |

#### Wave System
- **Wave delay**: 3000ms between waves
- **Spawn interval**: 800ms between enemies
- **HP scaling**: ×1.05 per wave
- **Speed scaling**: ×1.02 per wave
- **Boss waves**: Every 10 waves

### Tower System

#### Single Tower Mechanic
Player builds **Base Towers** and upgrades them:

```
🗼 Base Tower ─── Cost: 30 gold
      │
      ├──1️⃣ Choose Attack Type (required first)
      │      ├── 💥 Siege   (2x vs buildings/slow)
      │      ├── 🎯 Normal  (balanced)
      │      ├── ✨ Magic   (1.5x vs magic-weak)
      │      └── 🗡️ Piercing (ignores armor)
      │
      ├──2️⃣ Upgrade Stats (infinite levels)
      │      ├── Damage     (+5% per level)
      │      ├── Attack Speed (+4% per level)
      │      ├── Range      (+5% per level)
      │      ├── HP         (+8% per level)
      │      ├── Crit Chance (+1% per level, cap 75%)
      │      ├── Crit Damage (+10% per level)
      │      └── Power Efficiency (-3% energy cost)
      │
      └──3️⃣ Choose Element Path (unlocks abilities)
             ├── 🔥 Fire    - Burn DoT, AoE damage, Inferno
             ├── ❄️ Ice     - Slow, Freeze, Shatter
             ├── ⚡ Lightning - Chain damage, Charge Shot
             ├── 🌿 Nature  - Poison, Thorns, Entangle
             └── 💀 Dark    - True damage, Lifesteal, Void
```

#### Tower Base Stats (from CONFIG)
| Stat | Base Value | Notes |
|------|------------|-------|
| Damage | 10 | +1% per tower level |
| Range | 60 px | 3 grid cells |
| Fire Rate | 1.0/s | Attacks per second |
| Energy Cost | 2 | Per shot |
| HP | 100 | Tower health |
| Crit Chance | 5% | Base critical chance |
| Crit Damage | 1.5× | Critical multiplier |

#### Tower XP System
- **XP Multiplier**: ×2 (configurable)
- **Level thresholds**: [0, 3, 8, 15, 25, 40, 60, 85, 115, 150]
- **Level bonus**: +1% to all stats per level
- **Upgrade discount**: 5% per level (max 50%)

#### Element Abilities
Each element path unlocks unique abilities with upgrade tiers:

**🔥 Fire Path:**
- Burn (DoT) → Inferno (AoE) → Meteor (massive AoE)
- Fire spread mechanics

**❄️ Ice Path:**
- Slow → Freeze → Shatter (bonus damage to frozen)
- Chill stacking system

**⚡ Lightning Path:**
- Chain Lightning → Charge Shot → Overload
- Configurable charge target (0-100%)

**🌿 Nature Path:**
- Poison → Thorns → Entangle (root)
- Spreading poison mechanics

**💀 Dark Path:**
- Soul Siphon → Void → Death Mark
- Lifesteal and true damage

### Energy System

#### Energy Building Types

| Building | Icon | Cost | Size | Gen/tick | Special |
|----------|------|------|------|----------|---------|
| Generator | ⚡ | 50g | 1×1 | 5 | Stable, no requirements |
| Bio Generator | 🌳 | 80g | 2×2 L | 8 | Bonus from nearby nature |
| Wind Turbine | 💨 | 100g | 1×1 | 12 | Fluctuating output |
| Solar Panel | ☀️ | 90g | 1×1 | 10 | Biome-dependent |
| Hydro Generator | 💧 | 120g | 1×1 | 15 | Needs water proximity |
| Geothermal | 🌋 | 150g | 1×1 | 20 | Needs burned terrain |
| Battery | 🔋 | 60g | 2×2 | 0 | Storage: 200, relay |
| Relay | 📡 | 40g | 1×1 | 0 | 2 in, 2 out channels |

#### Unique Building Visuals
Each energy building has distinct WebGL rendering:
- **Generator**: Blue core with pulsing glow, energy rings
- **Solar**: Yellow panels with sun rays animation
- **Wind**: Rotating turbine blades
- **Hydro**: Water flow effect, blue waves
- **Geo**: Orange lava core with heat shimmer
- **Bio**: Green organic mass with leaf particles
- **Battery**: Lightning bolt icon, charge level indicator
- **Relay**: Signal waves emanating outward

#### Energy Building XP & Upgrades
Energy buildings gain XP from energy processed:
- **XP rate**: 1 XP per 100 energy
- **XP per level**: 10
- **Max level**: 20
- **Level bonus**: +2% to all stats per level

**Upgrade Types:**
| Upgrade | Bonus | Base Cost |
|---------|-------|-----------|
| Capacity | +10% per level | 30g |
| Output | +5% per level | 40g |
| Channels | +1 In/Out per level | 60g |
| Range | +1 per level | 50g |
| Efficiency | +10% per level | 35g |
| Generation | +15% per level | 45g |

#### Power Network
```
Connection Flow:
Generator (output:1) ──→ Relay (in:2, out:2) ──→ Tower
     │                                              │
     └─────────────→ Battery (in:1, out:1) ─────────┘
```

- Buildings connect via channels (range-based)
- **Powered bonus**: +10% damage, +15% fire rate
- **Unpowered penalty**: -10% damage, -20% fire rate
- **Overcharge**: Up to 2× power draw for bonus damage

### Economy

| Source | Amount |
|--------|--------|
| Starting Gold | 4000 |
| Enemy Kill | 5-200g (by type) |
| Wave Bonus | Variable |

### Menu System

#### Permanent Upgrades (gems)
| Upgrade | Max | Base Cost | Effect |
|---------|-----|-----------|--------|
| Starting Gold | 10 | 100 gems | +50g per level |
| Starting Lives | 5 | 150 gems | +1 life per level |
| Tower Damage | 10 | 200 gems | +5% per level |
| Energy Regen | 5 | 175 gems | +10% per level |

Cost multiplier: ×1.5 per level

---

## 🏗️ Technical Architecture

### File Structure
```
addons-dev/power-towers/
├── manifest.json              # Addon manifest
├── index.js                   # Entry point
│
├── core/                      # Core systems
│   ├── config.js              # ⭐ All game parameters
│   ├── event-bus.js           # EventBus communication
│   ├── game-core-modular.js   # Main game orchestrator
│   ├── attack-types.js        # Siege/Normal/Magic/Piercing
│   ├── biomes.js              # Biome definitions
│   ├── element-abilities.js   # Element ability definitions
│   ├── tower-upgrade-list.js  # Upgrade system
│   └── upgrades/              # Upgrade definitions
│       ├── stat-upgrades.js
│       ├── abilities.js
│       └── passive-effects.js
│
├── modules/                   # Feature modules
│   ├── map/                   # Map generation
│   ├── placement/             # Unified placement system
│   ├── towers/                # Tower system
│   │   ├── tower-factory.js
│   │   ├── tower-stats.js     # Uses CONFIG for all bonuses
│   │   ├── tower-combat.js
│   │   └── tower-upgrade-handlers.js
│   ├── enemies/               # Enemy system
│   │   ├── index.js
│   │   └── status-effects.js  # DoT, slow, freeze, etc.
│   ├── combat/                # Combat & projectiles
│   ├── economy/               # Gold management
│   ├── energy/                # Energy system
│   │   ├── index.js
│   │   ├── power-network.js
│   │   ├── power-node.js      # Uses CONFIG for bonuses
│   │   ├── generators.js
│   │   ├── storage.js
│   │   └── building-defs.js
│   ├── player/                # Player state
│   ├── menu/                  # Menu & meta-upgrades
│   └── game-panel/            # UI Module
│       ├── index.js
│       ├── templates.js
│       ├── styles.js
│       ├── game-controller.js
│       ├── bottom-panel-ui.js # Uses CONFIG for upgrades
│       ├── ability-upgrades-ui.js
│       └── energy-tooltip-ui.js
│
└── renderer/                  # WebGL Rendering
    ├── game-renderer.js       # Main renderer
    └── engine/                # WebGL infrastructure
        ├── core/
        ├── rendering/
        └── systems/
```

### Configuration System (config.js)

All game parameters are centralized in `config.js` organized by category:

```javascript
CONFIG = {
  // 1. MAP & DISPLAY
  MAP_WIDTH, MAP_HEIGHT, GRID_SIZE, TARGET_FPS...
  
  // 2. ECONOMY
  STARTING_GOLD, BASE_TOWER_COST, UPGRADE_COST_MULTIPLIER...
  TOWER_UPGRADE_DISCOUNT_PER_LEVEL, TOWER_UPGRADE_MAX_DISCOUNT...
  MENU_UPGRADE_COST_MULTIPLIER...
  
  // 3. WAVES & ENEMIES
  WAVE_DELAY_MS, SPAWN_INTERVAL_MS...
  ENEMY_HP_MULTIPLIER, ENEMY_SPEED_MULTIPLIER...
  ENEMY_TYPES: { basic, fast, tank, swarm, boss }
  
  // 4. XP & LEVELING
  XP_MULTIPLIER, TOWER_XP_THRESHOLDS...
  ENERGY_XP_PER_100_ENERGY, ENERGY_XP_PER_LEVEL, ENERGY_MAX_LEVEL...
  
  // 5. TOWERS
  TOWER_BASE_DAMAGE, TOWER_BASE_RANGE, TOWER_BASE_HP...
  TOWER_LEVEL_BONUS_PERCENT: 0.01
  TOWER_UPGRADE_BONUSES: { damage, attackSpeed, range, hp, critChance... }
  TOWER_CRIT_CHANCE_CAP, TOWER_CHAIN_COUNT_CAP, TOWER_POWER_EFFICIENCY_CAP...
  
  // 6. ENERGY SYSTEM
  ENERGY_LEVEL_BONUS_PERCENT, ENERGY_RANGE_PER_LEVEL...
  ENERGY_UPGRADE_BONUSES: { inputRate, outputRate, capacity, channels... }
  ENERGY_UPGRADE_COSTS: { capacity, output, channels, range... }
  TOWER_POWER_BONUSES: { powered: {...}, unpowered: {...} }
  
  // 7. COMBAT
  PROJECTILE_SPEED...
  
  // 8. VISUALS
  COLORS: { background, grid, tower, enemy, ui... }
  PATH_WAYPOINTS, BASE_POSITION
}
```

### Key Events
| Event | Data | Description |
|-------|------|-------------|
| `GAME_START` | - | Game begins |
| `GAME_OVER` | { won } | Game ends |
| `GAME_TICK` | { deltaTime } | Each frame update |
| `wave:start` | - | Start next wave |
| `wave:started` | { wave } | Wave spawned |
| `tower:built` | { tower } | Tower placed |
| `tower:levelup` | { tower } | Tower leveled up |
| `enemy:killed` | { reward, killerId } | Enemy died |
| `energy:stats-updated` | { generation, storage } | Energy changed |

---

## 🎮 Controls

| Action | Control |
|--------|---------|
| Place tower/building | Left-click toolbar + left-click map |
| Select tower/building | Left-click on it |
| Deselect | Right-click / ESC |
| Pan camera | Middle-drag / WASD |
| Zoom | Scroll wheel |
| Start wave | Space / Start button |
| Pause/Resume | Space / Pause button |

---

## 📋 Development Status

### ✅ Implemented
- [x] Modular architecture with EventBus
- [x] Map generation with spiral path
- [x] Biome system (6 types)
- [x] Single tower system with attack types
- [x] 5 Element paths with unique abilities
- [x] Tower XP and level system
- [x] Tower stat upgrades (infinite)
- [x] 5 enemy types with wave scaling
- [x] Status effects (burn, slow, freeze, poison)
- [x] Combat system with projectiles
- [x] Damage numbers
- [x] Complete energy system
  - [x] 7 building types
  - [x] Unique visuals per building
  - [x] Building XP and levels
  - [x] Building upgrades (6 types)
  - [x] Channel system (In/Out)
  - [x] Power network with bonuses
- [x] Unified PlacementManager
- [x] Multi-cell building support
- [x] Economy module
- [x] Menu with permanent upgrades
- [x] Camera with zoom/pan
- [x] WebGL rendering engine
- [x] **Centralized CONFIG system**

### 🚧 Planned
- [ ] Card system (every 10 waves)
- [ ] More enemy types (flying, magic-immune)
- [ ] Boss mechanics (special attacks)
- [ ] Sound effects
- [ ] Achievement system
- [ ] Save/Load system

---

*Document updated: 03.01.2026*
*Game Version: 0.3.0*
