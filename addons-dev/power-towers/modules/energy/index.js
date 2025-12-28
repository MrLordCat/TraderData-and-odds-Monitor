/**
 * Power Towers TD - Energy Module
 * 
 * Manages energy system for tower abilities and special attacks.
 */

const { GameEvents } = require('../../core/event-bus');

class EnergyModule {
  /**
   * @param {EventBus} eventBus - Event system
   * @param {object} config - Game configuration
   */
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    
    // Energy state
    this.energy = 0;
    this.maxEnergy = 100;
    this.regenRate = 2; // per second
  }

  /**
   * Initialize module
   */
  init() {
    this.eventBus.on(GameEvents.GAME_START, () => this.onGameStart());
    this.eventBus.on('energy:spend', (amount) => this.spendEnergy(amount));
    this.eventBus.on('energy:gain', (amount) => this.gainEnergy(amount));
    this.eventBus.on('enemy:killed', () => this.onEnemyKilled());
  }

  /**
   * Update - passive regen
   */
  update(deltaTime) {
    if (this.energy < this.maxEnergy) {
      this.energy = Math.min(this.maxEnergy, this.energy + this.regenRate * deltaTime);
      this.emitUpdate();
    }
  }

  /**
   * Reset
   */
  reset() {
    this.energy = 0;
    this.maxEnergy = 100;
    this.regenRate = 2;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.reset();
  }

  /**
   * On game start
   */
  onGameStart() {
    this.energy = 50; // Start with half energy
    this.emitUpdate();
  }

  /**
   * Spend energy
   */
  spendEnergy(amount) {
    if (this.energy >= amount) {
      this.energy -= amount;
      this.emitUpdate();
      return true;
    }
    return false;
  }

  /**
   * Gain energy
   */
  gainEnergy(amount) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
    this.emitUpdate();
  }

  /**
   * On enemy killed - small energy gain
   */
  onEnemyKilled() {
    this.gainEnergy(1);
  }

  /**
   * Emit update
   */
  emitUpdate() {
    this.eventBus.emit('energy:updated', {
      energy: this.energy,
      maxEnergy: this.maxEnergy,
      percent: (this.energy / this.maxEnergy) * 100
    });
  }

  /**
   * Check if can afford
   */
  canAfford(amount) {
    return this.energy >= amount;
  }

  /**
   * Get render data
   */
  getRenderData() {
    return {
      energy: this.energy,
      maxEnergy: this.maxEnergy,
      percent: (this.energy / this.maxEnergy) * 100
    };
  }
}

module.exports = { EnergyModule };
