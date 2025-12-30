/**
 * Power Towers TD - Game Renderer
 * Handles all Canvas rendering with Camera/Viewport support
 * 
 * Map: 2000x2000 px (world coordinates)
 * Canvas: viewport display (screen coordinates)
 */

const CONFIG = require('../core/config');
const { 
  drawTerrain, 
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
  drawDamageNumbers
} = require('./render-entities');
const { 
  drawHoverIndicator, 
  drawMinimap 
} = require('./render-ui');

class GameRenderer {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
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
   * Render full frame
   */
  render(data) {
    this.frameCount++;
    this.clear();
    
    // Apply camera transform
    this.ctx.save();
    if (this.camera) {
      this.ctx.scale(this.camera.zoom, this.camera.zoom);
      this.ctx.translate(-this.camera.x, -this.camera.y);
    }
    
    // Draw layers in order (all in world coordinates)
    drawTerrain(this.ctx, data.terrain, data.terrainTypes, this.camera, this.frameCount);
    drawGrid(this.ctx, this.camera);
    drawPath(this.ctx, data.waypoints, data.pathCells, this.camera);
    drawSpecialElements(this.ctx, data.energyNodes, data.resourceVeins, data.terrainTypes, this.frameCount);
    drawBase(this.ctx, data.waypoints, this.camera);
    drawTowers(this.ctx, data.towers, data.selectedTower, this.camera);
    drawEnemies(this.ctx, data.enemies, this.camera, this.frameCount);
    drawProjectiles(this.ctx, data.projectiles, this.camera);
    drawDamageNumbers(this.ctx, data.damageNumbers || [], this.camera);
    drawHoverIndicator(this.ctx, this.hoverGridX, this.hoverGridY, this.canPlaceHover, this.camera);
    
    // Draw range indicator for selected tower
    if (data.selectedTower) {
      drawRangeIndicator(this.ctx, data.selectedTower, this.camera);
    }
    
    // Restore transform
    this.ctx.restore();
    
    // Draw UI overlay (screen coords, not affected by camera)
    drawMinimap(this.ctx, data, this.camera, this.width, this.height);
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
    
    if (this.camera) {
      this.camera.setViewportSize(width, height);
    }
  }
}

module.exports = { GameRenderer };
