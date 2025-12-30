/**
 * Power Towers TD - Generator Classes
 * 
 * All generator types:
 * - BaseGenerator: Basic stable power
 * - BioGenerator: Uses trees, trees regrow
 * - WindGenerator: Unstable, needs mountains (9 for 100%)
 * - SolarGenerator: Efficiency varies by biome
 * - WaterGenerator: Like wind but uses water tiles
 */

const { PowerNode } = require('./power-node');

// ============================================
// BASE GENERATOR (Basic stable power)
// ============================================
class BaseGenerator extends PowerNode {
  constructor(options = {}) {
    super({
      ...options,
      type: 'base-generator',
      nodeType: 'generator',
      inputChannels: 0,        // Generators don't receive power
      outputChannels: 1,
      inputRate: 0,
      outputRate: 15,
      capacity: 50,
      range: 4
    });
    
    this.generation = options.generation || 5; // Power per second
    this.baseGeneration = this.generation;
  }

  generate(dt) {
    const produced = this.generation * dt;
    const space = this.capacity - this.stored;
    const actualProduced = Math.min(produced, space);
    this.stored += actualProduced;
    
    // Track energy for XP (100 energy = 1 XP)
    if (actualProduced > 0) {
      this.addEnergyProcessed(actualProduced);
    }
  }

  getState() {
    return {
      ...super.getState(),
      generation: this.generation,
      efficiency: 1.0
    };
  }
}

// ============================================
// BIO GENERATOR (Uses trees around)
// ============================================
class BioGenerator extends PowerNode {
  constructor(options = {}) {
    super({
      ...options,
      type: 'bio-generator',
      nodeType: 'generator',
      inputChannels: 0,
      outputChannels: 1,
      inputRate: 0,
      outputRate: 20,
      capacity: 80,
      range: 4
    });
    
    this.baseGeneration = options.baseGeneration || 8;
    this.generation = 0;
    this.treeRadius = 3; // Check trees in 3 cell radius
    this.treesUsed = 0;
    this.maxTrees = 12;
    this.treeConsumptionRate = 0.1; // Trees consumed per second at full power
    
    // Reference to map (set when placed)
    this.mapRef = null;
  }

  /**
   * Set map reference for tree checking
   */
  setMap(map) {
    this.mapRef = map;
  }

  /**
   * Count trees around generator
   */
  countTrees() {
    if (!this.mapRef) return 0;
    
    let count = 0;
    const biomes = this.mapRef.biomes;
    if (!biomes) return 0;
    
    for (let dy = -this.treeRadius; dy <= this.treeRadius; dy++) {
      for (let dx = -this.treeRadius; dx <= this.treeRadius; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const x = this.gridX + dx;
        const y = this.gridY + dy;
        
        if (x >= 0 && x < this.mapRef.width && y >= 0 && y < this.mapRef.height) {
          // Forest biome = trees
          if (biomes[y]?.[x] === 'forest') {
            count++;
          }
        }
      }
    }
    return Math.min(count, this.maxTrees);
  }

  generate(dt) {
    this.treesUsed = this.countTrees();
    const efficiency = this.treesUsed / this.maxTrees;
    this.generation = this.baseGeneration * efficiency;
    
    const produced = this.generation * dt;
    const space = this.capacity - this.stored;
    const actualProduced = Math.min(produced, space);
    this.stored += actualProduced;
    
    // Track energy for XP (100 energy = 1 XP)
    if (actualProduced > 0) {
      this.addEnergyProcessed(actualProduced);
    }
    
    // TODO: Slowly consume trees and regrow them
  }

  getState() {
    return {
      ...super.getState(),
      generation: this.generation,
      efficiency: this.treesUsed / this.maxTrees,
      treesUsed: this.treesUsed,
      maxTrees: this.maxTrees
    };
  }
}

