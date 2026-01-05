/**
 * Power Towers TD - Power Node Base Class
 * 
 * Base class for all power buildings.
 * Common properties: input/output channels, range, capacity, upgrades
 * 
 * XP SYSTEM: Buildings gain XP from energy processed (configurable in CONFIG)
 * LEVEL BONUSES: Each level gives configurable % bonus to all stats
 * STAT UPGRADES: Similar to towers, each upgrade gives configurable % bonus
 */

const CONFIG = require('../../core/config');

let nodeIdCounter = 0;

/**
 * Base class for all power nodes
 */
class PowerNode {
  constructor(options = {}) {
    this.id = `power-node-${++nodeIdCounter}`;
    this.type = options.type || 'unknown';
    this.nodeType = options.nodeType || 'generic'; // generator, storage, transfer, consumer
    
    // Position (grid)
    this.gridX = options.gridX || 0;
    this.gridY = options.gridY || 0;
    this.worldX = options.worldX || 0;
    this.worldY = options.worldY || 0;
    
    // Grid size (for multi-cell buildings)
    this.gridWidth = options.gridWidth || 1;
    this.gridHeight = options.gridHeight || 1;
    this.shape = options.shape || 'rect';  // 'rect', 'L', etc.
    
    // Grid size in pixels (from config or default)
    this.gridSize = options.gridSize || 24;
    
    // Center position in pixels (like towers have x/y)
    this.x = 0;
    this.y = 0;
    this._calculateCenterPosition();
    
    // Base Power properties (before any modifiers)
    this.baseInputChannels = options.inputChannels ?? 1;
    this.baseOutputChannels = options.outputChannels ?? 1;
    this.baseInputRate = options.inputRate || 10;   // Max power input per second
    this.baseOutputRate = options.outputRate || 10;  // Max power output per second
    this.baseCapacity = options.capacity || 100;     // Storage capacity
    this.baseRange = options.range || 5;             // Connection range (grid cells)
    
    // Effective values (calculated)
    this.inputChannels = this.baseInputChannels;
    this.outputChannels = this.baseOutputChannels;
    this.inputRate = this.baseInputRate;
    this.outputRate = this.baseOutputRate;
    this.capacity = this.baseCapacity;
    this.range = this.baseRange;
    this.stored = options.stored || 0;
    
    // XP System (like towers)
    this.xp = 0;                    // Current XP
    this.totalEnergyProcessed = 0; // Total energy for XP calculation
    this.level = 1;
    this.maxLevel = CONFIG.ENERGY_MAX_LEVEL || 20;
    
    // Stat upgrades (like towers - each gives % bonus)
    this.upgradeLevels = {
      inputRate: 0,
      outputRate: 0,
      capacity: 0,
      range: 0,
      channels: 0,
      efficiency: 0,    // For generators/relays
      generation: 0,    // For generators
      decay: 0          // For batteries
    };
    
    // Biome info (set when placed)
    this.biomeType = null;
    this.biomeModifiers = null;
    
    // Initial stat calculation
    this.recalculateStats();
  }

  /**
   * Calculate center position in pixels (unified with towers)
   * Updates this.x and this.y
   * Uses worldX/worldY if provided, otherwise calculates from grid position
   */
  _calculateCenterPosition() {
    // If worldX/worldY are provided, use them as center
    if (this.worldX && this.worldY) {
      this.x = this.worldX;
      this.y = this.worldY;
      return;
    }
    
    const gs = this.gridSize;
    
    if (this.shape === 'L' && this.gridWidth === 2 && this.gridHeight === 2) {
      // L-shape: center at junction point
      this.x = (this.gridX + 1) * gs;
      this.y = (this.gridY + 1) * gs;
    } else {
      // Rectangle: geometric center
      this.x = this.gridX * gs + (this.gridWidth * gs) / 2;
      this.y = this.gridY * gs + (this.gridHeight * gs) / 2;
    }
    
    // Sync worldX/worldY with calculated values
    this.worldX = this.x;
    this.worldY = this.y;
  }

