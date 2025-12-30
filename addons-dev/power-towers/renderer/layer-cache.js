/**
 * Power Towers TD - Layer Cache System
 * 
 * Caches static layers (biomes, terrain, grid) to offscreen canvases
 * for dramatically improved rendering performance.
 * 
 * ARCHITECTURE:
 * - Static Layer: biomes + terrain + grid (redrawn only on map change or camera move)
 * - Path Layer: enemy path (redrawn only on map change)
 * - Dynamic Layer: enemies, towers, projectiles, effects (every frame)
 * - UI Layer: hover, range indicators, minimap (every frame)
 * 
 * PERFORMANCE GAINS:
 * - Biome decorations calculated once, not every frame
 * - Grid lines drawn once per camera position
 * - Only visible tiles are rendered (frustum culling)
 */

const CONFIG = require('../core/config');

/**
 * LayerCache - Manages offscreen canvas layers
 */
class LayerCache {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    
    // Layer canvases
    this.layers = {
      static: null,    // biomes + terrain + grid
      path: null,      // enemy path (separate for potential path changes)
    };
    
    // Layer contexts
    this.contexts = {};
    
    // Dirty flags
    this.dirty = {
      static: true,
      path: true,
    };
    
    // Last camera position (to detect camera movement)
    this.lastCamera = { x: 0, y: 0, zoom: 1 };
    
    // Cached data references
    this.cachedData = null;
    
    // Performance stats
    this.stats = {
      staticRedraws: 0,
      pathRedraws: 0,
      frameCount: 0,
      lastFpsUpdate: Date.now(),
      fps: 60,
      frameTime: 0,
    };
    
    // Initialize layers
    this._createLayers();
  }
  
  /**
   * Create offscreen canvas layers
   */
  _createLayers() {
    // Use OffscreenCanvas if available (better performance)
    const createCanvas = (w, h) => {
      if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(w, h);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      return canvas;
    };
    
    for (const layerName of Object.keys(this.layers)) {
      this.layers[layerName] = createCanvas(this.width, this.height);
      this.contexts[layerName] = this.layers[layerName].getContext('2d');
    }
  }
  
  /**
   * Resize all layers
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
    
    for (const layerName of Object.keys(this.layers)) {
      this.layers[layerName].width = width;
      this.layers[layerName].height = height;
    }
    
    // Mark all as dirty
    this.invalidateAll();
  }
  
  /**
   * Mark all layers as dirty (need redraw)
   */
  invalidateAll() {
    this.dirty.static = true;
    this.dirty.path = true;
  }
  
  /**
   * Mark specific layer as dirty
   */
  invalidate(layerName) {
    if (this.dirty.hasOwnProperty(layerName)) {
      this.dirty[layerName] = true;
    }
  }
  
  /**
   * Check if camera moved significantly
   */
  _cameraChanged(camera) {
    if (!camera) return false;
    
    const threshold = 0.5; // Pixel threshold for movement detection
    const zoomThreshold = 0.01;
    
    const dx = Math.abs(camera.x - this.lastCamera.x);
    const dy = Math.abs(camera.y - this.lastCamera.y);
    const dz = Math.abs(camera.zoom - this.lastCamera.zoom);
    
    return dx > threshold || dy > threshold || dz > zoomThreshold;
  }
  
  /**
   * Update camera tracking
   */
  _updateCameraTracking(camera) {
    if (camera) {
      this.lastCamera.x = camera.x;
      this.lastCamera.y = camera.y;
      this.lastCamera.zoom = camera.zoom;
    }
  }
  
  /**
   * Render static layer (biomes + terrain + grid)
   */
  renderStaticLayer(ctx, data, camera, frameCount, drawFunctions) {
    // Check if camera moved - if so, need to redraw static layer
    if (this._cameraChanged(camera)) {
      this.dirty.static = true;
      this.dirty.path = true;  // Path also needs redraw on camera move!
      this._updateCameraTracking(camera);
    }
    
    // Only redraw if dirty
    if (this.dirty.static) {
      const layerCtx = this.contexts.static;
      
      // Clear layer
      layerCtx.clearRect(0, 0, this.width, this.height);
      
      // Apply camera transform
      layerCtx.save();
      if (camera) {
        layerCtx.scale(camera.zoom, camera.zoom);
        layerCtx.translate(-camera.x, -camera.y);
      }
      
      // Draw static elements
      if (drawFunctions.drawTerrain) {
        drawFunctions.drawTerrain(
          layerCtx, 
          data.terrain, 
          data.terrainTypes, 
          camera, 
          0, // Use 0 for frameCount - static decorations don't animate
          data.biomeMap, 
          data.biomeTypes
        );
      }
      
      if (drawFunctions.drawGrid) {
        drawFunctions.drawGrid(layerCtx, camera);
      }
      
      layerCtx.restore();
      
      this.dirty.static = false;
      this.stats.staticRedraws++;
    }
    
    // Blit cached layer to main canvas
    ctx.drawImage(this.layers.static, 0, 0);
  }
  
  /**
   * Render path layer
   */
  renderPathLayer(ctx, data, camera, drawFunctions) {
    // Path only changes on map regeneration
    if (this.dirty.path) {
      const layerCtx = this.contexts.path;
      
      // Clear layer
      layerCtx.clearRect(0, 0, this.width, this.height);
      
      // Apply camera transform
      layerCtx.save();
      if (camera) {
        layerCtx.scale(camera.zoom, camera.zoom);
        layerCtx.translate(-camera.x, -camera.y);
      }
      
      if (drawFunctions.drawPath) {
        drawFunctions.drawPath(layerCtx, data.waypoints, data.pathCells, camera);
      }
      
      if (drawFunctions.drawBase) {
        drawFunctions.drawBase(layerCtx, data.waypoints, camera);
      }
      
      layerCtx.restore();
      
      this.dirty.path = false;
      this.stats.pathRedraws++;
    }
    
    // Blit cached layer to main canvas
    ctx.drawImage(this.layers.path, 0, 0);
  }
  
  /**
   * Get performance stats
   */
  getStats() {
    return { ...this.stats };
  }
  
  /**
   * Update FPS counter
   */
  updateFps() {
    this.stats.frameCount++;
    
    const now = Date.now();
    const elapsed = now - this.stats.lastFpsUpdate;
    
    if (elapsed >= 1000) {
      this.stats.fps = Math.round(this.stats.frameCount * 1000 / elapsed);
      this.stats.frameTime = elapsed / this.stats.frameCount;
      this.stats.frameCount = 0;
      this.stats.lastFpsUpdate = now;
    }
  }
}

