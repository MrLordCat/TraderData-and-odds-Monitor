/**
 * Power Towers TD - Economy Module
 * 
 * Manages gold, income, and resource spending.
 */

const { GameEvents } = require('../../core/event-bus');

class EconomyModule {
  /**
   * @param {EventBus} eventBus - Event system
   * @param {object} config - Game configuration
   */
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    
    // Resources
    this.gold = 0;
    
    // Stats
    this.totalEarned = 0;
    this.totalSpent = 0;
  }

  /**
   * Initialize module
   */
  init() {
    this.eventBus.on(GameEvents.GAME_START, () => this.onGameStart());
    this.eventBus.on('economy:gain', (amount) => this.addGold(amount));
    this.eventBus.on('economy:spend', (amount) => this.spendGold(amount));
    this.eventBus.on('economy:check-afford', ({ amount, callback }) => {
      callback(this.canAfford(amount));
    });
    this.eventBus.on('wave:complete', () => this.onWaveComplete());
  }

  /**
   * Update (interest, etc)
   */
  update(deltaTime) {
    // Could add passive income here
  }

  /**
   * Reset
   */
  reset() {
    this.gold = 0;
    this.totalEarned = 0;
    this.totalSpent = 0;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.reset();
  }

  /**
   * On game start - no full reset, just emit update for UI sync
   */
  onGameStart() {
    // Don't reset - gold spent on towers before wave should persist
    // Only emit update for UI synchronization
    this.emitUpdate();
  }

  /**
   * Add gold
   */
  addGold(amount) {
    this.gold += amount;
    this.totalEarned += amount;
    this.emitUpdate();
  }

  /**
   * Spend gold
   */
  spendGold(amount) {
    if (this.gold >= amount) {
      this.gold -= amount;
      this.totalSpent += amount;
      this.emitUpdate();
      return true;
    }
    return false;
  }

  /**
   * Check if can afford
   */
  canAfford(amount) {
    return this.gold >= amount;
  }

  /**
   * On wave complete - bonus gold
   */
  onWaveComplete() {
    const bonus = 50;
    this.addGold(bonus);
    this.eventBus.emit('economy:wave-bonus', { bonus });
  }

  /**
   * Emit update
   */
  emitUpdate() {
    this.eventBus.emit('economy:updated', {
      gold: this.gold,
      totalEarned: this.totalEarned,
      totalSpent: this.totalSpent
    });
  }

  /**
   * Get current gold
   */
  getGold() {
    return this.gold;
  }

  /**
   * Get render data
   */
  getRenderData() {
    return {
      gold: this.gold,
      totalEarned: this.totalEarned,
      totalSpent: this.totalSpent
    };
  }
}

module.exports = { EconomyModule };
