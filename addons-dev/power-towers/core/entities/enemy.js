/**
 * Power Towers TD - Enemy Entity
 */

const CONFIG = require('../config');

let enemyIdCounter = 0;

class Enemy {
  constructor(data = {}) {
    this.id = ++enemyIdCounter;
    this.type = data.type || 'normal';
    
    // Position & Movement
    this.x = data.x || 0;
    this.y = data.y || 0;
    this.waypointIndex = 0;
    this.speed = data.speed || CONFIG.ENEMY_BASE_SPEED;
    
    // Stats
    this.hp = data.hp || CONFIG.ENEMY_BASE_HP;
    this.maxHp = data.maxHp || this.hp;
    this.armor = data.armor || 0;
    this.armorType = data.armorType || 'light';  // light, medium, heavy, magic
    
    // Reward
    this.reward = data.reward || CONFIG.ENEMY_BASE_REWARD;
    
    // Visual
    this.size = data.size || 12;
    this.color = CONFIG.COLORS.enemy[this.type] || CONFIG.COLORS.enemy.normal;
    
    // State
    this.alive = true;
    this.slowEffect = 0;      // slow percentage (0-1)
    this.slowDuration = 0;    // ticks remaining
    this.burnDamage = 0;      // DoT damage per tick
    this.burnDuration = 0;    // ticks remaining
  }

  /**
   * Update enemy position along path
   * @param {Array} waypoints - Path waypoints (absolute coords)
   * @returns {boolean} true if reached end of path
   */
  update(waypoints) {
    if (!this.alive || this.waypointIndex >= waypoints.length) {
      return this.waypointIndex >= waypoints.length;
    }

    // Apply slow effect
    let currentSpeed = this.speed;
    if (this.slowDuration > 0) {
      currentSpeed *= (1 - this.slowEffect);
      this.slowDuration--;
    }

    // Apply burn damage
    if (this.burnDuration > 0) {
      this.takeDamage(this.burnDamage, 'fire');
      this.burnDuration--;
    }

    // Move towards current waypoint
    const target = waypoints[this.waypointIndex];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < currentSpeed) {
      // Reached waypoint, move to next
      this.x = target.x;
      this.y = target.y;
      this.waypointIndex++;
      return this.waypointIndex >= waypoints.length;
    }

    // Move towards waypoint
    this.x += (dx / dist) * currentSpeed;
    this.y += (dy / dist) * currentSpeed;
    
    return false;
  }

  /**
   * Apply damage to enemy
   * @param {number} damage - Raw damage
   * @param {string} damageType - Type of damage (physical, magical, fire, ice, etc.)
   * @returns {number} Actual damage dealt
   */
  takeDamage(damage, damageType = 'physical') {
    if (!this.alive) return 0;

    // Apply armor reduction for physical damage
    let actualDamage = damage;
    if (damageType === 'physical') {
      actualDamage = Math.max(1, damage - this.armor);
    }

    this.hp -= actualDamage;
    
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }

    return actualDamage;
  }

  /**
   * Apply slow effect
   */
  applySlow(percentage, duration) {
    // Take stronger slow
    if (percentage > this.slowEffect || duration > this.slowDuration) {
      this.slowEffect = Math.min(0.8, percentage);  // cap at 80%
      this.slowDuration = duration;
    }
  }

  /**
   * Apply burn (DoT)
   */
  applyBurn(damagePerTick, duration) {
    this.burnDamage = Math.max(this.burnDamage, damagePerTick);
    this.burnDuration = Math.max(this.burnDuration, duration);
  }

  /**
   * Get distance to a point
   */
  distanceTo(x, y) {
    const dx = this.x - x;
    const dy = this.y - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get health percentage
   */
  getHealthPercent() {
    return this.hp / this.maxHp;
  }
}

/**
 * Factory function to create enemies from data
 */
function createEnemy(type, waveNum, startPos) {
  const baseHp = CONFIG.ENEMY_BASE_HP + CONFIG.ENEMY_HP_PER_WAVE * waveNum;
  const baseSpeed = CONFIG.ENEMY_BASE_SPEED + CONFIG.ENEMY_SPEED_PER_WAVE * waveNum;
  const baseReward = CONFIG.ENEMY_BASE_REWARD + waveNum;

  const templates = {
    normal: {
      type: 'normal',
      hp: baseHp,
      speed: baseSpeed,
      reward: baseReward,
      armorType: 'light'
    },
    fast: {
      type: 'fast',
      hp: baseHp * 0.6,
      speed: baseSpeed * 1.5,
      reward: baseReward * 0.8,
      armorType: 'light',
      size: 10
    },
    tank: {
      type: 'tank',
      hp: baseHp * 2,
      speed: baseSpeed * 0.6,
      reward: baseReward * 1.5,
      armor: 5,
      armorType: 'heavy',
      size: 16
    },
    flying: {
      type: 'flying',
      hp: baseHp * 0.8,
      speed: baseSpeed * 1.2,
      reward: baseReward * 1.2,
      armorType: 'light',
      size: 10
    }
  };

  const template = templates[type] || templates.normal;
  
  return new Enemy({
    ...template,
    x: startPos.x,
    y: startPos.y,
    maxHp: template.hp
  });
}

module.exports = { Enemy, createEnemy };
