/**
 * Power Towers TD - Power Node Base Class
 * 
 * Base class for all power buildings.
 * Common properties: input/output channels, range, capacity, upgrades
 * 
 * XP SYSTEM: Buildings gain XP from energy processed
 * - Every 100 energy = 1 XP
 * - Every 10 XP = 1 level (same as towers)
 */

let nodeIdCounter = 0;

/**
 * Base class for all power nodes
 */
class PowerNode {
  constructor(options = {}) {
    this.id = `power-node-${++nodeIdCounter}`;
    this.type = options.type || 'unknown';
    this.nodeType = options.nodeType || 'generic'; // generator, storage, transfer, consumer
    
    // Position
    this.gridX = options.gridX || 0;
    this.gridY = options.gridY || 0;
    this.worldX = options.worldX || 0;
    this.worldY = options.worldY || 0;
    
    // Power properties
    this.inputChannels = options.inputChannels ?? 1;
    this.outputChannels = options.outputChannels ?? 1;
    this.inputRate = options.inputRate || 10;   // Max power input per second
    this.outputRate = options.outputRate || 10;  // Max power output per second
    this.capacity = options.capacity || 100;     // Storage capacity
    this.stored = options.stored || 0;           // Current stored energy
    this.range = options.range || 5;             // Connection range (grid cells)
    
    // XP System (like towers)
    this.xp = 0;                    // Current XP
    this.totalEnergyProcessed = 0; // Total energy for XP calculation
    this.level = 1;
    this.maxLevel = 10;            // Max level from XP
    
    // Manual upgrades (separate from XP levels)
    this.upgrades = {
      inputRate: 0,
      outputRate: 0,
      capacity: 0,
      range: 0,
      channels: 0
    };
  }

  /**
   * Add energy processed (for XP calculation)
   * Every 100 energy = 1 XP, every 10 XP = 1 level
   */
  addEnergyProcessed(amount) {
    this.totalEnergyProcessed += amount;
    
    // Calculate XP: 100 energy = 1 XP
    const newXp = Math.floor(this.totalEnergyProcessed / 100);
    
    if (newXp > this.xp) {
      const xpGained = newXp - this.xp;
      this.xp = newXp;
      
      // Check level up: every 10 XP = 1 level
      const newLevel = Math.min(Math.floor(1 + (this.xp / 10)), this.maxLevel);
      if (newLevel > this.level) {
        const oldLevel = this.level;
        this.level = newLevel;
        return { leveledUp: true, oldLevel, newLevel, xpGained };
      }
      
      return { leveledUp: false, xpGained };
    }
    
    return { leveledUp: false, xpGained: 0 };
  }

  /**
   * Get XP progress to next level
   */
  getXpProgress() {
    const xpForCurrentLevel = (this.level - 1) * 10;
    const xpIntoLevel = this.xp - xpForCurrentLevel;
    const xpNeeded = 10; // 10 XP per level
    return {
      current: xpIntoLevel,
      needed: xpNeeded,
      percent: (xpIntoLevel / xpNeeded) * 100
    };
  }

  /**
   * Receive energy from connected source
   */
  receiveEnergy(amount) {
    const space = this.capacity - this.stored;
    const received = Math.min(amount, space);
    this.stored += received;
    return received;
  }

  /**
   * Get available input capacity (per dt)
   */
  getAvailableInput(dt) {
    const space = this.capacity - this.stored;
    const maxInput = this.getEffectiveInputRate() * dt;
    return Math.min(space, maxInput);
  }

  /**
   * Get available output (per dt)
   */
  getAvailableOutput(dt) {
    const maxOutput = this.getEffectiveOutputRate() * dt;
    return Math.min(this.stored, maxOutput);
  }

  /**
   * Get effective input rate (with upgrades)
   */
  getEffectiveInputRate() {
    return this.inputRate * (1 + this.upgrades.inputRate * 0.2);
  }

  /**
   * Get effective output rate (with upgrades)
   */
  getEffectiveOutputRate() {
    return this.outputRate * (1 + this.upgrades.outputRate * 0.2);
  }

  /**
   * Get effective capacity (with upgrades)
   */
  getEffectiveCapacity() {
    return this.capacity * (1 + this.upgrades.capacity * 0.25);
  }

  /**
   * Get effective range (with upgrades)
   */
  getEffectiveRange() {
    return this.range + this.upgrades.range * 2;
  }

  /**
   * Get effective channels
   */
  getEffectiveInputChannels() {
    return this.inputChannels + Math.floor(this.upgrades.channels / 2);
  }

  getEffectiveOutputChannels() {
    return this.outputChannels + Math.floor(this.upgrades.channels / 2);
  }

  /**
   * Apply upgrade
   */
  upgrade(type) {
    if (this.upgrades[type] !== undefined && this.level < this.maxLevel) {
      this.upgrades[type]++;
      this.level++;
      
      // Update capacity to new effective value
      if (type === 'capacity') {
        this.capacity = this.getEffectiveCapacity();
      }
      if (type === 'channels') {
        this.inputChannels = this.getEffectiveInputChannels();
        this.outputChannels = this.getEffectiveOutputChannels();
      }
      
      return true;
    }
    return false;
  }

  /**
   * Get current state
   */
  getState() {
    const xpProgress = this.getXpProgress();
    return {
      id: this.id,
      type: this.type,
      nodeType: this.nodeType,
      gridX: this.gridX,
      gridY: this.gridY,
      stored: this.stored,
      capacity: this.getEffectiveCapacity(),
      inputRate: this.getEffectiveInputRate(),
      outputRate: this.getEffectiveOutputRate(),
      range: this.getEffectiveRange(),
      inputChannels: this.inputChannels,
      outputChannels: this.outputChannels,
      level: this.level,
      xp: this.xp,
      xpProgress,
      totalEnergyProcessed: this.totalEnergyProcessed
    };
  }

  /**
   * Get render data
   */
  getRenderData() {
    return {
      ...this.getState(),
      worldX: this.worldX,
      worldY: this.worldY,
      energy: this.stored,
      maxEnergy: this.getEffectiveCapacity(),
      fillPercent: this.stored / this.getEffectiveCapacity()
    };
  }

  /**
   * Update (override in subclasses)
   */
  update(dt) {}

  /**
   * Generate energy (override in generators)
   */
  generate(dt) {}
}

module.exports = { PowerNode };
