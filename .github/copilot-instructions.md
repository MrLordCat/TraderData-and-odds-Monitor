# Power Towers TD - Copilot Instructions

AI assistant instructions for working on the Power Towers TD addon.

## 0. General Rules
**CRITICAL: NEVER create new terminal instances.** Always reuse the existing active terminal.
- Combine commands with `;` (e.g., `git add -A; git commit -m "msg"; git push`)
- Split files longer than ~500 lines into modules

## 1. About the Game

### Concept
Tower Defense with a unique **energy system mechanic** тАФ towers require energy to operate, player balances between defense and energy production.

### Roguelike Elements
- Procedural map generation (spiral path with 2 loops, biome system)
- Meta-progression through gems between runs
- Permanent upgrades

### Rendering
WebGL 2D graphics with Warcraft 3-inspired visuals and particle animations.

### Map & Terrain
| Property | Value | Notes |
|----------|-------|-------|
| Map Size | 2000├Ч2000 px | Configurable via CONFIG |
| Grid Cell | 20├Ч20 px | Tower/building placement unit |
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

### Base Enemy Types
| Type | Emoji | Health | Speed | Reward | XP |
|------|-------|--------|-------|--------|-----|
| Minion | 👾 | 20 | 40 px/s | 10g | 1 |
| Scout | 🦎 | 20 | 80 px/s | 15g | 2 |
| Brute | 🐗 | 100 | 25 px/s | 30g | 3 |
| Swarmling | 🐜 | 15 | 60 px/s | 5g | 1 |
| Boss | 👹 | 1000 | 20 px/s | 200g | 10 |

### Special Enemy Types (8 types)
| Type | Emoji | Wave | Mechanic |
|------|-------|------|----------|
| Flying | 🦅 | 8 | Hovers, needs anti-air |
| Armored | 🛡️ | 12 | High armor |
| Magic-Immune | 🔮 | 16 | Immune to Magic attacks |
| Regenerating | 💚 | 15 | Heals over time |
| Shielded | 🔷 | 21 | Absorbs damage |
| Phasing | 👻 | 21 | Periodic invulnerability |
| Undead | 💀 | 23 | Resurrects once |
| Splitter | 👥 | 25 | Splits on death |

### Elite Enemies
- Gold tint, ×2 HP, ×2.5 reward
- Chance: 1% + 0.5%/wave (max 15%)

### Wave Auras (7 types)
| Aura | Effect |
|------|--------|
| Haste ⚡ | +25% speed |
| Fortified 🛡️ | +30% HP |
| Regeneration 💚 | 2% HP/sec |
| Energized ⚡ | Slow immune |
| Ethereal 👻 | -20% damage |
| Berserker 🔥 | +50% speed <30% HP |
| Swarm Mind 🧠 | Share damage |

### Wave System
- **Wave delay**: 3000ms between waves
- **Spawn interval**: 800ms between enemies
- **HP scaling**: ├Ч1.05 per wave
- **Speed scaling**: ├Ч1.02 per wave
- **Boss waves**: Every 10 waves

---

## 2. Project Structure

