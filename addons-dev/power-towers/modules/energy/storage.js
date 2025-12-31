/**
 * Power Towers TD - Storage and Transfer Classes
 * 
 * - Battery: Stores power, has decay, stackable capacity
 * - PowerTransfer: Multiple channels (2/2 default), relays power
 */

const { PowerNode } = require('./power-node');

// ============================================
// BATTERY (Energy storage with decay)
// ============================================
class Battery extends PowerNode {
  constructor(options = {}) {
    super({
      ...options,
      type: 'battery',
      nodeType: 'storage',
      inputChannels: 1,
      outputChannels: 1,
      inputRate: 20,
      outputRate: 20,
      capacity: 200,
      range: 3
    });
    
    // Decay settings
    this.decayRate = options.decayRate || 0.5; // % loss per minute
    this.decayInterval = 60; // Decay calculated per minute
    
    // Stacking bonus (when adjacent to other batteries)
    this.stackBonus = 0.15; // 15% capacity per adjacent battery
    this.adjacentBatteries = 0;
    
    this.networkRef = null;
  }

  setNetwork(network) {
    this.networkRef = network;
  }

  /**
   * Override receiveEnergy to track XP
   */
  receiveEnergy(amount) {
    const received = super.receiveEnergy(amount);
    // Track energy for XP (100 energy = 1 XP)
    if (received > 0) {
      this.addEnergyProcessed(received);
    }
    return received;
  }

