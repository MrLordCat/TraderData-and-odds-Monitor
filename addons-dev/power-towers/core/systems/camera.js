/**
 * Power Towers TD - Camera System
 * Handles viewport, scrolling, and coordinate transformations
 * 
 * Map: 2000x2000 px (logical game world)
 * Viewport: what's visible on canvas (e.g., 400x400 px display)
 */

const CONFIG = require('../config');

class Camera {
  constructor() {
    // Camera position (top-left corner of viewport in world coords)
    this.x = 0;
    this.y = 0;
    
    // Zoom level (1.0 = 1:1, 0.5 = zoomed out, 2.0 = zoomed in)
    // Initial value will be adjusted to minZoom when setViewportSize is called
    this.zoom = 1.0;
    
    // Viewport size (display canvas size)
    this.viewportWidth = CONFIG.CANVAS_WIDTH;
    this.viewportHeight = CONFIG.CANVAS_HEIGHT;
    
    // Map bounds
    this.mapWidth = CONFIG.MAP_WIDTH;
    this.mapHeight = CONFIG.MAP_HEIGHT;
    
    // Smooth scrolling
    this.targetX = 0;
    this.targetY = 0;
    this.smoothing = 0.1;  // lerp factor
    
    // Drag state
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragCameraStartX = 0;
    this.dragCameraStartY = 0;
  }

  /**
   * Set viewport size (when canvas resizes)
   * Recalculates zoom to ensure map fills viewport
   */
  setViewportSize(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;
    
    // Recalculate zoom to ensure map fills viewport
    this.setZoom(this.zoom);
  }

