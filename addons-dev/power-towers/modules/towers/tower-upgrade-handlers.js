/**
 * Power Towers TD - Tower Upgrade Handlers
 * 
 * Processes upgrade requests and applies changes to towers.
 */

const { 
  getAttackType,
  getAvailableAttackTypes
} = require('../../core/attack-types');
const {
  getStatUpgradeCost,
  getAttackTypeCost,
  getElementPathCost,
  applyStatUpgrade,
  applyElementPath,
  calculateTotalInvested,
  applyElementAbilityUpgrade,
  getElementAbilityUpgradeCost
} = require('../../core/tower-upgrades');

/**
 * Create upgrade handlers for tower module
 * @param {Object} context - Context with towers Map and eventBus
 * @returns {Object} Handler functions
 */
function createUpgradeHandlers(context) {
  const { towers, eventBus } = context;

  /**
   * Handle attack type selection
   */
  function handleSetAttackType({ towerId, attackTypeId }) {
    const tower = towers.get(towerId);
    if (!tower) return;
    
    // Can only set attack type once (or if still 'base')
    if (tower.attackTypeId !== 'base') {
      eventBus.emit('tower:upgrade-failed', { 
        reason: 'Attack type already selected' 
      });
      return;
    }
    
    const cost = getAttackTypeCost(attackTypeId);
    
    eventBus.emit('economy:check-afford', {
      amount: cost,
      callback: (canAfford) => {
        if (!canAfford) {
          eventBus.emit('tower:upgrade-failed', { reason: 'Not enough gold' });
          return;
        }
        
        // Apply attack type
        tower.attackTypeId = attackTypeId;
        tower.attackTypeConfig = getAttackType(attackTypeId);
        tower.recalculateStats();
        
        eventBus.emit('economy:spend', cost);
        eventBus.emit('tower:attack-type-set', { tower, attackTypeId });
        eventBus.emit('tower:updated', { tower });
      }
    });
  }

  /**
   * Handle secondary attack type selection (dual-type)
   */
  function handleSetSecondaryAttackType({ towerId, attackTypeId, unlockSource }) {
    const tower = towers.get(towerId);
    if (!tower) return;
    
    // Must have primary attack type first
    if (tower.attackTypeId === 'base') {
      eventBus.emit('tower:upgrade-failed', { 
        reason: 'Must select primary attack type first' 
      });
      return;
    }
    
    // Cannot set same as primary
    if (tower.attackTypeId === attackTypeId) {
      eventBus.emit('tower:upgrade-failed', { 
        reason: 'Secondary must be different from primary' 
      });
      return;
    }
    
    // Check if already has secondary
    if (tower.hasSecondaryAttackType) {
      eventBus.emit('tower:upgrade-failed', { 
        reason: 'Secondary attack type already set' 
      });
      return;
    }
    
    // Apply secondary type (no cost - unlocked via card/special)
    tower.secondaryAttackTypeId = attackTypeId;
    tower.hasSecondaryAttackType = true;
    tower.recalculateStats();
    
    eventBus.emit('tower:secondary-attack-type-set', { 
      tower, 
      attackTypeId,
      unlockSource 
    });
    eventBus.emit('tower:updated', { tower });
  }

  /**
   * Handle stat upgrade
   */
  function handleUpgradeStat({ towerId, statId }) {
    const tower = towers.get(towerId);
    if (!tower) return;
    
    const currentLevel = tower.upgradeLevels[statId] || 0;
    const cost = getStatUpgradeCost(statId, currentLevel);
    
    if (cost === Infinity) {
      eventBus.emit('tower:upgrade-failed', { reason: 'Max level reached' });
      return;
    }
    
    eventBus.emit('economy:check-afford', {
      amount: cost,
      callback: (canAfford) => {
        if (!canAfford) {
          eventBus.emit('tower:upgrade-failed', { reason: 'Not enough gold' });
          return;
        }
        
        if (applyStatUpgrade(tower, statId)) {
          eventBus.emit('economy:spend', cost);
          eventBus.emit('tower:stat-upgraded', { tower, statId });
          eventBus.emit('tower:updated', { tower });
        }
      }
    });
  }

  /**
   * Handle element path selection
   */
  function handleSetElement({ towerId, elementId }) {
    const tower = towers.get(towerId);
    if (!tower) return;
    
    // Check if tower already has element
    if (tower.elementPath) {
      if (tower.elementPath !== elementId) {
        eventBus.emit('tower:upgrade-failed', { 
          reason: 'Cannot change element path' 
        });
        return;
      }
      eventBus.emit('tower:upgrade-failed', { 
        reason: 'Element already selected' 
      });
      return;
    }
    
    const cost = getElementPathCost(elementId);
    
    eventBus.emit('economy:check-afford', {
      amount: cost,
      callback: (canAfford) => {
        if (!canAfford) {
          eventBus.emit('tower:upgrade-failed', { reason: 'Not enough gold' });
          return;
        }
        
        if (applyElementPath(tower, elementId)) {
          eventBus.emit('economy:spend', cost);
          eventBus.emit('tower:element-set', { tower, elementId });
          eventBus.emit('tower:updated', { tower });
        }
      }
    });
  }

  /**
   * Handle power draw adjustment (for Magic attack type)
   */
  function handleSetPowerDraw({ towerId, powerDraw }) {
    const tower = towers.get(towerId);
    if (!tower) return;
    
    if (tower.attackTypeId !== 'magic') {
      return; // Only magic towers use power draw
    }
    
    const maxWithOverdrive = tower.overdriveEfficiency > 0 ? 200 : tower.maxPowerDraw;
    tower.currentPowerDraw = Math.max(
      tower.minPowerDraw, 
      Math.min(maxWithOverdrive, powerDraw)
    );
    
    eventBus.emit('tower:power-draw-changed', { tower });
  }

  /**
   * Handle element ability upgrade
   */
  function handleUpgradeAbility({ towerId, abilityId }) {
    const tower = towers.get(towerId);
    if (!tower) return;
    
    // Check if tower has element
    if (!tower.elementPath) {
      eventBus.emit('tower:upgrade-failed', { 
        reason: 'Tower has no element' 
      });
      return;
    }
    
    const cost = getElementAbilityUpgradeCost(tower, abilityId);
    
    eventBus.emit('economy:check-afford', {
      amount: cost,
      callback: (canAfford) => {
        if (!canAfford) {
          eventBus.emit('tower:upgrade-failed', { reason: 'Not enough gold' });
          return;
        }
        
        if (applyElementAbilityUpgrade(tower, abilityId)) {
          eventBus.emit('economy:spend', cost);
          eventBus.emit('tower:ability-upgraded', { tower, abilityId });
          eventBus.emit('tower:updated', { tower });
        } else {
          eventBus.emit('tower:upgrade-failed', { reason: 'Max level reached' });
        }
      }
    });
  }

  /**
   * Handle tower taking damage
   */
  function handleTowerDamage({ towerId, damage, source }, deselectCallback) {
    const tower = towers.get(towerId);
    if (!tower || tower.isDestroyed) return;
    
    tower.currentHp -= damage;
    
    eventBus.emit('tower:damaged', { 
      tower, 
      damage, 
      source,
      currentHp: tower.currentHp,
      maxHp: tower.maxHp
    });
    
    // Check if destroyed
    if (tower.currentHp <= 0) {
      tower.currentHp = 0;
      tower.isDestroyed = true;
      
      eventBus.emit('tower:destroyed', { tower, source });
      
      // Remove from active towers
      towers.delete(towerId);
      
      // Deselect if this tower was selected
      if (deselectCallback) {
        deselectCallback(towerId);
      }
    }
  }

  /**
   * Handle sell request
   */
  function handleSellRequest(towerId, deselectCallback) {
    const tower = towers.get(towerId);
    if (!tower) return;

    // Sell value = 60% of total invested
    const totalInvested = calculateTotalInvested(tower);
    const sellValue = Math.floor(totalInvested * 0.6);

    towers.delete(towerId);
    
    eventBus.emit('economy:gain', sellValue);
    eventBus.emit('tower:sold', { towerId, sellValue });
    
    if (deselectCallback) {
      deselectCallback(towerId);
    }
  }

  /**
   * Heal tower
   */
  function healTower(towerId, amount) {
    const tower = towers.get(towerId);
    if (!tower || tower.isDestroyed) return 0;
    
    const oldHp = tower.currentHp;
    tower.currentHp = Math.min(tower.maxHp, tower.currentHp + amount);
    const healed = tower.currentHp - oldHp;
    
    if (healed > 0) {
      eventBus.emit('tower:healed', { tower, amount: healed });
    }
    
    return healed;
  }

  return {
    handleSetAttackType,
    handleSetSecondaryAttackType,
    handleUpgradeStat,
    handleSetElement,
    handleSetPowerDraw,
    handleUpgradeAbility,
    handleTowerDamage,
    handleSellRequest,
    healTower
  };
}

module.exports = { createUpgradeHandlers };
