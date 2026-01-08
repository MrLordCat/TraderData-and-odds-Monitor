/**
 * Power Towers TD - Iron Guardian Boss
 * 
 * Mini-boss for Wave 5
 * Defensive tank with armor aura
 */

const IRON_GUARDIAN = {
  id: 'iron_guardian',
  name: 'Железный Страж',
  emoji: '🛡️',
  
  // Base stats (before wave scaling)
  baseHealth: 500,
  baseSpeed: 25,
  reward: 100,
  xp: 15,
  
  // Boss type
  type: 'mini',
  wave: 5,
  
  // Visual
  color: '#708090',  // Slate gray
  size: 30,
  
  // Special abilities
  abilities: [
    {
      id: 'iron_skin',
      name: 'Железная Кожа',
      description: 'Снижает весь входящий урон на 15%',
      type: 'passive',
      effect: {
        damageReduction: 0.15,
      },
    },
    {
      id: 'fortify_aura',
      name: 'Аура Стойкости',
      description: 'Союзники в радиусе 100px получают +20% HP',
      type: 'aura',
      effect: {
        radius: 100,
        healthBonus: 0.20,
      },
    },
  ],
  
  // Loot table
  loot: {
    guaranteed: [
      { type: 'gold', amount: 100 },
    ],
    chance: [
      { type: 'gem', amount: 1, chance: 0.3 },
    ],
  },
  
  // Death effect
  onDeath: {
    effect: 'explosion',
    radius: 60,
    damage: 0,  // Visual only
    sound: 'boss_death_1',
  },
  
  description: 'Первый мини-босс. Медленный но очень прочный.',
};

/**
 * Apply Iron Guardian abilities to boss instance
 * @param {Object} boss - Boss instance
 * @returns {Object} Modified boss
 */
function applyAbilities(boss) {
  const modified = { ...boss };
  
  // Iron Skin - damage reduction
  modified.damageReduction = IRON_GUARDIAN.abilities[0].effect.damageReduction;
  
  // Fortify Aura - will be processed by combat system
  modified.auraEffect = IRON_GUARDIAN.abilities[1].effect;
  
  return modified;
}

module.exports = {
  ...IRON_GUARDIAN,
  applyAbilities,
};