  /**
   * Add energy processed (for XP calculation)
   * Configurable: energy per XP and XP per level in CONFIG
   */
  addEnergyProcessed(amount) {
    this.totalEnergyProcessed += amount;
    
    // Calculate XP from energy processed
    const energyPerXp = 100 / (CONFIG.ENERGY_XP_PER_100_ENERGY || 1);
    const newXp = Math.floor(this.totalEnergyProcessed / energyPerXp);
    
    if (newXp > this.xp) {
      const xpGained = newXp - this.xp;
      this.xp = newXp;
      
      // Check level up
      const xpPerLevel = CONFIG.ENERGY_XP_PER_LEVEL || 10;
      const newLevel = Math.min(Math.floor(1 + (this.xp / xpPerLevel)), this.maxLevel);
      if (newLevel > this.level) {
        const oldLevel = this.level;
        this.level = newLevel;
        
        // Recalculate stats on level up
        this.recalculateStats();
        
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
    const { getEnergyXpProgress } = require('../../core/utils/xp-utils');
    return getEnergyXpProgress(this.xp, this.level);
  }
  
  /**
   * Recalculate all effective stats based on level and upgrades
   * Uses configurable bonuses from CONFIG
   */
  recalculateStats() {
    const bonuses = CONFIG.ENERGY_UPGRADE_BONUSES || {};
    const levelBonusPercent = CONFIG.ENERGY_LEVEL_BONUS_PERCENT || 0.02;
    const levelBonus = 1 + (this.level - 1) * levelBonusPercent;
    
    // Efficiency multiplier (applies to generation and other stats)
    const efficiencyBonus = 1 + (this.upgradeLevels.efficiency || 0) * (bonuses.efficiency || 0.10);
    
    // Input Rate
    this.inputRate = this.baseInputRate * levelBonus;
    if (this.upgradeLevels.inputRate) {
      this.inputRate *= (1 + this.upgradeLevels.inputRate * (bonuses.inputRate || 0.05));
    }
    
    // Output Rate
    this.outputRate = this.baseOutputRate * levelBonus;
    if (this.upgradeLevels.outputRate) {
      this.outputRate *= (1 + this.upgradeLevels.outputRate * (bonuses.outputRate || 0.05));
    }
    
    // Capacity
    this.capacity = this.baseCapacity * levelBonus;
    if (this.upgradeLevels.capacity) {
      this.capacity *= (1 + this.upgradeLevels.capacity * (bonuses.capacity || 0.10));
    }
    
    // Range (flat bonus per level)
    const rangePerLevel = CONFIG.ENERGY_RANGE_PER_LEVEL || 0.2;
    this.range = this.baseRange + Math.floor((this.level - 1) * rangePerLevel);
    if (this.upgradeLevels.range) {
      this.range += this.upgradeLevels.range * (bonuses.range || 1);
    }
    
    // Channels: base + upgrade bonus (only if base > 0)
    const channelsPerUpgrade = bonuses.channels || 1;
    const channelsUpgrade = this.upgradeLevels.channels || 0;
    this.inputChannels = this.baseInputChannels > 0 ? this.baseInputChannels + channelsUpgrade * channelsPerUpgrade : 0;
    this.outputChannels = this.baseOutputChannels > 0 ? this.baseOutputChannels + channelsUpgrade * channelsPerUpgrade : 0;
    
    // Generation (for generators) - base * level * efficiency * generation upgrade
    if (this.baseGeneration !== undefined) {
      let gen = this.baseGeneration * levelBonus * efficiencyBonus;
      if (this.upgradeLevels.generation) {
        gen *= (1 + this.upgradeLevels.generation * (bonuses.generation || 0.15));
      }
      this.effectiveGeneration = gen;
    }
    
    // Store efficiency multiplier for use in generate()
    this.efficiencyMultiplier = efficiencyBonus;
    
    // Apply biome modifiers if present
    if (this.biomeModifiers) {
      if (this.biomeModifiers.energyProduction) {
        // Affects generators
      }
      if (this.biomeModifiers.buildCost) {
        // Already applied at build time
      }
    }
  }
  
  /**
   * Apply a stat upgrade
   * @param {string} upgradeId - Upgrade ID (inputRate, outputRate, etc.)
   * @returns {boolean} Success
   */
  applyStatUpgrade(upgradeId) {
    if (this.upgradeLevels[upgradeId] === undefined) {
      return false;
    }
    
    this.upgradeLevels[upgradeId]++;
    this.recalculateStats();
    
    return true;
  }
  
  /**
   * Get upgrade level for a stat
   */
  getUpgradeLevel(upgradeId) {
    return this.upgradeLevels[upgradeId] || 0;
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
    const maxInput = this.inputRate * dt;
    return Math.min(space, maxInput);
  }

  /**
   * Get available output (per dt)
   */
  getAvailableOutput(dt) {
    const maxOutput = this.outputRate * dt;
    return Math.min(this.stored, maxOutput);
  }

  /**
   * Get effective input rate (already calculated in recalculateStats)
   */
  getEffectiveInputRate() {
    return this.inputRate;
  }

  /**
   * Get effective output rate (already calculated)
   */
  getEffectiveOutputRate() {
    return this.outputRate;
  }

  /**
   * Get effective capacity (already calculated)
   */
  getEffectiveCapacity() {
    return this.capacity;
  }

  /**
   * Get effective range (already calculated)
   */
  getEffectiveRange() {
    return this.range;
  }

  /**
   * Get effective generation (for generators, may include biome modifiers)
   */
  getEffectiveGeneration() {
    if (this.generation === undefined) return 0;
    
    // Base generation with biome modifiers
    let gen = this.generation;
    
    // Apply biome modifiers if present
    if (this.biomeModifiers?.generation) {
      gen *= this.biomeModifiers.generation;
    }
    
    return gen;
  }

  /**
   * Get effective channels
   */
  getEffectiveInputChannels() {
    return this.inputChannels;
  }

  getEffectiveOutputChannels() {
    return this.outputChannels;
  }

  /**
   * Legacy upgrade method (for compatibility)
   */
  upgrade(type) {
    return this.applyStatUpgrade(type);
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
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      shape: this.shape,
      stored: this.stored,
      capacity: this.capacity,
      inputRate: this.inputRate,
      outputRate: this.outputRate,
      range: this.range,
      inputChannels: this.inputChannels,
      outputChannels: this.outputChannels,
      level: this.level,
      xp: this.xp,
      xpProgress,
      totalEnergyProcessed: this.totalEnergyProcessed,
      upgradeLevels: { ...this.upgradeLevels },
      biomeType: this.biomeType,
      biomeModifiers: this.biomeModifiers
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
      maxEnergy: this.capacity,
      fillPercent: this.stored / this.capacity
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
