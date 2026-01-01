/**
 * PlacementManager - Unified building placement system
 * 
 * Centralizes ALL placement logic for towers AND energy buildings:
 * - canPlace checks (terrain, path, collisions)
 * - Cell calculations (1x1, 2x2, L-shape)
 * - World position calculations
 * - Placement mode state
 * - Affordability checks
 */

const { ENERGY_BUILDINGS } = require('../energy/building-defs');

/**
 * Building type constants
 */
const BUILDING_TYPES = {
  TOWER: 'tower',
  ENERGY: 'energy'
};

/**
 * @typedef {Object} BuildingDefinition
 * @property {number} [gridWidth=1] - Width in grid cells
 * @property {number} [gridHeight=1] - Height in grid cells
 * @property {string} [shape='rect'] - Shape type ('rect' | 'L')
 * @property {number} [cost=0] - Build cost
 */

/**
 * @typedef {Object} CellPosition
 * @property {number} x - Grid X coordinate
 * @property {number} y - Grid Y coordinate
 */

/**
 * @typedef {Object} WorldPosition
 * @property {number} x - World X coordinate
 * @property {number} y - World Y coordinate
 */

/**
 * @typedef {Object} PlacementState
 * @property {boolean} active - Whether placement mode is active
 * @property {'tower'|'energy'|null} type - Type of building being placed
 * @property {string|null} buildingId - ID of specific building (for energy)
 * @property {BuildingDefinition|null} definition - Building definition
 */

class PlacementManager {
  constructor(gameCore, config = {}) {
    this.game = gameCore;
    this.eventBus = gameCore?.eventBus;
    
    // Grid size (from config module)
    this.gridSize = config.gridSize || 32;
    
    // Placement state
    this.state = {
      active: false,
      type: null,
      buildingId: null,
      definition: null
    };
    
    // Tower cost (can be overridden)
    this.towerCost = config.towerCost || 50;
    
    // Callbacks for UI updates
    this.onStateChange = null;
    this.onAffordabilityChange = null;
  }

  // ============================================
  // CELL CALCULATIONS
  // ============================================

  /**
   * Get all cells occupied by a building at given position
   * @param {number} gridX - Grid X coordinate
   * @param {number} gridY - Grid Y coordinate
   * @param {BuildingDefinition|null} def - Building definition (null = 1x1 tower)
   * @returns {CellPosition[]} Array of cell positions
   */
  getCellsForBuilding(gridX, gridY, def = null) {
    if (!def) {
      return [{ x: gridX, y: gridY }];
    }

    const { gridWidth = 1, gridHeight = 1, shape = 'rect' } = def;
    const cells = [];

    // L-shaped building (2x2 with top-right corner empty)
    if (shape === 'L' && gridWidth === 2 && gridHeight === 2) {
      cells.push({ x: gridX, y: gridY });         // Top-left
      cells.push({ x: gridX, y: gridY + 1 });     // Bottom-left
      cells.push({ x: gridX + 1, y: gridY + 1 }); // Bottom-right
      // Top-right is empty (the "L" cut)
    } else {
      // Standard rectangular building
      for (let dy = 0; dy < gridHeight; dy++) {
        for (let dx = 0; dx < gridWidth; dx++) {
          cells.push({ x: gridX + dx, y: gridY + dy });
        }
      }
    }

    return cells;
  }

  /**
   * Get world center position for a building
   * @param {number} gridX - Grid X coordinate
   * @param {number} gridY - Grid Y coordinate
   * @param {BuildingDefinition|null} def - Building definition
   * @returns {WorldPosition} World coordinates of center
   */
  getBuildingCenter(gridX, gridY, def = null) {
    const gs = this.gridSize;

    if (!def) {
      // Standard 1x1 tower
      return {
        x: gridX * gs + gs / 2,
        y: gridY * gs + gs / 2
      };
    }

    const { gridWidth = 1, gridHeight = 1, shape = 'rect' } = def;

    // L-shaped building - center at the corner junction
    if (shape === 'L' && gridWidth === 2 && gridHeight === 2) {
      return {
        x: gridX * gs + gs,      // Center between left and right cells
        y: gridY * gs + gs       // Center between top and bottom cells
      };
    }

    // Standard rectangular building - geometric center
    return {
      x: gridX * gs + (gridWidth * gs) / 2,
      y: gridY * gs + (gridHeight * gs) / 2
    };
  }