```
addons-dev/power-towers/
тФЬтФАтФА manifest.json              # Addon manifest
тФЬтФАтФА index.js                   # Entry point
тФВ
тФЬтФАтФА core/                      # Core systems
тФВ   тФЬтФАтФА config/                # тнР Modular configuration
тФВ   тФВ   тФЬтФАтФА index.js           # Aggregates all configs
тФВ   тФВ   тФЬтФАтФА base.js            # Map, visuals, colors
тФВ   тФВ   тФЬтФАтФА economy.js         # Gold, costs
тФВ   тФВ   тФЬтФАтФА waves.js           # Waves, enemy types
тФВ   тФВ   тФЬтФАтФА tower.js           # Tower stats, XP
тФВ   тФВ   тФЬтФАтФА energy.js          # Energy buildings
тФВ   тФВ   тФФтФАтФА attacks/           # Attack type configs
тФВ   тФВ       тФЬтФАтФА index.js       # Aggregator + helpers
тФВ   тФВ       тФЬтФАтФА normal.js      # Combo System, Focus Fire
тФВ   тФВ       тФЬтФАтФА siege.js       # Splash + Armor Shred + Ground Zone
тФВ   тФВ       тФЬтФАтФА magic.js       # Power scaling
тФВ   тФВ       тФФтФАтФА piercing.js    # Critical mechanics
тФВ   тФВ
тФВ   тФЬтФАтФА enemies/               # ⭐ Enemy configuration
тФВ   тФВ   тФЬтФАтФА index.js           # Enemy types aggregator
тФВ   тФВ   тФЬтФАтФА special/           # Special enemy types
тФВ   тФВ   тФВ   тФЬтФАтФА index.js       # Special types aggregator
тФВ   тФВ   тФВ   тФЬтФАтФА flying.js      # Flying enemies
тФВ   тФВ   тФВ   тФЬтФАтФА armored.js     # High armor enemies
тФВ   тФВ   тФВ   тФЬтФАтФА magic-immune.js # Magic immunity
тФВ   тФВ   тФВ   тФЬтФАтФА regenerating.js # HP regen
тФВ   тФВ   тФВ   тФЬтФАтФА shielded.js    # Damage shields
тФВ   тФВ   тФВ   тФЬтФАтФА phasing.js     # Invulnerability phases
тФВ   тФВ   тФВ   тФЬтФАтФА undead.js      # Resurrection
тФВ   тФВ   тФВ   тФФтФАтФА splitter.js    # Split on death
тФВ   тФВ   тФЬтФАтФА elite.js           # Elite enemy system
тФВ   тФВ   тФФтФАтФА auras.js           # Wave aura system
тФВ   тФВ
тФВ   тФЬтФАтФА waves/                 # Wave compositions
тФВ   тФВ   тФЬтФАтФА index.js           # Wave system aggregator
тФВ   тФВ   тФФтФАтФА compositions.js    # 40 wave definitions
тФВ   тФВ
тФВ   тФЬтФАтФА event-bus.js           # EventBus communication
тФВ   тФЬтФАтФА game-core-modular.js   # Main orchestrator
тФВ   тФЬтФАтФА attack-types.js        # Attack handlers (Siege/Normal/Magic/Piercing)
тФВ   тФЬтФАтФА biomes.js              # Biome definitions
тФВ   тФЬтФАтФА element-abilities.js   # Elemental abilities
тФВ   тФФтФАтФА tower-upgrade-list.js  # Upgrade system
тФВ
тФЬтФАтФА modules/                   # Feature modules
тФВ   тФЬтФАтФА map/                   # Map generation
тФВ   тФЬтФАтФА placement/             # Placement system
тФВ   тФЬтФАтФА towers/                # Tower system
тФВ   тФВ   тФЬтФАтФА tower-factory.js   # Tower creation
тФВ   тФВ   тФЬтФАтФА tower-stats.js     # Stat calculation (uses CONFIG)
тФВ   тФВ   тФЬтФАтФА tower-combat.js    # Combo/Focus/Siege logic
тФВ   тФВ   тФФтФАтФА tower-upgrade-handlers.js
тФВ   тФЬтФАтФА enemies/               # Enemy system
тФВ   тФВ   тФЬтФАтФА index.js
тФВ   тФВ   тФФтФАтФА status-effects.js  # DoT, slow, freeze, shred
тФВ   тФЬтФАтФА combat/                # Combat system and projectiles
тФВ   тФЬтФАтФА economy/               # Gold management
тФВ   тФЬтФАтФА energy/                # Energy system
тФВ   тФЬтФАтФА player/                # Player state
тФВ   тФЬтФАтФА menu/                  # Menu and meta-upgrades
тФВ   тФФтФАтФА game-panel/            # UI Module (see section 5)
тФВ
тФФтФАтФА renderer/                  # WebGL Rendering
    тФЬтФАтФА game-renderer.js       # Main renderer
    тФФтФАтФА engine/                # WebGL infrastructure
```

---

## 3. Key Systems

### 3.1 Tower System

Player builds **Base Tower** and upgrades it:

