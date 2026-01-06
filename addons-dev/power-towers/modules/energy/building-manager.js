/**
 * Power Towers TD - Energy Building Manager
 * 
 * Handles placement, connection UI, and management of energy buildings
 * Uses unified PlacementManager for placement validation
 */

const { GameEvents } = require('../../core/event-bus');
const { PowerNetwork } = require('./power-network');
const { BaseGenerator, BioGenerator, WindGenerator, SolarGenerator, WaterGenerator } = require('./generators');
const { Battery, PowerTransfer, PowerConsumer } = require('./storage');
const { ENERGY_BUILDINGS, CATEGORY_COLORS, BUILDING_ICONS } = require('./building-defs');

class EnergyBuildingManager {
  constructor(eventBus, gameCore, placementManager = null) {
    this.eventBus = eventBus;
    this.gameCore = gameCore;
    this.placementManager = placementManager;
    
    // Power network
    this.network = new PowerNetwork(eventBus);
    
    // All placed energy buildings
    this.buildings = new Map(); // id -> building instance
    
    // Connection mode state
    this.connectionMode = false;
    this.selectedNode = null;
    
    // Building placement ghost
    this.placementGhost = null;
  }
  
  /**
   * Set placement manager reference
   */
  setPlacementManager(pm) {
    this.placementManager = pm;
  }

  init() {
    this.network.init();
    
    // Listen for events
    this.eventBus.on(GameEvents.GAME_START, () => this.onGameStart());
    
    // Building events
    this.eventBus.on('energy:place-building', (data) => this.placeBuilding(data));
    this.eventBus.on('energy:remove-building', (id) => this.removeBuilding(id));
    this.eventBus.on('energy:select-building', (id) => this.selectBuilding(id));
    
    // Connection events
    this.eventBus.on('energy:start-connection', (nodeId) => this.startConnection(nodeId));
    this.eventBus.on('energy:end-connection', (nodeId) => this.endConnection(nodeId));
    this.eventBus.on('energy:cancel-connection', () => this.cancelConnection());
  }

  /**
   * Get map module from game core
   */
  getMap() {
    return this.gameCore?.getModule('map') || null;
  }

  onGameStart() {
    // Don't reset - allow pre-placed buildings to persist (like towers)
    // Buildings are only reset on full game reset, not on wave start
  }

  /**
   * Place a new energy building
   */
  placeBuilding(data) {
    const { type, gridX, gridY, worldX, worldY } = data;
    const def = ENERGY_BUILDINGS[type];
    
    if (!def) {
      console.warn(`[EnergyManager] Unknown building type: ${type}`);
      return null;
    }

    // Check if can afford
    const economy = this.gameCore.getModule('economy');
    if (economy && !economy.canAfford(def.cost)) {
      this.eventBus.emit('ui:toast', { message: 'Not enough gold!', type: 'error' });
      return null;
    }

    // Check if cell is buildable
    if (!this.canBuildAt(gridX, gridY)) {
      this.eventBus.emit('ui:toast', { message: 'Cannot build here!', type: 'error' });
      return null;
    }

    // Deduct cost
    if (economy) {
      economy.spendGold(def.cost);
    }

    // Create building instance
    const building = this.createBuildingInstance(type, {
      gridX,
      gridY,
      worldX,
      worldY,
      gridWidth: def.gridWidth || 1,
      gridHeight: def.gridHeight || 1,
      shape: def.shape || 'rect',
      gridSize: this.config?.GRID_SIZE || 24,  // Pass grid size for pixel calculation
      ...def.stats
    });

    if (!building) return null;

    // Set map reference for terrain-dependent generators
    const map = this.getMap();
    if (building.setMap && map) {
      building.setMap(map);
    }

    // Store biome info on building for tooltip display
    if (map) {
      building.biomeType = map.biomeMap?.[gridY]?.[gridX] || 'default';
      
      // Get border info (nearby biomes)
      const borderInfo = map.getBorderInfo?.(gridX, gridY);
      if (borderInfo && borderInfo.nearbyBiomes) {
        // nearbyBiomes может быть Set или Array
        const nearbyArr = borderInfo.nearbyBiomes instanceof Set 
          ? Array.from(borderInfo.nearbyBiomes)
          : (Array.isArray(borderInfo.nearbyBiomes) ? borderInfo.nearbyBiomes : []);
        
        if (nearbyArr.length > 0) {
          building.nearbyBiomes = nearbyArr;
          building.isBorder = true;
        } else {
          building.nearbyBiomes = [];
          building.isBorder = false;
        }
      } else {
        building.nearbyBiomes = [];
        building.isBorder = false;
      }
    }

    // Set network reference for batteries
    if (building.setNetwork) {
      building.setNetwork(this.network);
    }

    // Register with network
    this.network.registerNode(building);
    
    // Store building
    this.buildings.set(building.id, building);

    // Mark cell as occupied
    if (map && map.setCellOccupied) {
      map.setCellOccupied(gridX, gridY, true);
    }
    
    this.eventBus.emit('energy:building-placed', {
      building,
      type,
      gridX,
      gridY
    });

    return building;
  }

