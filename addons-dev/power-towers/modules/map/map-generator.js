/**
 * Power Towers TD - Map Generator
 * 
 * Procedural map generation with:
 * - Random meandering paths from spawn to base
 * - Terrain distribution using noise
 * - Special element placement (energy nodes, resource veins)
 * 
 * Map Elements:
 * - grass: Default terrain, buildable
 * - path: Enemy walking path, not buildable
 * - hill: Gives tower range bonus (+20%)
 * - forest: Gives tower damage bonus (+15%), reduces range (-10%)
 * - water: Not buildable, slows enemies on path edges
 * - energy_node: Gives energy generation bonus
 * - resource_vein: Gives gold bonus when nearby tower kills
 */

/**
 * Simple seeded random number generator (Mulberry32)
 */
class SeededRandom {
  constructor(seed = Date.now()) {
    this.seed = seed;
  }
  
  /**
   * Get next random number [0, 1)
   */
  next() {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  
  /**
   * Get random integer [min, max]
   */
  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  
  /**
   * Get random float [min, max)
   */
  float(min, max) {
    return this.next() * (max - min) + min;
  }
  
  /**
   * Pick random element from array
   */
  pick(array) {
    return array[this.int(0, array.length - 1)];
  }
  
  /**
   * Shuffle array in place
   */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

/**
 * Simple 2D Noise Generator (Value Noise)
 * Used for natural-looking terrain distribution
 */
class NoiseGenerator {
  constructor(seed = 12345) {
    this.rng = new SeededRandom(seed);
    this.permutation = [];
    
    // Create permutation table
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }
    this.rng.shuffle(this.permutation);
    
    // Double the permutation for overflow
    for (let i = 0; i < 256; i++) {
      this.permutation[256 + i] = this.permutation[i];
    }
  }
  
  /**
   * Smooth interpolation
   */
  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  /**
   * Linear interpolation
   */
  lerp(a, b, t) {
    return a + t * (b - a);
  }
  
  /**
   * Get hash value at integer coordinate
   */
  hash(x, y) {
    return this.permutation[(this.permutation[x & 255] + y) & 255] / 255;
  }
  
  /**
   * Get noise value at coordinate [0, 1]
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} scale - Noise scale (larger = smoother)
   */
  get(x, y, scale = 20) {
    x = x / scale;
    y = y / scale;
    
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    
    const sx = this.fade(x - x0);
    const sy = this.fade(y - y0);
    
    const n00 = this.hash(x0, y0);
    const n10 = this.hash(x1, y0);
    const n01 = this.hash(x0, y1);
    const n11 = this.hash(x1, y1);
    
    const nx0 = this.lerp(n00, n10, sx);
    const nx1 = this.lerp(n01, n11, sx);
    
    return this.lerp(nx0, nx1, sy);
  }
  
  /**
   * Get fractal noise (multiple octaves)
   */
  fractal(x, y, octaves = 3, persistence = 0.5, scale = 20) {
    let total = 0;
    let maxValue = 0;
    let amplitude = 1;
    let frequency = 1;
    
    for (let i = 0; i < octaves; i++) {
      total += this.get(x * frequency, y * frequency, scale) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    
    return total / maxValue;
  }
}

/**
 * Map Generator Configuration
 */
const GENERATOR_CONFIG = {
  // Path generation
  PATH_MIN_LENGTH_FACTOR: 1.8,    // Min path length relative to direct distance
  PATH_MAX_LENGTH_FACTOR: 3.0,    // Max path length relative to direct distance
  PATH_SEGMENT_MIN: 3,            // Min cells per straight segment (shorter = more turns)
  PATH_SEGMENT_MAX: 8,            // Max cells per straight segment (shorter = more turns)
  PATH_WIDTH: 3,                  // Path width in cells (3 = enemy walks in center)
  
  // Path meandering
  TURN_CHANCE: 0.4,               // Chance to change direction
  FORWARD_BIAS: 0.5,              // How much to favor forward movement (lower = more meander)
  VERTICAL_WANDER: 0.35,          // Chance for random vertical movement
  
  // Terrain distribution thresholds (based on noise value 0-1)
  TERRAIN_THRESHOLDS: {
    water: 0.25,      // 0.00 - 0.25 = water
    forest: 0.45,     // 0.25 - 0.45 = forest
    grass: 0.75,      // 0.45 - 0.75 = grass
    hill: 1.0         // 0.75 - 1.00 = hill
  },
  
  // Special elements
  ENERGY_NODES: {
    count: { min: 3, max: 6 },
    minDistFromPath: 2,
    maxDistFromPath: 8
  },
  RESOURCE_VEINS: {
    count: { min: 2, max: 5 },
    minDistFromPath: 1,
    maxDistFromPath: 6
  },
  
  // Spawn/Base margins (cells from edge)
  SPAWN_MARGIN: 2,
  BASE_MARGIN: 2
};

/**
 * Main Map Generator Class
 */
class MapGenerator {
  /**
   * @param {number} width - Map width in cells
   * @param {number} height - Map height in cells
   * @param {number} gridSize - Size of each cell in pixels
   */
  constructor(width, height, gridSize) {
    this.width = width;
    this.height = height;
    this.gridSize = gridSize;
    
    this.rng = null;
    this.noise = null;
    
    // Generated data
    this.terrain = [];
    this.waypoints = [];
    this.pathCells = [];
    this.energyNodes = [];
    this.resourceVeins = [];
    this.spawnPoint = null;
    this.basePoint = null;
  }
  
  /**
   * Generate a new map
   * @param {number} seed - Random seed (optional, uses Date.now() if not provided)
   * @returns {object} Generated map data
   */
  generate(seed = null) {
    const actualSeed = seed !== null ? seed : Date.now();
    console.log(`[MapGenerator] Generating map with seed: ${actualSeed}`);
    
    this.rng = new SeededRandom(actualSeed);
    this.noise = new NoiseGenerator(actualSeed);
    
    // Step 1: Initialize terrain with noise-based distribution
    this._generateBaseTerrain();
    
    // Step 2: Generate spawn and base points
    this._generateEndpoints();
    
    // Step 3: Generate path
    this._generatePath();
    
    // Step 4: Carve path into terrain
    this._carvePath();
    
    // Step 5: Place special elements
    this._placeEnergyNodes();
    this._placeResourceVeins();
    
    // Step 6: Post-process (ensure playability)
    this._postProcess();
    
    console.log(`[MapGenerator] Generation complete: ${this.pathCells.length} path cells, ${this.waypoints.length} waypoints`);
    
    return this.getMapData();
  }
  
  /**
   * Generate base terrain using noise
   */
  _generateBaseTerrain() {
    this.terrain = [];
    
    const noiseScale = this.rng.float(15, 30);
    
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        const noiseValue = this.noise.fractal(x, y, 3, 0.5, noiseScale);
        row.push(this._noiseToTerrain(noiseValue));
      }
      this.terrain.push(row);
    }
  }
  
