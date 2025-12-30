/**
 * Power Towers TD - Map Module
 * 
 * Manages map state, terrain, biomes, and path for enemies.
 * Handles procedural generation and terrain/biome effects.
 * 
 * NEW: Biome system with modifiers and border effects
 */

const { GameEvents } = require('../../core/event-bus');
const { MapGenerator, GENERATOR_CONFIG } = require('./map-generator');
const { BiomeGenerator, BIOME_GEN_CONFIG } = require('./biome-generator');
const { 
  BIOME_TYPES, 
  getBiome, 
  getBorderEffect, 
  calculateCellModifiers,
  isBiomeBuildable 
} = require('../../core/biomes');

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
    
    // Biome data (NEW)
    this.biomeGenerator = new BiomeGenerator(this.width, this.height);
    this.biomeMap = [];       // 2D array of biome IDs
    
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
   * Update (forest regeneration, etc.)
   */
  update(deltaTime) {
    // Update forest regeneration
    const regrown = this.biomeGenerator.updateForestRegeneration(deltaTime * 60); // Convert to ticks
    
    if (regrown.length > 0) {
      this.eventBus.emit('map:forest-regrown', { cells: regrown });
    }
  }

  /**
   * Reset map state
   */
  reset() {
    this.terrain = [];
    this.biomeMap = [];
    this.waypoints = [];
    this.pathCells = [];
    this.energyNodes = [];
    this.resourceVeins = [];
    this.buildableCells = [];
    this.spawnPoint = null;
    this.basePoint = null;
    this.currentSeed = null;
    
    // Reset biome generator
    this.biomeGenerator = new BiomeGenerator(this.width, this.height);
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
    console.log('[MapModule] Generating new map with biomes...');
    
    // Generate base map (path, terrain features)
    const mapData = this.generator.generate(seed);
    
    // Store terrain data
    this.terrain = mapData.terrain;
    this.waypoints = mapData.waypoints;
    this.pathCells = mapData.pathCells;
    this.spawnPoint = mapData.spawnPoint;
    this.basePoint = mapData.basePoint;
    this.energyNodes = mapData.energyNodes;
    this.resourceVeins = mapData.resourceVeins;
    this.currentSeed = seed || Date.now();
    
    // Generate biomes (NEW)
    const pathCellSet = new Set(this.pathCells.map(c => `${c.x},${c.y}`));
    this.biomeMap = this.biomeGenerator.generate(
      this.generator.noise, 
      this.generator.rng,
      pathCellSet
    );
    
    // Calculate buildable cells (now considers biomes too)
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
      biomeMap: this.biomeMap,
      seed: this.currentSeed
    });
    
    console.log(`[MapModule] Map generated: ${this.pathCells.length} path cells, biomes enabled, seed: ${this.currentSeed}`);
  }

  /**
   * Calculate buildable cells (considering both terrain and biome)
   */
  calculateBuildableCells() {
    this.buildableCells = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        // Check terrain
        const terrain = this.terrain[y][x];
        const terrainDef = TERRAIN_TYPES[terrain];
        const terrainBuildable = terrainDef && terrainDef.buildable;
        
        // Check biome
        const biomeBuildable = this.biomeGenerator.isCellBuildable(x, y);
        
        // Cell is buildable if both terrain and biome allow it
        if (terrainBuildable && biomeBuildable) {
          this.buildableCells.push({ x, y });
        }
      }
    }
  }

  /**
   * Check if a cell is buildable (terrain + biome)
   */
  isBuildable(gridX, gridY) {
    if (gridX < 0 || gridX >= this.width || gridY < 0 || gridY >= this.height) {
      return false;
    }
    
    // Check terrain
    const terrain = this.terrain[gridY][gridX];
    const terrainDef = TERRAIN_TYPES[terrain];
    if (!terrainDef || !terrainDef.buildable) return false;
    
    // Check biome
    return this.biomeGenerator.isCellBuildable(gridX, gridY);
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
  
  // =========================================
  // BIOME API (NEW)
  // =========================================
  
  /**
   * Get biome at grid position
   * @param {number} gridX 
   * @param {number} gridY 
   * @returns {string|null} Biome ID
   */
  getBiomeAt(gridX, gridY) {
    return this.biomeGenerator.getBiomeAt(gridX, gridY);
  }
  
  /**
   * Get biome configuration at grid position
   * @param {number} gridX 
   * @param {number} gridY 
   * @returns {object|null} Biome config from BIOME_TYPES
   */
  getBiomeConfigAt(gridX, gridY) {
    const biomeId = this.getBiomeAt(gridX, gridY);
    return biomeId ? getBiome(biomeId) : null;
  }
  
  /**
   * Get border info for a cell (nearby different biomes)
   * @param {number} gridX 
   * @param {number} gridY 
   * @returns {object|null} { baseBiome, nearbyBiomes: Set, isBorder: bool }
   */
  getBorderInfo(gridX, gridY) {
    return this.biomeGenerator.getBorderInfo(gridX, gridY);
  }
  
  /**
   * Get all modifiers for a cell (biome + border effects combined)
   * Use this for building placement and tower stats
   * @param {number} gridX 
   * @param {number} gridY 
   * @returns {object} Combined modifier object
   */
  getCellModifiers(gridX, gridY) {
    const biomeId = this.getBiomeAt(gridX, gridY);
    if (!biomeId) return {};
    
    const borderInfo = this.getBorderInfo(gridX, gridY);
    const nearbyBiomes = borderInfo ? Array.from(borderInfo.nearbyBiomes) : [];
    
    return calculateCellModifiers(biomeId, nearbyBiomes);
  }
  
  /**
   * Burn forest at position (for bio-generator)
   * @param {number} gridX 
   * @param {number} gridY 
   * @returns {number} Energy gained (0 if not forest)
   */
  burnForest(gridX, gridY) {
    const energy = this.biomeGenerator.burnForest(gridX, gridY);
    
    if (energy > 0) {
      // Update biome map reference
      this.biomeMap = this.biomeGenerator.biomeMap;
      
      // Emit event
      this.eventBus.emit('map:forest-burned', { 
        x: gridX, 
        y: gridY, 
        energyGained: energy 
      });
    }
    
    return energy;
  }

  /**
   * Get terrain bonus for a tower at position
   * NOW includes biome modifiers!
   */
  getTerrainBonus(gridX, gridY) {
    const terrainDef = this.getTerrainDefAt(gridX, gridY);
    
    // Start with terrain bonuses
    const bonus = {
      rangeBonus: terrainDef?.rangeBonus || 1.0,
      damageBonus: terrainDef?.damageBonus || 1.0,
      energyBonus: terrainDef?.energyBonus || 0,
      goldBonus: terrainDef?.goldBonus || 0
    };
    
    // Apply biome modifiers
    const biomeModifiers = this.getCellModifiers(gridX, gridY);
    
    if (biomeModifiers.towerRange) {
      bonus.rangeBonus *= biomeModifiers.towerRange;
    }
    if (biomeModifiers.towerDamage) {
      bonus.damageBonus *= biomeModifiers.towerDamage;
    }
    if (biomeModifiers.energyProduction) {
      bonus.energyBonus += (biomeModifiers.energyProduction - 1); // Convert multiplier to bonus
    }
    
    return bonus;
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
      biomeMap: this.biomeMap,
      biomeTypes: BIOME_TYPES,
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
