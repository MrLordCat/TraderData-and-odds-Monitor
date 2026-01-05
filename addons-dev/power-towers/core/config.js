/**
 * Power Towers TD - Game Configuration
 * All game constants and tunable values
 * 
 * SECTIONS:
 * 1. MAP & DISPLAY      - Canvas, grid, visual settings
 * 2. ECONOMY            - Gold, costs, starting values
 * 3. WAVES & ENEMIES    - Wave system, enemy types and stats
 * 4. XP & LEVELING      - Experience and level progression
 * 5. TOWERS             - Tower stats, upgrades, caps
 * 6. ENERGY SYSTEM      - Energy buildings, upgrades, power bonuses
 * 7. COMBAT             - Projectiles, damage calculations
 * 8. VISUALS            - Colors, path, UI
 */

const CONFIG = {
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                         1. MAP & DISPLAY                               ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  // Map dimensions
  MAP_WIDTH: 2000,
  MAP_HEIGHT: 2000,
  VISUAL_PADDING: 0.1,  // 10% padding each side
  
  // Computed visual dimensions (buildable + padding)
  get VISUAL_MAP_WIDTH() { return this.MAP_WIDTH * (1 + this.VISUAL_PADDING * 2); },
  get VISUAL_MAP_HEIGHT() { return this.MAP_HEIGHT * (1 + this.VISUAL_PADDING * 2); },
  get BUILDABLE_OFFSET_X() { return this.MAP_WIDTH * this.VISUAL_PADDING; },
  get BUILDABLE_OFFSET_Y() { return this.MAP_HEIGHT * this.VISUAL_PADDING; },
  
  // Canvas & rendering
  GRID_SIZE: 20,
  CANVAS_WIDTH: 400,
  CANVAS_HEIGHT: 400,
  VIEWPORT_ZOOM: 1,
  TARGET_FPS: 60,
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                           2. ECONOMY                                   ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  // Starting resources
  STARTING_GOLD: 4000,
  STARTING_LIVES: 200,
  
  // Tower costs
  BASE_TOWER_COST: 30,
  UPGRADE_COST_MULTIPLIER: 1.5,
  
  // Tower upgrade cost discounts (per tower level)
  TOWER_UPGRADE_DISCOUNT_PER_LEVEL: 0.05,  // 5% discount per tower level
  TOWER_UPGRADE_MAX_DISCOUNT: 0.5,          // Max 50% discount
  
  // Menu/meta upgrades (permanent gems system)
  MENU_UPGRADE_COST_MULTIPLIER: 1.5,  // Cost scaling per level
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                        3. WAVES & ENEMIES                              ║
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
  
  // Enemy type definitions
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
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                         4. XP & LEVELING                               ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  // Global XP multiplier (applies to all XP gains)
  XP_MULTIPLIER: 2,
  
  // Tower XP scaling
  TOWER_BASE_XP: 10,               // XP needed for level 2
  TOWER_XP_SCALE: 1.1,            // Each level needs X times more XP
  TOWER_MAX_LEVEL: 100,            // Max tower level
  
  // Energy building XP
  ENERGY_XP_PER_100_ENERGY: 2,    // 1 XP per 100 energy processed
  ENERGY_XP_PER_LEVEL: 10,        // XP needed per level
  ENERGY_MAX_LEVEL: 20,           // Max level from XP
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                            5. TOWERS                                   ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  // --- 5.1 Base Stats ---
  TOWER_BASE_DAMAGE: 10,
  TOWER_BASE_RANGE: 60,
  TOWER_BASE_FIRE_RATE: 1,
  TOWER_BASE_ENERGY_COST: 2,
  TOWER_BASE_HP: 100,
  TOWER_BASE_MAX_ENERGY: 50,
  TOWER_BASE_CRIT_CHANCE: 0.05,
  TOWER_BASE_CRIT_DAMAGE: 1.5,
  
  // --- 5.2 Level Bonuses ---
  TOWER_LEVEL_BONUS_PERCENT: 0.02,     // +2% per tower level to base stats
  
  // --- 5.3 Upgrade Bonuses (per upgrade level) ---
  TOWER_UPGRADE_BONUSES: {
    damage: 0.05,           // +5% per level
    attackSpeed: 0.04,      // +4% per level
    range: 0.05,            // +5% per level
    hp: 0.08,               // +8% per level
    critChance: 0.01,       // +1% per level (additive)
    critDamage: 0.1,        // +10% per level (additive to multiplier)
    splashRadius: 0.08,     // +8% per level
    chainCount: 1,          // +1 per level (flat)
    powerScaling: 0.10,     // +10% per level
    energyStorage: 0.10,    // +10% per level
    powerEfficiency: 0.03,  // -3% energy cost per level
  },
  
  // --- 5.4 Stat Caps ---
  TOWER_CRIT_CHANCE_CAP: 0.75,      // 75% max crit chance
  TOWER_CHAIN_COUNT_CAP: 10,        // Max chain targets
  TOWER_POWER_EFFICIENCY_CAP: 0.8,  // Max 80% energy cost reduction
  TOWER_BASE_POWER_COST_RATIO: 0.5, // Energy cost per shot = damage * this
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                         6. ENERGY SYSTEM                               ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  // --- 6.1 Energy Building Level Bonuses ---
  ENERGY_LEVEL_BONUS_PERCENT: 0.02,  // +2% per level to all stats
  ENERGY_RANGE_PER_LEVEL: 0.2,       // +0.2 range per level (flat)
  
  // --- 6.2 Energy Building Upgrade Bonuses ---
  ENERGY_UPGRADE_BONUSES: {
    inputRate: 0.05,     // +5% per level
    outputRate: 0.05,    // +5% per level
    capacity: 0.10,      // +10% per level
    range: 1,            // +1 per level (flat)
    channels: 1,         // +1 input AND +1 output per level
    efficiency: 0.10,    // +10% per level
    generation: 0.15,    // +15% per level
  },
  
  // --- 6.3 Energy Building Upgrade Costs (Bottom Panel) ---
  ENERGY_UPGRADE_COSTS: {
    capacity: 30,
    output: 40,
    channels: 60,
    range: 50,
    efficiency: 35,
    generation: 45,
  },
  ENERGY_UPGRADE_COST_MULTIPLIER: 1.2,  // Cost multiplier per level
  
  // --- 6.4 Energy Tooltip Upgrades (separate legacy system) ---
  ENERGY_TOOLTIP_COSTS: {
    capacity: 20,
    outputRate: 25,
    range: 30,
    channels: 50,
  },
  ENERGY_TOOLTIP_MAX_LEVELS: {
    capacity: 5,
    outputRate: 5,
    range: 5,
  },
  ENERGY_TOOLTIP_COST_MULTIPLIER: 1.5,
  
  // --- 6.5 Tower Power Bonuses ---
  TOWER_POWER_BONUSES: {
    powered: {
      damage: 1.1,      // +10% damage when powered
      fireRate: 1.15,   // +15% fire rate
    },
    unpowered: {
      damage: 0.9,      // -10% damage when unpowered
      fireRate: 0.8,    // -20% fire rate
    },
  },
  TOWER_OVERCHARGE_BONUS_SCALE: 0.5,  // Overcharge bonus = (multiplier - 1) * 0.5
  TOWER_MAX_POWER_DRAW_MULTIPLIER: 2, // Max power draw multiplier
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                           7. COMBAT                                    ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  PROJECTILE_SPEED: 5,
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                           8. VISUALS                                   ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  // --- 8.1 Colors ---
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
  
  // --- 8.2 Path & Base ---
  PATH_WAYPOINTS: [
    { x: 0.5, y: 0.5 },
    { x: 0.6, y: 0.5 },
    { x: 0.6, y: 0.35 },
    { x: 0.75, y: 0.35 },
    { x: 0.75, y: 0.65 },
    { x: 0.85, y: 0.65 },
    { x: 0.85, y: 0.5 },
    { x: 0.95, y: 0.5 }
  ],
  BASE_POSITION: {
    x: 0.95,
    y: 0.5
  },
};

module.exports = CONFIG;