  /**
   * Convert noise value to terrain type
   */
  _noiseToTerrain(value) {
    const t = GENERATOR_CONFIG.TERRAIN_THRESHOLDS;
    
    if (value < t.water) return 'water';
    if (value < t.forest) return 'forest';
    if (value < t.grass) return 'grass';
    return 'hill';
  }
  
  /**
   * Generate spawn and base endpoints
   */
  _generateEndpoints() {
    const margin = GENERATOR_CONFIG.SPAWN_MARGIN;
    
    // Spawn on left edge, random Y
    const spawnY = this.rng.int(margin, this.height - margin - 1);
    this.spawnPoint = {
      gridX: -1,  // Off-map spawn
      gridY: spawnY,
      x: -this.gridSize,
      y: (spawnY + 0.5) * this.gridSize
    };
    
    // Base on right edge, random Y
    const baseY = this.rng.int(margin, this.height - margin - 1);
    this.basePoint = {
      gridX: this.width,
      gridY: baseY,
      x: (this.width + 0.5) * this.gridSize,
      y: (baseY + 0.5) * this.gridSize
    };
  }
  
  /**
   * Generate meandering path from spawn to base
   */
  _generatePath() {
    this.waypoints = [];
    this.pathCells = [];
    
    // Start point (entry from left edge)
    const startX = 0;
    const startY = this.spawnPoint.gridY;
    
    // End point (exit to right edge)  
    const endX = this.width - 1;
    const endY = this.basePoint.gridY;
    
    // Add spawn waypoint
    this.waypoints.push({
      x: this.spawnPoint.x,
      y: this.spawnPoint.y
    });
    
    // Generate path using random walk with direction bias
    const path = this._randomWalkPath(startX, startY, endX, endY);
    
    // Convert path cells to waypoints (simplify to key points)
    const simplifiedWaypoints = this._simplifyPath(path);
    
    // Add simplified waypoints
    for (const wp of simplifiedWaypoints) {
      this.waypoints.push({
        x: (wp.x + 0.5) * this.gridSize,
        y: (wp.y + 0.5) * this.gridSize
      });
    }
    
    // Add base waypoint
    this.waypoints.push({
      x: this.basePoint.x,
      y: this.basePoint.y
    });
    
    // Store path cells
    this.pathCells = path;
  }
  
