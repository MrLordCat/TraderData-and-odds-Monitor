/**
 * Power Towers TD - Biome System Configuration
 * 
 * Defines biome types, their properties, modifiers, and border effects.
 * 
 * BIOME TYPES:
 * - forest: Can regenerate, burnable for bio-generators
 * - plains: Good for wind turbines, neutral modifiers
 * - desert: High solar efficiency, low water
 * - water: Cannot build, good border effects for wind
 * - mountains: Cannot build (mostly), mineral deposits
 * 
 * MODIFIERS:
 * - Base modifiers apply to buildings in that biome
 * - Border modifiers apply when building is near another biome (within 2 cells)
 */

const BIOME_TYPES = {
  // =========================================
  // FOREST - Renewable resource
  // =========================================
  forest: {
    id: 'forest',
    name: 'Forest',
    emoji: '🌲',
    description: 'Dense woodland that can regenerate over time',
    
    // Visual
    color: '#228b22',        // Forest green
    colorVariants: ['#1e7a1e', '#2d9d2d', '#1a6b1a'], // Variation
    
    // Terrain properties
    buildable: true,
    walkable: true,          // Enemies can pass
    
    // Special mechanics
    canRegenerate: true,     // Forest can grow back
    regenerateTime: 60,      // Seconds to regrow after burned
    burnable: true,          // Can be consumed by bio-generator
    burnValue: 50,           // Energy gained when burned
    
    // Base modifiers for buildings in this biome
    modifiers: {
      energyProduction: 0.8,   // -20% base energy (trees block wind/sun)
      buildCost: 1.0,          // Normal cost
      towerRange: 0.9,         // -10% range (trees obstruct view)
      towerDamage: 1.0,
    },
    
    // Path modifier (affects enemy speed)
    pathSpeedMod: 0.9,       // Enemies slightly slower in forest
  },

  // =========================================
  // PLAINS - Neutral, good for wind
  // =========================================
  plains: {
    id: 'plains',
    name: 'Plains',
    emoji: '🌾',
    description: 'Open grassland with good wind exposure',
    
    color: '#90b866',
    colorVariants: ['#7da858', '#a3c874', '#85ad5c'],
    
    buildable: true,
    walkable: true,
    
    canRegenerate: false,
    burnable: false,
    
    modifiers: {
      energyProduction: 1.0,   // Normal
      buildCost: 1.0,
      towerRange: 1.0,
      towerDamage: 1.0,
      windEfficiency: 1.2,     // +20% wind turbine efficiency
    },
    
    pathSpeedMod: 1.0,
  },

  // =========================================
  // DESERT - High solar, harsh conditions
  // =========================================
  desert: {
    id: 'desert',
    name: 'Desert',
    emoji: '🏜️',
    description: 'Arid wasteland with intense sunlight',
    
    color: '#e6c87a',
    colorVariants: ['#d9b968', '#f0d68c', '#ccb060'],
    
    buildable: true,
    walkable: true,
    
    canRegenerate: false,
    burnable: false,
    
    modifiers: {
      energyProduction: 1.0,
      buildCost: 1.1,          // +10% cost (harsh conditions)
      towerRange: 1.1,         // +10% range (clear sight)
      towerDamage: 1.0,
      solarEfficiency: 1.5,    // +50% solar panel efficiency
      windEfficiency: 0.8,     // -20% wind (no elevation)
    },
    
    pathSpeedMod: 0.95,        // Slightly slower (sand)
  },

  // =========================================
  // WATER - Non-buildable, border effects
  // =========================================
  water: {
    id: 'water',
    name: 'Water',
    emoji: '🌊',
    description: 'Lakes and rivers - cannot build here',
    
    color: '#4a90d9',
    colorVariants: ['#3d7fc4', '#5aa0e8', '#3575b5'],
    
    buildable: false,         // Cannot place buildings
    walkable: false,          // Enemies cannot pass (need bridges)
    
    canRegenerate: false,
    burnable: false,
    
    modifiers: {
      // Only relevant for border effects
      hydroEfficiency: 2.0,    // Hydro power if adjacent
    },
    
    pathSpeedMod: 0,           // Impassable
  },

  // =========================================
  // MOUNTAINS - High ground, range bonus
  // =========================================
  mountains: {
    id: 'mountains',
    name: 'Mountains',
    emoji: '⛰️',
    description: 'High ground with excellent visibility for towers',
    
    color: '#8b8b8b',
    colorVariants: ['#7a7a7a', '#9c9c9c', '#6e6e6e'],
    
    buildable: true,          // Can build towers on mountains
    walkable: false,          // Enemies cannot pass (path goes around)
    
    canRegenerate: false,
    burnable: false,
    
    modifiers: {
      energyProduction: 0.9,   // -10% (harder to maintain)
      buildCost: 1.2,          // +20% cost (difficult terrain)
      towerRange: 1.2,         // +20% range (high ground advantage)
      towerDamage: 1.0,
      miningEfficiency: 1.5,   // +50% if mining buildings added
      windEfficiency: 1.3,     // +30% wind (altitude)
    },
    
    pathSpeedMod: 0,           // Impassable for enemies
  },

  // =========================================
  // BURNED - Temporary state after forest fire
  // =========================================
  burned: {
    id: 'burned',
    name: 'Burned Ground',
    emoji: '🔥',
    description: 'Charred remains of forest - will regenerate over time',
    
    color: '#3d3d3d',         // Dark ash gray
    colorVariants: ['#333333', '#474747', '#2a2a2a'],
    
    buildable: true,          // Can build on burned ground
    walkable: true,
    
    canRegenerate: true,      // Will become forest again
    regenerateTime: 60,       // Same as forest regen
    burnable: false,          // Already burned
    
    modifiers: {
      energyProduction: 0.9,   // -10% (ash residue)
      buildCost: 0.9,          // -10% cost (cleared land)
      towerRange: 1.1,         // +10% range (clear sight)
      towerDamage: 1.0,
    },
    
    pathSpeedMod: 1.0,
  },
};

