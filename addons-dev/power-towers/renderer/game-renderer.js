/**
 * Power Towers TD - Game Renderer
 * Handles all Canvas rendering with Camera/Viewport support
 * 
 * Map: 2000x2000 px (world coordinates)
 * Canvas: viewport display (screen coordinates)
 */

const CONFIG = require('../core/config');

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
    this.drawGrid();
    this.drawPath(data.waypoints, data.pathCells);
    this.drawBase(data.waypoints);
    this.drawTowers(data.towers, data.selectedTower);
    this.drawEnemies(data.enemies);
    this.drawProjectiles(data.projectiles);
    this.drawHoverIndicator(data.pathCells, data.towers);
    
    // Draw range indicator for selected tower
    if (data.selectedTower) {
      this.drawRangeIndicator(data.selectedTower);
    }
    
    // Restore transform
    this.ctx.restore();
    
    // Draw UI overlay (screen coords, not affected by camera)
    this.drawMinimap(data);
  }

  /**
   * Draw grid (world coordinates)
   */
  drawGrid() {
    const ctx = this.ctx;
    const gridSize = CONFIG.GRID_SIZE;
    const mapWidth = CONFIG.MAP_WIDTH;
    const mapHeight = CONFIG.MAP_HEIGHT;
    
    // Only draw visible grid lines for performance
    const visibleArea = this.camera ? this.camera.getVisibleArea() : 
      { x: 0, y: 0, width: mapWidth, height: mapHeight };
    
    const startGridX = Math.floor(visibleArea.x / gridSize);
    const startGridY = Math.floor(visibleArea.y / gridSize);
    const endGridX = Math.ceil((visibleArea.x + visibleArea.width) / gridSize);
    const endGridY = Math.ceil((visibleArea.y + visibleArea.height) / gridSize);
    
    ctx.strokeStyle = CONFIG.COLORS.grid;
    ctx.lineWidth = 1 / (this.camera ? this.camera.zoom : 1);  // Keep 1px on screen
    
    // Vertical lines
    for (let gx = startGridX; gx <= endGridX; gx++) {
      const x = gx * gridSize;
      ctx.beginPath();
      ctx.moveTo(x, visibleArea.y);
      ctx.lineTo(x, visibleArea.y + visibleArea.height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let gy = startGridY; gy <= endGridY; gy++) {
      const y = gy * gridSize;
      ctx.beginPath();
      ctx.moveTo(visibleArea.x, y);
      ctx.lineTo(visibleArea.x + visibleArea.width, y);
      ctx.stroke();
    }
  }

  /**
   * Draw enemy path (world coordinates)
   */
  drawPath(waypoints, pathCells) {
    const ctx = this.ctx;
    const gridSize = CONFIG.GRID_SIZE;
    
    // Draw path cells
    ctx.fillStyle = CONFIG.COLORS.path;
    for (const cell of pathCells) {
      // Skip cells outside visible area for performance
      if (this.camera && !this.camera.isVisible(
        cell.x * gridSize, cell.y * gridSize, gridSize, gridSize
      )) continue;
      
      ctx.fillRect(
        cell.x * gridSize,
        cell.y * gridSize,
        gridSize,
        gridSize
      );
    }
    
    // Draw path line
    if (waypoints.length < 2) return;
    
    ctx.strokeStyle = CONFIG.COLORS.pathBorder;
    ctx.lineWidth = 3 / (this.camera ? this.camera.zoom : 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i < waypoints.length; i++) {
      ctx.lineTo(waypoints[i].x, waypoints[i].y);
    }
    ctx.stroke();
  }

  /**
   * Draw player base (world coordinates)
   */
  drawBase(waypoints) {
    if (waypoints.length === 0) return;
    
    const ctx = this.ctx;
    const base = waypoints[waypoints.length - 1];
    const size = CONFIG.GRID_SIZE * 1.5;  // Base is 1.5 cells
    
    // Check visibility
    if (this.camera && !this.camera.isVisible(base.x - size*2, base.y - size*2, size*4, size*4)) return;
    
    // Glow effect
    const gradient = ctx.createRadialGradient(
      base.x, base.y, 0,
      base.x, base.y, size * 2
    );
    gradient.addColorStop(0, CONFIG.COLORS.baseGlow);
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(base.x, base.y, size * 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Base icon (simple house shape)
    ctx.fillStyle = CONFIG.COLORS.base;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y - size);
    ctx.lineTo(base.x + size, base.y);
    ctx.lineTo(base.x + size * 0.6, base.y);
    ctx.lineTo(base.x + size * 0.6, base.y + size * 0.8);
    ctx.lineTo(base.x - size * 0.6, base.y + size * 0.8);
    ctx.lineTo(base.x - size * 0.6, base.y);
    ctx.lineTo(base.x - size, base.y);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = '#2f855a';
    ctx.lineWidth = 2 / (this.camera ? this.camera.zoom : 1);
    ctx.stroke();
  }

  /**
   * Draw all towers
   */
  drawTowers(towers, selectedTower) {
    for (const tower of towers) {
      // Visibility check
      if (this.camera && !this.camera.isVisible(
        tower.x - tower.range, tower.y - tower.range, 
        tower.range * 2, tower.range * 2
      )) continue;
      
      this.drawTower(tower, tower === selectedTower);
    }
  }

  /**
   * Draw single tower (world coordinates)
   */
  drawTower(tower, isSelected) {
    const ctx = this.ctx;
    const size = tower.size / 2;
    const zoom = this.camera ? this.camera.zoom : 1;
    
    // Selection indicator
    if (isSelected) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, size + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Tower base (circle)
    ctx.fillStyle = tower.color;
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2 / zoom;
    ctx.stroke();
    
    // Turret (line showing direction)
    const turretLength = size * 0.8;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3 / zoom;
    ctx.beginPath();
    ctx.moveTo(tower.x, tower.y);
    ctx.lineTo(
      tower.x + Math.cos(tower.rotation) * turretLength,
      tower.y + Math.sin(tower.rotation) * turretLength
    );
    ctx.stroke();
    
    // Tier indicator (small dots)
    if (tower.tier > 0) {
      const dotSize = 3;
      const dotSpacing = 6;
      const startX = tower.x - ((tower.tier - 1) * dotSpacing) / 2;
      
      ctx.fillStyle = '#fff';
      for (let i = 0; i < tower.tier; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * dotSpacing, tower.y + size + 5, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Draw range indicator (world coordinates)
   */
  drawRangeIndicator(tower) {
    const ctx = this.ctx;
    const zoom = this.camera ? this.camera.zoom : 1;
    
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
    ctx.lineWidth = 1 / zoom;
    
    ctx.beginPath();
    ctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  /**
   * Draw all enemies
   */
  drawEnemies(enemies) {
    for (const enemy of enemies) {
      // Visibility check
      if (this.camera && !this.camera.isVisible(
        enemy.x - enemy.size * 2, enemy.y - enemy.size * 2,
        enemy.size * 4, enemy.size * 4
      )) continue;
      
      this.drawEnemy(enemy);
    }
  }

  /**
   * Draw single enemy (world coordinates)
   */
  drawEnemy(enemy) {
    const ctx = this.ctx;
    const size = enemy.size;
    const zoom = this.camera ? this.camera.zoom : 1;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(enemy.x, enemy.y + size * 0.8, size * 0.8, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1 / zoom;
    ctx.stroke();
    
    // Effects indicators
    if (enemy.slowDuration > 0) {
      ctx.strokeStyle = '#63b3ed';
      ctx.lineWidth = 2 / zoom;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, size + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    if (enemy.burnDuration > 0) {
      const flicker = Math.sin(this.frameCount * 0.3) * 2;
      ctx.fillStyle = '#f56565';
      ctx.beginPath();
      ctx.arc(enemy.x + flicker, enemy.y - size - 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Health bar
    this.drawHealthBar(enemy.x, enemy.y - size - 8, size * 2, 4 / zoom, enemy.getHealthPercent());
  }

  /**
   * Draw health bar (world coordinates)
   */
  drawHealthBar(x, y, width, height, percent) {
    const ctx = this.ctx;
    const left = x - width / 2;
    
    ctx.fillStyle = CONFIG.COLORS.healthBar.bg;
    ctx.fillRect(left, y, width, height);
    
    const fillColor = percent > 0.3 ? CONFIG.COLORS.healthBar.fill : CONFIG.COLORS.healthBar.low;
    ctx.fillStyle = fillColor;
    ctx.fillRect(left, y, width * percent, height);
    
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1 / (this.camera ? this.camera.zoom : 1);
    ctx.strokeRect(left, y, width, height);
  }

  /**
   * Draw all projectiles
   */
  drawProjectiles(projectiles) {
    for (const proj of projectiles) {
      this.drawProjectile(proj);
    }
  }

  /**
   * Draw single projectile (world coordinates)
   */
  drawProjectile(proj) {
    const ctx = this.ctx;
    const zoom = this.camera ? this.camera.zoom : 1;
    
    // Trail
    if (proj.trail.length > 1) {
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 2 / zoom;
      ctx.globalAlpha = 0.5;
      
      ctx.beginPath();
      ctx.moveTo(proj.trail[0].x, proj.trail[0].y);
      for (let i = 1; i < proj.trail.length; i++) {
        ctx.lineTo(proj.trail[i].x, proj.trail[i].y);
      }
      ctx.lineTo(proj.x, proj.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    
    // Projectile
    ctx.fillStyle = proj.color;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
    ctx.fill();
    
    // Glow
    const gradient = ctx.createRadialGradient(
      proj.x, proj.y, 0,
      proj.x, proj.y, proj.size * 2
    );
    gradient.addColorStop(0, proj.color);
    gradient.addColorStop(1, 'transparent');
    
    ctx.fillStyle = gradient;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.size * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /**
   * Draw hover indicator for tower placement (world coordinates)
   */
  drawHoverIndicator(pathCells, towers) {
    if (this.hoverGridX < 0 || this.hoverGridY < 0) return;
    
    const ctx = this.ctx;
    const gridSize = CONFIG.GRID_SIZE;
    const x = this.hoverGridX * gridSize;
    const y = this.hoverGridY * gridSize;
    const zoom = this.camera ? this.camera.zoom : 1;
    
    const canPlace = this.canPlaceHover;
    
    ctx.fillStyle = canPlace ? 'rgba(72, 187, 120, 0.3)' : 'rgba(245, 101, 101, 0.3)';
    ctx.fillRect(x, y, gridSize, gridSize);
    
    ctx.strokeStyle = canPlace ? '#48bb78' : '#f56565';
    ctx.lineWidth = 2 / zoom;
    ctx.strokeRect(x, y, gridSize, gridSize);
    
    // Preview tower range if can place
    if (canPlace) {
      const centerX = x + gridSize / 2;
      const centerY = y + gridSize / 2;
      
      ctx.strokeStyle = 'rgba(72, 187, 120, 0.2)';
      ctx.fillStyle = 'rgba(72, 187, 120, 0.05)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, CONFIG.TOWER_BASE_RANGE, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  /**
   * Draw minimap (screen coordinates - UI overlay)
   */
  drawMinimap(data) {
    if (!this.camera) return;
    
    const ctx = this.ctx;
    const minimapSize = 80;
    const margin = 10;
    const x = this.width - minimapSize - margin;
    const y = this.height - minimapSize - margin;
    const scale = minimapSize / CONFIG.MAP_WIDTH;
    
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, minimapSize, minimapSize);
    
    // Path cells (simplified)
    ctx.fillStyle = CONFIG.COLORS.path;
    for (const cell of data.pathCells) {
      ctx.fillRect(
        x + cell.x * CONFIG.GRID_SIZE * scale,
        y + cell.y * CONFIG.GRID_SIZE * scale,
        Math.max(1, CONFIG.GRID_SIZE * scale),
        Math.max(1, CONFIG.GRID_SIZE * scale)
      );
    }
    
    // Towers
    ctx.fillStyle = '#48bb78';
    for (const tower of data.towers) {
      ctx.beginPath();
      ctx.arc(x + tower.x * scale, y + tower.y * scale, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Enemies
    ctx.fillStyle = '#fc8181';
    for (const enemy of data.enemies) {
      ctx.beginPath();
      ctx.arc(x + enemy.x * scale, y + enemy.y * scale, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Viewport rectangle
    const visibleArea = this.camera.getVisibleArea();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      x + visibleArea.x * scale,
      y + visibleArea.y * scale,
      visibleArea.width * scale,
      visibleArea.height * scale
    );
    
    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(x, y, minimapSize, minimapSize);
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
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
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
