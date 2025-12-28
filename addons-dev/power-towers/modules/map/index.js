/**
 * Power Towers TD - Map Module
 * 
 * Manages map state, terrain, and path for enemies.
 * Handles procedural generation and terrain effects.
 */

const { GameEvents } = require('../../core/event-bus');

class MapModule {
  /**
   * @param {EventBus} eventBus - Event system for module communication
   * @param {object} config - Game configuration
   */
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    
    // Map dimensions (in grid cells)
    this.width = Math.floor(config.MAP_WIDTH / config.GRID_SIZE);   // 100
    this.height = Math.floor(config.MAP_HEIGHT / config.GRID_SIZE); // 100
    
    // Terrain data (2D array of terrain types)
    this.terrain = [];
    
    // Path data
    this.waypoints = [];      // Absolute pixel coordinates
    this.pathCells = [];      // Grid cells occupied by path
    
    // Buildable areas (cells where towers can be placed)
    this.buildableCells = [];
    
    // Special locations
    this.spawnPoint = null;   // Where enemies spawn
    this.basePoint = null;    // Player base location
  }

  /**
   * Initialize module - subscribe to events
   */
  init() {
    this.eventBus.on(GameEvents.GAME_START, () => this.generateMap());
    this.eventBus.on('map:regenerate', () => this.generateMap());
  }

  /**
   * Update (not much to do for map each frame)
   */
  update(deltaTime) {
    // Map is mostly static, terrain effects handled elsewhere
  }

  /**
   * Reset map state
   */
  reset() {
    this.terrain = [];
    this.waypoints = [];
    this.pathCells = [];
    this.buildableCells = [];
    this.spawnPoint = null;
    this.basePoint = null;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.reset();
  }

  /**
   * Generate map (currently uses config waypoints, later procedural)
   */
  generateMap() {
    const config = this.config;
    
    // Initialize terrain (all grass for now)
    this.terrain = [];
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        row.push('grass');
      }
      this.terrain.push(row);
    }
    
    // Convert relative waypoints to absolute pixel coords
    this.waypoints = config.PATH_WAYPOINTS.map(wp => ({
      x: wp.x * config.MAP_WIDTH,
      y: wp.y * config.MAP_HEIGHT
    }));
    
    // Set spawn and base points
    if (this.waypoints.length > 0) {
      this.spawnPoint = { ...this.waypoints[0] };
      this.basePoint = { ...this.waypoints[this.waypoints.length - 1] };
    }
    
    // Calculate path cells
    this.calculatePathCells();
    
    // Calculate buildable cells (all non-path cells for now)
    this.calculateBuildableCells();
    
    // Emit event
    this.eventBus.emit('map:generated', {
      width: this.width,
      height: this.height,
      waypoints: this.waypoints,
      pathCells: this.pathCells,
      spawnPoint: this.spawnPoint,
      basePoint: this.basePoint
    });
  }

  /**
   * Calculate which grid cells the path occupies
   */
  calculatePathCells() {
    this.pathCells = [];
    const gridSize = this.config.GRID_SIZE;
    
    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const start = this.waypoints[i];
      const end = this.waypoints[i + 1];
      
      // Interpolate between waypoints
      const dist = Math.sqrt(
        Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
      );
      const steps = Math.ceil(dist / (gridSize / 2));
      
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = start.x + (end.x - start.x) * t;
        const y = start.y + (end.y - start.y) * t;
        
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);
        
        // Add if not already in list
        if (!this.pathCells.some(c => c.x === gridX && c.y === gridY)) {
          this.pathCells.push({ x: gridX, y: gridY });
          
          // Mark terrain as path
          if (gridY >= 0 && gridY < this.height && gridX >= 0 && gridX < this.width) {
            this.terrain[gridY][gridX] = 'path';
          }
        }
      }
    }
  }

  /**
   * Calculate buildable cells
   */
  calculateBuildableCells() {
    this.buildableCells = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.terrain[y][x] !== 'path' && this.terrain[y][x] !== 'water') {
          this.buildableCells.push({ x, y });
        }
      }
    }
  }

  /**
   * Check if a cell is buildable
   */
  isBuildable(gridX, gridY) {
    if (gridX < 0 || gridX >= this.width || gridY < 0 || gridY >= this.height) {
      return false;
    }
    return this.terrain[gridY][gridX] !== 'path' && this.terrain[gridY][gridX] !== 'water';
  }

  /**
   * Check if a cell is on the path
   */
  isPathCell(gridX, gridY) {
    return this.pathCells.some(c => c.x === gridX && c.y === gridY);
  }

  /**
   * Get terrain type at grid position
   */
  getTerrainAt(gridX, gridY) {
    if (gridX < 0 || gridX >= this.width || gridY < 0 || gridY >= this.height) {
      return null;
    }
    return this.terrain[gridY][gridX];
  }

  /**
   * Get terrain bonus for a tower at position
   */
  getTerrainBonus(gridX, gridY) {
    const terrain = this.getTerrainAt(gridX, gridY);
    
    switch (terrain) {
      case 'hill':
        return { rangeBonus: 1.2, damageBonus: 1.0 };
      case 'forest':
        return { rangeBonus: 0.9, damageBonus: 1.15 };
      default:
        return { rangeBonus: 1.0, damageBonus: 1.0 };
    }
  }

  /**
   * Get data for rendering
   */
  getRenderData() {
    return {
      width: this.width,
      height: this.height,
      terrain: this.terrain,
      waypoints: this.waypoints,
      pathCells: this.pathCells,
      spawnPoint: this.spawnPoint,
      basePoint: this.basePoint
    };
  }
}

module.exports = { MapModule };
