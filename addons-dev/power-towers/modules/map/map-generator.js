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
  // Path generation - advanced waypoint system
  PATH_WIDTH: 3,                  // Path width in cells (3 = enemy walks in center)
  PATH_MARGIN: 6,                 // Minimum distance from map edges
  
  // Path complexity
  PATH_SEGMENTS_MIN: 6,           // Minimum path segments (more = longer path)
  PATH_SEGMENTS_MAX: 12,          // Maximum path segments
  PATH_SEGMENT_LENGTH_MIN: 8,     // Minimum segment length in cells
  PATH_SEGMENT_LENGTH_MAX: 25,    // Maximum segment length in cells
  
  // Path patterns weights (higher = more likely)
  PATTERN_WEIGHTS: {
    spiral: 25,                   // Спиральный путь к центру
    zigzag: 30,                   // Зигзаг к центру
    snake: 25,                    // S-образный
    corner: 20                    // Угловой путь
  },
  
  // Spawn edge weights (which edge to spawn from)
  SPAWN_EDGE_WEIGHTS: {
    left: 30,
    right: 30,
    top: 20,
    bottom: 20
  },
  
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
   * Base is ALWAYS in center of map
   * Spawn is on a random edge
   */
  _generateEndpoints() {
    const margin = GENERATOR_CONFIG.PATH_MARGIN;
    
    // BASE is always in center of map
    const centerX = Math.floor(this.width / 2);
    const centerY = Math.floor(this.height / 2);
    
    this.basePoint = {
      gridX: centerX,
      gridY: centerY,
      x: (centerX + 0.5) * this.gridSize,
      y: (centerY + 0.5) * this.gridSize
    };
    
    // SPAWN on random edge based on weights
    const edge = this._pickWeighted(GENERATOR_CONFIG.SPAWN_EDGE_WEIGHTS);
    
    let spawnGridX, spawnGridY, spawnX, spawnY;
    
    switch (edge) {
      case 'left':
        spawnGridX = -1;
        spawnGridY = this.rng.int(margin, this.height - margin - 1);
        spawnX = -this.gridSize;
        spawnY = (spawnGridY + 0.5) * this.gridSize;
        break;
      case 'right':
        spawnGridX = this.width;
        spawnGridY = this.rng.int(margin, this.height - margin - 1);
        spawnX = (this.width + 0.5) * this.gridSize;
        spawnY = (spawnGridY + 0.5) * this.gridSize;
        break;
      case 'top':
        spawnGridX = this.rng.int(margin, this.width - margin - 1);
        spawnGridY = -1;
        spawnX = (spawnGridX + 0.5) * this.gridSize;
        spawnY = -this.gridSize;
        break;
      case 'bottom':
        spawnGridX = this.rng.int(margin, this.width - margin - 1);
        spawnGridY = this.height;
        spawnX = (spawnGridX + 0.5) * this.gridSize;
        spawnY = (this.height + 0.5) * this.gridSize;
        break;
    }
    
    this.spawnPoint = {
      gridX: spawnGridX,
      gridY: spawnGridY,
      x: spawnX,
      y: spawnY,
      edge: edge
    };
    
    console.log(`[MapGenerator] Spawn: ${edge} edge, Base: center (${centerX}, ${centerY})`);
  }
  
  /**
   * Pick item based on weights
   */
  _pickWeighted(weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let random = this.rng.float(0, total);
    
    for (const [key, weight] of Object.entries(weights)) {
      random -= weight;
      if (random <= 0) return key;
    }
    
    return Object.keys(weights)[0];
  }
  
  /**
   * Generate path from spawn edge to base in center
   * Only uses 90-degree angles (horizontal and vertical segments)
   * Multiple pattern strategies for variety
   */
  _generatePath() {
    this.waypoints = [];
    this.pathCells = [];
    
    // Get entry point on map edge
    const entry = this._getEntryPoint();
    
    // Base is in center
    const baseX = this.basePoint.gridX;
    const baseY = this.basePoint.gridY;
    
    // Pick a path pattern
    const pattern = this._pickWeighted(GENERATOR_CONFIG.PATTERN_WEIGHTS);
    console.log(`[MapGenerator] Using path pattern: ${pattern}`);
    
    // Generate control waypoints based on pattern
    let controlPoints;
    switch (pattern) {
      case 'spiral':
        controlPoints = this._generateSpiralPath(entry, baseX, baseY);
        break;
      case 'zigzag':
        controlPoints = this._generateZigzagPath(entry, baseX, baseY);
        break;
      case 'snake':
        controlPoints = this._generateSnakePath(entry, baseX, baseY);
        break;
      case 'corner':
        controlPoints = this._generateCornerPath(entry, baseX, baseY);
        break;
      default:
        controlPoints = this._generateZigzagPath(entry, baseX, baseY);
    }
    
    // Add spawn waypoint
    this.waypoints.push({
      x: this.spawnPoint.x,
      y: this.spawnPoint.y
    });
    
    // Connect all points with only horizontal/vertical lines
    const allPoints = [entry, ...controlPoints, { x: baseX, y: baseY }];
    const path = this._connectPointsOrthogonal(allPoints);
    
    // Add waypoints for rendering
    for (const cp of controlPoints) {
      this.waypoints.push({
        x: (cp.x + 0.5) * this.gridSize,
        y: (cp.y + 0.5) * this.gridSize
      });
    }
    
    // Add base waypoint
    this.waypoints.push({
      x: this.basePoint.x,
      y: this.basePoint.y
    });
    
    this.pathCells = path;
  }
  
  /**
   * Get entry point on map edge based on spawn
   */
  _getEntryPoint() {
    const margin = GENERATOR_CONFIG.PATH_MARGIN;
    const edge = this.spawnPoint.edge;
    
    switch (edge) {
      case 'left':
        return { x: 0, y: Math.max(margin, Math.min(this.height - margin - 1, this.spawnPoint.gridY)) };
      case 'right':
        return { x: this.width - 1, y: Math.max(margin, Math.min(this.height - margin - 1, this.spawnPoint.gridY)) };
      case 'top':
        return { x: Math.max(margin, Math.min(this.width - margin - 1, this.spawnPoint.gridX)), y: 0 };
      case 'bottom':
        return { x: Math.max(margin, Math.min(this.width - margin - 1, this.spawnPoint.gridX)), y: this.height - 1 };
    }
    return { x: 0, y: Math.floor(this.height / 2) };
  }
  
  /**
   * Generate spiral path towards center
   */
  _generateSpiralPath(entry, targetX, targetY) {
    const points = [];
    const margin = GENERATOR_CONFIG.PATH_MARGIN;
    const segMin = GENERATOR_CONFIG.PATH_SEGMENT_LENGTH_MIN;
    const segMax = GENERATOR_CONFIG.PATH_SEGMENT_LENGTH_MAX;
    
    let x = entry.x;
    let y = entry.y;
    
    // Determine initial direction based on entry edge
    const edge = this.spawnPoint.edge;
    let directions;
    
    if (edge === 'left') {
      directions = ['right', 'down', 'left', 'up']; // Clockwise from left
    } else if (edge === 'right') {
      directions = ['left', 'up', 'right', 'down']; // Counter-clockwise from right
    } else if (edge === 'top') {
      directions = ['down', 'left', 'up', 'right'];
    } else {
      directions = ['up', 'right', 'down', 'left'];
    }
    
    // Shrinking bounds for spiral
    let bounds = {
      minX: margin,
      maxX: this.width - margin - 1,
      minY: margin,
      maxY: this.height - margin - 1
    };
    
    const numSegments = this.rng.int(GENERATOR_CONFIG.PATH_SEGMENTS_MIN, GENERATOR_CONFIG.PATH_SEGMENTS_MAX);
    let dirIndex = 0;
    
    for (let i = 0; i < numSegments; i++) {
      const dir = directions[dirIndex % 4];
      let length = this.rng.int(segMin, segMax);
      
      // Calculate next point
      let nextX = x, nextY = y;
      
      switch (dir) {
        case 'right':
          nextX = Math.min(bounds.maxX, x + length);
          bounds.maxX = nextX - margin; // Shrink
          break;
        case 'left':
          nextX = Math.max(bounds.minX, x - length);
          bounds.minX = nextX + margin;
          break;
        case 'down':
          nextY = Math.min(bounds.maxY, y + length);
          bounds.maxY = nextY - margin;
          break;
        case 'up':
          nextY = Math.max(bounds.minY, y - length);
          bounds.minY = nextY + margin;
          break;
      }
      
      // Only add if we actually moved
      if (nextX !== x || nextY !== y) {
        points.push({ x: nextX, y: nextY });
        x = nextX;
        y = nextY;
      }
      
      dirIndex++;
      
      // Check if close enough to target
      if (Math.abs(x - targetX) < segMin && Math.abs(y - targetY) < segMin) {
        break;
      }
    }
    
    return points;
  }
  
  /**
   * Generate zigzag path towards center
   */
  _generateZigzagPath(entry, targetX, targetY) {
    const points = [];
    const margin = GENERATOR_CONFIG.PATH_MARGIN;
    const segMin = GENERATOR_CONFIG.PATH_SEGMENT_LENGTH_MIN;
    const segMax = GENERATOR_CONFIG.PATH_SEGMENT_LENGTH_MAX;
    
    let x = entry.x;
    let y = entry.y;
    
    const edge = this.spawnPoint.edge;
    const isHorizontalEntry = (edge === 'left' || edge === 'right');
    
    const numSegments = this.rng.int(GENERATOR_CONFIG.PATH_SEGMENTS_MIN, GENERATOR_CONFIG.PATH_SEGMENTS_MAX);
    let goingUp = this.rng.next() > 0.5;
    
    for (let i = 0; i < numSegments; i++) {
      let nextX = x, nextY = y;
      
      if (i % 2 === 0) {
        // Move towards target on primary axis
        if (isHorizontalEntry) {
          const dir = targetX > x ? 1 : -1;
          const maxMove = Math.abs(targetX - x);
          const move = Math.min(maxMove, this.rng.int(segMin, segMax));
          nextX = x + dir * move;
        } else {
          const dir = targetY > y ? 1 : -1;
          const maxMove = Math.abs(targetY - y);
          const move = Math.min(maxMove, this.rng.int(segMin, segMax));
          nextY = y + dir * move;
        }
      } else {
        // Zigzag perpendicular
        if (isHorizontalEntry) {
          const move = this.rng.int(segMin, segMax);
          if (goingUp) {
            nextY = Math.max(margin, y - move);
          } else {
            nextY = Math.min(this.height - margin - 1, y + move);
          }
          goingUp = !goingUp;
        } else {
          const move = this.rng.int(segMin, segMax);
          if (goingUp) {
            nextX = Math.max(margin, x - move);
          } else {
            nextX = Math.min(this.width - margin - 1, x + move);
          }
          goingUp = !goingUp;
        }
      }
      
      // Clamp to bounds
      nextX = Math.max(margin, Math.min(this.width - margin - 1, nextX));
      nextY = Math.max(margin, Math.min(this.height - margin - 1, nextY));
      
      if (nextX !== x || nextY !== y) {
        points.push({ x: nextX, y: nextY });
        x = nextX;
        y = nextY;
      }
      
      // Close enough to target
      if (Math.abs(x - targetX) < segMin && Math.abs(y - targetY) < segMin) {
        break;
      }
    }
    
    return points;
  }
  
  /**
   * Generate S-shaped snake path
   */
  _generateSnakePath(entry, targetX, targetY) {
    const points = [];
    const margin = GENERATOR_CONFIG.PATH_MARGIN;
    const segMin = GENERATOR_CONFIG.PATH_SEGMENT_LENGTH_MIN;
    const segMax = GENERATOR_CONFIG.PATH_SEGMENT_LENGTH_MAX;
    
    let x = entry.x;
    let y = entry.y;
    
    const edge = this.spawnPoint.edge;
    const isHorizontalEntry = (edge === 'left' || edge === 'right');
    
    // Snake goes to edges then curves back
    const numCurves = this.rng.int(2, 4);
    let goingToEdge = true;
    
    for (let curve = 0; curve < numCurves; curve++) {
      // First go perpendicular to edge
      let nextX = x, nextY = y;
      
      if (isHorizontalEntry) {
        // Go up or down to edge
        if (goingToEdge) {
          if (y < this.height / 2) {
            nextY = this.rng.int(margin, margin + segMax);
          } else {
            nextY = this.rng.int(this.height - margin - segMax - 1, this.height - margin - 1);
          }
        } else {
          // Go towards center Y
          nextY = Math.floor(this.height / 2) + this.rng.int(-segMin, segMin);
        }
        goingToEdge = !goingToEdge;
        
        nextY = Math.max(margin, Math.min(this.height - margin - 1, nextY));
        if (nextY !== y) {
          points.push({ x, y: nextY });
          y = nextY;
        }
        
        // Then move towards target X
        const dir = targetX > x ? 1 : -1;
        const move = this.rng.int(segMin, segMax);
        nextX = Math.max(margin, Math.min(this.width - margin - 1, x + dir * move));
        if (nextX !== x) {
          points.push({ x: nextX, y });
          x = nextX;
        }
      } else {
        // Vertical entry - similar but swap axes
        if (goingToEdge) {
          if (x < this.width / 2) {
            nextX = this.rng.int(margin, margin + segMax);
          } else {
            nextX = this.rng.int(this.width - margin - segMax - 1, this.width - margin - 1);
          }
        } else {
          nextX = Math.floor(this.width / 2) + this.rng.int(-segMin, segMin);
        }
        goingToEdge = !goingToEdge;
        
        nextX = Math.max(margin, Math.min(this.width - margin - 1, nextX));
        if (nextX !== x) {
          points.push({ x: nextX, y });
          x = nextX;
        }
        
        const dir = targetY > y ? 1 : -1;
        const move = this.rng.int(segMin, segMax);
        nextY = Math.max(margin, Math.min(this.height - margin - 1, y + dir * move));
        if (nextY !== y) {
          points.push({ x, y: nextY });
          y = nextY;
        }
      }
      
      // Close enough
      if (Math.abs(x - targetX) < segMin && Math.abs(y - targetY) < segMin) {
        break;
      }
    }
    
    return points;
  }
  
  /**
   * Generate corner/L-shaped path with multiple turns
   */
  _generateCornerPath(entry, targetX, targetY) {
    const points = [];
    const margin = GENERATOR_CONFIG.PATH_MARGIN;
    const segMin = GENERATOR_CONFIG.PATH_SEGMENT_LENGTH_MIN;
    const segMax = GENERATOR_CONFIG.PATH_SEGMENT_LENGTH_MAX;
    
    let x = entry.x;
    let y = entry.y;
    
    const numTurns = this.rng.int(GENERATOR_CONFIG.PATH_SEGMENTS_MIN, GENERATOR_CONFIG.PATH_SEGMENTS_MAX);
    let isHorizontal = (this.spawnPoint.edge === 'left' || this.spawnPoint.edge === 'right');
    
    for (let i = 0; i < numTurns; i++) {
      let nextX = x, nextY = y;
      
      if (isHorizontal) {
        // Move horizontally
        const dir = targetX > x ? 1 : -1;
        const maxMove = Math.abs(targetX - x);
        const move = Math.min(maxMove, this.rng.int(segMin, segMax));
        nextX = x + dir * move;
      } else {
        // Move vertically
        const dir = targetY > y ? 1 : -1;
        const maxMove = Math.abs(targetY - y);
        const move = Math.min(maxMove, this.rng.int(segMin, segMax));
        nextY = y + dir * move;
      }
      
      nextX = Math.max(margin, Math.min(this.width - margin - 1, nextX));
      nextY = Math.max(margin, Math.min(this.height - margin - 1, nextY));
      
      if (nextX !== x || nextY !== y) {
        points.push({ x: nextX, y: nextY });
        x = nextX;
        y = nextY;
      }
      
      isHorizontal = !isHorizontal;
      
      if (Math.abs(x - targetX) < 3 && Math.abs(y - targetY) < 3) {
        break;
      }
    }
    
    return points;
  }
  
  /**
   * Connect points with only horizontal and vertical lines (90-degree turns)
   */
  _connectPointsOrthogonal(points) {
    const path = [];
    const visited = new Set();
    
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      
      // Draw orthogonal path (first horizontal, then vertical OR vice versa)
      // Alternate to create variety
      const horizontalFirst = i % 2 === 0;
      
      const lineCells = horizontalFirst
        ? this._drawOrthogonalLine(start.x, start.y, end.x, end.y, true)
        : this._drawOrthogonalLine(start.x, start.y, end.x, end.y, false);
      
      for (const cell of lineCells) {
        const key = `${cell.x},${cell.y}`;
        if (!visited.has(key)) {
          path.push(cell);
          visited.add(key);
        }
      }
    }
    
    return path;
  }
  
  /**
   * Draw orthogonal line (only horizontal and vertical segments)
   */
  _drawOrthogonalLine(x0, y0, x1, y1, horizontalFirst = true) {
    const cells = [];
    
    if (horizontalFirst) {
      // First horizontal
      const stepX = x1 > x0 ? 1 : -1;
      for (let x = x0; x !== x1; x += stepX) {
        cells.push({ x, y: y0 });
      }
      // Then vertical
      const stepY = y1 > y0 ? 1 : -1;
      for (let y = y0; y !== y1; y += stepY) {
        cells.push({ x: x1, y });
      }
    } else {
      // First vertical
      const stepY = y1 > y0 ? 1 : -1;
      for (let y = y0; y !== y1; y += stepY) {
        cells.push({ x: x0, y });
      }
      // Then horizontal
      const stepX = x1 > x0 ? 1 : -1;
      for (let x = x0; x !== x1; x += stepX) {
        cells.push({ x, y: y1 });
      }
    }
    
    // Add final point
    cells.push({ x: x1, y: y1 });
    
    return cells;
  }
  
  /**
   * @deprecated - Kept for reference, not used
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
