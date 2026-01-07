# Power Towers TD - Copilot Instructions

AI assistant instructions for working on the Power Towers TD addon.

## 0. General Rules
**CRITICAL: NEVER create new terminal instances.** Always reuse the existing active terminal.
- Combine commands with `;` (e.g., `git add -A; git commit -m "msg"; git push`)
- Split files longer than ~500 lines into modules

## 1. About the Game

### Concept
Tower Defense with a unique **energy system mechanic** — towers require energy to operate, player balances between defense and energy production.

### Roguelike Elements
- Procedural map generation (spiral path with 2 loops, biome system)
- Meta-progression through gems between runs
- Permanent upgrades

### Rendering
WebGL 2D graphics with Warcraft 3-inspired visuals and particle animations.

### Map & Terrain
| Property | Value | Notes |
|----------|-------|-------|
| Map Size | 2000×2000 px | Configurable via CONFIG |
| Grid Cell | 20×20 px | Tower/building placement unit |
| Visual Padding | 10% | Wall boundary around playable area |
| Path Type | Spiral | 2 loops, tightening toward center |

### Biome System (6 types)
| Biome | Effect | Terrain |
|-------|--------|---------|
| Plains | Default, balanced | Green grass |
| Forest | Damage +15% | Dark green |
| Desert | Range +10% | Sandy yellow |
| Water | Not buildable | Blue (blocks placement) |
| Mountains | Enemy slow +20% | Gray rocks |
| Burned | Fire bonus | Dark charred |

### Enemy System
| Type | Emoji | Health | Speed | Reward | XP |
|------|-------|--------|-------|--------|-----|
| Minion | 👾 | 20 | 40 px/s | 10g | 1 |
| Scout | 🦎 | 20 | 80 px/s | 15g | 2 |
| Brute | 🐗 | 100 | 25 px/s | 30g | 3 |
| Swarmling | 🐜 | 15 | 60 px/s | 5g | 1 |
| Boss | 👹 | 1000 | 20 px/s | 200g | 10 |

### Wave System
- **Wave delay**: 3000ms between waves
- **Spawn interval**: 800ms between enemies
- **HP scaling**: ×1.05 per wave
- **Speed scaling**: ×1.02 per wave
- **Boss waves**: Every 10 waves

---

## 2. Project Structure

```
addons-dev/power-towers/
├── manifest.json              # Addon manifest
├── index.js                   # Entry point
│
├── core/                      # Core systems
│   ├── config/                # ⭐ Modular configuration
│   │   ├── index.js           # Aggregates all configs
│   │   ├── base.js            # Map, visuals, colors
│   │   ├── economy.js         # Gold, costs
│   │   ├── waves.js           # Waves, enemy types
│   │   ├── tower.js           # Tower stats, XP
│   │   ├── energy.js          # Energy buildings
│   │   └── attacks/           # Attack type configs
│   │       ├── index.js       # Aggregator + helpers
│   │       ├── normal.js      # Combo System, Focus Fire
│   │       ├── siege.js       # Splash + Armor Shred + Ground Zone
│   │       ├── magic.js       # Power scaling
│   │       └── piercing.js    # Critical mechanics
│   │
│   ├── event-bus.js           # EventBus communication
│   ├── game-core-modular.js   # Main orchestrator
│   ├── attack-types.js        # Attack handlers (Siege/Normal/Magic/Piercing)
│   ├── biomes.js              # Biome definitions
│   ├── element-abilities.js   # Elemental abilities
│   └── tower-upgrade-list.js  # Upgrade system
│
├── modules/                   # Feature modules
│   ├── map/                   # Map generation
│   ├── placement/             # Placement system
│   ├── towers/                # Tower system
│   │   ├── tower-factory.js   # Tower creation
│   │   ├── tower-stats.js     # Stat calculation (uses CONFIG)
│   │   ├── tower-combat.js    # Combo/Focus/Siege logic
│   │   └── tower-upgrade-handlers.js
│   ├── enemies/               # Enemy system
│   │   ├── index.js
│   │   └── status-effects.js  # DoT, slow, freeze, shred
│   ├── combat/                # Combat system and projectiles
│   ├── economy/               # Gold management
│   ├── energy/                # Energy system
│   ├── player/                # Player state
│   ├── menu/                  # Menu and meta-upgrades
│   └── game-panel/            # UI Module (see section 5)
│
└── renderer/                  # WebGL Rendering
    ├── game-renderer.js       # Main renderer
    └── engine/                # WebGL infrastructure
```

