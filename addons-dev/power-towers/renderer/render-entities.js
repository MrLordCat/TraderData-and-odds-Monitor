/**
 * Power Towers TD - Entity Rendering
 * 
 * Handles towers, enemies, projectiles rendering.
 */

const CONFIG = require('../core/config');

/**
 * Draw all towers
 */
function drawTowers(ctx, towers, selectedTower, camera) {
  for (const tower of towers) {
    if (camera && !camera.isVisible(
      tower.x - tower.range, tower.y - tower.range, 
      tower.range * 2, tower.range * 2
    )) continue;
    
    drawTower(ctx, tower, tower === selectedTower, camera);
  }
}

/**
 * Draw single tower
 */
function drawTower(ctx, tower, isSelected, camera) {
  const size = tower.size / 2;
  const zoom = camera ? camera.zoom : 1;
  
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
 * Draw range indicator for selected tower
 */
function drawRangeIndicator(ctx, tower, camera) {
  const zoom = camera ? camera.zoom : 1;
  
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
function drawEnemies(ctx, enemies, camera, frameCount) {
  for (const enemy of enemies) {
    if (camera && !camera.isVisible(
      enemy.x - enemy.size * 2, enemy.y - enemy.size * 2,
      enemy.size * 4, enemy.size * 4
    )) continue;
    
    drawEnemy(ctx, enemy, camera, frameCount);
  }
}

/**
 * Draw single enemy
 */
function drawEnemy(ctx, enemy, camera, frameCount) {
  const size = enemy.size;
  const zoom = camera ? camera.zoom : 1;
  
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
    const flicker = Math.sin(frameCount * 0.3) * 2;
    ctx.fillStyle = '#f56565';
    ctx.beginPath();
    ctx.arc(enemy.x + flicker, enemy.y - size - 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Health bar
  const healthPercent = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : 0;
  drawHealthBar(ctx, enemy.x, enemy.y - size - 8, size * 2, 4 / zoom, healthPercent, camera);
}

/**
 * Draw health bar
 */
function drawHealthBar(ctx, x, y, width, height, percent, camera) {
  const left = x - width / 2;
  
  ctx.fillStyle = CONFIG.COLORS.healthBar.bg;
  ctx.fillRect(left, y, width, height);
  
  const fillColor = percent > 0.3 ? CONFIG.COLORS.healthBar.fill : CONFIG.COLORS.healthBar.low;
  ctx.fillStyle = fillColor;
  ctx.fillRect(left, y, width * percent, height);
  
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1 / (camera ? camera.zoom : 1);
  ctx.strokeRect(left, y, width, height);
}

/**
 * Draw all projectiles
 */
function drawProjectiles(ctx, projectiles, camera) {
  for (const proj of projectiles) {
    drawProjectile(ctx, proj, camera);
  }
}

/**
 * Draw single projectile
 */
function drawProjectile(ctx, proj, camera) {
  const zoom = camera ? camera.zoom : 1;
  
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
 * Draw all damage numbers
 */
function drawDamageNumbers(ctx, damageNumbers, camera) {
  for (const num of damageNumbers) {
    drawDamageNumber(ctx, num, camera);
  }
}

/**
 * Draw single damage number
 */
function drawDamageNumber(ctx, num, camera) {
  const zoom = camera ? camera.zoom : 1;
  
  ctx.save();
  
  // Set alpha for fade effect
  ctx.globalAlpha = num.alpha;
  
  // Font size adjusted for zoom and scale animation
  const fontSize = (num.fontSize * num.scale) / zoom;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Text content
  const text = num.isCrit ? `${num.value}!` : String(num.value);
  
  // Draw outline for better visibility
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.lineWidth = 3 / zoom;
  ctx.strokeText(text, num.x, num.y);
  
  // Draw text
  ctx.fillStyle = num.color;
  ctx.fillText(text, num.x, num.y);
  
  ctx.restore();
}

/**
 * Draw all visual effects (explosions, lightning bolts, etc.)
 */
function drawEffects(ctx, effects, camera) {
  for (const effect of effects) {
    drawEffect(ctx, effect, camera);
  }
}

/**
 * Draw single visual effect
 */
function drawEffect(ctx, effect, camera) {
  const zoom = camera ? camera.zoom : 1;
  const progress = effect.elapsed / effect.duration;
  const alpha = 1 - progress; // Fade out over time
  
  ctx.save();
  ctx.globalAlpha = alpha;
  
  switch (effect.type) {
    case 'explosion':
      // Draw expanding explosion circle
      const expandedRadius = effect.radius * (0.5 + progress * 0.5);
      
      // Outer glow
      const gradient = ctx.createRadialGradient(
        effect.x, effect.y, 0,
        effect.x, effect.y, expandedRadius
      );
      gradient.addColorStop(0, effect.color || '#ff6600');
      gradient.addColorStop(0.5, effect.isSplash ? '#ff9900' : '#ff3300');
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, expandedRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner bright core
      if (progress < 0.3) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = alpha * (1 - progress / 0.3);
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
      
    case 'lightning-bolt':
      // Draw jagged lightning line
      ctx.strokeStyle = effect.color || '#ffd700';
      ctx.lineWidth = (3 / zoom) * (1 - progress * 0.5);
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(effect.startX, effect.startY);
      
      // Create zigzag pattern
      const dx = effect.endX - effect.startX;
      const dy = effect.endY - effect.startY;
      const segments = 5;
      
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const offset = (Math.random() - 0.5) * 15 / zoom;
        ctx.lineTo(
          effect.startX + dx * t + offset,
          effect.startY + dy * t + offset
        );
      }
      ctx.lineTo(effect.endX, effect.endY);
      ctx.stroke();
      
      // Glow effect
      ctx.globalAlpha = alpha * 0.3;
      ctx.lineWidth = (8 / zoom) * (1 - progress * 0.5);
      ctx.stroke();
      break;
      
    case 'impact':
      // Small impact burst
      ctx.fillStyle = effect.color || '#fff';
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.size * (1 + progress), 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  
  ctx.restore();
}

/**
 * Draw energy buildings
 */
function drawEnergyBuildings(ctx, buildings, camera) {
  if (!buildings || buildings.length === 0) return;
  
  const GRID_SIZE = CONFIG.GRID_SIZE;
  const zoom = camera ? camera.zoom : 1;
  
  for (const building of buildings) {
    // Skip if not visible
    if (camera && !camera.isVisible(
      building.worldX - GRID_SIZE, building.worldY - GRID_SIZE,
      GRID_SIZE * 2, GRID_SIZE * 2
    )) continue;
    
    const x = building.worldX;
    const y = building.worldY;
    const size = GRID_SIZE * 0.8;
    
    // Background circle with category color
    ctx.fillStyle = building.categoryColor || '#4a5568';
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2 / zoom;
    ctx.stroke();
    
    // Icon (emoji)
    if (building.icon) {
      ctx.font = `${Math.round(size * 0.6)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(building.icon, x, y);
    }
    
    // Energy bar for generators
    if (building.energy !== undefined && building.maxEnergy > 0) {
      const barWidth = size;
      const barHeight = 4 / zoom;
      const barX = x - barWidth / 2;
      const barY = y + size / 2 + 4 / zoom;
      const fillWidth = (building.energy / building.maxEnergy) * barWidth;
      
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      // Fill
      ctx.fillStyle = building.nodeType === 'generator' ? '#4ade80' : '#60a5fa';
      ctx.fillRect(barX, barY, fillWidth, barHeight);
    }
  }
}

/**
 * Draw energy connections between buildings
 */
function drawEnergyConnections(ctx, buildings, connections, camera) {
  if (!connections || connections.length === 0) return;
  
  const zoom = camera ? camera.zoom : 1;
  
  ctx.save();
  ctx.lineWidth = 2 / zoom;
  ctx.lineCap = 'round';
  
  for (const conn of connections) {
    // Connection has { from: {x,y}, to: {x,y}, active }
    const fromX = conn.from?.x || 0;
    const fromY = conn.from?.y || 0;
    const toX = conn.to?.x || 0;
    const toY = conn.to?.y || 0;
    
    if (fromX === 0 && fromY === 0) continue;
    if (toX === 0 && toY === 0) continue;
    
    // Draw connection line
    const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY);
    gradient.addColorStop(0, conn.active ? 'rgba(74, 222, 128, 0.7)' : 'rgba(100, 100, 100, 0.4)');
    gradient.addColorStop(1, conn.active ? 'rgba(96, 165, 250, 0.7)' : 'rgba(100, 100, 100, 0.4)');
    
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    
    // Draw energy flow particles (animated) - only when active
    if (conn.active) {
      const time = Date.now() / 1000;
      const flowPos = (time % 1); // 0-1 position along line
      const px = fromX + (toX - fromX) * flowPos;
      const py = fromY + (toY - fromY) * flowPos;
      
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(px, py, 3 / zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.restore();
}

/**
 * Draw connection range indicator for an energy building
 */
function drawConnectionRange(ctx, building, camera) {
  if (!building) return;
  
  const GRID_SIZE = CONFIG.GRID_SIZE;
  const zoom = camera ? camera.zoom : 1;
  
  const x = building.worldX;
  const y = building.worldY;
  // Use getEffectiveRange if available, fallback to range property
  const rangeInCells = building.getEffectiveRange?.() || building.range || 4;
  const range = rangeInCells * GRID_SIZE; // Range in pixels
  
  // Draw range circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, range, 0, Math.PI * 2);
  
  // Pulsing effect
  const pulse = Math.sin(Date.now() / 200) * 0.15 + 0.35;
  ctx.fillStyle = `rgba(96, 165, 250, ${pulse * 0.3})`;
  ctx.fill();
  
  // Border
  ctx.strokeStyle = `rgba(96, 165, 250, ${pulse + 0.3})`;
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash([8 / zoom, 4 / zoom]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

module.exports = {
  drawTowers,
  drawTower,
  drawRangeIndicator,
  drawEnemies,
  drawEnemy,
  drawHealthBar,
  drawProjectiles,
  drawProjectile,
  drawDamageNumbers,
  drawDamageNumber,
  drawEffects,
  drawEffect,
  drawEnergyBuildings,
  drawEnergyConnections,
  drawConnectionRange
};
