/**
 * Power Towers TD - Minion Enemy Type
 * Basic enemy, standard stats
 */

const MINION = {
  id: 'minion',
  name: 'Minion',
  emoji: '👾',
  
  // Base stats
  baseHealth: 20,
  baseSpeed: 40,       // px/s
  reward: 10,          // gold
  xp: 1,
  
  // Visual
  color: '#ff6b6b',
  size: 10,            // px radius
  
  // Spawn settings
  spawnDelay: 0.5,     // seconds between spawns
  availableFromWave: 1,
  
  // Description
  description: 'Standard enemy. No special abilities.',
};

module.exports = MINION;
