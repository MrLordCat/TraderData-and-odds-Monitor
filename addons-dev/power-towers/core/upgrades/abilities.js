/**
 * Power Towers TD - Abilities
 * Special effects that can be unlocked/upgraded
 */

const ABILITIES = {
  // =========================================
  // BURN (Fire DoT)
  // =========================================
  burn: {
    id: 'burn',
    name: 'Burn',
    emoji: '🔥',
    category: 'dot',
    description: 'Attacks ignite enemies, dealing fire damage over time',
    
    tiers: [
      { tier: 1, name: 'Ignite', description: 'Attacks apply burn (2 DPS for 2s)',
        effects: { burnDamage: 2, burnDuration: 2000 }, cost: 75 },
      { tier: 2, name: 'Sear', description: 'Stronger burn (4 DPS for 3s)',
        effects: { burnDamage: 4, burnDuration: 3000 }, cost: 150 },
      { tier: 3, name: 'Incinerate', description: 'Intense burn (8 DPS for 4s)',
        effects: { burnDamage: 8, burnDuration: 4000 }, cost: 300 },
      { tier: 4, name: 'Inferno', description: 'Devastating burn (15 DPS for 5s), spreads to nearby',
        effects: { burnDamage: 15, burnDuration: 5000, burnSpread: true, burnSpreadRadius: 25 }, cost: 600 }
    ],
    
    infiniteScaling: { stat: 'burnDamage', valuePerLevel: 2, costBase: 200, costScale: 1.20 },
    color: '#e17055'
  },

  // =========================================
  // POISON (Nature DoT)
  // =========================================
  poison: {
    id: 'poison',
    name: 'Poison',
    emoji: '☠️',
    category: 'dot',
    description: 'Attacks poison enemies, dealing damage over time',
    
    tiers: [
      { tier: 1, name: 'Toxin', description: 'Attacks apply poison (3 DPS for 3s)',
        effects: { poisonDamage: 3, poisonDuration: 3000 }, cost: 70 },
      { tier: 2, name: 'Venom', description: 'Stronger poison (5 DPS for 4s), reduces armor',
        effects: { poisonDamage: 5, poisonDuration: 4000, armorReduction: 3 }, cost: 140 },
      { tier: 3, name: 'Blight', description: 'Deadly poison (10 DPS for 5s), stacks',
        effects: { poisonDamage: 10, poisonDuration: 5000, armorReduction: 5, poisonStacks: true, maxPoisonStacks: 3 }, cost: 280 },
      { tier: 4, name: 'Plague', description: 'Plague (18 DPS for 6s), spreads on death',
        effects: { poisonDamage: 18, poisonDuration: 6000, armorReduction: 8, poisonStacks: true, maxPoisonStacks: 5, spreadOnDeath: true, spreadRadius: 40 }, cost: 550 }
    ],
    
    infiniteScaling: { stat: 'poisonDamage', valuePerLevel: 2, costBase: 180, costScale: 1.18 },
    color: '#00b894'
  },

  // =========================================
  // SLOW (Ice debuff)
  // =========================================
  slow: {
    id: 'slow',
    name: 'Slow',
    emoji: '❄️',
    category: 'debuff',
    description: 'Attacks slow enemy movement',
    
    tiers: [
      { tier: 1, name: 'Chill', description: 'Slows enemies by 15% for 2s',
        effects: { slowPercent: 0.15, slowDuration: 2000 }, cost: 60 },
      { tier: 2, name: 'Frost', description: 'Slows enemies by 30% for 3s',
        effects: { slowPercent: 0.30, slowDuration: 3000 }, cost: 120 },
      { tier: 3, name: 'Freeze', description: 'Slows by 50% for 3s, chance to freeze',
        effects: { slowPercent: 0.50, slowDuration: 3000, freezeChance: 0.10, freezeDuration: 1000 }, cost: 250 },
      { tier: 4, name: 'Absolute Zero', description: 'Slows by 70% for 4s, high freeze chance',
        effects: { slowPercent: 0.70, slowDuration: 4000, freezeChance: 0.20, freezeDuration: 1500 }, cost: 500 }
    ],
    
    infiniteScaling: { stat: 'slowPercent', valuePerLevel: 0.03, maxValue: 0.90, costBase: 160, costScale: 1.15 },
    color: '#74b9ff'
  },

  // =========================================
  // ARMOR SHRED
  // =========================================
  armorShred: {
    id: 'armorShred',
    name: 'Armor Shred',
    emoji: '🗡️',
    category: 'debuff',
    description: 'Attacks reduce enemy armor',
    
    tiers: [
      { tier: 1, name: 'Pierce', description: 'Reduces enemy armor by 2 for 3s',
        effects: { armorReduction: 2, armorReductionDuration: 3000 }, cost: 65 },
      { tier: 2, name: 'Rend', description: 'Reduces armor by 5 for 4s',
        effects: { armorReduction: 5, armorReductionDuration: 4000 }, cost: 130 },
      { tier: 3, name: 'Shatter', description: 'Reduces armor by 10 for 5s, stacks',
        effects: { armorReduction: 10, armorReductionDuration: 5000, armorShredStacks: true, maxArmorShredStacks: 3 }, cost: 260 },
      { tier: 4, name: 'Obliterate', description: 'Reduces armor by 20 for 6s, full armor shred',
        effects: { armorReduction: 20, armorReductionDuration: 6000, armorShredStacks: true, maxArmorShredStacks: 5, percentArmorShred: 0.25 }, cost: 520 }
    ],
    
    infiniteScaling: { stat: 'armorReduction', valuePerLevel: 2, costBase: 170, costScale: 1.16 },
    color: '#636e72'
  },

  // =========================================
  // LIFE STEAL
  // =========================================
  lifeSteal: {
    id: 'lifeSteal',
    name: 'Life Steal',
    emoji: '🩸',
    category: 'sustain',
    description: 'Tower heals based on damage dealt',
    
    tiers: [
      { tier: 1, name: 'Siphon', description: 'Heal 5% of damage dealt',
        effects: { lifeStealPercent: 0.05 }, cost: 100 },
      { tier: 2, name: 'Drain', description: 'Heal 10% of damage dealt',
        effects: { lifeStealPercent: 0.10 }, cost: 200 },
      { tier: 3, name: 'Leech', description: 'Heal 18% of damage dealt',
        effects: { lifeStealPercent: 0.18 }, cost: 400 },
      { tier: 4, name: 'Vampiric', description: 'Heal 30% of damage dealt, excess becomes shield',
        effects: { lifeStealPercent: 0.30, overhealShield: true, maxShieldPercent: 0.25 }, cost: 800 }
    ],
    
    infiniteScaling: { stat: 'lifeStealPercent', valuePerLevel: 0.02, maxValue: 0.50, costBase: 250, costScale: 1.22 },
    color: '#d63031'
  },

  // =========================================
  // TRUE DAMAGE
  // =========================================
  trueDamage: {
    id: 'trueDamage',
    name: 'True Damage',
    emoji: '💀',
    category: 'offense',
    description: 'Portion of damage ignores all armor',
    
    tiers: [
      { tier: 1, name: 'Purity', description: '10% of damage is true damage',
        effects: { trueDamagePercent: 0.10 }, cost: 120 },
      { tier: 2, name: 'Essence', description: '20% of damage is true damage',
        effects: { trueDamagePercent: 0.20 }, cost: 240 },
      { tier: 3, name: 'Void', description: '35% of damage is true damage',
        effects: { trueDamagePercent: 0.35 }, cost: 480 },
      { tier: 4, name: 'Oblivion', description: '50% is true damage, execute low HP enemies',
        effects: { trueDamagePercent: 0.50, executeThreshold: 0.10 }, cost: 960 }
    ],
    
    infiniteScaling: { stat: 'trueDamagePercent', valuePerLevel: 0.03, maxValue: 0.80, costBase: 300, costScale: 1.25 },
    color: '#6c5ce7'
  },

  // =========================================
  // MULTI-SHOT
  // =========================================
  multishot: {
    id: 'multishot',
    name: 'Multi-Shot',
    emoji: '🏹',
    category: 'offense',
    description: 'Attack hits multiple targets simultaneously',
    
    tiers: [
      { tier: 1, name: 'Split Shot', description: 'Attack 2 targets (70% damage to secondary)',
        effects: { additionalTargets: 1, secondaryDamagePercent: 0.70 }, cost: 150 },
      { tier: 2, name: 'Barrage', description: 'Attack 3 targets (75% damage to secondary)',
        effects: { additionalTargets: 2, secondaryDamagePercent: 0.75 }, cost: 300 },
      { tier: 3, name: 'Volley', description: 'Attack 4 targets (80% damage to secondary)',
        effects: { additionalTargets: 3, secondaryDamagePercent: 0.80 }, cost: 600 },
      { tier: 4, name: 'Storm', description: 'Attack 6 targets (85% damage to secondary)',
        effects: { additionalTargets: 5, secondaryDamagePercent: 0.85 }, cost: 1200 }
    ],
    
    infiniteScaling: { stat: 'additionalTargets', valuePerLevel: 1, maxValue: 10, costBase: 400, costScale: 1.30 },
    color: '#fd79a8'
  },

  // =========================================
  // OVERDRIVE (Magic type)
  // =========================================
  overdrive: {
    id: 'overdrive',
    name: 'Overdrive',
    emoji: '⚡',
    category: 'special',
    description: 'Allows power draw above 100% with reduced efficiency',
    
    requires: { attackTypes: ['magic'] },
    
    tiers: [
      { tier: 1, name: 'Overcharge', description: 'Can draw up to 125% power (40% efficiency above 100%)',
        effects: { maxPowerDraw: 125, overdriveEfficiency: 0.40 }, cost: 100 },
      { tier: 2, name: 'Surge', description: 'Up to 150% power (50% efficiency)',
        effects: { maxPowerDraw: 150, overdriveEfficiency: 0.50 }, cost: 200 },
      { tier: 3, name: 'Overload', description: 'Up to 175% power (60% efficiency)',
        effects: { maxPowerDraw: 175, overdriveEfficiency: 0.60 }, cost: 400 },
      { tier: 4, name: 'Transcendence', description: 'Up to 200% power (75% efficiency)',
        effects: { maxPowerDraw: 200, overdriveEfficiency: 0.75 }, cost: 800 }
    ],
    
    infiniteScaling: { stat: 'overdriveEfficiency', valuePerLevel: 0.02, maxValue: 0.95, costBase: 300, costScale: 1.20 },
    color: '#a29bfe'
  },
};

module.exports = { ABILITIES };
