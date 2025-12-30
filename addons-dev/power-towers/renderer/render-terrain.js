/**
 * Power Towers TD - Terrain Rendering
 * 
 * Handles terrain, grid, path, biomes and special elements rendering.
 * 
 * OPTIMIZED: 
 * - Static decorations (trees, rocks, dunes) are cached
 * - Animated elements (waves, smoke) drawn in dynamic layer
 * - Biomes are drawn as base layer, terrain overlays on top
 */

const CONFIG = require('../core/config');

// Biomes that have animated decorations (for dynamic layer)
const ANIMATED_BIOMES = new Set(['water', 'burned']);

/**
 * Draw biome layer (base layer before terrain)
 * Biomes provide visual variety and modifiers for buildings
 * @param {boolean} staticOnly - If true, skip animated decorations (for cache)
 */
function drawBiomes(ctx, biomeMap, biomeTypes, camera, frameCount, staticOnly = false) {
  if (!biomeMap || !biomeTypes) return;
  
  const gridSize = CONFIG.GRID_SIZE;
  
  // Only draw visible area for performance
  const visibleArea = camera ? camera.getVisibleArea() : 
    { x: 0, y: 0, width: CONFIG.MAP_WIDTH, height: CONFIG.MAP_HEIGHT };
  
  const startGridX = Math.floor(visibleArea.x / gridSize);
  const startGridY = Math.floor(visibleArea.y / gridSize);
  const endGridX = Math.ceil((visibleArea.x + visibleArea.width) / gridSize);
  const endGridY = Math.ceil((visibleArea.y + visibleArea.height) / gridSize);
  
  for (let gy = startGridY; gy <= endGridY; gy++) {
    if (!biomeMap[gy]) continue;
    for (let gx = startGridX; gx <= endGridX; gx++) {
      const biomeId = biomeMap[gy][gx];
      if (!biomeId) continue;
      
      const biomeDef = biomeTypes[biomeId];
      if (!biomeDef) continue;
      
      const x = gx * gridSize;
      const y = gy * gridSize;
      
      // Choose color variant for visual variety
      let color = biomeDef.color;
      if (biomeDef.colorVariants && biomeDef.colorVariants.length > 0) {
        // Use cell position for consistent variation
        const variantIndex = (gx * 7 + gy * 11) % (biomeDef.colorVariants.length + 1);
        if (variantIndex > 0) {
          color = biomeDef.colorVariants[variantIndex - 1];
        }
      }
      
      // Draw biome cell
      ctx.fillStyle = color;
      ctx.fillRect(x, y, gridSize, gridSize);
      
      // Add static biome decorations (trees, rocks, etc.)
      // Skip animated decorations if staticOnly
      drawBiomeDecoration(ctx, biomeId, biomeDef, x, y, gridSize, frameCount, false);
    }
  }
}

/**
 * Draw ONLY animated biome decorations (water waves, smoke)
 * Called in dynamic layer every frame
 */
function drawAnimatedBiomeDecorations(ctx, biomeMap, biomeTypes, camera, frameCount) {
  if (!biomeMap || !biomeTypes) return;
  
  const gridSize = CONFIG.GRID_SIZE;
  
  // Only draw visible area
  const visibleArea = camera ? camera.getVisibleArea() : 
    { x: 0, y: 0, width: CONFIG.MAP_WIDTH, height: CONFIG.MAP_HEIGHT };
  
  const startGridX = Math.floor(visibleArea.x / gridSize);
  const startGridY = Math.floor(visibleArea.y / gridSize);
  const endGridX = Math.ceil((visibleArea.x + visibleArea.width) / gridSize);
  const endGridY = Math.ceil((visibleArea.y + visibleArea.height) / gridSize);
  
  for (let gy = startGridY; gy <= endGridY; gy++) {
    if (!biomeMap[gy]) continue;
    for (let gx = startGridX; gx <= endGridX; gx++) {
      const biomeId = biomeMap[gy][gx];
      
      // Only process biomes with animations
      if (!biomeId || !ANIMATED_BIOMES.has(biomeId)) continue;
      
      const biomeDef = biomeTypes[biomeId];
      if (!biomeDef) continue;
      
      const x = gx * gridSize;
      const y = gy * gridSize;
      
      // Draw only animated decorations
      drawBiomeDecoration(ctx, biomeId, biomeDef, x, y, gridSize, frameCount, true);
    }
  }
}
/**
 * Draw biome-specific decorations
 * @param {boolean} animatedOnly - If true, only draw animated decorations (for dynamic layer)
 */
