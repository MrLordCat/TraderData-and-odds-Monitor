/**
 * Power Towers TD - Game Renderer
 * Handles all Canvas rendering
 */

const CONFIG = require('../config');

class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    
    // Animation state
    this.frameCount = 0;
    
    // Hover state
    this.hoverGridX = -1;
    this.hoverGridY = -1;
    this.canPlaceHover = false;
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
    
    // Draw layers in order
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
  }

  /**
   * Draw grid
   */
  drawGrid() {
    const ctx = this.ctx;
    const gridSize = CONFIG.GRID_SIZE;
    
    ctx.strokeStyle = CONFIG.COLORS.grid;
    ctx.lineWidth = 1;
    
    // Vertical lines
    for (let x = 0; x <= this.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y <= this.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }
  }

  /**
   * Draw enemy path
   */
  drawPath(waypoints, pathCells) {
    const ctx = this.ctx;
    const gridSize = CONFIG.GRID_SIZE;
    
    // Draw path cells
    ctx.fillStyle = CONFIG.COLORS.path;
    for (const cell of pathCells) {
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
    ctx.lineWidth = 3;
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
   * Draw player base
   */
  drawBase(waypoints) {
    if (waypoints.length === 0) return;
    
    const ctx = this.ctx;
    const base = waypoints[waypoints.length - 1];
    const size = 20;
    
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
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * Draw all towers
   */
  drawTowers(towers, selectedTower) {
    for (const tower of towers) {
      this.drawTower(tower, tower === selectedTower);
    }
  }

  /**
   * Draw single tower
   */
  drawTower(tower, isSelected) {
    const ctx = this.ctx;
    const size = tower.size / 2;
    
    // Selection indicator
    if (isSelected) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
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
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Turret (line showing direction)
    const turretLength = size * 0.8;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
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
   * Draw range indicator
   */
  drawRangeIndicator(tower) {
    const ctx = this.ctx;
    
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
    ctx.lineWidth = 1;
    
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
      this.drawEnemy(enemy);
    }
  }

  /**
   * Draw single enemy
   */
  drawEnemy(enemy) {
    const ctx = this.ctx;
    const size = enemy.size;
    
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
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Effects indicators
    if (enemy.slowDuration > 0) {
      // Slow effect (blue tint)
      ctx.strokeStyle = '#63b3ed';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, size + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    if (enemy.burnDuration > 0) {
      // Burn effect (particles)
      const flicker = Math.sin(this.frameCount * 0.3) * 2;
      ctx.fillStyle = '#f56565';
      ctx.beginPath();
      ctx.arc(enemy.x + flicker, enemy.y - size - 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Health bar
    this.drawHealthBar(enemy.x, enemy.y - size - 8, size * 2, 4, enemy.getHealthPercent());
  }

  /**
   * Draw health bar
   */
  drawHealthBar(x, y, width, height, percent) {
    const ctx = this.ctx;
    const left = x - width / 2;
    
    // Background
    ctx.fillStyle = CONFIG.COLORS.healthBar.bg;
    ctx.fillRect(left, y, width, height);
    
    // Fill
    const fillColor = percent > 0.3 ? CONFIG.COLORS.healthBar.fill : CONFIG.COLORS.healthBar.low;
    ctx.fillStyle = fillColor;
    ctx.fillRect(left, y, width * percent, height);
    
    // Border
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
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
   * Draw single projectile
   */
  drawProjectile(proj) {
    const ctx = this.ctx;
    
    // Trail
    if (proj.trail.length > 1) {
      ctx.strokeStyle = proj.color;
      ctx.lineWidth = 2;
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
   * Draw hover indicator for tower placement
   */
  drawHoverIndicator(pathCells, towers) {
    if (this.hoverGridX < 0 || this.hoverGridY < 0) return;
    
    const ctx = this.ctx;
    const gridSize = CONFIG.GRID_SIZE;
    const x = this.hoverGridX * gridSize;
    const y = this.hoverGridY * gridSize;
    
    // Check if can place
    const canPlace = this.canPlaceHover;
    
    ctx.fillStyle = canPlace ? 'rgba(72, 187, 120, 0.3)' : 'rgba(245, 101, 101, 0.3)';
    ctx.fillRect(x, y, gridSize, gridSize);
    
    ctx.strokeStyle = canPlace ? '#48bb78' : '#f56565';
    ctx.lineWidth = 2;
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
   * Set hover position
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
   * Convert screen coords to grid coords
   */
  screenToGrid(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    const canvasX = (screenX - rect.left) * scaleX;
    const canvasY = (screenY - rect.top) * scaleY;
    
    return {
      gridX: Math.floor(canvasX / CONFIG.GRID_SIZE),
      gridY: Math.floor(canvasY / CONFIG.GRID_SIZE),
      canvasX,
      canvasY
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
  }
}

module.exports = { GameRenderer };