---

## 3. Key Systems

### 3.1 Tower System

Player builds **Base Tower** and upgrades it:

```
🗼 Base Tower (30 gold)
├── 1️⃣ Choose Attack Type (required first)
│     ├── 🎯 Normal  (combo stacks → best vs bosses)
│     ├── 💥 Siege   (splash damage → best vs swarms)
│     ├── ✨ Magic   (power scaling → best with energy)
│     └── 🗡️ Piercing (armor pen, high crit)
│
├── 2️⃣ Stat Upgrades (infinite levels)
│     Damage, AttackSpeed, Range, HP, CritChance, CritDamage, PowerEfficiency
│
├── 2️⃣b Attack Type Upgrades (type-specific)
│
└── 3️⃣ Element Path (unlocks abilities)
      🔥 Fire, ❄️ Ice, ⚡ Lightning, 🌿 Nature, 💀 Dark
```

### 3.2 Attack Types

| Type | Emoji | Purpose | Mechanics |
|------|-------|---------|-----------|
| **Normal** | 🎯 | Single-target, bosses | Combo System (stacks), Focus Fire (guaranteed crit) |
| **Siege** | 💥 | AoE, swarms | Splash Damage, Armor Shred, Ground Zone (craters) |
| **Magic** | ✨ | With energy | Power Scaling 1.5×, Overdrive |
| **Piercing** | 🗡️ | Crits | 15% base crit, 20% armor pen |

### 3.3 Tower Base Stats
| Stat | Base Value | Upgrade Bonus |
|------|------------|---------------|
| Damage | 10 | +5% per level |
| Range | 60 px | +5% per level |
| Fire Rate | 1.0/s | +4% per level |
| Energy Cost | 2 | -3% per level |
| HP | 100 | +8% per level |
| Crit Chance | 5% | +1% per level (cap 75%) |
| Crit Damage | 1.5× | +10% per level |

### 3.4 Tower XP & Level System
Towers gain XP from upgrades. Level provides stat bonuses and upgrade discounts.

**XP Formula:** `XP_needed = BASE_XP × SCALE^(level-2)`
- `TOWER_BASE_XP` = 3
- `TOWER_XP_SCALE` = 1.5
- `TOWER_MAX_LEVEL` = 10

**Level Bonuses:**
- +1% to all stats per level
- Upgrade discount: 5% per level since last purchase (max 50%)

### 3.5 Normal Attack (implemented)

**Combo System:**
- Each hit on same target adds damage stack
- Base: +5% damage per stack, max 10 stacks
- Decay: 3 seconds without hitting

**Focus Fire:**
- After 5 hits on same target → guaranteed crit
- Base crit multiplier: 2.0×

**Upgrades:**
| ID | Name | Effect | Cost |
|----|------|--------|------|
| `comboDamage` | Combo Power | +1% per stack | 25g |
| `comboMaxStacks` | Combo Mastery | +2 max stacks | 35g |
| `comboDecay` | Combo Persistence | +0.5s decay | 30g |
| `focusFire` | Focus Training | -1 hit required | 40g |
| `focusCritBonus` | Lethal Focus | +15% crit bonus | 45g |

### 3.6 Siege Attack (implemented)

**Splash Damage:**
- Base radius: 60px
- Falloff: 50% at edges

**Armor Shred:**
- Reduces enemy armor per hit
- Base: 5% per hit, 5 max stacks, 4s duration

**Ground Zone (Craters):**
- Explosions leave slowing zones
- Base: 25% slow, 2s duration, 40px radius

