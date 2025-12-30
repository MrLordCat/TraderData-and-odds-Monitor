/**
 * Power Towers TD - Towers Module
 * 
 * Manages tower creation, upgrades, targeting, and attacks.
 * 
 * SINGLE TOWER SYSTEM:
 * - Only one tower type exists: BASE tower
 * - After building, player chooses Attack Type (Siege, Normal, Magic, Piercing)
 * - Then can upgrade stats and choose Element Path
 * - All upgrades apply to the base stats, then modifiers are calculated
 */

const { GameEvents } = require('../../core/event-bus');
const { ATTACK_TYPES } = require('../../core/attack-types');
const {
  BASE_TOWER,
  ELEMENT_PATHS,
  getTowerBuildSummary
} = require('../../core/tower-upgrades');

// Split modules
const { createTowerInstance } = require('./tower-factory');
const { recalculateTowerStats } = require('./tower-stats');
const { createUpgradeHandlers } = require('./tower-upgrade-handlers');
const { isValidTarget, findTarget, performAttack } = require('./tower-combat');

class TowersModule {
  /**
   * @param {EventBus} eventBus - Event system
   * @param {object} config - Game configuration
   */
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    
    // Tower instances
    this.towers = new Map(); // towerId -> tower instance
    this.nextTowerId = 1;
    
    // Selected tower for UI
    this.selectedTowerId = null;
    
