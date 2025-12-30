/**
 * Power Towers TD - Game Configuration
 * All game constants and tunable values
 */

const CONFIG = {
  // =========================================
  // World & Map (logical game world)
  // =========================================
  MAP_WIDTH: 2000,        // Total map width in pixels
  MAP_HEIGHT: 2000,       // Total map height in pixels
  GRID_SIZE: 20,          // Each cell is 20x20 px (tower size)
  // Grid dimensions: 100x100 cells (2000/20)
  
  // =========================================
  // Display & Viewport (rendered canvas)
  // =========================================
  CANVAS_WIDTH: 400,      // Display canvas width
  CANVAS_HEIGHT: 400,     // Display canvas height
  // Viewport shows portion of map, can scroll/zoom
  VIEWPORT_ZOOM: 1.0,     // 1.0 = 1 map pixel = 1 canvas pixel
  TARGET_FPS: 60,
  
  // =========================================
  // Game Balance
  // =========================================
  STARTING_GOLD: 200,
  STARTING_LIVES: 20,
  // Energy is per-building/tower, no global energy pool
  
  // Tower Costs
  BASE_TOWER_COST: 30,
  UPGRADE_COST_MULTIPLIER: 1.5,
  
  // Wave System
  WAVE_DELAY_MS: 3000,        // delay between waves
  SPAWN_INTERVAL_MS: 800,     // delay between enemy spawns (legacy)
  
  // Enemy Scaling (multiplicative per wave)
  // HP: baseHealth * (HP_MULTIPLIER ^ (wave-1))
  // Speed: baseSpeed * (SPEED_MULTIPLIER ^ (wave-1))
  ENEMY_HP_MULTIPLIER: 1.1,      // x1.1 HP per wave
  ENEMY_SPEED_MULTIPLIER: 1.02,  // x1.02 speed per wave
  
  // XP Scaling
  XP_MULTIPLIER: 2.0,            // global XP multiplier (1.0 = normal, 2.0 = double XP)
  
  // Enemy Types - base stats and rewards
  ENEMY_TYPES: {
    basic: {
      name: 'Minion',
      emoji: '👾',
      baseHealth: 20,
      baseSpeed: 40,
      reward: 10,        // gold reward
      xp: 1,             // tower XP for kill
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
  
  // Legacy enemy stats (for core/entities/enemy.js)
  ENEMY_BASE_HP: 30,
  ENEMY_HP_PER_WAVE: 10,
  ENEMY_BASE_SPEED: 0.6,
  ENEMY_SPEED_PER_WAVE: 0.02,
  ENEMY_BASE_REWARD: 5,
  
  // Tower Base Stats
  TOWER_BASE_DAMAGE: 10,
  TOWER_BASE_RANGE: 60,
  TOWER_BASE_FIRE_RATE: 1.0,     // attacks per second
  TOWER_BASE_ENERGY_COST: 2,     // energy per shot
  
  // Projectile
  PROJECTILE_SPEED: 5,
  
  // Colors
  COLORS: {
    background: '#1a1a2e',
    grid: 'rgba(255,255,255,0.05)',
    path: '#2d3748',
    pathBorder: '#4a5568',
    base: '#48bb78',
    baseGlow: 'rgba(72, 187, 120, 0.3)',
    tower: {
      base: '#718096',
      fire: '#f56565',
      ice: '#63b3ed',
      lightning: '#ecc94b',
      nature: '#68d391',
      dark: '#9f7aea'
    },
    enemy: {
      normal: '#fc8181',
      fast: '#f6ad55',
      tank: '#b794f4',
      flying: '#90cdf4'
    },
    projectile: '#ffd700',
    healthBar: {
      bg: '#2d3748',
      fill: '#48bb78',
      low: '#f56565'
    },
    energy: {
      bg: '#2d3748',
      fill: '#63b3ed'
    },
    ui: {
      text: '#e2e8f0',
      gold: '#ecc94b',
      danger: '#fc8181'
    }
  },
  
  // Path waypoints (relative to canvas size, 0-1)
  PATH_WAYPOINTS: [
    { x: -0.05, y: 0.5 },
    { x: 0.2, y: 0.5 },
    { x: 0.2, y: 0.2 },
    { x: 0.5, y: 0.2 },
    { x: 0.5, y: 0.8 },
    { x: 0.8, y: 0.8 },
    { x: 0.8, y: 0.5 },
    { x: 1.05, y: 0.5 }
  ],
  
  // Base position (end of path)
  BASE_POSITION: { x: 0.9, y: 0.5 }
};

module.exports = CONFIG;