**Upgrades:**
| ID | Name | Effect |
|----|------|--------|
| `splashRadius` | Blast Radius | +8% splash radius |
| `splashFalloff` | Concentrated | -5% falloff |
| `shredUnlock` | Armor Shred | Unlocks shred |
| `shredAmount` | Sunder | +2% shred per hit |
| `shredStacks` | Deep Wounds | +1 max stacks |
| `shredDuration` | Lasting Wounds | +1s duration |
| `groundZoneUnlock` | Crater Zone | Unlocks craters |
| `groundZoneSlow` | Tar Pit | +5% slow |
| `groundZoneDuration` | Lingering | +0.5s duration |
| `groundZoneRadius` | Wide Impact | +5px radius |

**Files:**
- Config: `core/config/attacks/siege.js`
- Handler: `core/attack-types.js` → `processSiegeAttack()`
- Shred effect: `modules/enemies/status-effects.js` → `ARMOR_SHRED`
- Combat logic: `modules/towers/tower-combat.js` → `getSiegeConfig()`, `processSiegeHit()`

### 3.7 Energy System

| Building | Cost | Size | Gen/tick | Special |
|----------|------|------|----------|---------|
| Generator ⚡ | 50g | 1×1 | 5 | Stable |
| Bio Generator 🌳 | 80g | 2×2 | 8 | Nature bonus |
| Wind Turbine 💨 | 100g | 1×1 | 12 | Fluctuating |
| Solar Panel ☀️ | 90g | 1×1 | 10 | Biome-dependent |
| Hydro 💧 | 120g | 1×1 | 15 | Needs water |
| Geothermal 🌋 | 150g | 1×1 | 20 | Needs burned terrain |
| Battery 🔋 | 60g | 2×2 | 0 | Storage: 200 |

**Power Network:**
- Towers connect to energy buildings via channels
- **Powered bonus**: +10% damage, +15% fire rate
- **Unpowered penalty**: -10% damage, -20% fire rate

### 3.8 Element Abilities
Each element path unlocks unique abilities:

| Element | Emoji | Abilities |
|---------|-------|-----------|
| Fire | 🔥 | Burn DoT → Inferno (AoE) → Meteor |
| Ice | ❄️ | Slow → Freeze → Shatter |
| Lightning | ⚡ | Chain Lightning → Charge Shot → Overload |
| Nature | 🌿 | Poison → Thorns → Entangle (root) |
| Dark | 💀 | Soul Siphon → Void → Death Mark |

---

## 4. Configuration (core/config/)

**Usage:**
```javascript
// Unified import
const CONFIG = require('./config/index');

// Attack types with helpers
const { ATTACK_TYPE_CONFIG, getAttackTypeUpgrades } = require('./config/attacks');

// Direct access to attack config
const SIEGE = require('./config/attacks/siege');
// SIEGE.splash.baseRadius, SIEGE.armorShred.baseAmount...
```

---

## 5. UI / Game Panel

### Bottom Panel Architecture

```
game-panel/
├── index.js               # Main SidebarModule
├── templates.js           # HTML templates
├── styles.js              # CSS styles (including tooltip styles)
├── game-controller.js     # Game control, element caching
└── bottom-panel/          # ⭐ Mixins for BottomPanel
    ├── index.js           # BottomPanelMixin (composition)
    ├── events.js          # BottomPanelEventsMixin
    ├── tower-stats.js     # TowerStatsMixin (tower stats + popups)
    ├── energy-stats.js    # EnergyStatsMixin
    ├── upgrades.js        # UpgradesMixin
    └── utils/
        └── stat-detail-builder.js  # Popup content builder
```

### Element Caching Pattern

In `game-controller.js`:
```javascript
const el = {
  panelDamage: container.querySelector('#panel-damage'),
  panelSplash: container.querySelector('#panel-splash'),
  panelShred: container.querySelector('#panel-shred'),
  panelCrater: container.querySelector('#panel-crater'),
  // ...
};
```

