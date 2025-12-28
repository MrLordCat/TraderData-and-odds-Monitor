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
  PATH_WIDTH: 3,                  // Path width in cells (3 = enemy walks in center)
  PATH_MARGIN: 8,                 // Minimum distance from map edges
  PATH_CLEARANCE: 2,              // Minimum cells between path segments (for tower placement)
  
  // Path complexity  
  PATH_SEGMENTS_MIN: 5,           // Minimum path segments
  PATH_SEGMENTS_MAX: 9,           // Maximum path segments
  PATH_SEGMENT_LENGTH_MIN: 12,    // Minimum segment length in cells
  PATH_SEGMENT_LENGTH_MAX: 35,    // Maximum segment length in cells
  
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
   * Ensures no self-intersection with PATH_CLEARANCE gap
   */
  _generatePath() {
    this.waypoints = [];
    this.pathCells = [];
    
    // Get entry point on map edge
    const entry = this._getEntryPoint();
    
    // Base is in center
    const baseX = this.basePoint.gridX;
    const baseY = this.basePoint.gridY;
    
    // Occupied zones map - tracks cells that path cannot cross
    // Each path cell blocks itself + clearance radius
    this.occupiedZones = new Set();
    
    // Generate path with collision avoidance
    const path = this._generateSafePath(entry.x, entry.y, baseX, baseY);
    
    if (path.length === 0) {
      console.warn('[MapGenerator] Failed to generate path, using fallback');
      // Fallback: direct L-shaped path
      const fallbackPath = this._generateFallbackPath(entry.x, entry.y, baseX, baseY);
      this.pathCells = fallbackPath;
    } else {
      this.pathCells = path;
    }
    
    // Build waypoints from path cells (direction changes)
    this._buildWaypointsFromPath();
    
    console.log(`[MapGenerator] Path generated: ${this.pathCells.length} cells, ${this.waypoints.length} waypoints`);
  }
  
  /**
   * Generate safe path that doesn't intersect itself
   * Uses iterative segment-by-segment approach
   */
  _generateSafePath(startX, startY, endX, endY) {
    const path = [];
    const margin = GENERATOR_CONFIG.PATH_MARGIN;
    
    // Generate mandatory waypoints that go AROUND the base before reaching it
    const waypoints = this._generateMandatoryWaypoints(startX, startY, endX, endY, margin);
    
    console.log(`[MapGenerator] Generated ${waypoints.length} mandatory waypoints:`, 
      waypoints.map((w, i) => `WP${i}: (${w.x},${w.y})`).join(' -> '));
    
    // Build path through ALL waypoints using simple orthogonal lines
    // NO collision detection - just draw the path
    let x = startX;
    let y = startY;
    
    // Add all waypoints plus the base as final destination
    const allTargets = [...waypoints, { x: endX, y: endY }];
    
    for (const target of allTargets) {
      const result = this._connectWithJitteredPath(path, x, y, target.x, target.y, margin);
      x = result.x;
      y = result.y;
    }
    
    console.log(`[MapGenerator] Path built: ${path.length} cells`);
    
    return path;
  }
  
  /**
   * Generate mandatory waypoints that force path to SPIRAL towards the base
   * Path goes around the base with organic, non-parallel curves
   * Uses 12 points per loop for smoother curves with large random offsets
   */
  _generateMandatoryWaypoints(startX, startY, baseX, baseY, margin) {
    const waypoints = [];
    const edge = this.spawnPoint.edge;
    
    // Determine how many points to visit (more points = smoother spiral)
    // Each "loop" has ~12 points for very smooth curves
    const roll = this.rng.next();
    let totalPoints;
    if (roll < 0.15) {
      // 15% chance: partial loop
      totalPoints = this.rng.int(8, 10);
    } else if (roll < 0.45) {
      // 30% chance: ~1 loop
      totalPoints = this.rng.int(11, 14);
    } else if (roll < 0.80) {
      // 35% chance: ~1.5-2 loops  
      totalPoints = this.rng.int(16, 22);
    } else {
      // 20% chance: 2-3 loops (longest path)
      totalPoints = this.rng.int(24, 32);
    }
    
    console.log(`[MapGenerator] Spiral will visit ${totalPoints} points`);
    
    // Start radius - further for more points
    const loops = totalPoints / 12;
    const startRadius = 22 + (loops * 14) + this.rng.int(-3, 6);
    const endRadius = 5;
    
    // Calculate shrink per point
    const radiusShrink = (startRadius - endRadius) / totalPoints;
    
    // Determine starting angle based on spawn edge
    let startAngle;
    if (edge === 'top') {
      startAngle = startX < baseX ? Math.PI * 1.25 : Math.PI * 1.75;
    } else if (edge === 'bottom') {
      startAngle = startX < baseX ? Math.PI * 0.75 : Math.PI * 0.25;
    } else if (edge === 'left') {
      startAngle = startY < baseY ? Math.PI * 1.0 : Math.PI * 1.5;
    } else {
      startAngle = startY < baseY ? Math.PI * 0.0 : Math.PI * 0.5;
    }
    
    // Direction: clockwise or counter-clockwise
    const clockwise = this.rng.next() > 0.5;
    // 12 points per full circle for smoother curves
    const angleStep = (Math.PI * 2 / 12) * (clockwise ? 1 : -1);
    
    let angle = startAngle;
    let radius = startRadius;
    
    // Track previous point to ensure minimum distance
    let prevX = startX;
    let prevY = startY;
    
    // Generate spiral points
    for (let i = 0; i < totalPoints; i++) {
      // LARGE randomness for organic, non-parallel paths
      // Angle wobble increases as we go inward (more chaotic near center)
      const wobbleFactor = 1 + (i / totalPoints) * 0.5;
      const angleOffset = this.rng.float(-0.5, 0.5) * wobbleFactor;
      
      // Radius wobble - significant variation
      const radiusOffset = this.rng.float(-6, 6);
      
      const actualAngle = angle + angleOffset;
      const actualRadius = Math.max(endRadius, radius + radiusOffset);
      
      // Convert polar to cartesian
      let x = baseX + Math.cos(actualAngle) * actualRadius;
      let y = baseY + Math.sin(actualAngle) * actualRadius;
      
      // Add extra perpendicular offset to break parallel lines
      const perpAngle = actualAngle + Math.PI / 2;
      const perpOffset = this.rng.float(-5, 5);
      x += Math.cos(perpAngle) * perpOffset;
      y += Math.sin(perpAngle) * perpOffset;
      
      // Clamp to bounds
      const clampedX = this._clamp(Math.round(x), margin, this.width - margin - 1);
      const clampedY = this._clamp(Math.round(y), margin, this.height - margin - 1);
      
      // Only add if not too close to previous point (avoid bunching)
      const distToPrev = Math.abs(clampedX - prevX) + Math.abs(clampedY - prevY);
      if (distToPrev > 6) {
        waypoints.push({ x: clampedX, y: clampedY });
        prevX = clampedX;
        prevY = clampedY;
      }
      
      // Move to next position
      angle += angleStep;
      radius -= radiusShrink;
    }
    
    // Final approach waypoint near base
    const approachAngle = angle + this.rng.float(-0.8, 0.8);
    const approachX = baseX + Math.cos(approachAngle) * 4;
    const approachY = baseY + Math.sin(approachAngle) * 4;
    waypoints.push({ 
      x: this._clamp(Math.round(approachX), margin, this.width - margin - 1),
      y: this._clamp(Math.round(approachY), margin, this.height - margin - 1)
    });
    
    return waypoints;
  }

  /**
   * Connect current point to target using jittered Manhattan steps
   * Breaks long parallel lines by inserting small detours
   */
  _connectWithJitteredPath(path, startX, startY, targetX, targetY, margin) {
    let x = startX;
    let y = startY;

    const totalDist = Math.abs(targetX - x) + Math.abs(targetY - y);
    if (totalDist === 0) return { x, y };

    // Number of intermediate steps based on distance (more distance -> more bends)
    const steps = Math.max(2, Math.min(8, Math.floor(totalDist / 14)));

    // Occupancy for clearance checks
    const occupied = new Set(path.map(p => `${p.x},${p.y}`));
    const clearance = 2;
    const minBendLen = 6;

    const lineHasClearance = (x1, y1, x2, y2) => {
      const cells = this._getLineCells(x1, y1, x2, y2);
      for (const c of cells) {
        for (let dy = -clearance; dy <= clearance; dy++) {
          for (let dx = -clearance; dx <= clearance; dx++) {
            const key = `${c.x + dx},${c.y + dy}`;
            if (occupied.has(key)) {
              if (!(c.x + dx === x && c.y + dy === y)) return false;
            }
          }
        }
      }
      return true;
    };

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      let midX = Math.round(x + (targetX - x) * t);
      let midY = Math.round(y + (targetY - y) * t);

      const dx = Math.abs(targetX - x);
      const dy = Math.abs(targetY - y);
      const horizontalMain = dx >= dy;

      let attempt = 0;
      let placed = false;
      while (attempt < 4 && !placed) {
        const jitter = this.rng.int(-4 + attempt, 4 - attempt); // reduce on retries
        let jMidX = midX;
        let jMidY = midY;
        if (horizontalMain) {
          jMidY = this._clamp(midY + jitter, margin, this.height - margin - 1);
        } else {
          jMidX = this._clamp(midX + jitter, margin, this.width - margin - 1);
        }

        // ensure bend length
        if (Math.abs(jMidX - x) + Math.abs(jMidY - y) < minBendLen) {
          if (horizontalMain) {
            const dir = targetX > x ? 1 : -1;
            jMidX = this._clamp(x + dir * minBendLen, margin, this.width - margin - 1);
          } else {
            const dir = targetY > y ? 1 : -1;
            jMidY = this._clamp(y + dir * minBendLen, margin, this.height - margin - 1);
          }
        }

        const first = horizontalMain ? [x, y, jMidX, y] : [x, y, x, jMidY];
        const second = horizontalMain ? [jMidX, y, jMidX, jMidY] : [x, jMidY, jMidX, jMidY];

        if (lineHasClearance(...first) && lineHasClearance(...second)) {
          const horizontalFirst = this.rng.next() > 0.5;

          if (horizontalFirst) {
            if (x !== jMidX && lineHasClearance(x, y, jMidX, y)) {
              this._pushLineNoDup(path, x, y, jMidX, y);
              this._getLineCells(x, y, jMidX, y).forEach(c => occupied.add(`${c.x},${c.y}`));
              x = jMidX;
            }
            if (y !== jMidY && lineHasClearance(x, y, x, jMidY)) {
              this._pushLineNoDup(path, x, y, x, jMidY);
              this._getLineCells(x, y, x, jMidY).forEach(c => occupied.add(`${c.x},${c.y}`));
              y = jMidY;
            }
          } else {
            if (y !== jMidY && lineHasClearance(x, y, x, jMidY)) {
              this._pushLineNoDup(path, x, y, x, jMidY);
              this._getLineCells(x, y, x, jMidY).forEach(c => occupied.add(`${c.x},${c.y}`));
              y = jMidY;
            }
            if (x !== jMidX && lineHasClearance(x, y, jMidX, y)) {
              this._pushLineNoDup(path, x, y, jMidX, y);
              this._getLineCells(x, y, jMidX, y).forEach(c => occupied.add(`${c.x},${c.y}`));
              x = jMidX;
            }
          }
          placed = true;
        }
        attempt++;
      }
    }

    // Final snap to target with clearance
    if (x !== targetX && lineHasClearance(x, y, targetX, y)) {
      this._pushLineNoDup(path, x, y, targetX, y);
      this._getLineCells(x, y, targetX, y).forEach(c => occupied.add(`${c.x},${c.y}`));
      x = targetX;
    }
    if (y !== targetY && lineHasClearance(x, y, x, targetY)) {
      this._pushLineNoDup(path, x, y, x, targetY);
      this._getLineCells(x, y, x, targetY).forEach(c => occupied.add(`${c.x},${c.y}`));
      y = targetY;
    }

    return { x, y };
  }
  
  /**
   * Get corner position at given radius from base
   */
  _getCornerPosition(corner, baseX, baseY, radius, margin) {
    let x, y;
    
    switch (corner) {
      case 'topLeft':
        x = baseX - radius;
        y = baseY - radius;
        break;
      case 'topRight':
        x = baseX + radius;
        y = baseY - radius;
        break;
      case 'bottomRight':
        x = baseX + radius;
        y = baseY + radius;
        break;
      case 'bottomLeft':
        x = baseX - radius;
        y = baseY + radius;
        break;
    }
    
    // Add some randomness to make it less perfect
    x += this.rng.int(-3, 3);
    y += this.rng.int(-3, 3);
    
    return {
      x: this._clamp(x, margin, this.width - margin - 1),
      y: this._clamp(y, margin, this.height - margin - 1)
    };
  }
  
  /**
   * Navigate from current position to target waypoint using orthogonal moves
   */
  _navigateToPoint(path, startX, startY, targetX, targetY, margin, clearance) {
    const segMin = GENERATOR_CONFIG.PATH_SEGMENT_LENGTH_MIN;
    const segMax = GENERATOR_CONFIG.PATH_SEGMENT_LENGTH_MAX;
    
    let x = startX;
    let y = startY;
    let isHorizontal = this.rng.next() > 0.5;
    let iterations = 0;
    const maxIterations = 20;
    
    while ((Math.abs(x - targetX) > 2 || Math.abs(y - targetY) > 2) && iterations < maxIterations) {
      iterations++;
      
      const distX = Math.abs(x - targetX);
      const distY = Math.abs(y - targetY);
      
      // Prefer direction that has more distance to cover
      if (distX > distY + 5) {
        isHorizontal = true;
      } else if (distY > distX + 5) {
        isHorizontal = false;
      }
      
      const segLen = this.rng.int(segMin, Math.min(segMax, Math.max(distX, distY)));
      let moved = false;
      
      if (isHorizontal && distX > 0) {
        const dir = targetX > x ? 1 : -1;
        const nextX = this._findSafeEndpoint(x, y, dir, Math.min(segLen, distX), true, margin);
        
        if (nextX !== x && this._canDrawSegment(x, y, nextX, y, clearance)) {
          this._addPathSegment(path, x, y, nextX, y);
          x = nextX;
          moved = true;
        }
      }
      
      if (!moved && distY > 0) {
        const dir = targetY > y ? 1 : -1;
        const nextY = this._findSafeEndpoint(x, y, dir, Math.min(segLen, distY), false, margin);
        
        if (nextY !== y && this._canDrawSegment(x, y, x, nextY, clearance)) {
          this._addPathSegment(path, x, y, x, nextY);
          y = nextY;
          moved = true;
        }
      }
      
      // If couldn't move in preferred direction, try the other
      if (!moved) {
        if (!isHorizontal && distX > 0) {
          const dir = targetX > x ? 1 : -1;
          const nextX = this._findSafeEndpoint(x, y, dir, Math.min(segLen, distX), true, margin);
          
          if (nextX !== x && this._canDrawSegment(x, y, nextX, y, clearance)) {
            this._addPathSegment(path, x, y, nextX, y);
            x = nextX;
            moved = true;
          }
        }
        
        if (!moved && isHorizontal && distY > 0) {
          const dir = targetY > y ? 1 : -1;
          const nextY = this._findSafeEndpoint(x, y, dir, Math.min(segLen, distY), false, margin);
          
          if (nextY !== y && this._canDrawSegment(x, y, x, nextY, clearance)) {
            this._addPathSegment(path, x, y, x, nextY);
            y = nextY;
            moved = true;
          }
        }
      }
      
      // If still stuck, try escape
      if (!moved) {
        const escaped = this._tryEscapeStuck(path, x, y, targetX, targetY, 8, margin, clearance);
        if (escaped) {
          x = escaped.x;
          y = escaped.y;
        } else {
          break; // Give up on this waypoint
        }
      }
      
      isHorizontal = !isHorizontal;
    }
    
    return { x, y };
  }
  
  /**
   * Clamp value between min and max
   */
  _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  
  /**
   * Get primary direction towards target
   */
  _getPrimaryDirection(x, y, endX, endY, isHorizontal) {
    if (isHorizontal) {
      return endX > x ? 1 : -1;
    }
    return endY > y ? 1 : -1;
  }
  
  /**
   * Get best horizontal direction
   */
  _getBestHorizontalDir(x, endX) {
    return endX > x ? 1 : -1;
  }
  
  /**
   * Get best vertical direction
   */
  _getBestVerticalDir(y, endY) {
    return endY > y ? 1 : -1;
  }
  
  /**
   * Find safe endpoint for segment that doesn't cross occupied zones
   */
  _findSafeEndpoint(x, y, dir, maxLen, isHorizontal, margin) {
    const clearance = GENERATOR_CONFIG.PATH_CLEARANCE;
    let bestEnd = isHorizontal ? x : y;
    
    for (let len = 1; len <= maxLen; len++) {
      let testX = isHorizontal ? x + dir * len : x;
      let testY = isHorizontal ? y : y + dir * len;
      
      // Check bounds
      if (testX < margin || testX >= this.width - margin ||
          testY < margin || testY >= this.height - margin) {
        break;
      }
      
      // Check if this cell and its clearance zone is free
      if (this._isCellBlocked(testX, testY, clearance)) {
        break;
      }
      
      bestEnd = isHorizontal ? testX : testY;
    }
    
    return bestEnd;
  }
  
  /**
   * Check if cell is blocked by existing path
   */
  _isCellBlocked(x, y, clearance) {
    for (let dy = -clearance; dy <= clearance; dy++) {
      for (let dx = -clearance; dx <= clearance; dx++) {
        if (this.occupiedZones.has(`${x + dx},${y + dy}`)) {
          return true;
        }
      }
    }
    return false;
  }
  
  /**
   * Check if we can draw segment without crossing occupied zones
   */
  _canDrawSegment(x1, y1, x2, y2, clearance) {
    const cells = this._getLineCells(x1, y1, x2, y2);
    
    for (const cell of cells) {
      // Check clearance zone around each cell
      for (let dy = -clearance; dy <= clearance; dy++) {
        for (let dx = -clearance; dx <= clearance; dx++) {
          const key = `${cell.x + dx},${cell.y + dy}`;
          if (this.occupiedZones.has(key)) {
            // Check if it's our own recently added cells (allow continuation)
            const isOwnCell = (cell.x + dx === x1 && cell.y + dy === y1);
            if (!isOwnCell) {
              return false;
            }
          }
        }
      }
    }
    
    return true;
  }
  
  /**
   * Add path segment and mark occupied zones
   */
  _addPathSegment(path, x1, y1, x2, y2) {
    const cells = this._getLineCells(x1, y1, x2, y2);
    const clearance = GENERATOR_CONFIG.PATH_CLEARANCE;
    
    for (const cell of cells) {
      path.push(cell);
      
      // Mark occupied zone (cell + clearance)
      for (let dy = -clearance; dy <= clearance; dy++) {
        for (let dx = -clearance; dx <= clearance; dx++) {
          this.occupiedZones.add(`${cell.x + dx},${cell.y + dy}`);
        }
      }
    }
  }
  
  /**
   * Get cells along a horizontal or vertical line
   */
  _getLineCells(x1, y1, x2, y2) {
    const cells = [];
    
    if (x1 === x2) {
      // Vertical line
      const step = y2 > y1 ? 1 : -1;
      for (let y = y1; y !== y2 + step; y += step) {
        cells.push({ x: x1, y });
      }
    } else {
      // Horizontal line
      const step = x2 > x1 ? 1 : -1;
      for (let x = x1; x !== x2 + step; x += step) {
        cells.push({ x, y: y1 });
      }
    }
    
    return cells;
  }

  /**
   * Push line cells into path without duplicates
   */
  _pushLineNoDup(path, x1, y1, x2, y2) {
    const cells = this._getLineCells(x1, y1, x2, y2);
    for (const cell of cells) {
      if (!path.some(p => p.x === cell.x && p.y === cell.y)) {
        path.push(cell);
      }
    }
  }
  
  /**
   * Try to escape stuck situation
   */
  _tryEscapeStuck(path, x, y, endX, endY, segLen, margin, clearance) {
    // Try all 4 directions with shorter segments
    const directions = [
      { dx: 1, dy: 0 },   // right
      { dx: -1, dy: 0 },  // left
      { dx: 0, dy: 1 },   // down
      { dx: 0, dy: -1 }   // up
    ];
    
    // Shuffle for variety
    this.rng.shuffle(directions);
    
    for (const dir of directions) {
      const isHorizontal = dir.dx !== 0;
      
      for (let len = segLen; len >= 4; len -= 2) {
        const nextX = x + dir.dx * len;
        const nextY = y + dir.dy * len;
        
        // Check bounds
        if (nextX < margin || nextX >= this.width - margin ||
            nextY < margin || nextY >= this.height - margin) {
          continue;
        }
        
        // Check if segment is valid
        if (isHorizontal) {
          if (this._canDrawSegment(x, y, nextX, y, clearance)) {
            this._addPathSegment(path, x, y, nextX, y);
            return { x: nextX, y };
          }
        } else {
          if (this._canDrawSegment(x, y, x, nextY, clearance)) {
            this._addPathSegment(path, x, y, x, nextY);
            return { x, y: nextY };
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Connect current position to base with L-shaped path
   */
  _connectToBase(path, x, y, endX, endY) {
    // Clear occupied zones near base for final connection
    const clearance = GENERATOR_CONFIG.PATH_CLEARANCE;
    
    // First move horizontally to align X
    if (x !== endX) {
      const cells = this._getLineCells(x, y, endX, y);
      for (const cell of cells) {
        path.push(cell);
      }
      x = endX;
    }
    
    // Then move vertically to base
    if (y !== endY) {
      const cells = this._getLineCells(x, y, x, endY);
      for (const cell of cells) {
        path.push(cell);
      }
    }
  }
  
  /**
   * Generate simple fallback L-shaped path
   */
  _generateFallbackPath(startX, startY, endX, endY) {
    const path = [];
    
    // Horizontal first
    const hCells = this._getLineCells(startX, startY, endX, startY);
    for (const cell of hCells) {
      path.push(cell);
    }
    
    // Then vertical
    if (startY !== endY) {
      const vCells = this._getLineCells(endX, startY, endX, endY);
      // Skip first cell (already added)
      for (let i = 1; i < vCells.length; i++) {
        path.push(vCells[i]);
      }
    }
    
    return path;
  }
  
  /**
   * Build waypoints from path cells (extract direction changes)
   */
  _buildWaypointsFromPath() {
    if (this.pathCells.length === 0) return;
    
    // Add spawn waypoint
    this.waypoints.push({
      x: this.spawnPoint.x,
      y: this.spawnPoint.y
    });
    
    // Add first path cell
    const first = this.pathCells[0];
    this.waypoints.push({
      x: (first.x + 0.5) * this.gridSize,
      y: (first.y + 0.5) * this.gridSize
    });
    
    // Find direction changes
    if (this.pathCells.length > 2) {
      let lastDx = this.pathCells[1].x - this.pathCells[0].x;
      let lastDy = this.pathCells[1].y - this.pathCells[0].y;
      
      for (let i = 2; i < this.pathCells.length; i++) {
        const dx = this.pathCells[i].x - this.pathCells[i-1].x;
        const dy = this.pathCells[i].y - this.pathCells[i-1].y;
        
        if (dx !== lastDx || dy !== lastDy) {
          // Direction changed - add waypoint at turn
          const turn = this.pathCells[i-1];
          this.waypoints.push({
            x: (turn.x + 0.5) * this.gridSize,
            y: (turn.y + 0.5) * this.gridSize
          });
          lastDx = dx;
          lastDy = dy;
        }
      }
    }
    
    // Add base waypoint
    this.waypoints.push({
      x: this.basePoint.x,
      y: this.basePoint.y
    });
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