```
ЁЯЧ╝ Base Tower (30 gold)
тФЬтФАтФА 1я╕ПтГг Choose Attack Type (required first)
тФВ     тФЬтФАтФА ЁЯОп Normal  (combo stacks тЖТ best vs bosses)
тФВ     тФЬтФАтФА ЁЯТе Siege   (splash damage тЖТ best vs swarms)
тФВ     тФЬтФАтФА тЬи Magic   (power scaling тЖТ best with energy)
тФВ     тФФтФАтФА ЁЯЧбя╕П Piercing (armor pen, high crit)
тФВ
тФЬтФАтФА 2я╕ПтГг Stat Upgrades (infinite levels)
тФВ     Damage, AttackSpeed, Range, HP, CritChance, CritDamage, PowerEfficiency
тФВ
тФЬтФАтФА 2я╕ПтГгb Attack Type Upgrades (type-specific)
тФВ
тФФтФАтФА 3я╕ПтГг Element Path (unlocks abilities)
      ЁЯФе Fire, тЭДя╕П Ice, тЪб Lightning, ЁЯМ┐ Nature, ЁЯТА Dark
```

### 3.2 Attack Types

| Type | Emoji | Purpose | Mechanics |
|------|-------|---------|-----------|
| **Normal** | 🎯 | Single-target, bosses | Combo System (stacks), Focus Fire (guaranteed crit) |
| **Siege** | 💥 | AoE, swarms | Splash Damage, Armor Shred, Ground Zone (craters) |
| **Magic** | ✨ | Energy-based burst | Charge System, Arcane Overflow (cascade) |
| **Piercing** | 🗡️ | Crit-focused, execute | Precision System, Deadly Momentum, Execute, Bleed |

### 3.3 Tower Base Stats
| Stat | Base Value | Upgrade Bonus |
|------|------------|---------------|
| Damage | 10 | +5% per level |
| Range | 60 px | +5% per level |
| Fire Rate | 1.0/s | +4% per level |
| Energy Cost | 2 | -3% per level |
| HP | 100 | +8% per level |
| Crit Chance | 5% | +1% per level (cap 75%) |
| Crit Damage | 1.5├Ч | +10% per level |

### 3.4 Tower XP & Level System
Towers gain XP from upgrades. Level provides stat bonuses and upgrade discounts.

**XP Formula:** `XP_needed = BASE_XP ├Ч SCALE^(level-2)`
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
- After 5 hits on same target тЖТ guaranteed crit
- Base crit multiplier: 2.0├Ч

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

### 3.7 Magic Attack (implemented)

**Charge System:**
- Tower charges energy before firing
- **Formula:** `Shot Cost = DMG × 1.2 × (1 + charge%)²`
- Higher charge% = more damage but higher energy cost
- Instant charging from tower's energy storage

**Arcane Overflow (Cascade):**
- Overkill damage transfers to nearest enemy
- Base transfer: 75% of overkill damage
- Search radius: 80px (upgradeable)

**Stat Modifiers:**
- Attack Speed: ×0.7 (slower)
- Damage: ×0.9 (slightly lower base)
- Range: ×1.2 (extended)
- Energy Storage: ×1.2 (more capacity)

**Upgrades:**
| ID | Name | Emoji | Effect |
|----|------|-------|--------|
| `energyEfficiency` | Arcane Efficiency | ⚡ | -0.1 efficiency divisor per level |
| `overflowRange` | Overflow Reach | 🔮 | +20px cascade search radius |
| `overflowDamage` | Arcane Cascade | 💫 | +10% cascade damage transfer |
| `chargeSpeed` | Quick Charge | 🔋 | +15% charge rate |

**Files:**
- Config: `core/config/attacks/magic.js`
- Combat logic: `modules/towers/tower-combat.js` → `getMagicConfig()`, `updateMagicCharge()`, `processArcaneOverflow()`
- UI: `modules/game-panel/bottom-panel/tower-stats.js` → Magic charge popup

### 3.8 Piercing Attack (implemented)

**Precision System:**
- Guaranteed critical hit after N hits (default: 8)
- Precision crit deals +25% bonus damage
- Counter does NOT reset on target switch