  // ============================================
  // CAN PLACE CHECKS
  // ============================================

  /**
   * Check if a cell is within map bounds
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @returns {boolean}
   */
  isInBounds(x, y) {
    const map = this._getMap();
    if (!map) return true;

    const width = map.width || map.terrain?.[0]?.length || 20;
    const height = map.height || map.terrain?.length || 15;

    return x >= 0 && x < width && y >= 0 && y < height;
  }

  /**
   * Check if terrain at cell is buildable
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @returns {boolean}
   */
  isTerrainBuildable(x, y) {
    const map = this._getMap();
    if (!map?.terrain) return true;

    const terrain = map.terrain[y]?.[x];
    
    // Water is not buildable
    if (terrain === 'water') return false;
    
    return true;
  }

  /**
   * Check if cell is part of the path
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @returns {boolean}
   */
  isPath(x, y) {
    const map = this._getMap();
    if (!map) return false;

    // Use map's isPath method if available
    if (typeof map.isPath === 'function') {
      return map.isPath(x, y);
    }

    // Fallback: check path array
    if (Array.isArray(map.path)) {
      return map.path.some(p => p.x === x && p.y === y);
    }

    return false;
  }

  /**
   * Get tower at cell position
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @returns {Object|null} Tower object or null
   */
  getTowerAt(x, y) {
    const towers = this.game?.towers;
    if (!Array.isArray(towers)) return null;

    return towers.find(t => t.gridX === x && t.gridY === y) || null;
  }

  /**
   * Get energy building at cell position (handles multi-cell buildings)
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @returns {Object|null} Building object or null
   */
  getEnergyBuildingAt(x, y) {
    const energyModule = this.game?.getModule?.('energy');
    const buildings = energyModule?.buildingManager?.buildings;
    
    if (!buildings) return null;

    for (const building of buildings.values()) {
      const bx = building.gridX ?? building.x;
      const by = building.gridY ?? building.y;
      const gw = building.gridWidth || 1;
      const gh = building.gridHeight || 1;
      const shape = building.shape || 'rect';

      // Get cells for this building
      const cells = this.getCellsForBuilding(bx, by, { gridWidth: gw, gridHeight: gh, shape });
      
      // Check if target cell is one of building's cells
      if (cells.some(c => c.x === x && c.y === y)) {
        return building;
      }
    }

    return null;
  }

