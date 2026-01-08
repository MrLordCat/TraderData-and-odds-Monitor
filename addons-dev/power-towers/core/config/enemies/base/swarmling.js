/**
 * Power Towers TD - Swarmling Enemy Type
 * Swarm enemy, very low health, spawns in large groups
 */

const SWARMLING = {
  id: 'swarmling',
  name: 'Swarmling',
  emoji: '🐜',
  
  // Base stats
  baseHealth: 15,
  baseSpeed: 60,       // px/s
  reward: 5,           // low reward
  xp: 1,
  
  // Visual
  color: '#26de81',
  size: 6,             // small
  
  // Spawn settings
  spawnDelay: 0.15,    // very fast spawn (swarm!)
  availableFromWave: 5,
  
  // Description
  description: 'Tiny enemy. Comes in large numbers.',
};

module.exports = SWARMLING;
