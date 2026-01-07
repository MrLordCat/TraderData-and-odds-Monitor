# Magic Attack Implementation Plan

## Overview
Magic tower type with energy charging system and Arcane Overflow mechanic.

## Core Mechanics

### 1. Power Charge System
```
Shot Cost = (DMG / dmgDivisor) + charge% + (charge% × charge% / 100)
Final Damage = DMG + (Shot Cost / efficiency)
```

**Config Parameters:**
- `dmgDivisor`: 50 (configurable)
- `efficiencyBase`: 2.0 (reduced by upgrades)

### 2. Stat Modifiers (Magic-specific)
| Stat | Modifier |
|------|----------|
| Attack Speed | ×0.7 |
| Base Damage | ×0.9 |
| Range | ×1.2 |
| Energy Storage | ×1.2 |

### 3. Arcane Overflow
- When enemy killed with overkill damage
- Excess damage transfers to nearest enemy
- Configurable transfer radius and damage %

### 4. Charge Bar (under tower)
- Second bar below tower (blue/purple)
- Shows charge progress toward shot cost
- Tower fires when: charge >= shotCost AND attackSpeed cooldown ready

---

## Implementation Checklist

### Step 1: Config ✅
- [x] Create `core/config/attacks/magic.js`
- [x] Add to `core/config/attacks/index.js` (already imported)
- [x] Parameters: chargeFormula, efficiency, modifiers, overflow, upgrades

### Step 2: Tower Combat ✅
- [x] `getMagicConfig(tower)` in tower-combat.js
- [x] `initMagicState(tower)` - initialize magic properties
- [x] `updateMagicShotCost(tower)` - recalculate shot cost
- [x] `setMagicChargePercent(tower, percent)` - set from UI
- [x] `updateMagicCharge(tower, deltaTime, energyAvailable)` - accumulation
- [x] `isMagicReady(tower)` - check if can fire
- [x] `consumeMagicCharge(tower)` - fire and reset
- [x] `processArcaneOverflow(tower, enemy, overkill, enemies, eventBus)` - overflow

### Step 3: Tower Stats ✅
- [x] Apply Magic stat modifiers in tower-stats.js (Step 2b)
- [x] Apply energy storage modifier (Step 9)

### Step 4: Attack Handler ✅
- [x] Update attack-types.js magic section
- [x] Integrate magic charge into performAttack()
- [x] Handle overflow on enemy death (event emitted, needs combat module listener)

### Step 5: Renderer - Charge Bar ⬜
- [ ] Add charge bar rendering under Magic towers
- [ ] Blue/purple color, distinct from HP/energy bars
- [ ] Glow/particle effect at high charge levels

### Step 6: UI Panel ⬜
- [ ] Create charge control panel (above right side of bottom panel)
- [ ] Slider 1-100% for charge setting
- [ ] Display: shot cost, bonus damage, efficiency
- [ ] Only visible when Magic tower selected

### Step 7: Upgrades ✅
- [x] Add to tower-upgrade-list.js display
- [x] Add upgrade definitions to stat-upgrades.js
- [x] Wire up upgrade handlers (via getMagicConfig)

### Step 8: Visual Effects ⬜
- [ ] Charging animation on tower (particles/glow)
- [ ] Intensity increases with charge level
- [ ] Overflow visual (arc to next target)

---

## Files to Create/Modify

### New Files:
- `core/config/attacks/magic.js`
- `modules/game-panel/magic-charge-panel/index.js`
- `modules/game-panel/magic-charge-panel/templates.js`
- `modules/game-panel/magic-charge-panel/styles.js`

### Modify:
- `core/config/attacks/index.js` - add magic export
- `core/attack-types.js` - add processMagicAttack
- `modules/towers/tower-stats.js` - magic modifiers
- `modules/towers/tower-combat.js` - charge logic
- `modules/towers/tower-factory.js` - magic properties
- `renderer/game-renderer.js` - charge bar
- `modules/game-panel/index.js` - magic panel integration
- `modules/game-panel/templates.js` - panel HTML
- `core/tower-upgrade-list.js` - magic upgrades

---

## Upgrade Details

| ID | Name | Effect | Base Cost |
|----|------|--------|-----------|
| `energyEfficiency` | Arcane Efficiency | -0.1 efficiency divisor | 40g |
| `overflowRange` | Overflow Reach | +20px overflow radius | 35g |
| `overflowDamage` | Arcane Cascade | +10% overflow transfer | 45g |
| `chargeSpeed` | Quick Charge | +10% charge rate | 30g |

---

*Status: IN PROGRESS*
*Started: 07.01.2026*