**Deadly Momentum:**
- Each crit adds +3% crit chance (stacking)
- Max 5 stacks (+15% crit chance)
- Decays after 3 seconds without critting

**Execute:**
- +50% damage to enemies below 15% HP
- Crits vs execute targets: additional +25% damage

**Bleed (unlockable):**
- Crits apply bleeding DoT
- 3 DPS, 3s duration, stacks up to 5

**Stat Modifiers:**
- Damage: ×0.85 (lower base, offset by crits)
- Attack Speed: ×1.1 (faster)
- Range: ×0.9 (precision weapon)
- Crit Chance: 15% (vs 5% base)
- Crit Damage: 250% (vs 150% base)
- Armor Penetration: 20% (always)

**Upgrades:**
| ID | Name | Emoji | Effect |
|----|------|-------|--------|
| `precisionHits` | Deadly Precision | 🎯 | -1 hit for guaranteed crit |
| `precisionDamage` | Perfect Strike | 💫 | +10% precision crit bonus |
| `momentumStacks` | Killing Spree | ⚡ | +1 max momentum stack |
| `momentumDecay` | Sustained Fury | 🔥 | +0.5s decay time |
| `executeThreshold` | Executioner | 💀 | +5% HP threshold |
| `executeDamage` | Coup de Grace | ⚔️ | +15% execute damage |
| `executeCrit` | Merciless | ☠️ | +10% crit vs execute |
| `bleedUnlock` | Hemorrhage | 🩸 | Unlocks bleed on crit |
| `bleedDamage` | Deep Cuts | 🗡️ | +1 DPS |
| `bleedDuration` | Lingering Wounds | ⏱️ | +1s duration |
| `bleedStacks` | Arterial Strike | 💉 | +1 max stack |
| `armorPen` | Armor Piercing | 🛡️ | +5% armor pen |

**Files:**
- Config: `core/config/attacks/piercing.js`
- Combat logic: `modules/towers/tower-combat.js` → `getPiercingConfig()`, `initPiercingState()`, `processPiercingHit()`
- Status effect: `modules/enemies/status-effects.js` → BLEED type

### 3.9 Energy System

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

### 3.10 Element Abilities
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
тФЬтФАтФА index.js               # Main SidebarModule
тФЬтФАтФА templates.js           # HTML templates
тФЬтФАтФА styles.js              # CSS styles (including tooltip styles)
тФЬтФАтФА game-controller.js     # Game control, element caching
тФФтФАтФА bottom-panel/          # тнР Mixins for BottomPanel
    тФЬтФАтФА index.js           # BottomPanelMixin (composition)
    тФЬтФАтФА events.js          # BottomPanelEventsMixin
    тФЬтФАтФА tower-stats.js     # TowerStatsMixin (tower stats + popups)
    тФЬтФАтФА energy-stats.js    # EnergyStatsMixin
    тФЬтФАтФА upgrades.js        # UpgradesMixin
    тФФтФАтФА utils/
        тФФтФАтФА stat-detail-builder.js  # Popup content builder
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
  .line('Status:', 'ЁЯФТ Locked', 'detail-locked')  // Locked state
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
  <span class="stat-label">ЁЯФз MY STAT</span>
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
- **Magic Attack** (Charge System, Arcane Overflow) — complete
- **Piercing Attack** (Precision, Momentum, Execute, Bleed) — complete
- 5 elemental paths
- XP system for towers and buildings
- 5 base enemy types + **8 special types** (Flying, Armored, Magic-Immune, Regenerating, Shielded, Phasing, Undead, Splitter)
- **Elite enemy system** (gold enemies with bonuses)
- **7 wave auras** (Haste, Fortified, Regeneration, Energized, Ethereal, Berserker, Swarm Mind)
- Status effects (burn, slow, freeze, poison, armor_shred, bleed)
- Complete energy system
- WebGL rendering
- **40 wave compositions** with all special types

### 🚧 Planned
- Card system (every 10 waves)
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

*Document version: 08.01.2026*
*Game version: 0.8.0 (Enemy System Complete)*