### Stat Detail Builder

```javascript
const { createDetailBuilder } = require('./utils/stat-detail-builder');

const builder = createDetailBuilder()
  .base('Base:', '60px')                          // Base value
  .line('Upgrades (3):', '+24%', 'detail-upgrade') // Upgrade bonus
  .line('Status:', '🔒 Locked', 'detail-locked')  // Locked state
  .final('74px')                                   // Final value
  .formula('AoE damage');                          // Description

element.innerHTML = builder.build();
```

**CSS classes for popups:**
- `detail-base` - blue (#63b3ed)
- `detail-level` - orange (#f6ad55)
- `detail-upgrade` - red (#fc8181)
- `detail-upgrade.bonus` - green (#48bb78)
- `detail-locked` - gray italic (#718096)
- `detail-final` - gold bold (#ffd700)

---

## 6. Key Events (EventBus)

| Event | Data | Description |
|-------|------|-------------|
| `GAME_TICK` | { deltaTime } | Every frame |
| `tower:built` | { tower } | Tower placed |
| `tower:levelup` | { tower } | Tower leveled up |
| `tower:selected` | { tower } | Tower selected |
| `enemy:killed` | { reward, killerId } | Enemy killed |
| `enemy:hit` | { enemy, damage, tower } | Enemy took damage |

---

## 7. Adding a New Upgrade

1. **Config** (`core/config/attacks/<type>.js`):
```javascript
upgrades: {
  myUpgrade: {
    id: 'myUpgrade',
    name: 'My Upgrade',
    description: 'Does something',
    baseCost: 30,
    costMultiplier: 1.3,
    maxLevel: 5,
    requires: 'someOtherUpgrade', // optional
    effect: { valuePerLevel: 0.05 }
  }
}
```

2. **Upgrade list** (`core/tower-upgrade-list.js`):
```javascript
{
  id: 'myUpgrade',
  attackType: 'siege',
  category: 'siege',
  // ...
}
```

3. **Apply effect** (`modules/towers/tower-stats.js` or `tower-combat.js`)

4. **UI display** (`game-panel/bottom-panel/tower-stats.js`):
   - Add value display in `updateBottomPanelStats()`
   - Add popup in `updateStatDetailPopups()`

5. **HTML template** (`game-panel/bottom-panel/templates.js`):
```html
<div class="stat-item stat-hoverable" data-stat="mystat" id="stat-row-mystat">
  <span class="stat-label">🔧 MY STAT</span>
  <span class="stat-value" id="panel-mystat">-</span>
  <div class="hover-popup" id="panel-detail-mystat"></div>
</div>
```

6. **Cache element** (`game-panel/game-controller.js`):
```javascript
panelMystat: container.querySelector('#panel-mystat'),
```

---

## 8. Development Status

### ✅ Implemented
- Modular architecture with EventBus
- Map generation with spiral path
- Biome system (6 types)
- Tower system with attack types
- **Normal Attack** (Combo System, Focus Fire) — complete
- **Siege Attack** (Splash, Armor Shred, Ground Zone) — complete
- 5 elemental paths
- XP system for towers and buildings
- 5 enemy types with wave scaling
- Status effects (burn, slow, freeze, poison, armor_shred)
- Complete energy system
- WebGL rendering

### 🚧 Planned
- Magic Attack mechanics (power scaling upgrades)
- Piercing Attack mechanics (crit upgrades)
- Card system (every 10 waves)
- More enemy types (flying, magic-immune)
- Boss mechanics
- Sound effects
- Save/Load system

---

## 9. Common Mistakes

- **Forgot to cache element** — add to `game-controller.js`
- **Empty popup** — check that `getElementById` finds the element
- **Upgrade not applying** — check that you're reading from `tower.attackTypeUpgrades`
- **Stat not updating** — ensure `updateBottomPanelStats()` is being called
- **CSS class not working** — check `styles/tooltips.js`

---

*Document version: 07.01.2026*
*Game version: 0.5.0 (Siege Complete)*
