/**
 * Power Towers TD - Map Module
 * 
 * Manages map state, terrain, and path for enemies.
 * Handles procedural generation and terrain effects.
 */

const { GameEvents } = require('../../core/event-bus');
const { MapGenerator, GENERATOR_CONFIG } = require('./map-generator');

/**
 * Terrain type definitions with effects
 */
const TERRAIN_TYPES = {
  grass: {
    name: 'Grass',
    buildable: true,
    color: '#2d5a27',
    rangeBonus: 1.0,
    damageBonus: 1.0,
    description: 'Normal terrain'
  },
  path: {
    name: 'Path',
    buildable: false,
    color: '#4a3728',
    description: 'Enemy walking path'
  },
  hill: {
    name: 'Hill',
    buildable: true,
    color: '#6b5344',
    rangeBonus: 1.2,
    damageBonus: 1.0,
    description: '+20% tower range'
  },
  forest: {
    name: 'Forest',
    buildable: true,
    color: '#1a4314',
    rangeBonus: 0.9,
    damageBonus: 1.15,
    description: '+15% damage, -10% range'
  },
  water: {
    name: 'Water',
    buildable: false,
    color: '#1a4a6e',
    slowsEnemies: 0.3,
    description: 'Impassable, slows nearby enemies'
  },
  energy_node: {
    name: 'Energy Node',
    buildable: true,
    color: '#4a90d9',
    glowColor: 'rgba(74, 144, 217, 0.4)',
    rangeBonus: 1.0,
    damageBonus: 1.0,
    energyBonus: 0.5,
    description: '+50% energy regen for towers here'
  },
  resource_vein: {
    name: 'Resource Vein',
    buildable: true,
    color: '#d4af37',
    glowColor: 'rgba(212, 175, 55, 0.3)',
    rangeBonus: 1.0,
    damageBonus: 1.0,
    goldBonus: 0.25,
    description: '+25% gold from kills by towers here'
  }
};

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
    
    // Special elements
    this.energyNodes = [];
    this.resourceVeins = [];
    
    // Buildable areas (cells where towers can be placed)
    this.buildableCells = [];
    
    // Special locations
    this.spawnPoint = null;   // Where enemies spawn
    this.basePoint = null;    // Player base location
    
    // Map generator
    this.generator = new MapGenerator(this.width, this.height, config.GRID_SIZE);
    
    // Current seed (for replay/sharing)
    this.currentSeed = null;
  }

  /**
   * Initialize module - subscribe to events
   */
  init() {
    // Don't regenerate map on GAME_START - it's already generated in GameCore.initModules()
    // Only regenerate when explicitly requested
    this.eventBus.on('map:regenerate', (data) => this.generateMap(data?.seed));
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
    this.energyNodes = [];
    this.resourceVeins = [];
    this.buildableCells = [];
    this.spawnPoint = null;
    this.basePoint = null;
    this.currentSeed = null;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.reset();
  }

  /**
   * Generate map using procedural generator
   * @param {number} seed - Optional seed for reproducible generation
   */
  generateMap(seed = null) {
    console.log('[MapModule] Generating new map...');
    
    // Generate map
    const mapData = this.generator.generate(seed);
    
    // Store data
    this.terrain = mapData.terrain;
    this.waypoints = mapData.waypoints;
    this.pathCells = mapData.pathCells;
    this.spawnPoint = mapData.spawnPoint;
    this.basePoint = mapData.basePoint;
    this.energyNodes = mapData.energyNodes;
    this.resourceVeins = mapData.resourceVeins;
    this.currentSeed = seed || Date.now();
    
    // Calculate buildable cells
    this.calculateBuildableCells();
    
    // Emit event
    this.eventBus.emit('map:generated', {
      width: this.width,
      height: this.height,
      waypoints: this.waypoints,
      pathCells: this.pathCells,
      spawnPoint: this.spawnPoint,
      basePoint: this.basePoint,
      energyNodes: this.energyNodes,
      resourceVeins: this.resourceVeins,
      seed: this.currentSeed
    });
    
    console.log(`[MapModule] Map generated: ${this.pathCells.length} path cells, seed: ${this.currentSeed}`);
  }

  /**
   * Calculate buildable cells
   */
  calculateBuildableCells() {
    this.buildableCells = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const terrain = this.terrain[y][x];
        const terrainDef = TERRAIN_TYPES[terrain];
        
        if (terrainDef && terrainDef.buildable) {
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
    const terrain = this.terrain[gridY][gridX];
    const terrainDef = TERRAIN_TYPES[terrain];
    return terrainDef && terrainDef.buildable;
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
   * Get terrain definition at grid position
   */
  getTerrainDefAt(gridX, gridY) {
    const terrain = this.getTerrainAt(gridX, gridY);
    return terrain ? TERRAIN_TYPES[terrain] : null;
  }

  /**
   * Get terrain bonus for a tower at position
   */
  getTerrainBonus(gridX, gridY) {
    const terrainDef = this.getTerrainDefAt(gridX, gridY);
    
    if (!terrainDef) {
      return { rangeBonus: 1.0, damageBonus: 1.0, energyBonus: 0, goldBonus: 0 };
    }
    
    return {
      rangeBonus: terrainDef.rangeBonus || 1.0,
      damageBonus: terrainDef.damageBonus || 1.0,
      energyBonus: terrainDef.energyBonus || 0,
      goldBonus: terrainDef.goldBonus || 0
    };
  }

  /**
   * Get data for rendering
   */
  getRenderData() {
    return {
      width: this.width,
      height: this.height,
      terrain: this.terrain,
      terrainTypes: TERRAIN_TYPES,
      waypoints: this.waypoints,
      pathCells: this.pathCells,
      spawnPoint: this.spawnPoint,
      basePoint: this.basePoint,
      energyNodes: this.energyNodes,
      resourceVeins: this.resourceVeins
    };
  }
}

module.exports = { MapModule, TERRAIN_TYPES };