// ============================================
// WIND GENERATOR (Works everywhere, biome affects range)
// ============================================
class WindGenerator extends PowerNode {
  constructor(options = {}) {
    super({
      ...options,
      type: 'wind-generator',
      nodeType: 'generator',
      inputChannels: 0,
      outputChannels: 1,
      inputRate: 0,
      outputRate: 25,
      capacity: 60,
      range: 5
    });
    
    // Base generation range (min-max)
    this.baseMin = 5;
    this.baseMax = 30;
    
    // Biome modifiers to range (added to base)
    this.biomeModifiers = {
      mountains: { minBonus: 5, maxBonus: 10 },   // 10-40
      hills: { minBonus: 3, maxBonus: 5 },        // 8-35
      plains: { minBonus: 0, maxBonus: 0 },       // 5-30 (base)
      grassland: { minBonus: 0, maxBonus: 0 },    // 5-30
      desert: { minBonus: 2, maxBonus: 5 },       // 7-35 (open area)
      forest: { minBonus: -4, maxBonus: -10 },    // 1-20 (trees block wind)
      swamp: { minBonus: -3, maxBonus: -8 },      // 2-22
      tundra: { minBonus: 3, maxBonus: 8 },       // 8-38 (cold winds)
      default: { minBonus: 0, maxBonus: 0 }
    };
    
    // Current generation state
    this.generation = 0;
    this.currentTarget = 15;  // Target value we're moving towards
    this.currentBiome = 'default';
    
    // Smooth fluctuation
    this.fluctuationSpeed = 3;      // How fast value changes per second
    this.targetChangeTimer = 0;
    this.targetChangeInterval = 3;  // Pick new target every 3 seconds
    
    this.mapRef = null;
  }

  setMap(map) {
    this.mapRef = map;
  }

  /**
   * Get current biome at generator position
   */
  getCurrentBiome() {
    if (!this.mapRef) return 'default';
    
    const biomes = this.mapRef.biomes;
    if (!biomes || !biomes[this.gridY]) return 'default';
    
    return biomes[this.gridY][this.gridX] || 'default';
  }

  /**
   * Get generation range for current biome
   */
  getGenerationRange() {
    const biome = this.getCurrentBiome();
    const modifier = this.biomeModifiers[biome] || this.biomeModifiers.default;
    
    const min = Math.max(0, this.baseMin + modifier.minBonus);
    const max = Math.max(min + 1, this.baseMax + modifier.maxBonus);
    
    return { min, max, biome };
  }

  generate(dt) {
    // Get current biome and range
    const range = this.getGenerationRange();
    this.currentBiome = range.biome;
    
    // Update target periodically
    this.targetChangeTimer += dt;
    if (this.targetChangeTimer >= this.targetChangeInterval) {
      this.targetChangeTimer = 0;
      // Pick new random target within range
      this.currentTarget = range.min + Math.random() * (range.max - range.min);
      // Randomize next interval (2-5 seconds)
      this.targetChangeInterval = 2 + Math.random() * 3;
    }
    
    // Clamp target to current range (in case biome changed)
    this.currentTarget = Math.max(range.min, Math.min(range.max, this.currentTarget));
    
    // Smoothly move generation towards target
    const diff = this.currentTarget - this.generation;
    const maxChange = this.fluctuationSpeed * dt;
    
    if (Math.abs(diff) <= maxChange) {
      this.generation = this.currentTarget;
    } else {
      this.generation += Math.sign(diff) * maxChange;
    }
    
    // Produce energy
    const produced = this.generation * dt;
    const space = this.capacity - this.stored;
    const actualProduced = Math.min(produced, space);
    this.stored += actualProduced;
    
    // Track energy for XP
    if (actualProduced > 0) {
      this.addEnergyProcessed(actualProduced);
    }
  }

  getState() {
    const range = this.getGenerationRange();
    // Calculate efficiency as position within range (0-100%)
    const rangeSize = range.max - range.min;
    const efficiency = rangeSize > 0 ? (this.generation - range.min) / rangeSize : 1;
    
    return {
      ...super.getState(),
      generation: this.generation,
      efficiency: Math.max(0, Math.min(1, efficiency)),
      currentBiome: this.currentBiome,
      generationMin: range.min,
      generationMax: range.max,
      currentTarget: this.currentTarget
    };
  }
}