    // Create upgrade handlers with context
    this.upgradeHandlers = createUpgradeHandlers({
      towers: this.towers,
      eventBus: this.eventBus
    });
  }

  /**
   * Initialize module
   */
  init() {
    this.eventBus.on(GameEvents.GAME_START, () => this.onGameStart());
    this.eventBus.on('tower:build-request', (data) => this.handleBuildRequest(data));
    this.eventBus.on('tower:sell-request', (towerId) => this.handleSellRequest(towerId));
    this.eventBus.on('tower:select', (towerId) => this.selectTower(towerId));
    this.eventBus.on('tower:deselect', () => this.deselectTower());
    
    // Kill credit - tower gains XP when it kills an enemy
    this.eventBus.on('enemy:killed', (data) => this.onEnemyKilled(data));
    
    // Upgrade events - delegate to handlers
    this.eventBus.on('tower:set-attack-type', (data) => 
      this.upgradeHandlers.handleSetAttackType(data));
    this.eventBus.on('tower:set-secondary-attack-type', (data) => 
      this.upgradeHandlers.handleSetSecondaryAttackType(data));
    this.eventBus.on('tower:upgrade-stat', (data) => 
      this.upgradeHandlers.handleUpgradeStat(data));
    this.eventBus.on('tower:set-element', (data) => 
      this.upgradeHandlers.handleSetElement(data));
    this.eventBus.on('tower:set-power-draw', (data) => 
      this.upgradeHandlers.handleSetPowerDraw(data));
    this.eventBus.on('tower:damage', (data) => 
      this.upgradeHandlers.handleTowerDamage(data, (id) => this.checkDeselect(id)));
  }

  /**
   * Update all towers
   */
  update(deltaTime, enemies) {
    for (const [id, tower] of this.towers) {
      this.updateTower(tower, deltaTime, enemies);
    }
  }

  /**
   * Reset towers
   */
  reset() {
    this.towers.clear();
    this.nextTowerId = 1;
    this.selectedTowerId = null;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.reset();
  }

  /**
   * On game start - no reset needed, towers persist between prep and wave
   */
  onGameStart() {
    // Don't reset - allow pre-placed towers to persist
  }

  // =========================================
  // TOWER CREATION
  // =========================================

  /**
   * Handle tower build request
   */
  handleBuildRequest({ gridX, gridY }) {
    if (this.getTowerAt(gridX, gridY)) {
      this.eventBus.emit('tower:build-failed', { reason: 'Position occupied' });
      return;
    }

    this.eventBus.emit('economy:check-afford', {
      amount: BASE_TOWER.cost,
      callback: (canAfford) => {
        if (!canAfford) {
          this.eventBus.emit('tower:build-failed', { reason: 'Not enough gold' });
          return;
        }

        const tower = this.createTower(gridX, gridY);
        
        if (tower) {
          this.eventBus.emit('economy:spend', BASE_TOWER.cost);
          this.eventBus.emit('tower:built', { tower });
          this.eventBus.emit(GameEvents.TOWER_PLACED, { tower });
        }
      }
    });
  }

  /**
   * Create a new BASE tower
   */
  createTower(gridX, gridY) {
    const tower = createTowerInstance(
      gridX, 
      gridY, 
      this.config.GRID_SIZE, 
      this.nextTowerId++
    );
    
    // Bind recalculate method
    tower.recalculateStats = () => recalculateTowerStats(tower);
    
    this.towers.set(tower.id, tower);
    return tower;
  }

  // =========================================
  // SELL
  // =========================================

  handleSellRequest(towerId) {
    this.upgradeHandlers.handleSellRequest(towerId, (id) => this.checkDeselect(id));
  }

  /**
   * Remove a tower by ID (used by sell)
   */
  removeTower(towerId) {
    const tower = this.towers.get(towerId);
    if (!tower) return false;
    
    this.towers.delete(towerId);
    this.checkDeselect(towerId);
    this.eventBus.emit('tower:removed', { towerId });
    return true;
  }

  // =========================================
  // SELECTION
  // =========================================

  selectTower(towerId) {
    this.selectedTowerId = towerId;
    const tower = this.towers.get(towerId);
    
    if (tower) {
      const buildSummary = getTowerBuildSummary(tower);
      this.eventBus.emit('tower:selected', { tower, buildSummary });
    }
  }

  deselectTower() {
    this.selectedTowerId = null;
    this.eventBus.emit('tower:deselected');
  }

  checkDeselect(towerId) {
    if (this.selectedTowerId === towerId) {
      this.deselectTower();
    }
  }

  // =========================================
  // COMBAT UPDATE
  // =========================================

  updateTower(tower, deltaTime, enemies) {
    // Regenerate energy
    if (tower.currentEnergy < tower.maxEnergy) {
      tower.currentEnergy = Math.min(
        tower.maxEnergy,
        tower.currentEnergy + tower.energyRegen * deltaTime
      );
    }
    
    // Reduce cooldown
    if (tower.attackCooldown > 0) {
      tower.attackCooldown -= deltaTime;
    }

    // Find target if none or current target out of range/dead
    if (!tower.target || !isValidTarget(tower, tower.target, enemies)) {
      tower.target = findTarget(tower, enemies);
    }

    // Rotate towards target
    if (tower.target) {
      const dx = tower.target.x - tower.x;
      const dy = tower.target.y - tower.y;
      tower.rotation = Math.atan2(dy, dx);
    }

    // Attack if target, ready, and has enough energy
    if (tower.target && tower.attackCooldown <= 0 && tower.currentEnergy >= tower.energyCostPerShot) {
      performAttack(tower, this.eventBus);
    }
  }

  /**
   * Handle kill notification - tower gains XP
   */
  onEnemyKilled({ killerTowerId, enemy }) {
    if (!killerTowerId) return;
    
    const tower = this.towers.get(killerTowerId);
    if (tower) {
      tower.kills++;
      
      // XP based on enemy type
      let xpGain = 1;
      if (enemy?.type === 'tank') xpGain = 3;
      else if (enemy?.type === 'boss') xpGain = 10;
      else if (enemy?.type === 'fast') xpGain = 2;
      
      tower.upgradePoints = (tower.upgradePoints || 0) + xpGain;
      
      // Check for level up (every 10 XP = 1 level)
      const newLevel = Math.floor(1 + (tower.upgradePoints / 10));
      if (newLevel > (tower.level || 1)) {
        tower.level = newLevel;
        this.eventBus.emit('tower:level-up', { tower, newLevel });
      }
      
      // Emit update for tooltip refresh
      this.eventBus.emit('tower:updated', { tower });
    }
  }

  /**
   * Heal tower
   */
  healTower(towerId, amount) {
    return this.upgradeHandlers.healTower(towerId, amount);
  }

  // =========================================
  // QUERIES
  // =========================================

  getTowerAt(gridX, gridY) {
    for (const [id, tower] of this.towers) {
      if (tower.gridX === gridX && tower.gridY === gridY) {
        return tower;
      }
    }
    return null;
  }

  getTowersArray() {
    return Array.from(this.towers.values());
  }

  getTower(towerId) {
    return this.towers.get(towerId);
  }

  getSelectedTowerInfo() {
    if (!this.selectedTowerId) return null;
    
    const tower = this.towers.get(this.selectedTowerId);
    if (!tower) return null;
    
    return {
      tower,
      buildSummary: getTowerBuildSummary(tower)
    };
  }

  getRenderData() {
    return {
      towers: this.getTowersArray(),
      selectedId: this.selectedTowerId,
      baseTower: BASE_TOWER,
      attackTypes: ATTACK_TYPES,
      elementPaths: ELEMENT_PATHS
    };
  }

  getBuildCost() {
    return BASE_TOWER.cost;
  }
}

module.exports = { TowersModule };
