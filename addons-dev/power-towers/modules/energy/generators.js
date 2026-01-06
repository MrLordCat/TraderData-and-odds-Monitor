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
const { ENERGY_BUILDINGS } = require('./building-defs');

// ============================================
// BASE GENERATOR (Basic stable power)
// ============================================
class BaseGenerator extends PowerNode {
  constructor(options = {}) {
    // Get definition from ENERGY_BUILDINGS (supports debug-generator, base-generator, etc.)
    const buildingType = options.type || 'base-generator';
    const def = ENERGY_BUILDINGS[buildingType] || ENERGY_BUILDINGS['base-generator'];
    const stats = def.stats || {};
    
    super({
      ...options,
      type: buildingType,
      nodeType: 'generator',
      inputChannels: stats.inputChannels || 0,
      outputChannels: stats.outputChannels || 1,
      inputRate: 0,
      outputRate: stats.outputRate || 20,
      capacity: stats.capacity || 100,
      range: stats.range || 4
    });
    
    this.baseGeneration = stats.generation || options.generation || 15;
    this.generation = this.baseGeneration;
  }

  generate(dt) {
    // Use effectiveGeneration calculated in recalculateStats (includes efficiency upgrade)
    const gen = this.effectiveGeneration || this.baseGeneration;
    this.generation = gen;
    
    const produced = gen * dt;
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
    this.treeBonusPerTree = 1; // +1 energy/s per tree
    this.generation = this.baseGeneration;
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
   * Checks both actual forest biome AND cells on forest borders
   * Border cells count as 0.5 trees (edge of forest)
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
          const cellBiome = biomes[y]?.[x];
          
          // Forest biome = full tree
          if (cellBiome === 'forest') {
            count++;
          } else {
            // Check if cell borders forest (partial trees at forest edge)
            const borderInfo = this.mapRef.getBorderInfo?.(x, y);
            if (borderInfo && borderInfo.nearbyBiomes) {
              const nearbyArr = borderInfo.nearbyBiomes instanceof Set 
                ? Array.from(borderInfo.nearbyBiomes)
                : borderInfo.nearbyBiomes;
              
              if (nearbyArr.includes('forest')) {
                count += 0.5; // Border cells count as half
              }
            }
          }
        }
      }
    }
    
    return Math.min(Math.floor(count), this.maxTrees);
  }

  generate(dt) {
    this.treesUsed = this.countTrees();
    
    // Base generation + bonus from trees
    // Each tree adds treeBonusPerTree to generation
    const treeBonus = this.treesUsed * this.treeBonusPerTree;
    
    // Apply efficiency upgrade multiplier (from recalculateStats)
    const effMult = this.efficiencyMultiplier || 1;
    this.generation = (this.baseGeneration + treeBonus) * effMult;
    
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
    
    // Apply efficiency upgrade multiplier
    const effMult = this.efficiencyMultiplier || 1;
    const effectiveGen = this.generation * effMult;
    
    // Produce energy
    const produced = effectiveGen * dt;
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
    const biomeEff = this.biomeEfficiency[this.currentBiome] || 1.0;
    const effMult = this.efficiencyMultiplier || 1;
    
    this.generation = this.baseGeneration * biomeEff * effMult;
    
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
    const waterEff = this.waterTiles / this.maxWaterTiles;
    const effMult = this.efficiencyMultiplier || 1;
    
    this.generation = this.baseGeneration * waterEff * effMult;
    
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