// ============================================
// SOLAR GENERATOR (Biome efficiency)
// ============================================
class SolarGenerator extends PowerNode {
  constructor(options = {}) {
    super({
      ...options,
      type: 'solar-generator',
      nodeType: 'generator',
      inputChannels: 0,
      outputChannels: 1,
      inputRate: 0,
      outputRate: 18,
      capacity: 70,
      range: 4
    });
    
    this.baseGeneration = options.baseGeneration || 10;
    this.generation = 0;
    
    // Biome efficiency multipliers
    this.biomeEfficiency = {
      'desert': 1.5,   // Best in desert
      'plains': 1.2,   // Good in plains
      'grass': 1.0,    // Normal
      'forest': 0.6,   // Trees block sun
      'swamp': 0.4,    // Cloudy
      'snow': 0.8      // Reflective but cold
    };
    
    this.currentBiome = 'grass';
    this.mapRef = null;
  }

  setMap(map) {
    this.mapRef = map;
  }

  getBiomeAtPosition() {
    if (!this.mapRef) return 'grass';
    
    const biomes = this.mapRef.biomes;
    if (!biomes) return 'grass';
    if (biomes[this.gridY]?.[this.gridX]) {
      return biomes[this.gridY][this.gridX];
    }
    return 'grass';
  }

  generate(dt) {
    this.currentBiome = this.getBiomeAtPosition();
    const efficiency = this.biomeEfficiency[this.currentBiome] || 1.0;
    
    this.generation = this.baseGeneration * efficiency;
    
    const produced = this.generation * dt;
    const space = this.capacity - this.stored;
    const actualProduced = Math.min(produced, space);
    this.stored += actualProduced;
    
    // Track energy for XP (100 energy = 1 XP)
    if (actualProduced > 0) {
      this.addEnergyProcessed(actualProduced);
    }
  }

  getState() {
    return {
      ...super.getState(),
      generation: this.generation,
      efficiency: this.biomeEfficiency[this.currentBiome] || 1.0,
      biome: this.currentBiome
    };
  }
}

// ============================================
// WATER GENERATOR (Like wind but for water)
// ============================================
class WaterGenerator extends PowerNode {
  constructor(options = {}) {
    super({
      ...options,
      type: 'water-generator',
      nodeType: 'generator',
      inputChannels: 0,
      outputChannels: 1,
      inputRate: 0,
      outputRate: 22,
      capacity: 65,
      range: 4
    });
    
    this.baseGeneration = options.baseGeneration || 10;
    this.generation = 0;
    this.waterRadius = 2;
    this.waterTiles = 0;
    this.maxWaterTiles = 9;
    
    this.mapRef = null;
  }

  setMap(map) {
    this.mapRef = map;
  }

  countWaterTiles() {
    if (!this.mapRef) return 0;
    
    let count = 0;
    const terrain = this.mapRef.terrain;
    if (!terrain) return 0;
    
    for (let dy = -this.waterRadius; dy <= this.waterRadius; dy++) {
      for (let dx = -this.waterRadius; dx <= this.waterRadius; dx++) {
        const x = this.gridX + dx;
        const y = this.gridY + dy;
        
        if (x >= 0 && x < this.mapRef.width && y >= 0 && y < this.mapRef.height) {
          if (terrain[y]?.[x] === 'water') {
            count++;
          }
        }
      }
    }
    return Math.min(count, this.maxWaterTiles);
  }

  generate(dt) {
    this.waterTiles = this.countWaterTiles();
    const efficiency = this.waterTiles / this.maxWaterTiles;
    
    this.generation = this.baseGeneration * efficiency;
    
    const produced = this.generation * dt;
    const space = this.capacity - this.stored;
    const actualProduced = Math.min(produced, space);
    this.stored += actualProduced;
    
    // Track energy for XP (100 energy = 1 XP)
    if (actualProduced > 0) {
      this.addEnergyProcessed(actualProduced);
    }
  }

  getState() {
    return {
      ...super.getState(),
      generation: this.generation,
      efficiency: this.waterTiles / this.maxWaterTiles,
      waterTiles: this.waterTiles,
      maxWaterTiles: this.maxWaterTiles
    };
  }
}

module.exports = {
  BaseGenerator,
  BioGenerator,
  WindGenerator,
  SolarGenerator,
  WaterGenerator
};