  /**
   * Count adjacent batteries for stacking bonus
   */
  countAdjacentBatteries() {
    if (!this.networkRef) return 0;
    
    let count = 0;
    for (const node of this.networkRef.nodes.values()) {
      if (node.id === this.id) continue;
      if (node.type !== 'battery') continue;
      
      const dx = Math.abs(node.gridX - this.gridX);
      const dy = Math.abs(node.gridY - this.gridY);
      
      // Adjacent = within 1 cell
      if (dx <= 1 && dy <= 1) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get effective capacity (with stacking)
   */
  getEffectiveCapacity() {
    this.adjacentBatteries = this.countAdjacentBatteries();
    const stackMultiplier = 1 + (this.adjacentBatteries * this.stackBonus);
    return this.capacity * (1 + this.upgrades.capacity * 0.25) * stackMultiplier;
  }

  /**
   * Apply energy decay over time
   */
  applyDecay(dt) {
    if (this.stored > 0) {
      const decayAmount = this.stored * (this.decayRate / 100) * (dt / this.decayInterval);
      this.stored = Math.max(0, this.stored - decayAmount);
    }
  }

  getState() {
    return {
      ...super.getState(),
      capacity: this.getEffectiveCapacity(),
      decayRate: this.decayRate,
      adjacentBatteries: this.adjacentBatteries,
      stackBonus: this.stackBonus
    };
  }
}

// ============================================
// POWER TRANSFER (Multi-channel relay)
// ============================================
class PowerTransfer extends PowerNode {
  constructor(options = {}) {
    super({
      ...options,
      type: 'power-transfer',
      nodeType: 'transfer',
      inputChannels: 2,        // Multiple inputs!
      outputChannels: 2,       // Multiple outputs!
      inputRate: 50,           // Fast input
      outputRate: 50,          // Fast output - matches description
      capacity: 100,           // Bigger buffer for smooth flow
      range: 6                 // Longer range
    });
    
    // Transfer efficiency (some loss)
    this.efficiency = options.efficiency || 0.95; // 5% loss
    
    // Can upgrade channels more
    this.maxChannelUpgrades = 4; // Up to 4/4 channels
  }

  /**
   * Override receive to apply efficiency and track XP
   */
  receiveEnergy(amount) {
    const effectiveAmount = amount * this.efficiency;
    const space = this.capacity - this.stored;
    const received = Math.min(effectiveAmount, space);
    this.stored += received;
    
    // Track energy for XP (100 energy = 1 XP)
    if (received > 0) {
      this.addEnergyProcessed(received);
    }
    
    return received;
  }

  /**
   * Get effective channels (more upgrade potential)
   */
  getEffectiveInputChannels() {
    return this.inputChannels + this.upgrades.channels;
  }

  getEffectiveOutputChannels() {
    return this.outputChannels + this.upgrades.channels;
  }

  /**
   * Override upgrade for channel limits
   */
  upgrade(type) {
    if (type === 'channels') {
      if (this.upgrades.channels < this.maxChannelUpgrades) {
        this.upgrades.channels++;
        this.inputChannels = this.getEffectiveInputChannels();
        this.outputChannels = this.getEffectiveOutputChannels();
        this.level++;
        return true;
      }
      return false;
    }
    return super.upgrade(type);
  }

  getState() {
    return {
      ...super.getState(),
      efficiency: this.efficiency,
      maxChannelUpgrades: this.maxChannelUpgrades
    };
  }
}

// ============================================
// POWER CONSUMER (Tower adapter)
// ============================================
class PowerConsumer extends PowerNode {
  constructor(options = {}) {
    super({
      ...options,
      type: 'power-consumer',
      nodeType: 'consumer',
      inputChannels: 1,
      outputChannels: 0,       // Doesn't output
      inputRate: Infinity,     // No input rate limit for towers
      outputRate: 0,
      capacity: options.capacity || options.maxEnergy || 100,
      range: 0                 // Doesn't connect to others
    });
    
    // Power consumption per second (for tracking only)
    this.consumption = options.consumption || 5;
    
    // Is the consumer powered?
    this.powered = false;
    this.powerLevel = 0; // 0-1, affects tower performance
    
    // Reference to tower
    this.towerRef = null;
  }

  setTower(tower) {
    this.towerRef = tower;
    // Update capacity to match tower's maxEnergy
    if (tower && tower.maxEnergy) {
      this.capacity = tower.maxEnergy;
    }
  }

  /**
   * Override: Towers have NO input rate limit - can receive as much as they have space
   */
  getAvailableInput(dt) {
    // For towers: only limit is available space, not input rate
    if (this.towerRef) {
      const towerSpace = (this.towerRef.maxEnergy || 100) - (this.towerRef.currentEnergy || 0);
      return towerSpace;
    }
    // Fallback to capacity space
    return this.capacity - this.stored;
  }

  /**
   * Receive energy and transfer to tower
   */
  receiveEnergy(amount) {
    // Transfer directly to tower without intermediate storage
    if (this.towerRef) {
      const towerSpace = (this.towerRef.maxEnergy || 100) - (this.towerRef.currentEnergy || 0);
      const toTower = Math.min(amount, towerSpace);
      if (toTower > 0) {
        this.towerRef.currentEnergy = (this.towerRef.currentEnergy || 0) + toTower;
      }
      return toTower;
    }
    
    // Fallback: store in consumer buffer
    const space = this.capacity - this.stored;
    const received = Math.min(amount, space);
    this.stored += received;
    return received;
  }

  /**
   * Consume power and update powered state
   * Consumer doesn't consume energy for itself - it just transfers to tower
   */
  update(dt) {
    // Transfer stored energy to tower
    if (this.towerRef && this.stored > 0) {
      const towerSpace = (this.towerRef.maxEnergy || 100) - (this.towerRef.currentEnergy || 0);
      const toTower = Math.min(this.stored, towerSpace);
      if (toTower > 0) {
        this.towerRef.currentEnergy = (this.towerRef.currentEnergy || 0) + toTower;
        this.stored -= toTower;
      }
    }
    
    // Update powered state based on tower's current energy
    if (this.towerRef) {
      const towerEnergy = this.towerRef.currentEnergy || 0;
      const towerMax = this.towerRef.maxEnergy || 100;
      
      this.powered = towerEnergy > 0;
      this.powerLevel = towerMax > 0 ? towerEnergy / towerMax : 0;
      
      // Update tower power level for visual feedback
      this.towerRef.powerLevel = this.powerLevel;
      this.towerRef.powered = this.powered;
    } else {
      this.powered = this.stored > 0;
      this.powerLevel = this.capacity > 0 ? this.stored / this.capacity : 0;
    }
  }

  getState() {
    return {
      ...super.getState(),
      consumption: this.consumption,
      powered: this.powered,
      powerLevel: this.powerLevel
    };
  }
}

module.exports = {
  Battery,
  PowerTransfer,
  PowerConsumer
};
