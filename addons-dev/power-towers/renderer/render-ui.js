/**
 * Power Towers TD - UI Rendering
 * 
 * Handles minimap, hover indicator, and other UI overlays.
 */

const CONFIG = require('../core/config');

/**
 * Draw hover indicator for tower placement
 */
function drawHoverIndicator(ctx, hoverGridX, hoverGridY, canPlace, camera) {
  if (hoverGridX < 0 || hoverGridY < 0) return;
  
  const gridSize = CONFIG.GRID_SIZE;
  const x = hoverGridX * gridSize;
  const y = hoverGridY * gridSize;
  const zoom = camera ? camera.zoom : 1;
  
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
function drawMinimap(ctx, data, camera, canvasWidth, canvasHeight) {
  if (!camera) return;
  
  const minimapSize = 80;
  const margin = 10;
  const x = canvasWidth - minimapSize - margin;
  const y = canvasHeight - minimapSize - margin;
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
  const visibleArea = camera.getVisibleArea();
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

module.exports = {
  drawHoverIndicator,
  drawMinimap
};
