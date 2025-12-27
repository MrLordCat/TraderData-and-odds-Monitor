/**
 * Power Towers TD - Projectile Entity
 */

let projectileIdCounter = 0;

class Projectile {
  constructor(data) {
    this.id = ++projectileIdCounter;
    
    // Position
    this.x = data.startX;
    this.y = data.startY;
    this.targetX = data.targetX;
    this.targetY = data.targetY;
    
    // Source
    this.towerId = data.towerId;
    this.targetId = data.targetId;
    
    // Stats (copied from attack)
    this.damage = data.damage;
    this.damageType = data.damageType || 'physical';
    this.splashRadius = data.splashRadius || 0;
    this.chainCount = data.chainCount || 0;
    this.slowPercent = data.slowPercent || 0;
    this.slowDuration = data.slowDuration || 0;
    this.burnDamage = data.burnDamage || 0;
    this.burnDuration = data.burnDuration || 0;
    
    // Movement
    this.speed = data.speed || 5;
    
    // Visual
    this.size = 4;
    this.color = data.color || '#ffd700';
    this.trail = [];
    this.maxTrailLength = 5;
    
    // State
    this.alive = true;
    this.chainedTargets = [];  // for chain lightning
  }

  /**
   * Update projectile position
   * @param {Object} target - Current target enemy
   * @returns {boolean} true if reached target
   */
  update(target) {
    if (!this.alive) return false;

    // Save trail position
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }

    // Update target position if target is alive
    if (target && target.alive) {
      this.targetX = target.x;
      this.targetY = target.y;
    }

    // Move towards target
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < this.speed) {
      // Reached target
      this.x = this.targetX;
      this.y = this.targetY;
      return true;
    }

    this.x += (dx / dist) * this.speed;
    this.y += (dy / dist) * this.speed;
    
    return false;
  }

  /**
   * Mark projectile as hit
   */
  hit() {
    this.alive = false;
  }

  /**
   * Get all enemies in splash radius
   */
  getEnemiesInSplash(enemies) {
    if (this.splashRadius <= 0) return [];
    
    return enemies.filter(e => {
      if (!e.alive || e.id === this.targetId) return false;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      return Math.sqrt(dx * dx + dy * dy) <= this.splashRadius;
    });
  }

  /**
   * Get next chain target
   */
  getNextChainTarget(enemies) {
    if (this.chainCount <= 0) return null;
    
    let nearest = null;
    let nearestDist = 100;  // max chain range
    
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (enemy.id === this.targetId) continue;
      if (this.chainedTargets.includes(enemy.id)) continue;
      
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }
    
    return nearest;
  }
}

module.exports = { Projectile };
