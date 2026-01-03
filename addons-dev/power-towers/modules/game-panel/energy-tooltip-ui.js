/**
 * Power Towers TD - Energy Building UI Mixin
 * Handles energy building selection and connections (UI in bottom panel)
 */

const CONFIG = require('../../core/config');

// Base upgrade costs (from CONFIG)
const BASE_UPGRADE_COSTS = CONFIG.ENERGY_TOOLTIP_COSTS || {
  capacity: 20,
  outputRate: 25,
  range: 30,
  channels: 50
};

// Max upgrade levels (from CONFIG)
const MAX_UPGRADE_LEVELS = CONFIG.ENERGY_TOOLTIP_MAX_LEVELS || {
  capacity: 5,
  outputRate: 5,
  range: 5
};

// Cost multiplier (from CONFIG)
const TOOLTIP_COST_MULTIPLIER = CONFIG.ENERGY_TOOLTIP_COST_MULTIPLIER || 1.5;

/**
 * Calculate upgrade cost for energy building
 */
function calculateEnergyUpgradeCost(stat, currentLevel) {
  const baseCost = BASE_UPGRADE_COSTS[stat] || 20;
  return Math.floor(baseCost * Math.pow(TOOLTIP_COST_MULTIPLIER, currentLevel));
}

/**
 * Mixin for energy building UI functionality
 * @param {Class} Base - GameController base class
 */