  /**
   * Get visible world area
   */
  getVisibleArea() {
    const worldWidth = this.viewportWidth / this.zoom;
    const worldHeight = this.viewportHeight / this.zoom;
    return {
      x: this.x,
      y: this.y,
      width: worldWidth,
      height: worldHeight,
      right: this.x + worldWidth,
      bottom: this.y + worldHeight
    };
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX, screenY) {
    return {
      x: this.x + screenX / this.zoom,
      y: this.y + screenY / this.zoom
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX, worldY) {
    return {
      x: (worldX - this.x) * this.zoom,
      y: (worldY - this.y) * this.zoom
    };
  }

  /**
   * Convert screen size to world size
   */
  screenToWorldSize(screenSize) {
    return screenSize / this.zoom;
  }

  /**
   * Convert world size to screen size
   */
  worldToScreenSize(worldSize) {
    return worldSize * this.zoom;
  }

  /**
   * Snap world position to grid
   */
  snapToGrid(worldX, worldY) {
    const gridSize = CONFIG.GRID_SIZE;
    return {
      x: Math.floor(worldX / gridSize) * gridSize,
      y: Math.floor(worldY / gridSize) * gridSize
    };
  }

  /**
   * Get grid cell from world position
   */
  worldToGrid(worldX, worldY) {
    const gridSize = CONFIG.GRID_SIZE;
    return {
      gridX: Math.floor(worldX / gridSize),
      gridY: Math.floor(worldY / gridSize)
    };
  }

  /**
   * Get world position from grid cell (center of cell)
   */
  gridToWorld(gridX, gridY) {
    const gridSize = CONFIG.GRID_SIZE;
    return {
      x: gridX * gridSize + gridSize / 2,
      y: gridY * gridSize + gridSize / 2
    };
  }

  /**
   * Move camera to center on position
   */
  centerOn(worldX, worldY, instant = false) {
    const worldWidth = this.viewportWidth / this.zoom;
    const worldHeight = this.viewportHeight / this.zoom;
    
    this.targetX = worldX - worldWidth / 2;
    this.targetY = worldY - worldHeight / 2;
    
    if (instant) {
      this.x = this.targetX;
      this.y = this.targetY;
    }
    
    this.clampPosition();
  }

  /**
   * Move camera by delta
   */
  pan(deltaX, deltaY) {
    this.targetX += deltaX / this.zoom;
    this.targetY += deltaY / this.zoom;
    this.clampPosition();
  }

  /**
   * Set zoom level with bounds checking
   * Prevents zooming out beyond map boundaries - viewport always filled with map
   * Zoom is centered on the viewport center (not cursor position)
   */
  setZoom(newZoom, centerX = null, centerY = null) {
    const oldZoom = this.zoom;
    
    // Calculate minimum zoom to fill viewport completely
    // This ensures map always fills the entire viewport (no empty borders)
    const minZoomX = this.viewportWidth / this.mapWidth;
    const minZoomY = this.viewportHeight / this.mapHeight;
    const minZoom = Math.max(minZoomX, minZoomY); // Must fill viewport in both dimensions
    
    const clampedZoom = Math.max(minZoom, Math.min(2.0, newZoom));
    
    // If zoom didn't change, nothing to do
    if (clampedZoom === oldZoom) {
      return;
    }
    
    // Always zoom relative to viewport center for consistent UX
    // Calculate the world point at viewport center BEFORE zoom change
    const viewportCenterX = this.viewportWidth / 2;
    const viewportCenterY = this.viewportHeight / 2;
    
    // World point currently at viewport center (using old zoom)
    const worldCenterX = this.x + viewportCenterX / oldZoom;
    const worldCenterY = this.y + viewportCenterY / oldZoom;
    
    // Apply new zoom
    this.zoom = clampedZoom;
    
    // Adjust camera so the same world point stays at viewport center
    this.x = worldCenterX - viewportCenterX / this.zoom;
    this.y = worldCenterY - viewportCenterY / this.zoom;
    this.targetX = this.x;
    this.targetY = this.y;
    
    this.clampPosition();
  }

  /**
   * Zoom in/out by factor (always centered on viewport)
   */
  zoomBy(factor) {
    this.setZoom(this.zoom * factor);
  }

  /**
   * Clamp camera position to map bounds
   * Ensures camera never shows area outside the map
   */
  clampPosition() {
    const worldWidth = this.viewportWidth / this.zoom;
    const worldHeight = this.viewportHeight / this.zoom;
    
    // Calculate bounds - camera position is top-left corner
    // Ensure we never see past map edges
    let maxX, maxY, minX, minY;
    
    if (worldWidth >= this.mapWidth) {
      // Viewport wider than map - center horizontally
      minX = maxX = (this.mapWidth - worldWidth) / 2;
    } else {
      minX = 0;
      maxX = this.mapWidth - worldWidth;
    }
    
    if (worldHeight >= this.mapHeight) {
      // Viewport taller than map - center vertically
      minY = maxY = (this.mapHeight - worldHeight) / 2;
    } else {
      minY = 0;
      maxY = this.mapHeight - worldHeight;
    }
    
    this.targetX = Math.max(minX, Math.min(maxX, this.targetX));
    this.targetY = Math.max(minY, Math.min(maxY, this.targetY));
    
    this.x = Math.max(minX, Math.min(maxX, this.x));
    this.y = Math.max(minY, Math.min(maxY, this.y));
  }

  /**
   * Update camera (smooth scrolling)
   */
  update() {
    // Lerp towards target
    this.x += (this.targetX - this.x) * this.smoothing;
    this.y += (this.targetY - this.y) * this.smoothing;
    
    // Snap if very close
    if (Math.abs(this.x - this.targetX) < 0.1) this.x = this.targetX;
    if (Math.abs(this.y - this.targetY) < 0.1) this.y = this.targetY;
  }

  /**
   * Start drag operation
   */
  startDrag(screenX, screenY) {
    this.isDragging = true;
    this.dragStartX = screenX;
    this.dragStartY = screenY;
    this.dragCameraStartX = this.x;
    this.dragCameraStartY = this.y;
  }

  /**
   * Update drag
   */
  updateDrag(screenX, screenY) {
    if (!this.isDragging) return;
    
    const deltaX = (this.dragStartX - screenX) / this.zoom;
    const deltaY = (this.dragStartY - screenY) / this.zoom;
    
    this.targetX = this.dragCameraStartX + deltaX;
    this.targetY = this.dragCameraStartY + deltaY;
    this.x = this.targetX;
    this.y = this.targetY;
    
    this.clampPosition();
  }

  /**
   * End drag operation
   */
  endDrag() {
    this.isDragging = false;
  }

  /**
   * Check if world rect is visible
   */
  isVisible(worldX, worldY, width, height) {
    const area = this.getVisibleArea();
    return !(worldX + width < area.x ||
             worldX > area.right ||
             worldY + height < area.y ||
             worldY > area.bottom);
  }

  /**
   * Reset camera to default position
   */
  reset() {
    this.zoom = 0.2;
    this.centerOn(this.mapWidth / 2, this.mapHeight / 2, true);
  }
}

module.exports = { Camera };