// =========================================
// BORDER EFFECTS
// When a building is within borderRange cells of another biome
// =========================================
const BORDER_EFFECTS = {
  // Format: 'biome1_biome2': { modifiers }
  // Order doesn't matter - both combinations are checked
  
  // Plains near Water = great for wind turbines
  plains_water: {
    borderRange: 2,           // Effect range in cells
    description: 'Coastal winds boost turbine efficiency',
    modifiers: {
      windEfficiency: 1.4,    // +40% wind efficiency
      hydroEfficiency: 1.2,   // Can use some hydro
    }
  },
  
  // Desert near Water = oasis effect
  desert_water: {
    borderRange: 2,
    description: 'Oasis provides cooling and water access',
    modifiers: {
      buildCost: 0.9,         // -10% build cost
      energyProduction: 1.1,  // +10% general efficiency
    }
  },
  
  // Forest near Plains = forest edge
  forest_plains: {
    borderRange: 2,
    description: 'Forest edge provides shelter and resources',
    modifiers: {
      towerRange: 1.05,       // +5% range
      bioEfficiency: 1.1,     // +10% bio generator
    }
  },
  
  // Forest near Water = humid forest
  forest_water: {
    borderRange: 2,
    description: 'River forest - faster regeneration',
    modifiers: {
      regenerateTimeMod: 0.5, // 50% faster forest regrowth
      burnValue: 1.2,         // +20% burn energy (wet wood burns longer)
    }
  },
  
  // Plains near Mountains = foothill winds
  plains_mountains: {
    borderRange: 2,
    description: 'Mountain winds cascade down',
    modifiers: {
      windEfficiency: 1.3,    // +30% wind
    }
  },
  
  // Desert near Mountains = canyon effect
  desert_mountains: {
    borderRange: 2,
    description: 'Canyon walls focus sunlight',
    modifiers: {
      solarEfficiency: 1.2,   // +20% solar bonus
    }
  },
};

// =========================================
// HELPER FUNCTIONS
// =========================================

/**
 * Get biome configuration by ID
 * @param {string} biomeId - Biome identifier
 * @returns {object|null} Biome config or null
 */
function getBiome(biomeId) {
  return BIOME_TYPES[biomeId] || null;
}

/**
 * Get border effect between two biomes
 * @param {string} biome1 - First biome ID
 * @param {string} biome2 - Second biome ID
 * @returns {object|null} Border effect or null
 */
function getBorderEffect(biome1, biome2) {
  // Check both orderings
  const key1 = `${biome1}_${biome2}`;
  const key2 = `${biome2}_${biome1}`;
  
  return BORDER_EFFECTS[key1] || BORDER_EFFECTS[key2] || null;
}

/**
 * Get all biome IDs
 * @returns {string[]} Array of biome IDs
 */
function getAllBiomeIds() {
  return Object.keys(BIOME_TYPES);
}

/**
 * Get buildable biome IDs
 * @returns {string[]} Array of buildable biome IDs
 */
function getBuildableBiomes() {
  return Object.entries(BIOME_TYPES)
    .filter(([id, biome]) => biome.buildable)
    .map(([id]) => id);
}

/**
 * Check if a biome is buildable
 * @param {string} biomeId - Biome ID
 * @returns {boolean}
 */
function isBiomeBuildable(biomeId) {
  const biome = BIOME_TYPES[biomeId];
  return biome ? biome.buildable : false;
}

/**
 * Check if a biome is walkable (for pathfinding)
 * @param {string} biomeId - Biome ID
 * @returns {boolean}
 */
function isBiomeWalkable(biomeId) {
  const biome = BIOME_TYPES[biomeId];
  return biome ? biome.walkable : false;
}

/**
 * Calculate combined modifiers for a cell position
 * Includes base biome modifiers + all applicable border effects
 * 
 * @param {string} baseBiome - The biome at the cell
 * @param {string[]} nearbyBiomes - Array of unique biomes within border range
 * @returns {object} Combined modifier object
 */
function calculateCellModifiers(baseBiome, nearbyBiomes) {
  const baseConfig = BIOME_TYPES[baseBiome];
  if (!baseConfig) return {};
  
  // Start with base modifiers
  const combined = { ...baseConfig.modifiers };
  
  // Apply border effects
  for (const nearbyBiome of nearbyBiomes) {
    if (nearbyBiome === baseBiome) continue;
    
    const borderEffect = getBorderEffect(baseBiome, nearbyBiome);
    if (borderEffect) {
      // Merge modifiers (multiply for efficiency mods)
      for (const [key, value] of Object.entries(borderEffect.modifiers)) {
        if (combined[key] !== undefined) {
          // Multiply existing value
          combined[key] *= value;
        } else {
          combined[key] = value;
        }
      }
    }
  }
  
  return combined;
}

module.exports = {
  BIOME_TYPES,
  BORDER_EFFECTS,
  
  // Helper functions
  getBiome,
  getBorderEffect,
  getAllBiomeIds,
  getBuildableBiomes,
  isBiomeBuildable,
  isBiomeWalkable,
  calculateCellModifiers,
};
