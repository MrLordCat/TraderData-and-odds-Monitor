/**
 * Power Towers TD - Game Configuration
 * All game constants and tunable values
 */

const CONFIG = {
  // Canvas & Display
  CANVAS_WIDTH: 300,
  CANVAS_HEIGHT: 300,
  GRID_SIZE: 30,      // 10x10 grid
  TARGET_FPS: 60,
  
  // Game Balance
  STARTING_GOLD: 100,
  STARTING_LIVES: 20,
  STARTING_ENERGY: 50,
  MAX_ENERGY: 100,
  ENERGY_REGEN: 0.5,  // per tick
  
  // Tower Costs
  BASE_TOWER_COST: 50,
  UPGRADE_COST_MULTIPLIER: 2,
  
  // Wave System
  WAVE_DELAY_MS: 3000,        // delay between waves
  SPAWN_INTERVAL_MS: 800,     // delay between enemy spawns
  ENEMIES_BASE_COUNT: 5,
  ENEMIES_PER_WAVE: 2,
  
  // Enemy Base Stats
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
