/**
 * Power Towers TD - Waves & Enemies Configuration
 * 
 * Wave system, enemy types, spawning, scaling
 */

const WAVES_CONFIG = {
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                        WAVES & SPAWNING                                ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  // Wave timing
  WAVE_DELAY_MS: 3000,
  SPAWN_INTERVAL_MS: 800,
  
  // Scaling per wave
  ENEMY_HP_MULTIPLIER: 1.05,      // HP increase per wave
  ENEMY_SPEED_MULTIPLIER: 1.02,   // Speed increase per wave
  
  // Enemy base stats (fallback/formula)
  ENEMY_BASE_HP: 30,
  ENEMY_HP_PER_WAVE: 10,
  ENEMY_BASE_SPEED: 0.6,
  ENEMY_SPEED_PER_WAVE: 0.02,
  ENEMY_BASE_REWARD: 5,
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                         ENEMY TYPES                                    ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  ENEMY_TYPES: {
    basic: {
      name: 'Minion',
      emoji: '👾',
      baseHealth: 20,
      baseSpeed: 40,
      reward: 10,
      xp: 1,
      color: '#ff6b6b'
    },
    fast: {
      name: 'Scout',
      emoji: '🦎',
      baseHealth: 20,
      baseSpeed: 80,
      reward: 15,
      xp: 2,
      color: '#4ecdc4'
    },
    tank: {
      name: 'Brute',
      emoji: '🐗',
      baseHealth: 100,
      baseSpeed: 25,
      reward: 30,
      xp: 3,
      color: '#a55eea'
    },
    swarm: {
      name: 'Swarmling',
      emoji: '🐜',
      baseHealth: 15,
      baseSpeed: 60,
      reward: 5,
      xp: 1,
      color: '#26de81'
    },
    boss: {
      name: 'Boss',
      emoji: '👹',
      baseHealth: 1000,
      baseSpeed: 20,
      reward: 200,
      xp: 10,
      color: '#eb3b5a'
    }
  },
};

module.exports = WAVES_CONFIG;
