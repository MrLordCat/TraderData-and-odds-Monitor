/**
 * Power Towers TD - Energy Module
 * 
 * Complete energy system with:
 * - Generators (Base, Bio, Wind, Solar, Water)
 * - Storage (Battery with stacking & decay)
 * - Transfer (Multi-channel relay)
 * - Power Network (connections & energy flow)
 */

const { GameEvents } = require('../../core/event-bus');
const { PowerNetwork } = require('./power-network');
const { EnergyBuildingManager } = require('./building-manager');
const { ENERGY_BUILDINGS } = require('./building-defs');

class EnergyModule {
  /**
   * @param {EventBus} eventBus - Event system
   * @param {object} config - Game configuration
   * @param {object} gameCore - Reference to game core
   */
  constructor(eventBus, config, gameCore) {
    this.eventBus = eventBus;
    this.config = config;
    this.gameCore = gameCore;
    
    // Building manager handles placement & network
    this.buildingManager = new EnergyBuildingManager(eventBus, gameCore);
    
    // Global energy stats (for UI)
    this.totalGeneration = 0;
    this.totalStorage = 0;
    this.totalCapacity = 0;
  }

  /**
   * Initialize module
   */
  init() {
    this.buildingManager.init();
    
    // Listen for network state updates
    this.eventBus.on('power:network-state', (state) => this.onNetworkState(state));
    this.eventBus.on(GameEvents.GAME_START, () => this.onGameStart());
  }

  /**
   * Set map reference
   */
  setMap(map) {
    this.buildingManager.setMap(map);
  }

  /**
   * Update
   */
  update(deltaTime) {
    this.buildingManager.update(deltaTime);
  }

  /**
   * On game start - don't reset, buildings persist
   */
  onGameStart() {
    // Don't reset buildings - they persist like towers
    // Only reset stats counters
    this.totalGeneration = 0;
    this.totalStorage = 0;
    this.totalCapacity = 0;
  }

  /**
   * On network state update
   */
  onNetworkState(state) {
    this.totalGeneration = state.totalGeneration;
    this.totalStorage = state.totalStorage;
    this.totalCapacity = state.totalCapacity;
    
    // Emit for UI
    this.eventBus.emit('energy:stats-updated', {
      generation: this.totalGeneration,
      storage: this.totalStorage,
      capacity: this.totalCapacity,
      connections: state.connections
    });
  }

  /**
   * Place an energy building
   */
  placeBuilding(type, gridX, gridY, worldX, worldY) {
    return this.buildingManager.placeBuilding({
      type, gridX, gridY, worldX, worldY
    });
  }

  /**
   * Get building definitions
   */
  getBuildingDefinitions() {
    return ENERGY_BUILDINGS;
  }

  /**
   * Get building at grid position
   */
  getBuildingAt(gridX, gridY) {
    return this.buildingManager.getBuildingAt(gridX, gridY);
  }

  /**
   * Remove building by ID
   */
  removeBuilding(id) {
    return this.buildingManager.removeBuilding(id);
  }

  /**
   * Connect two buildings
   */
  connectBuildings(fromId, toId) {
    return this.buildingManager.connectBuildings(fromId, toId);
  }

  /**
   * Get connections count for a building
   */
  getConnectionsCount(buildingId) {
    return this.buildingManager.getConnectionsCount(buildingId);
  }

  /**
   * Create power consumer for tower
   */
  createConsumerForTower(tower, consumption) {
    return this.buildingManager.createConsumerForTower(tower, consumption);
  }

  /**
   * Connect energy building to tower as consumer
   */
  connectTower(fromBuildingId, tower) {
    return this.buildingManager.connectTower(fromBuildingId, tower);
  }

  /**
   * Get render data
   */
  getRenderData() {
    // Calculate total potential consumption from towers
    let totalConsumption = 0;
    if (this.gameCore?.modules?.towers) {
      const towers = this.gameCore.modules.towers.getTowersArray();
      for (const tower of towers) {
        // Consumption = energyCostPerShot * attackSpeed (shots per second)
        const costPerShot = tower.energyCostPerShot || 0;
        const attackSpeed = tower.attackSpeed || 1;
        totalConsumption += costPerShot * attackSpeed;
      }
    }
    
    return {
      ...this.buildingManager.getRenderData(),
      totalGeneration: this.totalGeneration,
      totalStored: this.totalStorage,
      totalCapacity: this.totalCapacity,
      totalConsumption: Math.round(totalConsumption * 10) / 10 // Round to 1 decimal
    };
  }

  /**
   * Reset
   */
  reset() {
    this.buildingManager.reset();
    this.totalGeneration = 0;
    this.totalStorage = 0;
    this.totalCapacity = 0;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.buildingManager.destroy();
    this.reset();
  }
}

// Re-export components
module.exports = { 
  EnergyModule,
  PowerNetwork,
  EnergyBuildingManager,
  ENERGY_BUILDINGS
};