  /**
   * Universal canPlace check for any building
   * @param {number} gridX - Grid X coordinate
   * @param {number} gridY - Grid Y coordinate
   * @param {BuildingDefinition|null} def - Building definition (null = 1x1 tower)
   * @returns {boolean} Whether building can be placed
   */
  canPlace(gridX, gridY, def = null) {
    const cells = this.getCellsForBuilding(gridX, gridY, def);

    for (const cell of cells) {
      // 1. Check bounds
      if (!this.isInBounds(cell.x, cell.y)) {
        return false;
      }

      // 2. Check terrain
      if (!this.isTerrainBuildable(cell.x, cell.y)) {
        return false;
      }

      // 3. Check path
      if (this.isPath(cell.x, cell.y)) {
        return false;
      }

      // 4. Check collision with towers
      if (this.getTowerAt(cell.x, cell.y)) {
        return false;
      }

      // 5. Check collision with energy buildings
      if (this.getEnergyBuildingAt(cell.x, cell.y)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if tower can be placed at position
   * @param {number} gridX - Grid X
   * @param {number} gridY - Grid Y
   * @returns {boolean}
   */
  canPlaceTower(gridX, gridY) {
    return this.canPlace(gridX, gridY, null);
  }

  /**
   * Check if energy building can be placed at position
   * @param {number} gridX - Grid X
   * @param {number} gridY - Grid Y
   * @param {string} buildingType - Energy building type ID
   * @returns {boolean}
   */
  canPlaceEnergy(gridX, gridY, buildingType) {
    const def = ENERGY_BUILDINGS[buildingType];
    return this.canPlace(gridX, gridY, def);
  }

  // ============================================
  // PLACEMENT MODE
  // ============================================

  /**
   * Enter placement mode
   * @param {'tower'|'energy'} type - Building type
   * @param {string|null} buildingId - Building ID (for energy buildings)
   */
  enterPlacementMode(type, buildingId = null) {
    // Exit current mode first
    if (this.state.active) {
      this.exitPlacementMode();
    }

    this.state.active = true;
    this.state.type = type;
    this.state.buildingId = buildingId;

    // Get building definition
    if (type === BUILDING_TYPES.ENERGY && buildingId) {
      this.state.definition = ENERGY_BUILDINGS[buildingId] || null;
    } else {
      this.state.definition = null; // Towers are 1x1
    }

    // Deselect any selected tower
    if (this.game?.selectedTower) {
      this.game.selectTower(null);
    }

    // Notify listeners
    this._notifyStateChange();
  }

  /**
   * Exit placement mode
   */
  exitPlacementMode() {
    if (!this.state.active) return;

    this.state.active = false;
    this.state.type = null;
    this.state.buildingId = null;
    this.state.definition = null;

    // Notify listeners
    this._notifyStateChange();
  }

  /**
   * Toggle placement mode
   * @param {'tower'|'energy'} type - Building type
   * @param {string|null} buildingId - Building ID (for energy)
   */
  togglePlacementMode(type, buildingId = null) {
    // If same type and id, exit
    if (this.state.active && 
        this.state.type === type && 
        this.state.buildingId === buildingId) {
      this.exitPlacementMode();
    } else {
      this.enterPlacementMode(type, buildingId);
    }
  }

  /**
   * Get current placement state
   * @returns {PlacementState}
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Check if currently placing towers
   * @returns {boolean}
   */
  isPlacingTower() {
    return this.state.active && this.state.type === BUILDING_TYPES.TOWER;
  }

  /**
   * Check if currently placing energy buildings
   * @returns {boolean}
   */
  isPlacingEnergy() {
    return this.state.active && this.state.type === BUILDING_TYPES.ENERGY;
  }

  /**
   * Get current building definition (if any)
   * @returns {BuildingDefinition|null}
   */
  getCurrentDefinition() {
    return this.state.definition;
  }

  // ============================================
  // AFFORDABILITY
  // ============================================

  /**
   * Check if player can afford tower
   * @returns {boolean}
   */
  canAffordTower() {
    const gold = this.game?.getState()?.gold || 0;
    return gold >= this.towerCost;
  }

  /**
   * Check if player can afford energy building
   * @param {string} buildingType - Building type ID
   * @returns {boolean}
   */
  canAffordEnergy(buildingType) {
    const gold = this.game?.getState()?.gold || 0;
    const def = ENERGY_BUILDINGS[buildingType];
    const cost = def?.cost || 999;
    return gold >= cost;
  }

  /**
   * Get building cost
   * @param {'tower'|'energy'} type - Building type
   * @param {string|null} buildingId - Building ID (for energy)
   * @returns {number}
   */
  getBuildingCost(type, buildingId = null) {
    if (type === BUILDING_TYPES.TOWER) {
      return this.towerCost;
    }
    
    if (type === BUILDING_TYPES.ENERGY && buildingId) {
      const def = ENERGY_BUILDINGS[buildingId];
      return def?.cost || 999;
    }

    return 0;
  }

  // ============================================
  // HOVER / PREVIEW
  // ============================================

  /**
   * Get hover data for renderer
   * @param {number} gridX - Grid X
   * @param {number} gridY - Grid Y
   * @returns {Object} Hover data for renderer
   */
  getHoverData(gridX, gridY) {
    if (!this.state.active) {
      return null;
    }

    const def = this.state.definition;
    const canPlace = this.canPlace(gridX, gridY, def);
    const cells = this.getCellsForBuilding(gridX, gridY, def);
    const center = this.getBuildingCenter(gridX, gridY, def);

    return {
      gridX,
      gridY,
      canPlace,
      cells,
      center,
      type: this.state.type,
      buildingId: this.state.buildingId,
      definition: def
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  /**
   * Get map from game
   * @private
   * @returns {Object|null}
   */
  _getMap() {
    // Try map module first
    const mapModule = this.game?.getModule?.('map');
    if (mapModule?.currentMap) return mapModule.currentMap;

    // Fallback to direct map property
    return this.game?.map || null;
  }

  /**
   * Notify state change listeners
   * @private
   */
  _notifyStateChange() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(this.getState());
    }
  }

  /**
   * Update grid size (if config changes)
   * @param {number} size - New grid size
   */
  setGridSize(size) {
    this.gridSize = size;
  }
}

// Export
module.exports = {
  PlacementManager,
  BUILDING_TYPES
};
