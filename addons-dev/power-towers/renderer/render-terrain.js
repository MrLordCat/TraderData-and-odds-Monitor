/**
 * Power Towers TD - Terrain Rendering
 * 
 * Handles terrain, grid, path, and special elements rendering.
 */

const CONFIG = require('../core/config');

/**
 * Draw terrain layer
 */
function drawTerrain(ctx, terrain, terrainTypes, camera, frameCount) {
  if (!terrain || !terrainTypes) return;
  
  const gridSize = CONFIG.GRID_SIZE;
  
  // Only draw visible terrain for performance
  const visibleArea = camera ? camera.getVisibleArea() : 
    { x: 0, y: 0, width: CONFIG.MAP_WIDTH, height: CONFIG.MAP_HEIGHT };
  
  const startGridX = Math.floor(visibleArea.x / gridSize);
  const startGridY = Math.floor(visibleArea.y / gridSize);
  const endGridX = Math.ceil((visibleArea.x + visibleArea.width) / gridSize);
  const endGridY = Math.ceil((visibleArea.y + visibleArea.height) / gridSize);
  
  // Draw base terrain (skip grass - that's the background)
  for (let gy = startGridY; gy <= endGridY; gy++) {
    if (!terrain[gy]) continue;
    for (let gx = startGridX; gx <= endGridX; gx++) {
      const terrainType = terrain[gy][gx];
      
      // Skip grass (background) and path (drawn separately)
      if (!terrainType || terrainType === 'grass' || terrainType === 'path') continue;
      
      const terrainDef = terrainTypes[terrainType];
      if (!terrainDef) continue;
      
      const x = gx * gridSize;
      const y = gy * gridSize;
      
      // Draw terrain cell
      ctx.fillStyle = terrainDef.color;
      ctx.fillRect(x, y, gridSize, gridSize);
      
      // Add terrain decorations
      drawTerrainDecoration(ctx, terrainType, x, y, gridSize);
    }
  }
}

/**
 * Draw terrain decoration (patterns, icons)
 */
function drawTerrainDecoration(ctx, terrainType, x, y, size) {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  
  switch (terrainType) {
    case 'hill':
      ctx.fillStyle = 'rgba(139, 119, 101, 0.4)';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.5, y + size * 0.2);
      ctx.lineTo(x + size * 0.8, y + size * 0.8);
      ctx.lineTo(x + size * 0.2, y + size * 0.8);
      ctx.closePath();
      ctx.fill();
      break;
      
    case 'forest':
      ctx.fillStyle = 'rgba(34, 85, 34, 0.6)';
      ctx.beginPath();
      ctx.arc(centerX, centerY - 2, size * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(101, 67, 33, 0.6)';
      ctx.fillRect(centerX - 2, centerY + 2, 4, size * 0.25);
      break;
      
    case 'water':
      ctx.strokeStyle = 'rgba(100, 180, 220, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, centerY);
      ctx.quadraticCurveTo(centerX, centerY - 4, x + size - 4, centerY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 4, centerY + 5);
      ctx.quadraticCurveTo(centerX, centerY + 1, x + size - 4, centerY + 5);
      ctx.stroke();
      break;
  }
}

/**
 * Draw special elements (energy nodes, resource veins)
 */
function drawSpecialElements(ctx, energyNodes, resourceVeins, terrainTypes, frameCount) {
  const gridSize = CONFIG.GRID_SIZE;
  
  // Draw energy nodes
  if (energyNodes && terrainTypes.energy_node) {
    const def = terrainTypes.energy_node;
    energyNodes.forEach(node => {
      const x = node.x * gridSize;
      const y = node.y * gridSize;
      const centerX = x + gridSize / 2;
      const centerY = y + gridSize / 2;
      
      // Animated glow (pulsing)
      const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.05);
      const glowRadius = gridSize * (0.6 + pulse * 0.2);
      
      // Draw glow
      const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, glowRadius
      );
      gradient.addColorStop(0, def.glowColor || 'rgba(74, 144, 217, 0.6)');
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw energy symbol
      ctx.fillStyle = '#fff';
      ctx.font = `${gridSize * 0.6}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', centerX, centerY);
    });
  }
  
  // Draw resource veins
  if (resourceVeins && terrainTypes.resource_vein) {
    const def = terrainTypes.resource_vein;
    resourceVeins.forEach(vein => {
      const x = vein.x * gridSize;
      const y = vein.y * gridSize;
      const centerX = x + gridSize / 2;
      const centerY = y + gridSize / 2;
      
      // Shimmering effect
      const shimmer = 0.5 + 0.5 * Math.sin(frameCount * 0.03 + vein.x);
      
      // Draw glow
      const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, gridSize * 0.5
      );
      gradient.addColorStop(0, def.glowColor || 'rgba(212, 175, 55, 0.5)');
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.globalAlpha = 0.5 + shimmer * 0.3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, gridSize * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      
      // Draw gem symbol
      ctx.fillStyle = '#fff';
      ctx.font = `${gridSize * 0.5}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💎', centerX, centerY);
    });
  }
}

/**
 * Draw grid lines
 */
function drawGrid(ctx, camera) {
  const gridSize = CONFIG.GRID_SIZE;
  const mapWidth = CONFIG.MAP_WIDTH;
  const mapHeight = CONFIG.MAP_HEIGHT;
  
  const visibleArea = camera ? camera.getVisibleArea() : 
    { x: 0, y: 0, width: mapWidth, height: mapHeight };
  
  const startGridX = Math.floor(visibleArea.x / gridSize);
  const startGridY = Math.floor(visibleArea.y / gridSize);
  const endGridX = Math.ceil((visibleArea.x + visibleArea.width) / gridSize);
  const endGridY = Math.ceil((visibleArea.y + visibleArea.height) / gridSize);
  
  ctx.strokeStyle = CONFIG.COLORS.grid;
  ctx.lineWidth = 1 / (camera ? camera.zoom : 1);
  
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
 * Draw enemy path
 */
function drawPath(ctx, waypoints, pathCells, camera) {
  const gridSize = CONFIG.GRID_SIZE;
  
  // Draw path cells
  ctx.fillStyle = CONFIG.COLORS.path;
  for (const cell of pathCells) {
    if (camera && !camera.isVisible(
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
  ctx.lineWidth = 3 / (camera ? camera.zoom : 1);
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
function drawBase(ctx, waypoints, camera) {
  if (waypoints.length === 0) return;
  
  const base = waypoints[waypoints.length - 1];
  const size = CONFIG.GRID_SIZE * 1.5;
  
  if (camera && !camera.isVisible(base.x - size*2, base.y - size*2, size*4, size*4)) return;
  
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
  
  // Base icon (house shape)
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
  ctx.lineWidth = 2 / (camera ? camera.zoom : 1);
  ctx.stroke();
}

module.exports = {
  drawTerrain,
  drawTerrainDecoration,
  drawSpecialElements,
  drawGrid,
  drawPath,
  drawBase
};
