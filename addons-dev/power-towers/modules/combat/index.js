/**
 * Power Towers TD - Combat Module
 * 
 * Handles damage calculation, projectiles, and special effects.
 * Acts as bridge between towers and enemies for combat resolution.
 */

const { GameEvents } = require('../../core/event-bus');

// Projectile types
const PROJECTILE_TYPES = {
  fire: {
    speed: 300,
    color: '#ff4500',
    size: 4,
    trail: true
  },
  ice: {
    speed: 200,
    color: '#00bfff',
    size: 5,
    trail: false
  },
  lightning: {
    speed: 1000, // instant-ish
    color: '#ffd700',
    size: 3,
    chain: true
  },
  nature: {
    speed: 250,
    color: '#32cd32',
    size: 4,
    trail: false
  },
  dark: {
    speed: 200,
    color: '#800080',
    size: 6,
    trail: true
  }
};

class CombatModule {
  /**
   * @param {EventBus} eventBus - Event system
   * @param {object} config - Game configuration
   */
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    
    // Active projectiles
    this.projectiles = [];
    this.nextProjectileId = 1;
    
    // Visual effects
    this.effects = [];
  }

  /**
   * Initialize module
   */
  init() {
    this.eventBus.on(GameEvents.GAME_START, () => this.reset());
    this.eventBus.on('combat:tower-attack', (data) => this.handleTowerAttack(data));
  }

  /**
   * Update projectiles and effects
   */
  update(deltaTime, enemies) {
    this.updateProjectiles(deltaTime, enemies);
    this.updateEffects(deltaTime);
  }

  /**
   * Reset
   */
  reset() {
    this.projectiles = [];
    this.nextProjectileId = 1;
    this.effects = [];
  }

  /**
   * Cleanup
   */
  destroy() {
    this.reset();
  }

  /**
   * Handle tower attack
   */
  handleTowerAttack({ towerId, towerType, targetId, damage, position, targetPosition }) {
    // Create projectile
    const projectileDef = PROJECTILE_TYPES[towerType] || PROJECTILE_TYPES.fire;
    
    const projectile = {
      id: this.nextProjectileId++,
      towerId,
      towerType,
      targetId,
      damage,
      x: position.x,
      y: position.y,
      targetX: targetPosition.x,
      targetY: targetPosition.y,
      speed: projectileDef.speed,
      color: projectileDef.color,
      size: projectileDef.size,
      chain: projectileDef.chain,
      trail: projectileDef.trail,
      // Trail history
      trailPoints: projectileDef.trail ? [{ x: position.x, y: position.y }] : []
    };
    
    this.projectiles.push(projectile);
    
    // For lightning (instant), skip projectile travel
    if (towerType === 'lightning') {
      this.instantHit(projectile);
    }
  }

  /**
   * Update projectiles
   */
  updateProjectiles(deltaTime, enemies) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      
      // Find current target position (enemy might have moved)
      const target = enemies.find(e => e.id === proj.targetId);
      if (target) {
        proj.targetX = target.x;
        proj.targetY = target.y;
      }
      
      // Move towards target
      const dx = proj.targetX - proj.x;
      const dy = proj.targetY - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < proj.speed * deltaTime) {
        // Hit!
        this.projectileHit(proj, enemies);
        this.projectiles.splice(i, 1);
      } else {
        // Move
        const ratio = (proj.speed * deltaTime) / dist;
        proj.x += dx * ratio;
        proj.y += dy * ratio;
        
        // Update trail
        if (proj.trail && proj.trailPoints.length < 10) {
          proj.trailPoints.push({ x: proj.x, y: proj.y });
        }
      }
    }
  }

  /**
   * Instant hit (for lightning)
   */
  instantHit(projectile) {
    // Remove from active projectiles if present
    const idx = this.projectiles.indexOf(projectile);
    if (idx >= 0) {
      this.projectiles.splice(idx, 1);
    }
    
    // Apply damage directly
    this.eventBus.emit('enemy:damage', {
      enemyId: projectile.targetId,
      damage: projectile.damage,
      effects: this.getEffectsForType(projectile.towerType)
    });
    
    // Visual effect
    this.addEffect({
      type: 'lightning-bolt',
      startX: projectile.x,
      startY: projectile.y,
      endX: projectile.targetX,
      endY: projectile.targetY,
      duration: 0.15,
      color: '#ffd700'
    });
    
    // Chain lightning (hit nearby enemies)
    if (projectile.chain) {
      this.eventBus.emit('enemies:get-nearby', {
        x: projectile.targetX,
        y: projectile.targetY,
        radius: 80,
        excludeId: projectile.targetId,
        maxCount: 2,
        callback: (nearbyEnemies) => {
          for (const enemy of nearbyEnemies) {
            this.eventBus.emit('enemy:damage', {
              enemyId: enemy.id,
              damage: projectile.damage * 0.5,
              effects: []
            });
            
            this.addEffect({
              type: 'lightning-bolt',
              startX: projectile.targetX,
              startY: projectile.targetY,
              endX: enemy.x,
              endY: enemy.y,
              duration: 0.1,
              color: '#87ceeb'
            });
          }
        }
      });
    }
  }

  /**
   * Projectile hit
   */
  projectileHit(projectile, enemies) {
    // Apply damage
    this.eventBus.emit('enemy:damage', {
      enemyId: projectile.targetId,
      damage: projectile.damage,
      effects: this.getEffectsForType(projectile.towerType)
    });
    
    // Impact effect
    this.addEffect({
      type: 'impact',
      x: projectile.targetX,
      y: projectile.targetY,
      duration: 0.2,
      color: projectile.color,
      size: projectile.size * 2
    });
    
    // Tower-specific effects
    if (projectile.towerType === 'fire') {
      this.addEffect({
        type: 'explosion',
        x: projectile.targetX,
        y: projectile.targetY,
        duration: 0.3,
        radius: 20,
        color: '#ff6600'
      });
    }
  }

  /**
   * Get status effects for tower type
   */
  getEffectsForType(towerType) {
    switch (towerType) {
      case 'ice':
        return [{ type: 'slow', value: 0.5, duration: 2 }];
      case 'nature':
        return [{ type: 'poison', value: 5, duration: 3 }];
      case 'dark':
        return [{ type: 'slow', value: 0.8, duration: 1.5 }];
      default:
        return [];
    }
  }

  /**
   * Add visual effect
   */
  addEffect(effect) {
    this.effects.push({
      ...effect,
      elapsed: 0
    });
  }

  /**
   * Update visual effects
   */
  updateEffects(deltaTime) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.elapsed += deltaTime;
      
      if (effect.elapsed >= effect.duration) {
        this.effects.splice(i, 1);
      }
    }
  }

  /**
   * Get render data
   */
  getRenderData() {
    return {
      projectiles: this.projectiles,
      effects: this.effects
    };
  }
}

module.exports = { CombatModule, PROJECTILE_TYPES };