function EnergyTooltipMixin(Base) {
  return class extends Base {
    
    /**
     * Show energy building info in bottom panel
     */
    showEnergyBuildingInfo(building) {
      if (!this.camera) return;
      
      this.selectedEnergyBuilding = building;
      this.energyTooltipBuildingPosition = { x: building.gridX, y: building.gridY };
      
      // Update bottom panel
      if (this.showEnergyBuildingInBottomPanel) {
        this.showEnergyBuildingInBottomPanel(building);
      }
    }
    
    /**
     * Hide energy building info (clears state)
     */
    hideEnergyBuildingInfo() {
      this.selectedEnergyBuilding = null;
      this.energyTooltipBuildingPosition = null;
    }
    
    /**
     * Sell selected energy building
     */
    sellSelectedEnergyBuilding() {
      if (!this.selectedEnergyBuilding || !this.game) return;
      
      const building = this.selectedEnergyBuilding;
      const energyModule = this.game.getModule('energy');
      const economy = this.game.getModule('economy');
      
      if (energyModule && economy) {
        const { ENERGY_BUILDINGS } = require('../../modules/energy/building-defs');
        const def = ENERGY_BUILDINGS[building.type];
        const sellPrice = Math.floor((def?.cost || 50) * 0.5);
        
        energyModule.removeBuilding(building.id);
        economy.addGold(sellPrice);
        
        this.hideEnergyBuildingInfo();
        if (this.hideBottomPanelSelection) {
          this.hideBottomPanelSelection();
        }
        this.updateUI(this.game.getState());
        this.renderGame();
      }
    }
    
    /**
     * Toggle energy upgrades panel in bottom panel
     */
    toggleEnergyUpgradesPanel_Bottom() {
      // This is handled by bottom-panel-ui action cards
      // Kept for compatibility
    }
    
    /**
     * Upgrade energy building stat
     */
    upgradeEnergyBuildingStat(stat) {
      if (!this.selectedEnergyBuilding || !this.game) return;
      
      const building = this.selectedEnergyBuilding;
      const economy = this.game.getModule('economy');
      if (!economy) return;
      
      const maxLevels = {
        ...MAX_UPGRADE_LEVELS,
        channels: building.maxChannelUpgrades || 4
      };
      
      const upgrades = building.upgradeLevels || building.upgrades || { capacity: 0, outputRate: 0, range: 0, channels: 0 };
      const level = upgrades[stat] || 0;
      const maxLevel = maxLevels[stat] || 5;
      const cost = calculateEnergyUpgradeCost(stat, level);
      
      if (!economy.canAfford(cost)) return;
      if (level >= maxLevel) return;
      
      economy.spendGold(cost);
      
      // Apply upgrade
      if (building.applyStatUpgrade) {
        building.applyStatUpgrade(stat);
      } else if (building.upgrade) {
        building.upgrade(stat);
      } else {
        building.upgradeLevels = building.upgradeLevels || { capacity: 0, outputRate: 0, range: 0, channels: 0 };
        building.upgradeLevels[stat]++;
      }
      
      // Refresh bottom panel
      if (this.showEnergyBuildingInBottomPanel) {
        this.showEnergyBuildingInBottomPanel(building);
      }
      this.updateUI(this.game.getState());
      this.renderGame();
    }
    
    // =============================================
    // Energy Connection Mode
    // =============================================
    
    /**
     * Start energy connection mode
     */
    startEnergyConnectionMode() {
      if (!this.selectedEnergyBuilding || !this.game) return;
      
      const energyModule = this.game.getModule('energy');
      if (!energyModule) return;
      
      this.connectingFromBuilding = this.selectedEnergyBuilding;
      this.isConnectingEnergy = true;
      
      const range = this.connectingFromBuilding.getEffectiveRange?.() || this.connectingFromBuilding.range || 4;
      
      this.game.eventBus?.emit('ui:toast', { 
        message: `Click building or tower within ${range} cells to connect`, 
        type: 'info' 
      });
      
      this.renderGame();
    }
    
    /**
     * Cancel energy connection mode
     */
    cancelEnergyConnectionMode() {
      this.connectingFromBuilding = null;
      this.isConnectingEnergy = false;
    }
    
    /**
     * Complete energy connection to building
     */
    completeEnergyConnection(targetBuilding) {
      if (!this.connectingFromBuilding || !targetBuilding || !this.game) return;
      
      const energyModule = this.game.getModule('energy');
      if (!energyModule) return;
      
      const from = this.connectingFromBuilding;
      const to = targetBuilding;
      
      if (from.id === to.id) {
        this.cancelEnergyConnectionMode();
        return;
      }
      
      const dx = from.gridX - to.gridX;
      const dy = from.gridY - to.gridY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxRange = Math.max(from.range || 4, to.range || 4);
      
      if (distance > maxRange) {
        this.game.eventBus?.emit('ui:toast', { 
          message: 'Buildings too far apart!', 
          type: 'error' 
        });
        this.cancelEnergyConnectionMode();
        return;
      }
      
      const result = energyModule.connectBuildings?.(from.id, to.id);
      
      if (result === 'disconnected') {
        this.game.eventBus?.emit('ui:toast', { message: 'Connection removed', type: 'info' });
      } else if (result !== false) {
        this.game.eventBus?.emit('ui:toast', { message: 'Connection established!', type: 'success' });
      }
      
      this.cancelEnergyConnectionMode();
      this.renderGame();
    }
    
    /**
     * Complete energy connection to tower
     */
    completeEnergyConnectionToTower(tower) {
      if (!this.connectingFromBuilding || !tower || !this.game) return;
      
      const energyModule = this.game.getModule('energy');
      if (!energyModule) return;
      
      const from = this.connectingFromBuilding;
      
      const dx = from.gridX - tower.gridX;
      const dy = from.gridY - tower.gridY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxRange = from.range || 4;
      
      if (distance > maxRange) {
        this.game.eventBus?.emit('ui:toast', { 
          message: 'Tower too far from energy building!', 
          type: 'error' 
        });
        this.cancelEnergyConnectionMode();
        return;
      }
      
      const result = energyModule.connectTower?.(from.id, tower);
      
      if (result === 'disconnected') {
        this.game.eventBus?.emit('ui:toast', { message: '⚡ Tower disconnected from power', type: 'info' });
      } else if (result) {
        this.game.eventBus?.emit('ui:toast', { message: '⚡ Tower connected to power!', type: 'success' });
      } else {
        this.game.eventBus?.emit('ui:toast', { message: 'Failed to connect tower', type: 'error' });
      }
      
      this.cancelEnergyConnectionMode();
      this.renderGame();
    }
  };
}

module.exports = { EnergyTooltipMixin, calculateEnergyUpgradeCost, BASE_UPGRADE_COSTS, MAX_UPGRADE_LEVELS };