  /**
   * Create building instance by type
   */
  createBuildingInstance(type, options) {
    switch (type) {
      case 'debug-generator':
        // Debug generator uses BaseGenerator with overridden stats
        return new BaseGenerator({ ...options, type: 'debug-generator' });
      case 'base-generator':
        return new BaseGenerator(options);
      case 'bio-generator':
        return new BioGenerator(options);
      case 'wind-generator':
        return new WindGenerator(options);
      case 'solar-generator':
        return new SolarGenerator(options);
      case 'water-generator':
        return new WaterGenerator(options);
      case 'battery':
        return new Battery(options);
      case 'power-transfer':
        return new PowerTransfer(options);
      default:
        console.warn(`[EnergyManager] Unknown building type: ${type}`);
        return null;
    }
  }

  /**
   * Check if can build at position
   * Uses unified PlacementManager for consistent checks
   */
  canBuildAt(gridX, gridY, buildingType = null) {
    // Prefer PlacementManager for unified checks
    if (this.placementManager) {
      if (buildingType) {
        return this.placementManager.canPlaceEnergy(gridX, gridY, buildingType);
      }
      // Default to 1x1 building check
      return this.placementManager.canPlace(gridX, gridY, null);
    }
    
    // Fallback: basic check if no PlacementManager
    const map = this.getMap();
    if (!map) return true;
    
    // Check terrain
    const terrain = map.terrain?.[gridY]?.[gridX];
    if (terrain === 'water') return false;
    
    // Check if path
    if (map.isPath && map.isPath(gridX, gridY)) return false;
    
    // Check if occupied
    if (map.isCellOccupied && map.isCellOccupied(gridX, gridY)) return false;
    
    return true;
  }

  /**
   * Remove a building
   */
  removeBuilding(id) {
    const building = this.buildings.get(id);
    if (!building) return false;

    // Unregister from network
    this.network.unregisterNode(id);
    
    // Free cell
    const map = this.getMap();
    if (map && map.setCellOccupied) {
      map.setCellOccupied(building.gridX, building.gridY, false);
    }

    this.buildings.delete(id);
    
    this.eventBus.emit('energy:building-removed', { id, building });
    
    return true;
  }

  /**
   * Select a building (show info/connections)
   */
  selectBuilding(id) {
    const building = this.buildings.get(id);
    if (!building) return;

    this.selectedNode = building;
    
    // Get connection options
    const connections = this.network.getAvailableConnections(id);
    
    this.eventBus.emit('energy:building-selected', {
      building: building.getState(),
      connections
    });
  }

  /**
   * Start connection mode from a node
   */
  startConnection(nodeId) {
    const node = this.network.nodes.get(nodeId);
    if (!node) return;

    this.connectionMode = true;
    this.selectedNode = node;
    
    // Get valid targets
    const available = this.network.getAvailableConnections(nodeId);
    
    this.eventBus.emit('energy:connection-mode', {
      active: true,
      source: nodeId,
      availableTargets: available.outputs
    });
  }

