/**
 * Power Towers TD - Tower Power Integration
 * 
 * Connects towers to the power network
 * - Towers can optionally require power
 * - Powered towers get bonuses
 * - Unpowered towers work at reduced efficiency
 */

const { PowerConsumer } = require('../energy/storage');

/**
 * Power adapter for a tower
 * Wraps a tower and manages its power consumption
 */
class TowerPowerAdapter {
  constructor(tower, powerNetwork, options = {}) {
    this.tower = tower;
    this.powerNetwork = powerNetwork;
    
    // Power consumption settings
    this.basePowerDraw = options.basePowerDraw || 3;  // Power per second at 100%
    this.currentPowerDraw = this.basePowerDraw;
    this.powerDrawMultiplier = 1.0;  // Can be upgraded
    
    // Power state
    this.powered = false;
    this.powerLevel = 0;  // 0-1
    
    // Bonus when powered
    this.poweredBonus = {
      damage: 1.2,      // +20% damage
      range: 1.1,       // +10% range
      fireRate: 1.15    // +15% fire rate
    };
    
    // Penalty when unpowered
    this.unpoweredPenalty = {
      damage: 0.7,      // -30% damage
      range: 0.9,       // -10% range
      fireRate: 0.8     // -20% fire rate
    };
    
    // Create power consumer node
    this.consumer = new PowerConsumer({
      gridX: tower.gridX,
      gridY: tower.gridY,
      worldX: tower.x,
      worldY: tower.y,
      consumption: this.currentPowerDraw,
      capacity: this.currentPowerDraw * 5  // 5 second buffer
    });
    
    // Link consumer to this adapter
    this.consumer.adapter = this;
    
    // Set consumer to reference the real tower for energy transfer
    this.consumer.setTower(tower);
    
    // Register with network
    this.powerNetwork.registerNode(this.consumer);
  }

  /**
   * Called when power level changes
   */
  onPowerLevelChanged(level) {
    this.powerLevel = level;
    this.powered = level > 0.5;  // Need at least 50% power to be "powered"
    
    // Update tower power state
    this.tower.powered = this.powered;
    this.tower.powerLevel = this.powerLevel;
    
    // Recalculate stats with power modifiers
    this.applyPowerModifiers();
  }

  /**
   * Apply power-based modifiers to tower stats
   */
  applyPowerModifiers() {
    if (!this.tower.recalculateStats) return;
    
    // Store power multipliers on tower
    if (this.powered) {
      const bonus = this.poweredBonus;
      const scale = Math.min(1, this.powerLevel);  // Scale bonus by power level
      
      this.tower.powerModifiers = {
        damage: 1 + (bonus.damage - 1) * scale,
        range: 1 + (bonus.range - 1) * scale,
        fireRate: 1 + (bonus.fireRate - 1) * scale
      };
    } else {
      this.tower.powerModifiers = this.unpoweredPenalty;
    }
    
    // Trigger stat recalculation
    this.tower.recalculateStats();
  }

  /**
   * Set power draw level (0-2, where 1 is normal)
   */
  setPowerDraw(multiplier) {
    this.powerDrawMultiplier = Math.max(0, Math.min(2, multiplier));
    this.currentPowerDraw = this.basePowerDraw * this.powerDrawMultiplier;
    this.consumer.consumption = this.currentPowerDraw;
    
    // Adjust bonuses based on power draw
    if (this.powerDrawMultiplier > 1) {
      // Overcharge - more power = more bonus
      const overchargeScale = 1 + (this.powerDrawMultiplier - 1) * 0.5;
      this.poweredBonus = {
        damage: 1.2 * overchargeScale,
        range: 1.1 * overchargeScale,
        fireRate: 1.15 * overchargeScale
      };
    } else if (this.powerDrawMultiplier < 1) {
      // Eco mode - less power = less bonus
      const ecoScale = this.powerDrawMultiplier;
      this.poweredBonus = {
        damage: 1 + 0.2 * ecoScale,
        range: 1 + 0.1 * ecoScale,
        fireRate: 1 + 0.15 * ecoScale
      };
    }
  }

  /**
   * Update - check power status from consumer/tower
   */
  update(dt) {
    this.consumer.update(dt);
    
    // Get power level from tower's current energy
    const towerEnergy = this.tower.currentEnergy || 0;
    const towerMax = this.tower.maxEnergy || 100;
    this.powerLevel = towerMax > 0 ? towerEnergy / towerMax : 0;
    this.powered = towerEnergy > 0;
    
    // Update tower power state
    this.tower.powered = this.powered;
    this.tower.powerLevel = this.powerLevel;
  }

  /**
   * Get power state for UI
   */
  getState() {
    return {
      powered: this.powered,
      powerLevel: this.powerLevel,
      powerDraw: this.currentPowerDraw,
      drawMultiplier: this.powerDrawMultiplier,
      stored: this.consumer.stored,
      capacity: this.consumer.capacity
    };
  }

  /**
   * Disconnect and cleanup
   */
  destroy() {
    if (this.powerNetwork && this.consumer) {
      this.powerNetwork.unregisterNode(this.consumer.id);
    }
  }
}

/**
 * Mixin to add power support to towers module
 */
function addPowerSupportToTowers(towersModule, energyModule) {
  // Store adapters
  towersModule.powerAdapters = new Map();
  
  // Store reference to power network
  towersModule.powerNetwork = energyModule.buildingManager.network;
  
  // Override createTower to add power adapter
  const originalCreateTower = towersModule.createTower.bind(towersModule);
  towersModule.createTower = function(gridX, gridY) {
    const tower = originalCreateTower(gridX, gridY);
    
    if (tower) {
      // Create power adapter for this tower
      const adapter = new TowerPowerAdapter(tower, this.powerNetwork);
      this.powerAdapters.set(tower.id, adapter);
      tower.powerAdapter = adapter;
    }
    
    return tower;
  };
  
  // Override removeTower to cleanup adapter
  const originalRemoveTower = towersModule.removeTower.bind(towersModule);
  towersModule.removeTower = function(towerId) {
    const adapter = this.powerAdapters.get(towerId);
    if (adapter) {
      adapter.destroy();
      this.powerAdapters.delete(towerId);
    }
    return originalRemoveTower(towerId);
  };
  
  // Override update to update adapters
  const originalUpdate = towersModule.update.bind(towersModule);
  towersModule.update = function(deltaTime, enemies) {
    // Update power adapters
    for (const adapter of this.powerAdapters.values()) {
      adapter.update(deltaTime);
    }
    
    return originalUpdate(deltaTime, enemies);
  };
  
  console.log('[TowerPower] Power support added to towers module');
}

module.exports = { 
  TowerPowerAdapter,
  addPowerSupportToTowers
};
