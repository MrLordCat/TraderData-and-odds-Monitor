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
 * 
 * Dependencies extracted to separate modules:
 * - seeded-random.js - Random number generator
 * - noise-generator.js - Value noise generator
 * - generator-config.js - Configuration constants
 */

const { SeededRandom } = require('./seeded-random');
const { NoiseGenerator } = require('./noise-generator');
const { GENERATOR_CONFIG } = require('./generator-config');

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
    
    // Step 3: Generate path - USE STATIC SPIRAL PATH
    this._generateSpiralPath();
    
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
   * Generate static spiral path from edge to center
   * Replaces procedural path generation for reliability
   * Only 2 loops for cleaner gameplay
   */
  _generateSpiralPath() {
    this.waypoints = [];
    this.pathCells = [];
    
    const centerX = Math.floor(this.width / 2);
    const centerY = Math.floor(this.height / 2);
    const gridSize = this.gridSize;
    
    const points = [];
    const margin = 4;
    const shrink = 10; // Сужение на каждом повороте
    
    // Starting bounds
    let left = margin;
    let right = this.width - margin - 1;
    let top = margin;
    let bottom = this.height - margin - 1;
    
    // Entry - top left
    points.push({ x: left, y: -1 });  // Spawn outside
    points.push({ x: left, y: top }); // Enter map
    
    // Loop 1 - outer
    points.push({ x: left, y: bottom });         // Down
    left += shrink;
    points.push({ x: right, y: bottom });        // Right
    bottom -= shrink;
    points.push({ x: right, y: top });           // Up
    right -= shrink;
    points.push({ x: left, y: top });            // Left (turn in)
    top += shrink;
    
    // Loop 2 - inner
    points.push({ x: left, y: bottom });         // Down
    left += shrink;
    points.push({ x: right, y: bottom });        // Right
    bottom -= shrink;
    points.push({ x: right, y: top });           // Up
    
    // Final - to center
    points.push({ x: centerX, y: top });         // Horizontal to center
    points.push({ x: centerX, y: centerY });     // Down to base
    
    // Convert to world coordinates
    this.waypoints = points.map(p => ({
      x: p.x * gridSize + gridSize / 2,
      y: p.y * gridSize + gridSize / 2
    }));
    
    // Generate path cells
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i];
      const to = points[i + 1];
      const cells = this._getLineCells(from.x, from.y, to.x, to.y);
      for (const cell of cells) {
        if (!this.pathCells.some(c => c.x === cell.x && c.y === cell.y)) {
          this.pathCells.push(cell);
        }
      }
    }
    
    // Set spawn and base
    this.spawnPoint = {
      gridX: points[0].x,
      gridY: points[0].y,
      worldX: this.waypoints[0].x,
      worldY: this.waypoints[0].y
    };
    
    this.basePoint = {
      gridX: centerX,
      gridY: centerY,
      worldX: centerX * gridSize + gridSize / 2,
      worldY: centerY * gridSize + gridSize / 2
    };
    
    console.log(`[MapGenerator] Spiral: ${this.pathCells.length} cells, ${this.waypoints.length} waypoints`);
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
    
    // Helper to pick spawn position avoiding center of edge
    // Pick from first 30% or last 30% of edge (avoiding middle 40%)
    const pickEdgePosition = (edgeLength) => {
      const zoneSize = Math.floor(edgeLength * 0.30);
      const useFirstZone = this.rng.next() < 0.5;
      if (useFirstZone) {
        return this.rng.int(margin, margin + zoneSize);
      } else {
        return this.rng.int(edgeLength - margin - zoneSize, edgeLength - margin - 1);
      }
    };
    
    switch (edge) {
      case 'left':
        spawnGridX = -1;
        spawnGridY = pickEdgePosition(this.height);
        spawnX = -this.gridSize;
        spawnY = (spawnGridY + 0.5) * this.gridSize;
        break;
      case 'right':
        spawnGridX = this.width;
        spawnGridY = pickEdgePosition(this.height);
        spawnX = (this.width + 0.5) * this.gridSize;
        spawnY = (spawnGridY + 0.5) * this.gridSize;
        break;
      case 'top':
        spawnGridX = pickEdgePosition(this.width);
        spawnGridY = -1;
        spawnX = (spawnGridX + 0.5) * this.gridSize;
        spawnY = -this.gridSize;
        break;
      case 'bottom':
        spawnGridX = pickEdgePosition(this.width);
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
   * Generate safe path using Segment-Walker approach
   * Builds path segment by segment with dynamic bounds shrinking
   */
  _generateSafePath(startX, startY, endX, endY) {
    const margin = GENERATOR_CONFIG.PATH_MARGIN;
    const CLEARANCE = 2;
    const MIN_SEGMENT = 10; // Reduced for more flexibility
    const MAX_SEGMENT = 15;
    const FIRST_SEGMENT_MIN = 20; // Minimum first segment into the map
    
    console.log(`[MapGenerator] Starting Segment-Walker from (${startX},${startY}) to base (${endX},${endY})`);
    
    // Initialize path and tracking
    const path = [];
    const occupied = new Set();
    
    // Dynamic bounds - include full map area for path drawing
    // We use soft bounds for collision, not hard bounds
    const initialBounds = {
      left: margin,
      right: this.width - margin - 1,
      top: margin,
      bottom: this.height - margin - 1
    };
    const initialWidth = initialBounds.right - initialBounds.left;
    const initialHeight = initialBounds.bottom - initialBounds.top;
    
    let bounds = { ...initialBounds };
    let shrinkStep = 0;
    
    // Mark cell as occupied with clearance
    const markOccupied = (x, y) => {
      for (let dy = -CLEARANCE; dy <= CLEARANCE; dy++) {
        for (let dx = -CLEARANCE; dx <= CLEARANCE; dx++) {
          occupied.add(`${x + dx},${y + dy}`);
        }
      }
    };
    
    // Check if cell is free (for collision detection only, not bounds)
    // currentPos is used to allow cells near the turn point
    const isFree = (cellX, cellY, currentX, currentY) => {
      // Allow cells outside bounds but within map (for spawn connection)
      if (cellX < 0 || cellX >= this.width || cellY < 0 || cellY >= this.height) {
        return false;
      }
      
      // Allow cells within CLEARANCE of current position (for turns)
      const distFromCurrent = Math.abs(cellX - currentX) + Math.abs(cellY - currentY);
      if (distFromCurrent <= CLEARANCE + 1) {
        return true;
      }
      
      return !occupied.has(`${cellX},${cellY}`);
    };
    
    // Check if cell is within shrinking bounds (for direction choice)
    const isInBounds = (x, y) => {
      return x >= bounds.left && x <= bounds.right &&
             y >= bounds.top && y <= bounds.bottom;
    };
    
    // Check if line segment is free from collisions
    // startX, startY = current position (used to allow cells near turn point)
    const canDrawLine = (x1, y1, x2, y2, debug = false) => {
      const cells = this._getLineCells(x1, y1, x2, y2);
      for (let i = 1; i < cells.length; i++) {
        if (!isFree(cells[i].x, cells[i].y, x1, y1)) {
          if (debug) {
            console.log(`[MapGenerator] canDrawLine BLOCKED at cell (${cells[i].x},${cells[i].y}), i=${i}/${cells.length}`);
          }
          return false;
        }
      }
      return true;
    };
    
    // Add line to path
    const addLine = (x1, y1, x2, y2) => {
      const cells = this._getLineCells(x1, y1, x2, y2);
      for (const c of cells) {
        if (!path.some(p => p.x === c.x && p.y === c.y)) {
          path.push(c);
          markOccupied(c.x, c.y);
        }
      }
    };
    
    // Start position
    let x = startX;
    let y = startY;
    path.push({ x, y });
    markOccupied(x, y);
    
    // Determine initial direction (from edge inward)
    let currentDir = this._getInitialDirection(startX, startY);
    console.log(`[MapGenerator] Initial direction: ${currentDir}`);
    
    // === MANDATORY FIRST SEGMENT: Go straight into the map ===
    const firstSegmentLength = this.rng.int(FIRST_SEGMENT_MIN, FIRST_SEGMENT_MIN + 20);
    const { endPt: firstEnd } = this._calcSegmentEndpoint(currentDir, x, y, firstSegmentLength, {
      left: 0, right: this.width - 1, top: 0, bottom: this.height - 1
    });
    
    console.log(`[MapGenerator] First mandatory segment: ${currentDir} for ${firstSegmentLength} cells to (${firstEnd.x},${firstEnd.y})`);
    addLine(x, y, firstEnd.x, firstEnd.y);
    x = firstEnd.x;
    y = firstEnd.y;
    let totalPathLength = firstSegmentLength;
    
    // Track last turn and base side for probability adjustment
    let lastTurnToBase = false;
    let prevBaseSide = this._getBaseSide(currentDir, x, y, endX, endY);
    
    // Segment history for rollback
    const segmentHistory = []; // Each entry: { x, y, pathLength, boundsSnapshot, shrinkStep }
    let consecutiveRollbacks = 0; // Track consecutive rollbacks to increase depth
    let lastRollbackPos = null; // Track last rollback position
    
    // Main loop - max 30 iterations
    const mapSize = Math.min(this.width, this.height);
    const finishThreshold = mapSize * 0.20; // 20% of map size (~20 cells on 100x100 map)
    let iterations = 0;
    const maxIterations = 30;
    // totalPathLength already initialized above with first segment
    const minTotalPathLength = mapSize * 1.2; // Path should be at least 1.2x map size
    
    while (iterations < maxIterations) {
      iterations++;
      
      const distToBase = Math.abs(x - endX) + Math.abs(y - endY);
      console.log(`[MapGenerator] Iter ${iterations}: pos=(${x},${y}), distToBase=${distToBase}, totalLen=${totalPathLength}, shrink=${shrinkStep}`);
      
      // Check if close enough to base AND path is long enough - finish with direct path
      if (distToBase <= finishThreshold && totalPathLength >= minTotalPathLength) {
        console.log(`[MapGenerator] Close to base and path long enough, finishing directly`);
        this._finishPathToBase(x, y, endX, endY, path, addLine, canDrawLine);
        break;
      }
      
      // Force continue if path is too short even if close to base
      if (distToBase <= finishThreshold && totalPathLength < minTotalPathLength) {
        console.log(`[MapGenerator] Close to base but path too short (${totalPathLength}/${minTotalPathLength}), continuing`);
      }
      
      // Save state for potential rollback
      segmentHistory.push({
        x, y,
        pathLength: path.length,
        totalPathLength,
        bounds: { ...bounds },
        shrinkStep,
        currentDir,
        lastTurnToBase,
        prevBaseSide
      });
      
      // Get current base side
      const baseSide = this._getBaseSide(currentDir, x, y, endX, endY);
      
      // Check if base side changed to opposite - shrink bounds
      if (this._isOppositeSide(prevBaseSide, baseSide)) {
        shrinkStep++;
        const shrinkAmount = shrinkStep * 0.10;
        bounds = {
          left: initialBounds.left + Math.floor(shrinkAmount * initialWidth / 2),
          right: initialBounds.right - Math.floor(shrinkAmount * initialWidth / 2),
          top: initialBounds.top + Math.floor(shrinkAmount * initialHeight / 2),
          bottom: initialBounds.bottom - Math.floor(shrinkAmount * initialHeight / 2)
        };
        console.log(`[MapGenerator] Base side changed ${prevBaseSide}->${baseSide}, shrink to ${shrinkStep * 10}%`);
      }
      prevBaseSide = baseSide;
      
      // Check if we can still go toward edge (for probability adjustment)
      const canGoToEdge = this._canGoToEdge(currentDir, x, y, bounds, MIN_SEGMENT);
      
      // If close to base and path is reasonably long, force direction toward base
      const closeToBase = distToBase < 25;
      const pathReasonablyLong = totalPathLength >= minTotalPathLength * 0.8;
      const forceTowardBase = closeToBase && pathReasonablyLong;
      
      // Choose next direction
      const nextDir = forceTowardBase 
        ? this._getDirectionTowardBase(currentDir, x, y, endX, endY)
        : this._chooseNextDirection(currentDir, baseSide, lastTurnToBase, canGoToEdge, this.rng);
      
      // Calculate segment length
      const segmentLength = this._calcSegmentLength(nextDir, x, y, bounds, endX, endY, MIN_SEGMENT, MAX_SEGMENT, this.rng);
      
      console.log(`[MapGenerator] Trying dir=${nextDir}, segmentLength=${segmentLength}`);
      
      if (segmentLength < MIN_SEGMENT) {
        console.log(`[MapGenerator] Segment too short (${segmentLength}), trying other directions`);
        
        // Try other available directions
        const tried = new Set([nextDir]);
        let found = false;
        
        for (const tryDir of [this._getTurnLeft(currentDir), this._getTurnRight(currentDir), currentDir]) {
          if (tried.has(tryDir)) continue;
          tried.add(tryDir);
          
          const tryLength = this._calcSegmentLength(tryDir, x, y, bounds, endX, endY, MIN_SEGMENT, MAX_SEGMENT, this.rng);
          if (tryLength >= MIN_SEGMENT) {
            const { endPt: tryEnd, actualLength: tryActual } = this._calcSegmentEndpoint(tryDir, x, y, tryLength, bounds);
            if (canDrawLine(x, y, tryEnd.x, tryEnd.y)) {
              addLine(x, y, tryEnd.x, tryEnd.y);
              totalPathLength += tryActual;
              x = tryEnd.x;
              y = tryEnd.y;
              currentDir = tryDir;
              found = true;
              console.log(`[MapGenerator] Found alternate: ${tryDir} to (${x},${y}), len=${tryActual}`);
              break;
            }
          }
        }
        
        if (!found) {
          // Progressive rollback - increase depth if stuck in same area
          if (lastRollbackPos && Math.abs(x - lastRollbackPos.x) < 10 && Math.abs(y - lastRollbackPos.y) < 10) {
            consecutiveRollbacks++;
          } else {
            consecutiveRollbacks = 1;
          }
          lastRollbackPos = { x, y };
          
          // Try rollback with progressive depth
          const recovered = this._tryRollback(segmentHistory, path, occupied, CLEARANCE, consecutiveRollbacks);
          if (recovered) {
            x = recovered.x;
            y = recovered.y;
            bounds = recovered.bounds;
            shrinkStep = recovered.shrinkStep;
            currentDir = recovered.currentDir;
            lastTurnToBase = recovered.lastTurnToBase;
            prevBaseSide = recovered.prevBaseSide;
            totalPathLength = recovered.totalPathLength;
            console.log(`[MapGenerator] Rolled back to (${x},${y}), totalLen=${totalPathLength}`);
            continue;
          } else {
            console.log(`[MapGenerator] Rollback failed, finishing`);
            break;
          }
        }
        continue;
      }
      
      // Calculate end point
      const { endPt, actualLength } = this._calcSegmentEndpoint(nextDir, x, y, segmentLength, bounds);
      
      console.log(`[MapGenerator] Trying to draw from (${x},${y}) to (${endPt.x},${endPt.y})`);
      
      // Try to draw segment - if blocked, try progressively shorter lengths
      let drawnSegment = false;
      let tryLength = segmentLength;
      
      while (tryLength >= MIN_SEGMENT && !drawnSegment) {
        const { endPt: tryEnd, actualLength: tryActual } = this._calcSegmentEndpoint(nextDir, x, y, tryLength, bounds);
        
        if (canDrawLine(x, y, tryEnd.x, tryEnd.y, true)) {
          addLine(x, y, tryEnd.x, tryEnd.y);
          totalPathLength += tryActual;
          
          // Track if this was a turn toward base
          const turnedToBase = (baseSide === 'left' && this._isTurnLeft(currentDir, nextDir)) ||
                              (baseSide === 'right' && this._isTurnRight(currentDir, nextDir));
          lastTurnToBase = turnedToBase;
          
          x = tryEnd.x;
          y = tryEnd.y;
          currentDir = nextDir;
          drawnSegment = true;
          consecutiveRollbacks = 0; // Reset on successful segment
          
          console.log(`[MapGenerator] Drew segment to (${x},${y}), dir=${currentDir}, len=${tryActual}, total=${totalPathLength}`);
        } else {
          // Try shorter
          tryLength = Math.floor(tryLength * 0.7);
        }
      }
      
      if (!drawnSegment) {
        // Segment blocked even at minimum - try alternate direction
        console.log(`[MapGenerator] Segment blocked in ${nextDir}, trying alternates`);
        
        const alternates = [this._getTurnLeft(currentDir), this._getTurnRight(currentDir), currentDir]
          .filter(d => d !== nextDir && d !== this._getOppositeDir(currentDir));
        
        for (const altDir of alternates) {
          const altLength = this._calcSegmentLength(altDir, x, y, bounds, endX, endY, MIN_SEGMENT, MAX_SEGMENT, this.rng);
          
          if (altLength >= MIN_SEGMENT) {
            const { endPt: altEnd, actualLength: altActual } = this._calcSegmentEndpoint(altDir, x, y, altLength, bounds);
            
            if (canDrawLine(x, y, altEnd.x, altEnd.y)) {
              addLine(x, y, altEnd.x, altEnd.y);
              totalPathLength += altActual;
              lastTurnToBase = false;
              x = altEnd.x;
              y = altEnd.y;
              currentDir = altDir;
              drawnSegment = true;
              consecutiveRollbacks = 0; // Reset on successful segment
              console.log(`[MapGenerator] Used alternate dir ${altDir} to (${x},${y}), total=${totalPathLength}`);
              break;
            }
          }
        }
      }
      
      if (!drawnSegment) {
        // All directions blocked - rollback
        console.log(`[MapGenerator] All directions blocked, rolling back`);
        
        // Progressive rollback - increase depth if stuck in same area
        if (lastRollbackPos && Math.abs(x - lastRollbackPos.x) < 10 && Math.abs(y - lastRollbackPos.y) < 10) {
          consecutiveRollbacks++;
        } else {
          consecutiveRollbacks = 1;
        }
        lastRollbackPos = { x, y };
        
        const recovered = this._tryRollback(segmentHistory, path, occupied, CLEARANCE, consecutiveRollbacks);
        if (recovered) {
          x = recovered.x;
          y = recovered.y;
          bounds = recovered.bounds;
          shrinkStep = recovered.shrinkStep;
          currentDir = recovered.currentDir;
          lastTurnToBase = recovered.lastTurnToBase;
          prevBaseSide = recovered.prevBaseSide;
          totalPathLength = recovered.totalPathLength;
          console.log(`[MapGenerator] Rolled back to (${x},${y}), totalLen=${totalPathLength}`);
        } else {
          console.log(`[MapGenerator] No recovery possible, finishing`);
          break;
        }
      }
    }
    
    // Ensure we reach base
    if (path.length > 0) {
      const last = path[path.length - 1];
      if (last.x !== endX || last.y !== endY) {
        console.log(`[MapGenerator] Path ended at (${last.x},${last.y}), finishing to base (${endX},${endY})`);
        this._finishPathToBase(last.x, last.y, endX, endY, path, addLine, canDrawLine);
      }
    }
    
    console.log(`[MapGenerator] Segment-Walker complete: ${path.length} cells`);
    return path;
  }
  
  /**
   * Get initial direction based on spawn position (from edge inward)
   */
  _getInitialDirection(startX, startY) {
    const margin = GENERATOR_CONFIG.PATH_MARGIN;
    
    // Determine which edge spawn is on
    if (startX <= margin + 2) return 'right';
    if (startX >= this.width - margin - 3) return 'left';
    if (startY <= margin + 2) return 'down';
    if (startY >= this.height - margin - 3) return 'up';
    
    return 'right'; // default
  }
  
  /**
   * Get base position relative to current direction
   * Returns: 'left', 'right', 'front', 'back'
   */
  _getBaseSide(currentDir, x, y, baseX, baseY) {
    const dx = baseX - x;
    const dy = baseY - y;
    
    // Transform to direction-relative coordinates
    let relX, relY;
    switch (currentDir) {
      case 'right': relX = dx; relY = dy; break;
      case 'left': relX = -dx; relY = -dy; break;
      case 'down': relX = -dy; relY = dx; break;
      case 'up': relX = dy; relY = -dx; break;
    }
    
    // Determine which side base is on
    if (Math.abs(relY) > Math.abs(relX)) {
      return relY < 0 ? 'left' : 'right';
    } else {
      return relX > 0 ? 'front' : 'back';
    }
  }
  
  /**
   * Check if two sides are opposite
   */
  _isOppositeSide(side1, side2) {
    return (side1 === 'left' && side2 === 'right') ||
           (side1 === 'right' && side2 === 'left');
  }
  
  /**
   * Get direction that moves toward base (avoiding 180-degree turns)
   */
  _getDirectionTowardBase(currentDir, x, y, baseX, baseY) {
    const dx = baseX - x;
    const dy = baseY - y;
    const opposite = this._getOppositeDir(currentDir);
    
    // Prefer the axis with larger distance
    const candidates = [];
    
    if (Math.abs(dx) >= Math.abs(dy)) {
      // Prefer horizontal
      if (dx > 0) candidates.push('right');
      else if (dx < 0) candidates.push('left');
      if (dy > 0) candidates.push('down');
      else if (dy < 0) candidates.push('up');
    } else {
      // Prefer vertical
      if (dy > 0) candidates.push('down');
      else if (dy < 0) candidates.push('up');
      if (dx > 0) candidates.push('right');
      else if (dx < 0) candidates.push('left');
    }
    
    // Pick first candidate that isn't opposite to current direction
    for (const dir of candidates) {
      if (dir !== opposite) {
        return dir;
      }
    }
    
    // Fallback to current direction
    return currentDir;
  }
  
  /**
   * Check if we can go toward nearest edge
   */
  _canGoToEdge(currentDir, x, y, bounds, minDist) {
    // Calculate distances to edges based on perpendicular directions
    let leftDist, rightDist;
    switch (currentDir) {
      case 'right':
      case 'left':
        leftDist = y - bounds.top;
        rightDist = bounds.bottom - y;
        break;
      case 'up':
      case 'down':
        leftDist = x - bounds.left;
        rightDist = bounds.right - x;
        break;
    }
    
    return leftDist >= minDist || rightDist >= minDist;
  }
  
  /**
   * Choose next direction based on base position and history
   * 
   * Probabilities when base is on one side:
   * - Toward base: 60% (50% if last turn was also toward base)
   * - Straight: 30%
   * - Away from base: 10% (20% if last turn was toward base)
   * 
   * Never returns opposite of current direction (180° turn)
   */
  _chooseNextDirection(currentDir, baseSide, lastTurnToBase, canGoToEdge, rng) {
    const opposite = this._getOppositeDir(currentDir);
    
    // Available directions (exclude 180° turn)
    const available = ['up', 'down', 'left', 'right'].filter(d => d !== opposite);
    
    // Map to relative directions (straight, left, right relative to current)
    const straight = currentDir;
    const turnLeft = this._getTurnLeft(currentDir);
    const turnRight = this._getTurnRight(currentDir);
    
    // Determine which turn goes toward base
    let towardBase, awayFromBase;
    if (baseSide === 'left') {
      towardBase = turnLeft;
      awayFromBase = turnRight;
    } else if (baseSide === 'right') {
      towardBase = turnRight;
      awayFromBase = turnLeft;
    } else {
      // Base is front or back - prefer straight or random turn
      towardBase = straight;
      awayFromBase = rng.next() > 0.5 ? turnLeft : turnRight;
    }
    
    // Calculate probabilities
    let probToward = 60;
    let probStraight = 30;
    let probAway = 10;
    
    // Reduce toward probability if last turn was also toward base
    if (lastTurnToBase && baseSide !== 'front' && baseSide !== 'back') {
      probToward -= 10;
      probAway += 10;
    }
    
    // If can't go to edge, remove away option and redistribute
    if (!canGoToEdge && (baseSide === 'left' || baseSide === 'right')) {
      probToward += probAway / 2;
      probStraight += probAway / 2;
      probAway = 0;
    }
    
    // Roll dice
    const roll = rng.float(0, 100);
    
    if (roll < probToward) {
      return towardBase;
    } else if (roll < probToward + probStraight) {
      return straight;
    } else {
      return awayFromBase;
    }
  }
  
  /**
   * Get direction after turning left
   */
  _getTurnLeft(dir) {
    const map = { right: 'up', up: 'left', left: 'down', down: 'right' };
    return map[dir];
  }
  
  /**
   * Get direction after turning right
   */
  _getTurnRight(dir) {
    const map = { right: 'down', down: 'left', left: 'up', up: 'right' };
    return map[dir];
  }
  
  /**
   * Get opposite direction
   */
  _getOppositeDir(dir) {
    const map = { right: 'left', left: 'right', up: 'down', down: 'up' };
    return map[dir];
  }
  
  /**
   * Check if nextDir is a left turn from currentDir
   */
  _isTurnLeft(currentDir, nextDir) {
    return this._getTurnLeft(currentDir) === nextDir;
  }
  
  /**
   * Check if nextDir is a right turn from currentDir
   */
  _isTurnRight(currentDir, nextDir) {
    return this._getTurnRight(currentDir) === nextDir;
  }
  
  /**
   * Calculate segment length - shorter toward edge, longer toward center
   * Range: MIN_SEGMENT to MAX_SEGMENT
   */
  _calcSegmentLength(dir, x, y, bounds, baseX, baseY, minLen, maxLen, rng) {
    // Calculate available space in direction
    let maxAvailable;
    switch (dir) {
      case 'right': maxAvailable = bounds.right - x; break;
      case 'left': maxAvailable = x - bounds.left; break;
      case 'down': maxAvailable = bounds.bottom - y; break;
      case 'up': maxAvailable = y - bounds.top; break;
    }
    
    // Use a reasonable range: 20-70 cells typically
    // More randomness, less dependency on position
    const baseMin = Math.max(minLen, 20);
    const baseMax = Math.min(maxLen, 70);
    
    // Random length in range
    let length = rng.int(baseMin, baseMax);
    
    // Clamp to available space and limits
    length = Math.min(length, maxAvailable, maxLen);
    length = Math.max(length, Math.min(minLen, maxAvailable));
    
    return length;
  }
  
  /**
   * Calculate endpoint for segment
   */
  _calcSegmentEndpoint(dir, x, y, length, bounds) {
    let endX = x, endY = y;
    
    switch (dir) {
      case 'right':
        endX = Math.min(x + length, bounds.right);
        break;
      case 'left':
        endX = Math.max(x - length, bounds.left);
        break;
      case 'down':
        endY = Math.min(y + length, bounds.bottom);
        break;
      case 'up':
        endY = Math.max(y - length, bounds.top);
        break;
    }
    
    const actualLength = Math.abs(endX - x) + Math.abs(endY - y);
    return { endPt: { x: endX, y: endY }, actualLength };
  }
  
  /**
   * Get alternate direction when primary is blocked
   */
  _getAlternateDirection(currentDir, blockedDir, baseSide) {
    const opposite = this._getOppositeDir(currentDir);
    const candidates = ['up', 'down', 'left', 'right'].filter(d => 
      d !== opposite && d !== blockedDir
    );
    
    // Prefer direction toward base
    if (baseSide === 'left') {
      const left = this._getTurnLeft(currentDir);
      if (candidates.includes(left)) return left;
    } else if (baseSide === 'right') {
      const right = this._getTurnRight(currentDir);
      if (candidates.includes(right)) return right;
    }
    
    return candidates[0] || currentDir;
  }
  
  /**
   * Try to rollback several segments and retry
   * @param {number} rollbackDepth - How many consecutive rollbacks (increases segments to remove)
   */
  _tryRollback(history, path, occupied, clearance, rollbackDepth = 1) {
    // Progressive rollback: 1st attempt = 1 segment, 2nd = 2, 3rd = 3, etc.
    // Cap at half of history to avoid rolling back too far
    const maxRollback = Math.max(1, Math.floor(history.length / 2));
    const rollbackCount = Math.min(rollbackDepth, maxRollback, history.length - 1);
    
    if (rollbackCount <= 0) return null;
    
    console.log(`[MapGenerator] Rolling back ${rollbackCount} segments (depth ${rollbackDepth})`);
    
    // Get recovery point
    for (let i = 0; i < rollbackCount; i++) {
      history.pop();
    }
    
    if (history.length === 0) return null;
    
    const recovery = { ...history[history.length - 1] };
    
    // Trim path to recovery point
    while (path.length > recovery.pathLength) {
      const removed = path.pop();
      // Clear occupied around removed cell
      for (let dy = -clearance; dy <= clearance; dy++) {
        for (let dx = -clearance; dx <= clearance; dx++) {
          occupied.delete(`${removed.x + dx},${removed.y + dy}`);
        }
      }
    }
    
    // Force change direction after rollback to avoid repeating same path
    // Turn left from the recovered direction (or right randomly)
    const oldDir = recovery.currentDir;
    const forceLeft = this.rng.next() < 0.5;
    recovery.currentDir = forceLeft ? this._getTurnLeft(oldDir) : this._getTurnRight(oldDir);
    console.log(`[MapGenerator] Rollback: force direction ${oldDir} -> ${recovery.currentDir}`);
    
    return recovery;
  }
  
  /**
   * Finish path to base with L-path
   */
  _finishPathToBase(x, y, baseX, baseY, path, addLine, canDrawLine) {
    // Try H-first
    if (x !== baseX) {
      if (canDrawLine(x, y, baseX, y)) {
        addLine(x, y, baseX, y);
        x = baseX;
      }
    }
    if (y !== baseY) {
      if (canDrawLine(x, y, x, baseY)) {
        addLine(x, y, x, baseY);
      } else {
        // Force it
        const cells = this._getLineCells(x, y, x, baseY);
        for (const c of cells) {
          if (!path.some(p => p.x === c.x && p.y === c.y)) {
            path.push(c);
          }
        }
      }
    }
    
    // If still not at base X, force horizontal
    const last = path[path.length - 1];
    if (last && last.x !== baseX) {
      const cells = this._getLineCells(last.x, last.y, baseX, last.y);
      for (const c of cells) {
        if (!path.some(p => p.x === c.x && p.y === c.y)) {
          path.push(c);
        }
      }
    }
  }
  
  /**
   * Connect waypoints with L-shaped paths, avoiding collisions
   */
  _connectWaypointsWithLPaths(startX, startY, waypoints, endX, endY, margin, clearance) {
    const path = [];
    const occupied = new Set();
    
    // Mark cell as occupied with clearance
    const markOccupied = (x, y) => {
      for (let dy = -clearance; dy <= clearance; dy++) {
        for (let dx = -clearance; dx <= clearance; dx++) {
          occupied.add(`${x + dx},${y + dy}`);
        }
      }
    };
    
    // Check if cell is free
    const isFree = (x, y) => {
      if (x < margin || x >= this.width - margin ||
          y < margin || y >= this.height - margin) {
        return false;
      }
      return !occupied.has(`${x},${y}`);
    };
    
    // Check if line segment is free (skip first cell which is current pos)
    const canDrawLine = (x1, y1, x2, y2, skipFirst = true) => {
      const cells = this._getLineCells(x1, y1, x2, y2);
      const startIdx = skipFirst ? 1 : 0;
      for (let i = startIdx; i < cells.length; i++) {
        if (!isFree(cells[i].x, cells[i].y)) return false;
      }
      return true;
    };
    
    // Add line to path
    const addLine = (x1, y1, x2, y2) => {
      const cells = this._getLineCells(x1, y1, x2, y2);
      for (const c of cells) {
        if (!path.some(p => p.x === c.x && p.y === c.y)) {
          path.push(c);
          markOccupied(c.x, c.y);
        }
      }
    };
    
    // Start
    let x = startX;
    let y = startY;
    path.push({ x, y });
    markOccupied(x, y);
    
    // Connect to each waypoint
    const allTargets = [...waypoints, { x: endX, y: endY }];
    
    for (let i = 0; i < allTargets.length; i++) {
      const target = allTargets[i];
      const connected = this._connectToTarget(
        x, y, target.x, target.y, 
        canDrawLine, addLine, margin, 
        i === allTargets.length - 1 // isLastTarget
      );
      
      if (connected.success) {
        x = connected.x;
        y = connected.y;
      } else {
        // Failed to connect - try adjusting waypoint
        const adjusted = this._findAlternativeWaypoint(
          x, y, target.x, target.y, canDrawLine, margin
        );
        
        if (adjusted) {
          const retryConnected = this._connectToTarget(
            x, y, adjusted.x, adjusted.y,
            canDrawLine, addLine, margin, false
          );
          
          if (retryConnected.success) {
            x = retryConnected.x;
            y = retryConnected.y;
          }
        }
      }
    }
    
    // Ensure we reach the base
    if (x !== endX || y !== endY) {
      // Force connection (ignore collisions for final stretch)
      if (x !== endX) {
        this._pushLineNoDup(path, x, y, endX, y);
        x = endX;
      }
      if (y !== endY) {
        this._pushLineNoDup(path, x, y, x, endY);
      }
    }
    
    return path;
  }
  
  /**
   * Try to connect to target with L-path
   */
  _connectToTarget(fromX, fromY, toX, toY, canDrawLine, addLine, margin, isLastTarget) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    
    if (dx === 0 && dy === 0) {
      return { success: true, x: toX, y: toY };
    }
    
    // Try Horizontal-then-Vertical
    let hFirstOk = true;
    if (dx !== 0 && !canDrawLine(fromX, fromY, toX, fromY)) hFirstOk = false;
    if (hFirstOk && dy !== 0 && !canDrawLine(toX, fromY, toX, toY)) hFirstOk = false;
    
    // Try Vertical-then-Horizontal
    let vFirstOk = true;
    if (dy !== 0 && !canDrawLine(fromX, fromY, fromX, toY)) vFirstOk = false;
    if (vFirstOk && dx !== 0 && !canDrawLine(fromX, toY, toX, toY)) vFirstOk = false;
    
    // Choose path
    let useHFirst;
    if (hFirstOk && vFirstOk) {
      useHFirst = this.rng.next() > 0.5;
    } else if (hFirstOk) {
      useHFirst = true;
    } else if (vFirstOk) {
      useHFirst = false;
    } else {
      // Neither works
      return { success: false, x: fromX, y: fromY };
    }
    
    // Draw the path
    let x = fromX, y = fromY;
    
    if (useHFirst) {
      if (dx !== 0) {
        addLine(x, y, toX, y);
        x = toX;
      }
      if (dy !== 0) {
        addLine(x, y, x, toY);
        y = toY;
      }
    } else {
      if (dy !== 0) {
        addLine(x, y, x, toY);
        y = toY;
      }
      if (dx !== 0) {
        addLine(x, y, toX, y);
        x = toX;
      }
    }
    
    return { success: true, x, y };
  }
  
  /**
   * Find alternative waypoint position when direct path is blocked
   */
  _findAlternativeWaypoint(fromX, fromY, targetX, targetY, canDrawLine, margin) {
    // Try positions around the target
    const offsets = [
      { dx: 0, dy: -8 }, { dx: 0, dy: 8 },
      { dx: -8, dy: 0 }, { dx: 8, dy: 0 },
      { dx: -6, dy: -6 }, { dx: 6, dy: -6 },
      { dx: -6, dy: 6 }, { dx: 6, dy: 6 },
      { dx: 0, dy: -12 }, { dx: 0, dy: 12 },
      { dx: -12, dy: 0 }, { dx: 12, dy: 0 }
    ];
    
    for (const off of offsets) {
      const altX = this._clamp(targetX + off.dx, margin, this.width - margin - 1);
      const altY = this._clamp(targetY + off.dy, margin, this.height - margin - 1);
      
      // Check if we can reach this alternative
      const dx = altX - fromX;
      const dy = altY - fromY;
      
      // H-first
      let hOk = true;
      if (dx !== 0 && !canDrawLine(fromX, fromY, altX, fromY)) hOk = false;
      if (hOk && dy !== 0 && !canDrawLine(altX, fromY, altX, altY)) hOk = false;
      
      // V-first
      let vOk = true;
      if (dy !== 0 && !canDrawLine(fromX, fromY, fromX, altY)) vOk = false;
      if (vOk && dx !== 0 && !canDrawLine(fromX, altY, altX, altY)) vOk = false;
      
      if (hOk || vOk) {
        return { x: altX, y: altY };
      }
    }
    
    return null;
  }
  
  // ============ UTILITY METHODS ============
  
  /**
   * Find corner points (direction changes) in a path
   */
  _findCorners(path) {
    const corners = [];
    if (path.length < 3) {
      return path.slice(1);
    }
    
    let lastDx = path[1].x - path[0].x;
    let lastDy = path[1].y - path[0].y;
    
    for (let i = 2; i < path.length; i++) {
      const dx = path[i].x - path[i-1].x;
      const dy = path[i].y - path[i-1].y;
      
      if (dx !== lastDx || dy !== lastDy) {
        corners.push(path[i-1]);
        lastDx = dx;
        lastDy = dy;
      }
    }
    
    // Always include final point
    corners.push(path[path.length - 1]);
    
    return corners;
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
