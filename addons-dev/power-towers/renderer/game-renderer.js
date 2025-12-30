/**
 * Power Towers TD - Game Renderer
 * Handles all Canvas rendering with Camera/Viewport support
 * 
 * OPTIMIZED with LayerCache:
 * - Static layers (biomes, terrain, grid) cached to offscreen canvas
 * - Only dynamic elements redrawn each frame
 * - Significant FPS improvement for large maps
 * 
 * Map: 2000x2000 px (world coordinates)
 * Canvas: viewport display (screen coordinates)
 */

const CONFIG = require('../core/config');
const { LayerCache } = require('./layer-cache');
const { 
  drawBiomes,
  drawTerrain, 
  drawAnimatedBiomeDecorations,
  drawSpecialElements, 
  drawGrid, 
  drawPath, 
  drawBase 
} = require('./render-terrain');
const { 
  drawTowers, 
  drawRangeIndicator, 
  drawEnemies, 
  drawProjectiles,
  drawDamageNumbers,
  drawEffects
} = require('./render-entities');
const { 
  drawHoverIndicator, 
  drawMinimap 
} = require('./render-ui');

class GameRenderer {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { 
      alpha: false,  // No transparency needed for main canvas
      desynchronized: true  // Hint for better performance
    });
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Camera reference (handles world<->screen transforms)
    this.camera = camera;
    
    // Animation state
    this.frameCount = 0;
    
    // Hover state (in grid coords)
    this.hoverGridX = -1;
    this.hoverGridY = -1;
    this.canPlaceHover = false;
    
    // Layer cache for static elements (OPTIMIZATION)
    this.layerCache = new LayerCache(canvas.width, canvas.height);
    
    // Draw functions reference for layer cache
    this.drawFunctions = {
      drawTerrain,
      drawGrid,
      drawPath,
      drawBase,
    };
    
    // Debug mode (show FPS)
    this.showFps = true;
  }

  /**
   * Set camera reference
   */
  setCamera(camera) {
    this.camera = camera;
  }

  /**
   * Clear canvas
   */
  clear() {
    this.ctx.fillStyle = CONFIG.COLORS.background;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Invalidate static layer cache (call when map changes)
   */
  invalidateStaticCache() {
    this.layerCache.invalidateAll();
  }

  /**
   * Render full frame (OPTIMIZED)
   */
  render(data) {
    this.frameCount++;
    this.layerCache.updateFps();
    this.clear();
    
    // === CACHED STATIC LAYERS ===
    // These are rendered to offscreen canvas and only updated when needed
    this.layerCache.renderStaticLayer(
      this.ctx, 
      data, 
      this.camera, 
      this.frameCount,
      this.drawFunctions
    );
    
    // Path layer (also cached, changes rarely)
    this.layerCache.renderPathLayer(
      this.ctx,
      data,
      this.camera,
      this.drawFunctions
    );
    
    // === DYNAMIC LAYERS ===
    // These are redrawn every frame
    this.ctx.save();
    if (this.camera) {
      this.ctx.scale(this.camera.zoom, this.camera.zoom);
      this.ctx.translate(-this.camera.x, -this.camera.y);
    }
    
    // Animated biome decorations (water waves, smoke)
    drawAnimatedBiomeDecorations(this.ctx, data.biomeMap, data.biomeTypes, this.camera, this.frameCount);
    
    // Special elements with animation (energy nodes glow)
    drawSpecialElements(this.ctx, data.energyNodes, data.resourceVeins, data.terrainTypes, this.frameCount);
    
    // Game entities (always dynamic)
    drawTowers(this.ctx, data.towers, data.selectedTower, this.camera);
    drawEnemies(this.ctx, data.enemies, this.camera, this.frameCount);
    drawProjectiles(this.ctx, data.projectiles, this.camera);
    drawEffects(this.ctx, data.effects || [], this.camera);
    drawDamageNumbers(this.ctx, data.damageNumbers || [], this.camera);
    drawHoverIndicator(this.ctx, this.hoverGridX, this.hoverGridY, this.canPlaceHover, this.camera);
    
    // Draw range indicator for selected tower
    if (data.selectedTower) {
      drawRangeIndicator(this.ctx, data.selectedTower, this.camera);
    }
    
    // Restore transform
    this.ctx.restore();
    
    // === UI OVERLAY ===
    // Draw UI overlay (screen coords, not affected by camera)
    drawMinimap(this.ctx, data, this.camera, this.width, this.height);
    
    // FPS counter
    if (this.showFps) {
      this._drawFps();
    }
  }
  
  /**
   * Draw FPS counter
   */
  _drawFps() {
    const stats = this.layerCache.getStats();
    
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(5, 5, 80, 40);
    
    this.ctx.fillStyle = stats.fps >= 50 ? '#4ade80' : stats.fps >= 30 ? '#fbbf24' : '#ef4444';
    this.ctx.font = 'bold 14px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`FPS: ${stats.fps}`, 10, 22);
    
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.font = '10px monospace';
    this.ctx.fillText(`Cache: ${stats.staticRedraws}`, 10, 38);
  }

  /**
   * Set hover position (grid coordinates)
   */
  setHover(gridX, gridY, canPlace) {
    this.hoverGridX = gridX;
    this.hoverGridY = gridY;
    this.canPlaceHover = canPlace;
  }

  /**
   * Clear hover
   */
  clearHover() {
    this.hoverGridX = -1;
    this.hoverGridY = -1;
  }

  /**
   * Convert screen coords to world coords
   */
  screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    
    // Convert client coords to canvas coords (account for CSS scaling)
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    
    const canvasX = (screenX - rect.left) * scaleX;
    const canvasY = (screenY - rect.top) * scaleY;
    
    if (this.camera) {
      return this.camera.screenToWorld(canvasX, canvasY);
    }
    
    return { x: canvasX, y: canvasY };
  }

  /**
   * Convert screen coords to grid coords
   */
  screenToGrid(screenX, screenY) {
    const world = this.screenToWorld(screenX, screenY);
    const gridSize = CONFIG.GRID_SIZE;
    
    return {
      gridX: Math.floor(world.x / gridSize),
      gridY: Math.floor(world.y / gridSize),
      worldX: world.x,
      worldY: world.y
    };
  }

  /**
   * Resize canvas
   */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
    
    // Resize layer cache
    this.layerCache.resize(width, height);
    
    if (this.camera) {
      this.camera.setViewportSize(width, height);
    }
  }
  
  /**
   * Toggle FPS display
   */
  toggleFps() {
    this.showFps = !this.showFps;
  }
}

module.exports = { GameRenderer };
