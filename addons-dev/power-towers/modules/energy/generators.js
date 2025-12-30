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
// WIND GENERATOR (Needs mountains)
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
    
    this.baseGeneration = options.baseGeneration || 12;
    this.generation = 0;
    this.mountainRadius = 2;
    this.mountainsFound = 0;
    this.maxMountains = 9; // 3x3 area
    
    // Instability - power fluctuates
    this.instabilityFactor = 0.3; // 30% variance
    this.currentMultiplier = 1.0;
    this.fluctuationTimer = 0;
    this.fluctuationInterval = 2; // Change every 2 seconds
    
    this.mapRef = null;
  }

  setMap(map) {
    this.mapRef = map;
  }

  countMountains() {
    if (!this.mapRef) return 0;
    
    let count = 0;
    const terrain = this.mapRef.terrain;
    
    for (let dy = -this.mountainRadius; dy <= this.mountainRadius; dy++) {
      for (let dx = -this.mountainRadius; dx <= this.mountainRadius; dx++) {
        const x = this.gridX + dx;
        const y = this.gridY + dy;
        
        if (x >= 0 && x < this.mapRef.width && y >= 0 && y < this.mapRef.height) {
          // Hill terrain = mountain
          if (terrain[y]?.[x] === 'hill') {
            count++;
          }
        }
      }
    }
    return Math.min(count, this.maxMountains);
  }

  generate(dt) {
    this.mountainsFound = this.countMountains();
    const efficiency = this.mountainsFound / this.maxMountains;
    
    // Update fluctuation
    this.fluctuationTimer += dt;
    if (this.fluctuationTimer >= this.fluctuationInterval) {
      this.fluctuationTimer = 0;
      // Random multiplier between (1 - instability) and (1 + instability)
      this.currentMultiplier = 1 + (Math.random() * 2 - 1) * this.instabilityFactor;
    }
    
    this.generation = this.baseGeneration * efficiency * this.currentMultiplier;
    
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
      efficiency: this.mountainsFound / this.maxMountains,
      mountainsFound: this.mountainsFound,
      maxMountains: this.maxMountains,
      instability: this.instabilityFactor,
      currentMultiplier: this.currentMultiplier
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
