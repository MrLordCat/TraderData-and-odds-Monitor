/**
 * Power Towers TD - Event Bus
 * Simple pub/sub system for decoupled communication
 */

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    
    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event once
   */
  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    return this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event
   */
  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Emit an event
   */
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[EventBus] Error in ${event} handler:`, err);
        }
      });
    }
  }

  /**
   * Clear all listeners
   */
  clear() {
    this.listeners.clear();
  }
}

// Event names
const GameEvents = {
  // Game state
  GAME_INIT: 'game:init',
  GAME_START: 'game:start',
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',
  GAME_OVER: 'game:over',
  GAME_WIN: 'game:win',
  GAME_TICK: 'game:tick',
  
  // Wave events
  WAVE_START: 'wave:start',
  WAVE_END: 'wave:end',
  WAVE_CLEAR: 'wave:clear',
  
  // Entity events
  ENEMY_SPAWN: 'enemy:spawn',
  ENEMY_DAMAGE: 'enemy:damage',
  ENEMY_DEATH: 'enemy:death',
  ENEMY_REACHED_BASE: 'enemy:reached_base',
  
  TOWER_PLACED: 'tower:placed',
  TOWER_ATTACK: 'tower:attack',
  TOWER_UPGRADED: 'tower:upgraded',
  TOWER_SOLD: 'tower:sold',
  
  PROJECTILE_SPAWN: 'projectile:spawn',
  PROJECTILE_HIT: 'projectile:hit',
  
  // Economy
  GOLD_CHANGED: 'economy:gold_changed',
  LIVES_CHANGED: 'economy:lives_changed',
  
  // Energy
  ENERGY_CHANGED: 'energy:changed',
  ENERGY_DEPLETED: 'energy:depleted',
  
  // UI
  UI_UPDATE: 'ui:update',
  UI_MESSAGE: 'ui:message'
};

module.exports = { EventBus, GameEvents };