  /**
   * End connection to a target node
   */
  endConnection(targetId) {
    if (!this.connectionMode || !this.selectedNode) return;

    const success = this.network.connect(this.selectedNode.id, targetId);
    
    if (success) {
      this.eventBus.emit('ui:toast', { message: 'Connected!', type: 'success' });
    } else {
      this.eventBus.emit('ui:toast', { message: 'Connection failed!', type: 'error' });
    }

    this.cancelConnection();
  }

  /**
   * Cancel connection mode
   */
  cancelConnection() {
    this.connectionMode = false;
    this.selectedNode = null;
    
    this.eventBus.emit('energy:connection-mode', { active: false });
  }

  /**
   * Update all buildings
   */
  update(deltaTime) {
    // Update network (handles energy flow)
    this.network.update(deltaTime);
    
    // Update individual buildings
    for (const building of this.buildings.values()) {
      building.update?.(deltaTime);
    }
  }

  /**
   * Create power consumer for a tower (with custom ID)
   */
  createConsumerForTower(tower, consumption = 5, customId = null) {
    const consumer = new PowerConsumer({
      gridX: tower.gridX,
      gridY: tower.gridY,
      worldX: tower.x,
      worldY: tower.y,
      consumption,
      capacity: consumption * 4 // 4 seconds buffer
    });
    
    // Set custom ID BEFORE registration
    if (customId) {
      consumer.id = customId;
    }
    
    consumer.setTower(tower);
    this.network.registerNode(consumer);
    
    return consumer;
  }

  /**
   * Get building at grid position
   */
  getBuildingAt(gridX, gridY) {
    for (const building of this.buildings.values()) {
      if (building.gridX === gridX && building.gridY === gridY) {
        return building;
      }
    }
    return null;
  }

  /**
   * Connect two buildings via network
   */
  connectBuildings(fromId, toId) {
    const fromBuilding = this.buildings.get(fromId);
    const toBuilding = this.buildings.get(toId);
    
    if (!fromBuilding || !toBuilding) return false;
    
    // Create connection in network
    return this.network.connect(fromId, toId);
  }

  /**
   * Connect energy building to tower
   * Tower becomes a consumer in the network
   */
  connectTower(fromBuildingId, tower) {
    const fromBuilding = this.buildings.get(fromBuildingId);
    if (!fromBuilding || !tower) return false;
    
    // Check if tower has a power adapter with consumer already
    let consumer = null;
    let consumerId = null;
    
    if (tower.powerAdapter && tower.powerAdapter.consumer) {
      // Use existing consumer from power adapter
      consumer = tower.powerAdapter.consumer;
      consumerId = consumer.id;
      
      // Make sure consumer references the real tower for energy transfer
      consumer.setTower(tower);
      tower.powerConsumer = consumer;
    } else {
      // Fallback: check for consumer by tower ID
      consumerId = `tower-${tower.id}`;
      consumer = this.network.nodes.get(consumerId);
      
      if (!consumer) {
        // Create consumer for tower with custom ID
        const consumption = tower.energyCost || 5;
        consumer = this.createConsumerForTower(tower, consumption, consumerId);
        
        // Store reference
        tower.powerConsumer = consumer;
      }
    }
    
    // Connect building to tower's consumer
    const success = this.network.connect(fromBuildingId, consumerId);
    return success;
  }

  /**
   * Get connections count for a building
   */
  getConnectionsCount(buildingId) {
    const connections = this.network.connections || [];
    return connections.filter(c => c.from === buildingId || c.to === buildingId).length;
  }

  /**
   * Get all building definitions
   */
  getBuildingDefinitions() {
    return ENERGY_BUILDINGS;
  }

  /**
   * Get render data for visualization
   */
  getRenderData() {
    const buildings = [];
    
    for (const building of this.buildings.values()) {
      buildings.push({
        ...building.getRenderData(),
        icon: BUILDING_ICONS[building.type],
        categoryColor: CATEGORY_COLORS[building.nodeType]
      });
    }

    return {
      buildings,
      network: this.network.getRenderData(),
      connectionMode: this.connectionMode,
      selectedNode: this.selectedNode?.id
    };
  }

  reset() {
    this.buildings.clear();
    this.network.reset();
    this.connectionMode = false;
    this.selectedNode = null;
  }

  destroy() {
    this.reset();
    this.network.destroy();
  }
}

module.exports = { EnergyBuildingManager };