/**
 * Biome decoration cache
 * Pre-calculates which cells get which decorations
 */
class BiomeDecorationCache {
  constructor() {
    this.decorations = new Map(); // key: "x,y" -> decoration type and params
    this.generated = false;
  }
  
  /**
   * Generate decoration map for biomes
   * Called once when map is generated
   */
  generate(biomeMap, biomeTypes) {
    this.decorations.clear();
    
    if (!biomeMap || !biomeTypes) return;
    
    const height = biomeMap.length;
    const width = biomeMap[0]?.length || 0;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const biomeId = biomeMap[y][x];
        if (!biomeId) continue;
        
        // Use deterministic hash for consistent decorations
        const hash = (x * 31 + y * 17) % 100;
        const decoration = this._getDecoration(biomeId, hash, x, y);
        
        if (decoration) {
          this.decorations.set(`${x},${y}`, decoration);
        }
      }
    }
    
    this.generated = true;
  }
  
  /**
   * Determine decoration for a cell
   */
  _getDecoration(biomeId, hash, x, y) {
    switch (biomeId) {
      case 'forest':
        if (hash < 40) {
          return {
            type: 'tree',
            offsetX: (hash % 3 + 1) / 4,
            offsetY: ((hash * 7) % 3 + 1) / 4,
            size: 0.15 + (hash % 10) * 0.005,
          };
        }
        break;
        
      case 'desert':
        if (hash < 25) {
          return { type: 'dune' };
        }
        break;
        
      case 'mountains':
        if (hash < 30) {
          return {
            type: 'rock',
            offsetX: (hash % 4) / 5 + 0.1,
            offsetY: ((hash * 3) % 4) / 5 + 0.1,
          };
        }
        break;
        
      case 'plains':
        if (hash < 15) {
          return {
            type: 'grass',
            offsetX: (hash % 5 + 1) / 6,
          };
        }
        break;
        
      case 'burned':
        if (hash < 40) {
          return {
            type: 'ash',
            offsetX: 0.3 + hash % 20 / 100,
          };
        }
        break;
    }
    
    return null;
  }
  
  /**
   * Get decoration at cell
   */
  get(x, y) {
    return this.decorations.get(`${x},${y}`);
  }
  
  /**
   * Clear cache
   */
  clear() {
    this.decorations.clear();
    this.generated = false;
  }
}

module.exports = { LayerCache, BiomeDecorationCache };
