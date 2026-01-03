/**
 * Power Towers TD - Game Configuration
 * All game constants and tunable values
 */

const CONFIG = {
  // Buildable area (where towers can be placed)
  MAP_WIDTH: 2000,
  MAP_HEIGHT: 2000,
  
  // Visual padding around buildable area (10% each side = 20% total expansion)
  // Creates "outside wall" area that is visible but not buildable
  VISUAL_PADDING: 0.1,  // 10% padding each side
  
  // Computed visual dimensions (buildable + padding)
  get VISUAL_MAP_WIDTH() { return this.MAP_WIDTH * (1 + this.VISUAL_PADDING * 2); },
  get VISUAL_MAP_HEIGHT() { return this.MAP_HEIGHT * (1 + this.VISUAL_PADDING * 2); },
  
  // Offset from visual origin to buildable origin
  get BUILDABLE_OFFSET_X() { return this.MAP_WIDTH * this.VISUAL_PADDING; },
  get BUILDABLE_OFFSET_Y() { return this.MAP_HEIGHT * this.VISUAL_PADDING; },
  
  GRID_SIZE: 20,
  CANVAS_WIDTH: 400,
  CANVAS_HEIGHT: 400,
  VIEWPORT_ZOOM: 1,
  TARGET_FPS: 60,
  STARTING_GOLD: 4000,
  STARTING_LIVES: 200,
  BASE_TOWER_COST: 30,
  UPGRADE_COST_MULTIPLIER: 1.5,
  WAVE_DELAY_MS: 3000,
  SPAWN_INTERVAL_MS: 800,
  ENEMY_HP_MULTIPLIER: 1.05,
  ENEMY_SPEED_MULTIPLIER: 1.02,
  XP_MULTIPLIER: 2,
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
  ENEMY_BASE_HP: 30,
  ENEMY_HP_PER_WAVE: 10,
  ENEMY_BASE_SPEED: 0.6,
  ENEMY_SPEED_PER_WAVE: 0.02,
  ENEMY_BASE_REWARD: 5,
  TOWER_BASE_DAMAGE: 10,
  TOWER_BASE_RANGE: 60,
  TOWER_BASE_FIRE_RATE: 1,
  TOWER_BASE_ENERGY_COST: 2,
  PROJECTILE_SPEED: 5,
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
  
  // Path from center to right side (shorter path, no edge paths)
  // Enemies spawn at center and move to the base on the right
  PATH_WAYPOINTS: [
    { x: 0.5, y: 0.5 },    // Spawn at center
    { x: 0.6, y: 0.5 },    // Move right
    { x: 0.6, y: 0.35 },   // Up
    { x: 0.75, y: 0.35 },  // Right
    { x: 0.75, y: 0.65 },  // Down
    { x: 0.85, y: 0.65 },  // Right
    { x: 0.85, y: 0.5 },   // Up to base level
    { x: 0.95, y: 0.5 }    // Exit to base
  ],
  
  // Base on right side
  BASE_POSITION: {
    x: 0.95,
    y: 0.5
  },
};

module.exports = CONFIG;
