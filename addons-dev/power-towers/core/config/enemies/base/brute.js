/**
 * Power Towers TD - Brute Enemy Type
 * Tank enemy, high health, slow
 */

const BRUTE = {
  id: 'brute',
  name: 'Brute',
  emoji: '🐗',
  
  // Base stats
  baseHealth: 100,
  baseSpeed: 25,       // px/s (slow)
  reward: 30,
  xp: 3,
  
  // Visual
  color: '#a55eea',
  size: 12,            // larger
  
  // Spawn settings
  spawnDelay: 1.5,     // slower spawn (they're big)
  availableFromWave: 3,
  
  // Description
  description: 'Heavy enemy. High health, slow movement.',
};

module.exports = BRUTE;
