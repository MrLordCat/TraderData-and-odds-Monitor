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
      │      ├── 🎯 Normal  (combo stacks, focus fire → best vs bosses)
      │      ├── 💥 Siege   (splash damage → best vs swarms)
      │      ├── ✨ Magic   (power scaling → best with energy)
      │      └── 🗡️ Piercing (armor penetration, high crit)
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
      ├──2️⃣b Attack Type Upgrades (type-specific)
      │      ├── 🎯 Normal: Combo Power, Combo Mastery, 
      │      │            Combo Persistence, Focus Training, Lethal Focus
      │      ├── 💥 Siege: Splash Radius, Splash Falloff (TODO)
      │      ├── ✨ Magic: Power Scaling, Overdrive (TODO)
      │      └── 🗡️ Piercing: Crit Chance, Crit Damage (TODO)
      │
      └──3️⃣ Choose Element Path (unlocks abilities)
             ├── 🔥 Fire    - Burn DoT, AoE damage, Inferno
             ├── ❄️ Ice     - Slow, Freeze, Shatter
             ├── ⚡ Lightning - Chain damage, Charge Shot
             ├── 🌿 Nature  - Poison, Thorns, Entangle
             └── 💀 Dark    - True damage, Lifesteal, Void
```

#### Attack Type Mechanics

**🎯 Normal Attack** ✅ COMPLETE — Best for single-target sustained damage (bosses)
- **Combo System**: Each hit on same target adds damage stack (configurable)
- **Focus Fire**: After N hits on same target → guaranteed crit with bonus
- **5 Dedicated Upgrades** (all implemented):

| Upgrade | Effect | Base Cost |
|---------|--------|-----------|
| Combo Damage | +1% bonus per combo stack | 25g |
| Combo Stacks | +1 max combo stack | 35g |
| Combo Decay | -0.1s decay time | 30g |
| Focus Threshold | -1 hit to activate focus | 40g |
| Focus Crit Bonus | +0.1× focus crit multiplier | 45g |

**Config (in `core/config/attacks/normal.js`):**
```javascript
COMBO: {
  baseDamageBonus: 0.05,  // +5% per stack base
  maxStacks: 10,
  decayTime: 3000         // ms before combo resets
},
FOCUS: {
  hitsToActivate: 5,
  critMultiplier: 2.0     // Guaranteed crit multiplier
}
```

**💥 Siege Attack** — Best for crowd control (swarms)
- **Splash Damage**: Hits multiple enemies in radius
- **Falloff**: Damage decreases at edge of splash

**✨ Magic Attack** — Best with energy investment
- **Power Scaling**: Damage scales 1.5× with energy supply
- **Overdrive**: Can consume extra power for burst damage

**🗡️ Piercing Attack** — Best for critical hits
- **High Crit**: 15% base crit chance (vs 5% normal)
- **Armor Penetration**: Ignores 20% enemy armor

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
Towers gain XP (upgrade points) from upgrades. Level determines stat bonuses and upgrade discounts.

**XP Scaling Formula:**
```
XP for level N = BASE_XP × SCALE^(N-2)
Total XP = sum of all levels
```

**Config Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `XP_MULTIPLIER` | 2 | Global XP gain multiplier |
| `TOWER_BASE_XP` | 3 | XP needed for level 2 |
| `TOWER_XP_SCALE` | 1.5 | Scale factor per level |
| `TOWER_MAX_LEVEL` | 10 | Maximum tower level |

**Example Thresholds (BASE=3, SCALE=1.5):**
| Level | XP Needed | Cumulative |
|-------|-----------|------------|
| 1 | 0 | 0 |
| 2 | 3 | 3 |
| 3 | 5 | 8 |
| 4 | 7 | 15 |
| 5 | 10 | 25 |
| 6 | 15 | 40 |
| 7 | 23 | 63 |
| 8 | 34 | 97 |
| 9 | 51 | 148 |
| 10 | 77 | 225 |

**Level Bonuses:**
- **Stat bonus**: +1% to all stats per level
- **Upgrade discount**: Individual per upgrade (see below)

#### Upgrade Discount System ✅
Each upgrade has its own discount stack that accumulates independently:

**Discount Formula:**
```
discountStacks = tower.level - lastPurchaseLevel[upgradeId]
discountPercent = min(50%, stacks × 5%)
finalCost = rawCost × (1 - discountPercent)
```

**How it works:**
1. When tower levels up → all unpurchased upgrades gain discount stacks
2. When upgrade is purchased → only THAT upgrade's discount resets
3. Other upgrades keep their accumulated discounts

**Config (in `core/config/upgrades.js`):**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `percentPerStack` | 0.05 | 5% discount per stack |
| `maxPercent` | 0.50 | Maximum 50% discount |

**Example:**
- Tower at Level 3, never bought Damage upgrade → 2 stacks → 10% discount
- Buy Damage → Damage discount resets to 0
- Attack Speed still has 2 stacks (10% discount)
- Tower levels to 4 → Damage has 1 stack, Attack Speed has 3 stacks

**Utils:** `core/utils/xp-utils.js`
- `getTowerXpThreshold(level)` - cumulative XP for level
- `calculateTowerLevel(xp)` - level from XP points
- `getTowerXpProgress(xp, level)` - {current, needed, percent}

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
Energy buildings gain XP from energy processed (linear scaling).

**Config Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `ENERGY_XP_PER_100_ENERGY` | 2 | XP gained per 100 energy |
| `ENERGY_XP_PER_LEVEL` | 10 | XP needed per level |
| `ENERGY_MAX_LEVEL` | 20 | Maximum building level |
| `ENERGY_LEVEL_BONUS_PERCENT` | 0.02 | +2% stats per level |

**Level Bonuses:**
- +2% to all stats per level (output, capacity, range, etc.)

**Utils:** `core/utils/xp-utils.js`
- `getEnergyXpThreshold(level)` - cumulative XP for level
- `calculateEnergyLevel(xp)` - level from XP
- `getEnergyXpProgress(xp, level)` - {current, needed, percent}

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
│   ├── config/                # ⭐ Modular configuration
│   │   ├── index.js           # Entry point (aggregates all)
│   │   ├── base.js            # Map, display, visuals, colors
│   │   ├── economy.js         # Gold, costs, starting values
│   │   ├── waves.js           # Wave timing, enemy types
│   │   ├── tower.js           # Tower stats, upgrades, XP
│   │   ├── energy.js          # Energy system buildings
│   │   └── attacks/           # Attack type configs
│   │       ├── index.js       # Aggregator + helpers
│   │       ├── normal.js      # Combo System, Focus Fire
│   │       ├── siege.js       # Splash mechanics
│   │       ├── magic.js       # Power scaling
│   │       └── piercing.js    # Critical mechanics
│   │
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
│   │   ├── tower-combat.js    # Combo/Focus Fire logic
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

### Configuration System (core/config/)

All game parameters are organized in a modular folder structure:

```
core/config/
├── index.js      # Entry point - aggregates all configs
├── base.js       # Map, display, visuals, colors
├── economy.js    # Gold, costs, starting values
├── waves.js      # Wave timing, enemy types
├── tower.js      # Tower stats, upgrades, XP
├── energy.js     # Energy system buildings
└── attacks/      # Attack type specific configs
    ├── index.js  # Aggregator + helper functions
    ├── normal.js # Combo System, Focus Fire, upgrades
    ├── siege.js  # Splash damage mechanics
    ├── magic.js  # Power scaling mechanics
    └── piercing.js # Critical hit mechanics
