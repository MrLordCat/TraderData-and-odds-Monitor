/**
 * Power Towers TD - Biome Generator
 * 
 * Generates biome map using multi-octave noise for natural-looking regions.
 * Creates distinct biome zones with smooth transitions.
 * 
 * Generation approach:
 * 1. Use multiple noise layers for different biome characteristics
 * 2. Height noise determines mountains vs lowlands
 * 3. Moisture noise determines water vs desert
 * 4. Combine to determine final biome
 * 5. Apply cellular automata for smoother regions
 */

const { BIOME_TYPES, getBiome, isBiomeBuildable, isBiomeWalkable } = require('../../core/biomes');

/**
 * Biome generation configuration
 */
const BIOME_GEN_CONFIG = {
  // Noise scales (lower = larger features)
  HEIGHT_SCALE: 0.03,       // For elevation (mountains)
  MOISTURE_SCALE: 0.04,     // For water/desert
  DETAIL_SCALE: 0.08,       // For local variation
  
  // Biome thresholds (based on height + moisture)
  THRESHOLDS: {
    // Water forms in low areas with high moisture
    WATER_HEIGHT_MAX: 0.3,
    WATER_MOISTURE_MIN: 0.6,
    
    // Mountains form at high elevation
    MOUNTAIN_HEIGHT_MIN: 0.75,
    
    // Desert in low moisture areas
    DESERT_MOISTURE_MAX: 0.25,
    
    // Forest in medium-high moisture
    FOREST_MOISTURE_MIN: 0.45,
    FOREST_HEIGHT_MAX: 0.65,
    
    // Plains fill the rest
  },
  
  // Smoothing passes
  SMOOTHING_PASSES: 2,
  SMOOTHING_THRESHOLD: 5, // If 5+ of 8 neighbors are same biome, convert
  
  // Minimum biome region size (cells)
  MIN_REGION_SIZE: 15,
  
  // Forest regeneration tracking
  FOREST_REGROW_TICKS: 3600, // 60 seconds at 60fps
};

/**
 * BiomeGenerator class
 * Handles biome map generation and state
 */
class BiomeGenerator {
  /**
   * @param {number} width - Map width in cells
   * @param {number} height - Map height in cells
   */
  constructor(width, height) {
    this.width = width;
    this.height = height;
    
    // Biome map (2D array of biome IDs)
    this.biomeMap = [];
    
    // Forest state tracking (for regeneration)
    this.forestState = new Map(); // key: "x,y", value: { burned: bool, regrowTimer: number }
    
    // Border cache (calculated once, updated when biomes change)
    this.borderCache = new Map(); // key: "x,y", value: { nearbyBiomes: Set, modifiers: object }
    
    // Noise generators (set during generate)
    this.heightNoise = null;
    this.moistureNoise = null;
    this.detailNoise = null;
  }
  
  /**
   * Generate biome map
   * @param {object} noiseGen - Noise generator instance
   * @param {object} rng - Random number generator
   * @param {Set} pathCells - Set of path cell keys ("x,y") to exclude
   * @returns {string[][]} 2D array of biome IDs
   */
  generate(noiseGen, rng, pathCells = new Set()) {
    this.heightNoise = noiseGen;
    this.moistureNoise = noiseGen;
    this.detailNoise = noiseGen;
    
    // Step 1: Generate raw biomes from noise
    this._generateRawBiomes(rng);
    
    // Step 2: Mark path cells (will be handled by terrain, not biome)
    // Path goes OVER biomes, doesn't change them
    
    // Step 3: Smooth biome regions
    for (let i = 0; i < BIOME_GEN_CONFIG.SMOOTHING_PASSES; i++) {
      this._smoothBiomes();
    }
    
    // Step 4: Remove tiny isolated regions
    this._removeSmallRegions();
    
    // Step 5: Build border cache
    this._buildBorderCache();
    
    return this.biomeMap;
  }
  
