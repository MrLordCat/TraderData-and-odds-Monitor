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

module.exports = {
  drawTowers,
  drawTower,
  drawRangeIndicator,
  drawEnemies,
  drawEnemy,
  drawHealthBar,
  drawProjectiles,
  drawProjectile
};
