/**
 * Power Towers TD - Economy System
 * Manages gold and purchases
 */

const CONFIG = require('../config');

class Economy {
  constructor(eventBus) {
    this.eventBus = eventBus;
    
    this.gold = CONFIG.STARTING_GOLD;
    this.totalEarned = 0;
    this.totalSpent = 0;
  }

  /**
   * Reset to starting values
   */
  reset() {
    this.gold = CONFIG.STARTING_GOLD;
    this.totalEarned = 0;
    this.totalSpent = 0;
  }

  /**
   * Add gold
   */
  addGold(amount, source = 'unknown') {
    this.gold += amount;
    this.totalEarned += amount;
    
    this.eventBus.emit('economy:gold_changed', {
      gold: this.gold,
      change: amount,
      source
    });
  }

  /**
   * Spend gold
   * @returns {boolean} true if successful
   */
  spend(amount, purpose = 'unknown') {
    if (this.gold < amount) {
      return false;
    }
    
    this.gold -= amount;
    this.totalSpent += amount;
    
    this.eventBus.emit('economy:gold_changed', {
      gold: this.gold,
      change: -amount,
      purpose
    });
    
    return true;
  }

  /**
   * Check if can afford
   */
  canAfford(amount) {
    return this.gold >= amount;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      gold: this.gold,
      totalEarned: this.totalEarned,
      totalSpent: this.totalSpent
    };
  }
}

module.exports = { Economy };