  /**
   * Generate path using biased random walk
   */
  _randomWalkPath(startX, startY, endX, endY) {
    const path = [];
    const visited = new Set();
    
    let x = startX;
    let y = startY;
    
    // Add starting point
    path.push({ x, y });
    visited.add(`${x},${y}`);
    
    // Direction vectors: right, up, down, left
    const directions = [
      { dx: 1, dy: 0, name: 'right' },
      { dx: 0, dy: -1, name: 'up' },
      { dx: 0, dy: 1, name: 'down' },
      { dx: -1, dy: 0, name: 'left' }
    ];
    
    let lastDir = 'right';
    let straightCount = 0;
    const maxStraight = this.rng.int(
      GENERATOR_CONFIG.PATH_SEGMENT_MIN,
      GENERATOR_CONFIG.PATH_SEGMENT_MAX
    );
    
    const maxIterations = this.width * this.height;
    let iterations = 0;
    
    while (x !== endX || Math.abs(y - endY) > 1) {
      iterations++;
      if (iterations > maxIterations) {
        console.warn('[MapGenerator] Path generation exceeded max iterations');
        break;
      }
      
      // Calculate weights for each direction
      const weights = [];
      
      for (const dir of directions) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        
        // Skip if out of bounds or visited
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
          weights.push(0);
          continue;
        }
        if (visited.has(`${nx},${ny}`)) {
          weights.push(0);
          continue;
        }
        
        // Calculate weight based on:
        // 1. Progress towards goal
        // 2. Randomness for meandering
        // 3. Continuing in same direction for segments
        
        let weight = 1;
        
        // Progress weight - favor moves that get closer, but not too strongly
        const distToEnd = Math.abs(endX - nx) + Math.abs(endY - ny);
        const currentDist = Math.abs(endX - x) + Math.abs(endY - y);
        
        if (distToEnd < currentDist) {
          weight *= 1.5; // Reduced from 3 - less aggressive forward progress
        }
        
        // Right direction bonus (main progression) - reduced for more meandering
        if (dir.name === 'right') {
          weight *= GENERATOR_CONFIG.FORWARD_BIAS * 5; // 0.5 * 5 = 2.5
        }
        
        // Same direction bonus (for straight segments)
        if (dir.name === lastDir && straightCount < maxStraight) {
          weight *= 1.5;
        }
        
        // Random turn chance - add weight to perpendicular directions
        if ((dir.name === 'up' || dir.name === 'down') && this.rng.next() < GENERATOR_CONFIG.TURN_CHANCE) {
          weight *= 3; // Encourage turns
        }
        
        // Random vertical wandering even when not needed
        if ((dir.name === 'up' || dir.name === 'down') && this.rng.next() < GENERATOR_CONFIG.VERTICAL_WANDER) {
          weight *= 2;
        }
        
        // Vertical movement when we need to align with end Y (but don't force it)
        if (dir.name === 'up' && y > endY) weight *= 1.3;
        if (dir.name === 'down' && y < endY) weight *= 1.3;
        
        // Avoid going back left too much
        if (dir.name === 'left') {
          weight *= 0.15; // Reduced from 0.3 - even less backtracking
        }
        
        // Terrain preference (avoid water for path)
        const terrainAt = this.terrain[ny]?.[nx];
        if (terrainAt === 'water') {
          weight *= 0.2;
        }
        
        weights.push(weight);
      }
      
