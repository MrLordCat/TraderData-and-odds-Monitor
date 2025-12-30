/**
 * Power Towers TD - Passive Effects
 * Passive bonuses that towers can unlock
 */

const PASSIVE_EFFECTS = {
  // =========================================
  // AURA - Damage boost to nearby towers
  // =========================================
  damageAura: {
    id: 'damageAura',
    name: 'Battle Aura',
    emoji: '🔆',
    category: 'support',
    description: 'Nearby towers deal more damage',
    
    tiers: [
      {
        tier: 1,
        effects: {
          auraRadius: 80,
          auraDamageBonus: 0.05, // +5% damage
        },
        cost: 200
      },
      {
        tier: 2,
        effects: {
          auraRadius: 100,
          auraDamageBonus: 0.10,
        },
        cost: 400
      },
      {
        tier: 3,
        effects: {
          auraRadius: 120,
          auraDamageBonus: 0.15,
        },
        cost: 800
      }
    ],
    
    color: '#fdcb6e'
  },

  // =========================================
  // THORNS - Damage attackers
  // =========================================
  thorns: {
    id: 'thorns',
    name: 'Thorns',
    emoji: '🌵',
    category: 'defense',
    description: 'Enemies that damage this tower take damage back',
    
    tiers: [
      {
        tier: 1,
        effects: {
          thornsDamageFlat: 5,
          thornsDamagePercent: 0.10, // 10% of damage taken
        },
        cost: 150
      },
      {
        tier: 2,
        effects: {
          thornsDamageFlat: 10,
          thornsDamagePercent: 0.20,
        },
        cost: 300
      },
      {
        tier: 3,
        effects: {
          thornsDamageFlat: 20,
          thornsDamagePercent: 0.30,
        },
        cost: 600
      }
    ],
    
    color: '#00cec9'
  },

  // =========================================
  // GOLD BONUS
  // =========================================
  goldBonus: {
    id: 'goldBonus',
    name: 'Treasure Hunter',
    emoji: '💰',
    category: 'economy',
    description: 'Enemies killed give bonus gold',
    
    tiers: [
      {
        tier: 1,
        effects: {
          bonusGoldFlat: 1,
          bonusGoldPercent: 0.05,
        },
        cost: 100
      },
      {
        tier: 2,
        effects: {
          bonusGoldFlat: 2,
          bonusGoldPercent: 0.10,
        },
        cost: 250
      },
      {
        tier: 3,
        effects: {
          bonusGoldFlat: 5,
          bonusGoldPercent: 0.20,
        },
        cost: 500
      }
    ],
    
    color: '#f9ca24'
  },
};

module.exports = { PASSIVE_EFFECTS };
