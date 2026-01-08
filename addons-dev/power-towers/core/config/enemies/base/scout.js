/**
 * Power Towers TD - Scout Enemy Type
 * Fast enemy, low health
 */

const SCOUT = {
  id: 'scout',
  name: 'Scout',
  emoji: '🦎',
  
  // Base stats
  baseHealth: 20,
  baseSpeed: 80,       // px/s (fast!)
  reward: 15,
  xp: 2,
  
  // Visual
  color: '#4ecdc4',
  size: 10,
  
  // Spawn settings
  spawnDelay: 0.3,     // faster spawn
  availableFromWave: 2,
  
  // Description
  description: 'Fast enemy. Rushes through defenses.',
};

module.exports = SCOUT;