      // Pick direction based on weights
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      
      if (totalWeight === 0) {
        // Dead end - backtrack
        if (path.length > 1) {
          path.pop();
          const last = path[path.length - 1];
          x = last.x;
          y = last.y;
        }
        continue;
      }
      
      let random = this.rng.float(0, totalWeight);
      let chosenDir = 0;
      
      for (let i = 0; i < weights.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          chosenDir = i;
          break;
        }
      }
      
      // Move in chosen direction
      const dir = directions[chosenDir];
      x += dir.dx;
      y += dir.dy;
      
      // Update straight count
      if (dir.name === lastDir) {
        straightCount++;
      } else {
        straightCount = 0;
      }
      lastDir = dir.name;
      
      // Add to path
      path.push({ x, y });
      visited.add(`${x},${y}`);
    }
    
    // Connect to end Y if needed
    while (y !== endY) {
      y += y < endY ? 1 : -1;
      if (!visited.has(`${x},${y}`)) {
        path.push({ x, y });
        visited.add(`${x},${y}`);
      }
    }
    
    // Ensure we reach the end
    while (x < endX) {
      x++;
      if (!visited.has(`${x},${y}`)) {
        path.push({ x, y });
        visited.add(`${x},${y}`);
      }
    }
    
    return path;
  }
  
  /**
   * Simplify path to key waypoints (direction changes)
   */
  _simplifyPath(path) {
    if (path.length < 3) return path;
    
    const waypoints = [path[0]];
    
    let lastDirX = path[1].x - path[0].x;
    let lastDirY = path[1].y - path[0].y;
    
    for (let i = 2; i < path.length; i++) {
      const dirX = path[i].x - path[i-1].x;
      const dirY = path[i].y - path[i-1].y;
      
      // Direction changed - add previous point as waypoint
      if (dirX !== lastDirX || dirY !== lastDirY) {
        waypoints.push(path[i-1]);
        lastDirX = dirX;
        lastDirY = dirY;
      }
    }
    
    // Add final point
    waypoints.push(path[path.length - 1]);
    
    return waypoints;
  }
  
  /**
   * Carve path into terrain (mark path cells)
   * Expands path to PATH_WIDTH cells wide
   * Center line is the actual enemy walk path
   */
  _carvePath() {
    const pathWidth = GENERATOR_CONFIG.PATH_WIDTH;
    const halfWidth = Math.floor(pathWidth / 2);
    
    // Store original center path for waypoints (enemies walk here)
    this.centerPath = [...this.pathCells];
    
    // Expand path cells to include adjacent cells for width
    const expandedCells = new Set();
    
    for (const cell of this.pathCells) {
      // Add center cell
      expandedCells.add(`${cell.x},${cell.y}`);
      
      // Add adjacent cells based on path width
      for (let dy = -halfWidth; dy <= halfWidth; dy++) {
        for (let dx = -halfWidth; dx <= halfWidth; dx++) {
          const nx = cell.x + dx;
          const ny = cell.y + dy;
          
          // Check bounds
          if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
            expandedCells.add(`${nx},${ny}`);
          }
        }
      }
    }
    
    // Convert expanded cells to path terrain
    this.pathCells = [];
    for (const key of expandedCells) {
      const [x, y] = key.split(',').map(Number);
      this.pathCells.push({ x, y });
      if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
        this.terrain[y][x] = 'path';
      }
    }
  }
  
  /**
   * Place energy nodes near path
   */
  _placeEnergyNodes() {
    this.energyNodes = [];
    
    const config = GENERATOR_CONFIG.ENERGY_NODES;
    const count = this.rng.int(config.count.min, config.count.max);
    
    const candidates = this._findPlacementCandidates(
      config.minDistFromPath,
      config.maxDistFromPath,
      ['grass', 'hill']
    );
    
    this.rng.shuffle(candidates);
    
    for (let i = 0; i < Math.min(count, candidates.length); i++) {
      const cell = candidates[i];
      this.terrain[cell.y][cell.x] = 'energy_node';
      this.energyNodes.push(cell);
    }
  }
  
  /**
   * Place resource veins near path
   */
  _placeResourceVeins() {
    this.resourceVeins = [];
    
    const config = GENERATOR_CONFIG.RESOURCE_VEINS;
    const count = this.rng.int(config.count.min, config.count.max);
    
    const candidates = this._findPlacementCandidates(
      config.minDistFromPath,
      config.maxDistFromPath,
      ['grass', 'hill', 'forest']
    );
    
    // Filter out cells too close to energy nodes
    const filtered = candidates.filter(c => {
      return !this.energyNodes.some(e => 
        Math.abs(e.x - c.x) + Math.abs(e.y - c.y) < 4
      );
    });
    
    this.rng.shuffle(filtered);
    
    for (let i = 0; i < Math.min(count, filtered.length); i++) {
      const cell = filtered[i];
      this.terrain[cell.y][cell.x] = 'resource_vein';
      this.resourceVeins.push(cell);
    }
  }
  
  /**
   * Find cells suitable for placing special elements
   */
  _findPlacementCandidates(minDist, maxDist, allowedTerrains) {
    const candidates = [];
    const pathSet = new Set(this.pathCells.map(c => `${c.x},${c.y}`));
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!allowedTerrains.includes(this.terrain[y][x])) continue;
        
        // Calculate distance to nearest path cell
        let minPathDist = Infinity;
        for (const pc of this.pathCells) {
          const dist = Math.abs(pc.x - x) + Math.abs(pc.y - y);
          if (dist < minPathDist) minPathDist = dist;
        }
        
        if (minPathDist >= minDist && minPathDist <= maxDist) {
          candidates.push({ x, y, distToPath: minPathDist });
        }
      }
    }
    
    return candidates;
  }
  
  /**
   * Post-process map for playability
   */
  _postProcess() {
    // Ensure spawn and base areas are accessible
    this._clearAreaAroundPoint(this.spawnPoint.gridY, 0, 2);
    this._clearAreaAroundPoint(this.basePoint.gridY, this.width - 1, 2);
    
    // Ensure there are buildable cells near path
    this._ensureBuildableNearPath();
  }
  
  /**
   * Clear terrain around a point (make grass)
   */
  _clearAreaAroundPoint(centerY, centerX, radius) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
          const terrain = this.terrain[y][x];
          if (terrain === 'water') {
            this.terrain[y][x] = 'grass';
          }
        }
      }
    }
  }
  
  /**
   * Ensure there are buildable cells near path
   */
  _ensureBuildableNearPath() {
    // Check every N-th path cell has at least one adjacent buildable cell
    for (let i = 0; i < this.pathCells.length; i += 5) {
      const cell = this.pathCells[i];
      
      const neighbors = [
        { x: cell.x - 1, y: cell.y },
        { x: cell.x + 1, y: cell.y },
        { x: cell.x, y: cell.y - 1 },
        { x: cell.x, y: cell.y + 1 }
      ];
      
      let hasBuildable = false;
      for (const n of neighbors) {
        if (n.x >= 0 && n.x < this.width && n.y >= 0 && n.y < this.height) {
          const terrain = this.terrain[n.y][n.x];
          if (terrain !== 'path' && terrain !== 'water') {
            hasBuildable = true;
            break;
          }
        }
      }
      
      // If no buildable neighbor, convert one water cell to grass
      if (!hasBuildable) {
        for (const n of neighbors) {
          if (n.x >= 0 && n.x < this.width && n.y >= 0 && n.y < this.height) {
            if (this.terrain[n.y][n.x] === 'water') {
              this.terrain[n.y][n.x] = 'grass';
              break;
            }
          }
        }
      }
    }
  }
  
  /**
   * Get generated map data
   */
  getMapData() {
    return {
      width: this.width,
      height: this.height,
      gridSize: this.gridSize,
      terrain: this.terrain,
      waypoints: this.waypoints,
      pathCells: this.pathCells,
      spawnPoint: this.spawnPoint,
      basePoint: this.basePoint,
      energyNodes: this.energyNodes,
      resourceVeins: this.resourceVeins
    };
  }
}

module.exports = { 
  MapGenerator, 
  SeededRandom, 
  NoiseGenerator,
  GENERATOR_CONFIG 
};