  /**
   * Generate raw biomes from noise values
   */
  _generateRawBiomes(rng) {
    this.biomeMap = [];
    
    // Random offset for variety
    const offsetX = rng.float(0, 1000);
    const offsetY = rng.float(0, 1000);
    
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        // Sample noise at different scales
        const height = this._sampleNoise(
          x + offsetX, 
          y + offsetY, 
          BIOME_GEN_CONFIG.HEIGHT_SCALE
        );
        
        const moisture = this._sampleNoise(
          x + offsetX + 500, 
          y + offsetY + 500, 
          BIOME_GEN_CONFIG.MOISTURE_SCALE
        );
        
        const detail = this._sampleNoise(
          x + offsetX + 1000, 
          y + offsetY + 1000, 
          BIOME_GEN_CONFIG.DETAIL_SCALE
        );
        
        // Determine biome based on height + moisture
        row.push(this._determineBiome(height, moisture, detail));
      }
      this.biomeMap.push(row);
    }
  }
  
  /**
   * Sample noise with octaves for more natural look
   */
  _sampleNoise(x, y, scale) {
    // Use fractal noise for more natural patterns
    return this.heightNoise.fractal(x * scale, y * scale, 3, 0.5, 1);
  }
  
  /**
   * Determine biome from height and moisture values
   * @param {number} height - 0-1 elevation value
   * @param {number} moisture - 0-1 moisture value
   * @param {number} detail - 0-1 local variation
   * @returns {string} Biome ID
   */
  _determineBiome(height, moisture, detail) {
    const t = BIOME_GEN_CONFIG.THRESHOLDS;
    
    // Mountains at high elevation (regardless of moisture)
    if (height > t.MOUNTAIN_HEIGHT_MIN) {
      return 'mountains';
    }
    
    // Water in low areas with high moisture
    if (height < t.WATER_HEIGHT_MAX && moisture > t.WATER_MOISTURE_MIN) {
      return 'water';
    }
    
    // Desert in low moisture areas
    if (moisture < t.DESERT_MOISTURE_MAX) {
      return 'desert';
    }
    
    // Forest in moderate-high moisture, not too high elevation
    if (moisture > t.FOREST_MOISTURE_MIN && height < t.FOREST_HEIGHT_MAX) {
      // Use detail noise to add variation
      if (detail > 0.3) {
        return 'forest';
      }
    }
    
    // Default to plains
    return 'plains';
  }
  
  /**
   * Smooth biome map using cellular automata
   */
  _smoothBiomes() {
    const newMap = [];
    
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        const current = this.biomeMap[y][x];
        const neighbors = this._getNeighborBiomes(x, y);
        
        // Count occurrences of each biome
        const counts = {};
        counts[current] = 1; // Include self
        
        for (const biome of neighbors) {
          counts[biome] = (counts[biome] || 0) + 1;
        }
        
        // Find most common biome
        let maxCount = 0;
        let dominant = current;
        
        for (const [biome, count] of Object.entries(counts)) {
          if (count > maxCount) {
            maxCount = count;
            dominant = biome;
          }
        }
        
        // Convert if dominant has enough neighbors
        if (maxCount >= BIOME_GEN_CONFIG.SMOOTHING_THRESHOLD) {
          row.push(dominant);
        } else {
          row.push(current);
        }
      }
      newMap.push(row);
    }
    
    this.biomeMap = newMap;
  }
  
  /**
   * Get neighboring biomes (8-directional)
   */
  _getNeighborBiomes(x, y) {
    const neighbors = [];
    
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
          neighbors.push(this.biomeMap[ny][nx]);
        }
      }
    }
    
    return neighbors;
  }
  
  /**
   * Remove small isolated biome regions
   */
  _removeSmallRegions() {
    // Flood-fill to find regions
    const visited = new Set();
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        
        const biome = this.biomeMap[y][x];
        const region = this._floodFill(x, y, biome, visited);
        
        // If region is too small, convert to neighbor's biome
        if (region.length < BIOME_GEN_CONFIG.MIN_REGION_SIZE) {
          const replacement = this._findDominantNeighborBiome(region, biome);
          for (const [rx, ry] of region) {
            this.biomeMap[ry][rx] = replacement;
          }
        }
      }
    }
  }
  
  /**
   * Flood fill to find connected region
   */
  _floodFill(startX, startY, biome, visited) {
    const region = [];
    const stack = [[startX, startY]];
    
    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const key = `${x},${y}`;
      
      if (visited.has(key)) continue;
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue;
      if (this.biomeMap[y][x] !== biome) continue;
      
      visited.add(key);
      region.push([x, y]);
      
      // Add neighbors (4-directional for cleaner regions)
      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }
    
    return region;
  }
  
  /**
   * Find dominant biome in neighbors of a region
   */
  _findDominantNeighborBiome(region, excludeBiome) {
    const neighborCounts = {};
    
    for (const [x, y] of region) {
      for (const neighbor of this._getNeighborBiomes(x, y)) {
        if (neighbor !== excludeBiome) {
          neighborCounts[neighbor] = (neighborCounts[neighbor] || 0) + 1;
        }
      }
    }
    
    // Find most common neighbor biome
    let maxCount = 0;
    let dominant = 'plains'; // Default fallback
    
    for (const [biome, count] of Object.entries(neighborCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominant = biome;
      }
    }
    
    return dominant;
  }
  
  /**
   * Build border cache for all cells
   */
  _buildBorderCache() {
    this.borderCache.clear();
    
    const borderRange = 2; // Check 2 cells in each direction
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const baseBiome = this.biomeMap[y][x];
        const nearbyBiomes = new Set();
        
        // Check cells within border range
        for (let dy = -borderRange; dy <= borderRange; dy++) {
          for (let dx = -borderRange; dx <= borderRange; dx++) {
            if (dx === 0 && dy === 0) continue;
            
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
              const neighborBiome = this.biomeMap[ny][nx];
              if (neighborBiome !== baseBiome) {
                nearbyBiomes.add(neighborBiome);
              }
            }
          }
        }
        
        // Store in cache
        const key = `${x},${y}`;
        this.borderCache.set(key, {
          baseBiome,
          nearbyBiomes,
          isBorder: nearbyBiomes.size > 0
        });
      }
    }
  }
  
  /**
   * Get biome at cell
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @returns {string|null} Biome ID or null if out of bounds
   */
  getBiomeAt(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return null;
    }
    return this.biomeMap[y][x];
  }
  
  /**
   * Get border info for a cell
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @returns {object|null} Border info or null
   */
  getBorderInfo(x, y) {
    const key = `${x},${y}`;
    return this.borderCache.get(key) || null;
  }
  
  /**
   * Check if cell is buildable based on biome
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @returns {boolean}
   */
  isCellBuildable(x, y) {
    const biome = this.getBiomeAt(x, y);
    return biome ? isBiomeBuildable(biome) : false;
  }
  
  /**
   * Check if cell is walkable based on biome
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @returns {boolean}
   */
  isCellWalkable(x, y) {
    const biome = this.getBiomeAt(x, y);
    return biome ? isBiomeWalkable(biome) : false;
  }
  
  /**
   * Burn forest at cell (for bio-generator)
   * @param {number} x - Grid X
   * @param {number} y - Grid Y
   * @returns {number} Energy gained (0 if not forest)
   */
  burnForest(x, y) {
    const biome = this.getBiomeAt(x, y);
    if (biome !== 'forest') return 0;
    
    const forestConfig = BIOME_TYPES.forest;
    const key = `${x},${y}`;
    
    // Mark as burned
    this.forestState.set(key, {
      burned: true,
      regrowTimer: BIOME_GEN_CONFIG.FOREST_REGROW_TICKS,
      originalBiome: 'forest'
    });
    
    // Change biome to burned (charred area)
    this.biomeMap[y][x] = 'burned';
    
    // Recalculate border cache for nearby cells
    this._updateBorderCacheAround(x, y);
    
    return forestConfig.burnValue;
  }
  
  /**
   * Update forest regeneration
   * @param {number} deltaTicks - Ticks passed
   * @returns {Array} List of regrown cells [{x, y}]
   */
  updateForestRegeneration(deltaTicks) {
    const regrown = [];
    
    for (const [key, state] of this.forestState.entries()) {
      if (!state.burned) continue;
      
      state.regrowTimer -= deltaTicks;
      
      if (state.regrowTimer <= 0) {
        // Regrow forest
        const [x, y] = key.split(',').map(Number);
        this.biomeMap[y][x] = 'forest';
        state.burned = false;
        
        // Update border cache
        this._updateBorderCacheAround(x, y);
        
        regrown.push({ x, y });
      }
    }
    
    return regrown;
  }
  
  /**
   * Update border cache around a cell (after biome change)
   */
  _updateBorderCacheAround(cx, cy) {
    const borderRange = 2;
    
    for (let dy = -borderRange; dy <= borderRange; dy++) {
      for (let dx = -borderRange; dx <= borderRange; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          this._updateCellBorderCache(x, y);
        }
      }
    }
  }
  
  /**
   * Update border cache for single cell
   */
  _updateCellBorderCache(x, y) {
    const baseBiome = this.biomeMap[y][x];
    const nearbyBiomes = new Set();
    const borderRange = 2;
    
    for (let dy = -borderRange; dy <= borderRange; dy++) {
      for (let dx = -borderRange; dx <= borderRange; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
          const neighborBiome = this.biomeMap[ny][nx];
          if (neighborBiome !== baseBiome) {
            nearbyBiomes.add(neighborBiome);
          }
        }
      }
    }
    
    this.borderCache.set(`${x},${y}`, {
      baseBiome,
      nearbyBiomes,
      isBorder: nearbyBiomes.size > 0
    });
  }
  
  /**
   * Get render data for biome map
   */
  getRenderData() {
    return {
      biomeMap: this.biomeMap,
      forestState: this.forestState
    };
  }
}

module.exports = { BiomeGenerator, BIOME_GEN_CONFIG };