```

**Usage:**
```javascript
// Import unified config (backwards compatible)
const CONFIG = require('./config/index');
// CONFIG.MAP_WIDTH, CONFIG.ENEMY_TYPES, CONFIG.TOWER_BASE_DAMAGE...

// Import attack type configs with helpers
const { 
  ATTACK_TYPE_CONFIG,
  getAttackTypeUpgrades,
  calculateAttackTypeUpgradeCost 
} = require('./config/attacks');

// Direct access to specific attack config
const NORMAL = require('./config/attacks/normal');
// NORMAL.combo.baseDmgPerStack, NORMAL.focusFire.baseHitsRequired...
```

**Config Sections:**

| File | Contents |
|------|----------|
| `base.js` | MAP_WIDTH, GRID_SIZE, COLORS, PATH_WAYPOINTS |
| `economy.js` | STARTING_GOLD, BASE_TOWER_COST, UPGRADE_COST_MULTIPLIER |
| `waves.js` | WAVE_DELAY_MS, ENEMY_TYPES, scaling multipliers |
| `tower.js` | TOWER_BASE_*, TOWER_UPGRADE_BONUSES, XP settings |
| `energy.js` | ENERGY_UPGRADE_*, TOWER_POWER_BONUSES |
| `attacks/normal.js` | Combo System, Focus Fire, 5 upgrades |
| `attacks/siege.js` | Splash radius, falloff (TODO) |
| `attacks/magic.js` | Power scaling, overdrive (TODO) |
| `attacks/piercing.js` | Crit chance/damage bonuses (TODO) |

**Attack Type Configs:**

Normal Attack (best for bosses):
```javascript
normal: {
  combo: {
    baseDmgPerStack: 0.05,  // +5% per stack
    maxStacks: 10,
    decayTime: 2.0,         // seconds
  },
  focusFire: {
    baseHitsRequired: 5,    // hits for guaranteed crit
    baseCritBonus: 0.5,     // +50% crit damage
  },
  upgrades: {
    comboDamage,            // +1% per stack per level
    comboMaxStacks,         // +2 max stacks per level
    comboDecay,             // +0.5s decay time per level
    focusFire,              // -1 hit required per level
    focusCritBonus,         // +15% crit bonus per level
  }
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
- [x] **Normal Attack mechanics** (Combo System, Focus Fire)
- [x] **Attack type upgrades** (5 upgrades for Normal)
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
- [x] **Modular CONFIG system** (split into domain files)

### 🚧 Planned
- [ ] Siege Attack mechanics (splash upgrades)
- [ ] Magic Attack mechanics (power scaling upgrades)
- [ ] Piercing Attack mechanics (crit upgrades)
- [ ] Card system (every 10 waves)
- [ ] More enemy types (flying, magic-immune)
- [ ] Boss mechanics (special attacks)
- [ ] Sound effects
- [ ] Achievement system
- [ ] Save/Load system

---

*Document updated: 06.01.2026*
*Game Version: 0.4.0*
