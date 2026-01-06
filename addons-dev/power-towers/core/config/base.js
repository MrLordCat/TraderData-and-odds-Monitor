/**
 * Power Towers TD - Base Configuration
 * 
 * MAP, DISPLAY & VISUAL settings
 */

const BASE_CONFIG = {
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                         MAP & DISPLAY                                  ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
  // Map dimensions
  MAP_WIDTH: 2000,
  MAP_HEIGHT: 2000,
  VISUAL_PADDING: 0.1,  // 10% padding each side
  
  // Canvas & rendering
  GRID_SIZE: 20,
  CANVAS_WIDTH: 400,
  CANVAS_HEIGHT: 400,
  VIEWPORT_ZOOM: 1,
  TARGET_FPS: 60,
  
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║                           VISUALS                                      ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  
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
  
  // Path & Base
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
  
  // Combat
  PROJECTILE_SPEED: 5,
};

// Computed getters (added to object after creation)
Object.defineProperties(BASE_CONFIG, {
  VISUAL_MAP_WIDTH: {
    get() { return this.MAP_WIDTH * (1 + this.VISUAL_PADDING * 2); }
  },
  VISUAL_MAP_HEIGHT: {
    get() { return this.MAP_HEIGHT * (1 + this.VISUAL_PADDING * 2); }
  },
  BUILDABLE_OFFSET_X: {
    get() { return this.MAP_WIDTH * this.VISUAL_PADDING; }
  },
  BUILDABLE_OFFSET_Y: {
    get() { return this.MAP_HEIGHT * this.VISUAL_PADDING; }
  },
});

module.exports = BASE_CONFIG;