function drawBiomeDecoration(ctx, biomeId, biomeDef, x, y, size, frameCount, animatedOnly = false) {
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  
  switch (biomeId) {
    case 'forest':
      // Static trees (skip if animatedOnly)
      if (!animatedOnly) {
        const treeHash = (Math.floor(x) * 31 + Math.floor(y) * 17) % 100;
        if (treeHash < 40) {
          ctx.fillStyle = 'rgba(34, 85, 34, 0.7)';
          const treeX = x + (treeHash % 3 + 1) * size / 4;
          const treeY = y + ((treeHash * 7) % 3 + 1) * size / 4;
          ctx.beginPath();
          ctx.arc(treeX, treeY, size * 0.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(101, 67, 33, 0.5)';
          ctx.fillRect(treeX - 2, treeY + size * 0.08, 4, size * 0.15);
        }
      }
      break;
      
    case 'water':
      // Animated waves (only in dynamic layer)
      if (animatedOnly) {
        const waveOffset = Math.sin(frameCount * 0.03 + x * 0.1 + y * 0.1) * 2;
        ctx.strokeStyle = 'rgba(100, 180, 220, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 4, centerY + waveOffset);
        ctx.quadraticCurveTo(centerX, centerY - 3 + waveOffset, x + size - 4, centerY + waveOffset);
        ctx.stroke();
      }
      break;
      
    case 'desert':
      // Static dunes (skip if animatedOnly)
      if (!animatedOnly) {
        const duneHash = (Math.floor(x) * 13 + Math.floor(y) * 23) % 100;
        if (duneHash < 25) {
          ctx.fillStyle = 'rgba(205, 175, 125, 0.4)';
          ctx.beginPath();
          ctx.moveTo(x + size * 0.2, y + size * 0.7);
          ctx.quadraticCurveTo(centerX, y + size * 0.4, x + size * 0.8, y + size * 0.7);
          ctx.fill();
        }
      }
      break;
      
    case 'mountains':
      // Static rocks (skip if animatedOnly)
      if (!animatedOnly) {
        const rockHash = (Math.floor(x) * 17 + Math.floor(y) * 29) % 100;
        if (rockHash < 30) {
          ctx.fillStyle = 'rgba(70, 70, 80, 0.5)';
          const rockX = x + (rockHash % 4) * size / 5 + size * 0.1;
          const rockY = y + ((rockHash * 3) % 4) * size / 5 + size * 0.1;
          ctx.beginPath();
          ctx.moveTo(rockX, rockY + size * 0.2);
          ctx.lineTo(rockX + size * 0.15, rockY);
          ctx.lineTo(rockX + size * 0.3, rockY + size * 0.2);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
      
    case 'plains':
      // Animated grass (only in dynamic layer) - но это дорого, сделаем статичной
      if (!animatedOnly) {
        const grassHash = (Math.floor(x) * 41 + Math.floor(y) * 37) % 100;
        if (grassHash < 15) {
          ctx.strokeStyle = 'rgba(100, 150, 80, 0.5)';
          ctx.lineWidth = 1;
          const grassX = x + (grassHash % 5 + 1) * size / 6;
          const grassY = y + size * 0.6;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(grassX + i * 3, grassY + size * 0.3);
            ctx.lineTo(grassX + i * 3, grassY - size * 0.15);
            ctx.stroke();
          }
        }
      }
      break;
      
    case 'burned':
      // Static ash (skip if animatedOnly)
      if (!animatedOnly) {
        ctx.fillStyle = 'rgba(30, 30, 30, 0.3)';
        const ashHash = (Math.floor(x) * 11 + Math.floor(y) * 19) % 100;
        if (ashHash < 40) {
          ctx.beginPath();
          ctx.arc(x + size * 0.3 + ashHash % 20, y + size * 0.5, size * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Animated smoke (only in dynamic layer)
      if (animatedOnly) {
        const smokeY = Math.sin(frameCount * 0.05 + x) * 3;
        ctx.fillStyle = 'rgba(100, 100, 100, 0.15)';
        ctx.beginPath();
        ctx.arc(centerX, centerY - size * 0.2 + smokeY, size * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
  }
}

/**
 * Draw terrain layer (overlays on biomes)
 */
function drawTerrain(ctx, terrain, terrainTypes, camera, frameCount, biomeMap, biomeTypes) {
  // First draw biomes as base layer
  if (biomeMap && biomeTypes) {
    drawBiomes(ctx, biomeMap, biomeTypes, camera, frameCount);
  }
  
  if (!terrain || !terrainTypes) return;
  
  const gridSize = CONFIG.GRID_SIZE;
  
  // Only draw visible terrain for performance
  const visibleArea = camera ? camera.getVisibleArea() : 
    { x: 0, y: 0, width: CONFIG.MAP_WIDTH, height: CONFIG.MAP_HEIGHT };
  
  const startGridX = Math.floor(visibleArea.x / gridSize);
  const startGridY = Math.floor(visibleArea.y / gridSize);
  const endGridX = Math.ceil((visibleArea.x + visibleArea.width) / gridSize);
  const endGridY = Math.ceil((visibleArea.y + visibleArea.height) / gridSize);
  
  // Draw special terrain (skip grass - biome provides that)
  for (let gy = startGridY; gy <= endGridY; gy++) {
    if (!terrain[gy]) continue;
    for (let gx = startGridX; gx <= endGridX; gx++) {
      const terrainType = terrain[gy][gx];
      
      // Skip grass (biome provides base) and path (drawn separately)
      if (!terrainType || terrainType === 'grass' || terrainType === 'path') continue;
      
      const terrainDef = terrainTypes[terrainType];
      if (!terrainDef) continue;
      
      const x = gx * gridSize;
      const y = gy * gridSize;
      
      // Draw terrain cell with semi-transparency to blend with biome
      ctx.fillStyle = terrainDef.color;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(x, y, gridSize, gridSize);
      ctx.globalAlpha = 1;
      
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
  drawBiomes,
  drawBiomeDecoration,
  drawAnimatedBiomeDecorations,
  drawTerrain,
  drawTerrainDecoration,
  drawSpecialElements,
  drawGrid,
  drawPath,
  drawBase
};
