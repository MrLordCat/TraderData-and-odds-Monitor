/**
 * Power Towers TD - Energy System
 * Manages energy production, storage, and consumption
 */

const CONFIG = require('../config');

class EnergySystem {
  constructor(eventBus) {
    this.eventBus = eventBus;
    
    this.current = CONFIG.STARTING_ENERGY;
    this.max = CONFIG.MAX_ENERGY;
    this.regenRate = CONFIG.ENERGY_REGEN;  // per tick
    
    this.generators = [];  // future: energy generator buildings
  }

  /**
   * Reset energy to starting values
   */
  reset() {
    this.current = CONFIG.STARTING_ENERGY;
    this.max = CONFIG.MAX_ENERGY;
    this.generators = [];
  }

  /**
   * Update energy (regeneration)
   * @param {number} deltaTime - ms since last update
   */
  update(deltaTime) {
    // Base regeneration
    const regen = this.regenRate * (deltaTime / 1000) * 60;  // per second
    this.addEnergy(regen);
    
    // Generator production (future)
    for (const gen of this.generators) {
      this.addEnergy(gen.production * (deltaTime / 1000));
    }
  }

  /**
   * Add energy
   */
  addEnergy(amount) {
    const oldValue = this.current;
    this.current = Math.min(this.max, this.current + amount);
    
    if (this.current !== oldValue) {
      this.eventBus.emit('energy:changed', this.getState());
    }
  }

  /**
   * Consume energy
   * @param {number} amount - Amount to consume
   * @returns {boolean} true if successful
   */
  consume(amount) {
    if (this.current < amount) {
      this.eventBus.emit('energy:depleted', { required: amount, available: this.current });
      return false;
    }
    
    this.current -= amount;
    this.eventBus.emit('energy:changed', this.getState());
    return true;
  }

  /**
   * Check if has enough energy
   */
  hasEnergy(amount) {
    return this.current >= amount;
  }

  /**
   * Get percentage
   */
  getPercent() {
    return this.current / this.max;
  }

  /**
   * Increase max energy
   */
  increaseMax(amount) {
    this.max += amount;
    this.eventBus.emit('energy:changed', this.getState());
  }

  /**
   * Get current state
   */
  getState() {
    return {
      current: Math.floor(this.current),
      max: this.max,
      percent: this.getPercent(),
      regenRate: this.regenRate
    };
  }
}

module.exports = { EnergySystem };
