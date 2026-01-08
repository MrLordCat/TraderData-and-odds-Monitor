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
    
    // Ground zones (Siege craters)
    this.groundZones = [];
    this.nextZoneId = 1;
  }

  /**
   * Initialize module
   */
  init() {
    this.eventBus.on(GameEvents.GAME_START, () => this.reset());
    this.eventBus.on('combat:tower-attack', (data) => this.handleTowerAttack(data));
    this.eventBus.on('combat:create-ground-zone', (data) => this.createGroundZone(data));
  }

  /**
   * Update projectiles and effects
   */
  update(deltaTime, enemies) {
    this.updateProjectiles(deltaTime, enemies);
    this.updateEffects(deltaTime);
    this.updateGroundZones(deltaTime, enemies);
  }

  /**
   * Reset
   */
  reset() {
    this.projectiles = [];
    this.nextProjectileId = 1;
    this.effects = [];
    this.groundZones = [];
    this.nextZoneId = 1;
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
  handleTowerAttack({ 
    towerId, towerType, targetId, damage, isCrit, position, targetPosition,
    // Critical hit info for secondary damage
    critMultiplier,
    // Element system (NEW)
    elementPath, elementAbilities,
    // AoE params
    splashRadius, splashDmgFalloff, splashCanCrit,
    // Chain params  
    chainCount, chainDmgFalloff, chainCanCrit,
    // Attack type
    attackTypeId,
    // Combo system (Normal attack)
    isFocusFire, comboStacks,
    // Armor Shred (Siege)
    armorShredEnabled, armorShredAmount, armorShredMaxStacks, armorShredDuration,
    // Ground Zone (Siege)
    groundZoneEnabled, groundZoneRadius, groundZoneDuration, groundZoneSlow,
    // Piercing-specific
    isPrecision, isExecute, applyBleed, momentumStacks, bleedConfig, armorPenetration,
    // Projectile visuals (can be overridden by combo colors)
    projectileColor, projectileSize, projectileSpeed
  }) {
    // Determine tower type from element path or legacy towerType
    const effectiveTowerType = elementPath || towerType || 'fire';
    
    // Create projectile
    const projectileDef = PROJECTILE_TYPES[effectiveTowerType] || PROJECTILE_TYPES.fire;
    
    const projectile = {
      id: this.nextProjectileId++,
      towerId,
      towerType: effectiveTowerType,
      attackTypeId,
      targetId,
      damage,
      isCrit: isCrit || false,
      isFocusFire: isFocusFire || false,  // NEW: Focus fire indicator
      comboStacks: comboStacks || 0,       // NEW: Combo stacks
      critMultiplier: critMultiplier || 1.5, // For secondary crit calculations
      x: position.x,
      y: position.y,
      targetX: targetPosition.x,
      targetY: targetPosition.y,
      speed: projectileSpeed || projectileDef.speed,
      color: projectileColor || projectileDef.color,  // Use provided color (combo colors)
      size: isFocusFire ? (projectileSize || projectileDef.size) * 1.5 : (projectileSize || projectileDef.size),  // Bigger for focus fire
      chain: projectileDef.chain,
      trail: projectileDef.trail,
      // AoE (siege)
      splashRadius: splashRadius || 0,
      splashDmgFalloff: splashDmgFalloff || 0.5,
      splashCanCrit: splashCanCrit || false, // Unlockable via cards
      // Chain (lightning)
      chainCount: chainCount || 0,
      chainDmgFalloff: chainDmgFalloff || 0.5,
      chainCanCrit: chainCanCrit || false,   // Unlockable via cards
      // Armor Shred (Siege)
      armorShredEnabled: armorShredEnabled || false,
      armorShredAmount: armorShredAmount || 0,
      armorShredMaxStacks: armorShredMaxStacks || 0,
      armorShredDuration: armorShredDuration || 0,
      // Ground Zone (Siege)
      groundZoneEnabled: groundZoneEnabled || false,
      groundZoneRadius: groundZoneRadius || 0,
      groundZoneDuration: groundZoneDuration || 0,
      groundZoneSlow: groundZoneSlow || 0,
      // Piercing (NEW)
      isPrecision: isPrecision || false,
      isExecute: isExecute || false,
      applyBleed: applyBleed || false,
      momentumStacks: momentumStacks || 0,
      bleedConfig: bleedConfig || null,
      armorPenetration: armorPenetration || 0,
      // Element system (NEW)
      elementPath: effectiveTowerType,
      elementAbilities: elementAbilities || null,
      // Trail history
      trailPoints: projectileDef.trail ? [{ x: position.x, y: position.y }] : []
    };
    
    this.projectiles.push(projectile);
    
    // For lightning (instant), skip projectile travel
    if (effectiveTowerType === 'lightning') {
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
    
    // Apply damage directly with element effects
    this.eventBus.emit('enemy:damage', {
      enemyId: projectile.targetId,
      damage: projectile.damage,
      isCrit: projectile.isCrit,
      towerId: projectile.towerId,
      attackType: projectile.attackTypeId,  // NEW: Attack type for cascade
      effects: this.getEffectsForType(projectile.towerType),
      // NEW: Element effects
      elementEffects: projectile.elementAbilities ? {
        elementPath: projectile.elementPath,
        abilities: projectile.elementAbilities,
      } : null,
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
    if (projectile.chain && projectile.chainCount > 0) {
      const chainRange = projectile.elementAbilities?.chain?.chainRange || 80;
      const chainFalloff = projectile.chainDmgFalloff || 0.5;
      
      this.eventBus.emit('enemies:get-nearby', {
        x: projectile.targetX,
        y: projectile.targetY,
        radius: chainRange,
        excludeId: projectile.targetId,
        maxCount: projectile.chainCount,
        callback: (nearbyEnemies) => {
          let currentDamage = projectile.damage;
          
          for (let i = 0; i < nearbyEnemies.length; i++) {
            const enemy = nearbyEnemies[i];
            // Apply chain damage falloff
            const chainDamage = currentDamage * (1 - chainFalloff);
            currentDamage = chainDamage; // Next chain uses reduced damage
            
            // Check if chain can crit (unlockable via cards)
            let chainIsCrit = false;
            if (projectile.chainCanCrit) {
              chainIsCrit = projectile.isCrit; // Inherit crit from main attack
            }
            
            this.eventBus.emit('enemy:damage', {
              enemyId: enemy.id,
              damage: chainDamage,
              isCrit: chainIsCrit,
              towerId: projectile.towerId,
              // Pass element effects to chain targets too
              elementEffects: projectile.elementAbilities ? {
                elementPath: projectile.elementPath,
                abilities: projectile.elementAbilities,
              } : null,
            });
            
            this.addEffect({
              type: 'lightning-bolt',
              startX: i === 0 ? projectile.targetX : nearbyEnemies[i-1].x,
              startY: i === 0 ? projectile.targetY : nearbyEnemies[i-1].y,
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
    // Apply damage to main target with element effects
    this.eventBus.emit('enemy:damage', {
      enemyId: projectile.targetId,
      damage: projectile.damage,
      isCrit: projectile.isCrit,
      isFocusFire: projectile.isFocusFire,  // Focus fire indicator
      isPrecision: projectile.isPrecision,   // Piercing precision strike
      isExecute: projectile.isExecute,       // Piercing execute
      towerId: projectile.towerId,
      attackType: projectile.attackTypeId,  // Attack type for cascade
      armorPenetration: projectile.armorPenetration || 0, // Piercing armor pen
      effects: this.getEffectsForType(projectile.towerType),
      // Element effects
      elementEffects: projectile.elementAbilities ? {
        elementPath: projectile.elementPath,
        abilities: projectile.elementAbilities,
      } : null,
      // Bleed effect (Piercing)
      bleedConfig: projectile.applyBleed ? projectile.bleedConfig : null,
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
    
    // === FOCUS FIRE EFFECT (Normal attack) ===
    if (projectile.isFocusFire) {
      // Add golden burst effect for focus fire
      this.addEffect({
        type: 'focus-fire-burst',
        x: projectile.targetX,
        y: projectile.targetY,
        duration: 0.4,
        color: '#ffd700',
        size: 30
      });
    }
    
    // === PRECISION STRIKE EFFECT (Piercing attack) ===
    if (projectile.isPrecision) {
      this.addEffect({
        type: 'precision-strike',
        x: projectile.targetX,
        y: projectile.targetY,
        duration: 0.5,
        color: '#ffd700',
        size: 35
      });
    }
    
    // === EXECUTE EFFECT (Piercing attack) ===
    if (projectile.isExecute) {
      this.addEffect({
        type: 'execute',
        x: projectile.targetX,
        y: projectile.targetY,
        duration: 0.4,
        color: '#8b0000',
        size: 25
      });
    }
    
    // === BLEED EFFECT VISUAL (Piercing attack) ===
    if (projectile.applyBleed && projectile.bleedConfig) {
      this.addEffect({
        type: 'bleed-apply',
        x: projectile.targetX,
        y: projectile.targetY,
        duration: 0.3,
        color: '#dc143c',
        size: 15
      });
    }
    
    // =========================================
    // SPLASH DAMAGE (Siege attack type)
    // =========================================
    if (projectile.splashRadius > 0) {
      // Find enemies near impact point
      this.eventBus.emit('enemies:get-nearby', {
        x: projectile.targetX,
        y: projectile.targetY,
        radius: projectile.splashRadius,
        excludeId: projectile.targetId, // Main target already damaged
        maxCount: 20, // No limit for AoE
        callback: (nearbyEnemies) => {
          for (const enemy of nearbyEnemies) {
            // Calculate distance for falloff
            const dx = enemy.x - projectile.targetX;
            const dy = enemy.y - projectile.targetY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Damage falloff based on distance (closer = more damage)
            const falloffRatio = 1 - (distance / projectile.splashRadius) * projectile.splashDmgFalloff;
            let splashDamage = projectile.damage * Math.max(0.2, falloffRatio);
            
            // Check if splash can crit (unlockable via cards)
            // If original hit was crit and splash can't crit, use base damage
            // If splash can crit, roll a new crit for each enemy
            let splashIsCrit = false;
            if (projectile.splashCanCrit) {
              // Roll new crit for splash damage (uses same crit chance as main attack)
              // For now just inherit crit from main attack
              splashIsCrit = projectile.isCrit;
              if (splashIsCrit) {
                // Already applied crit multiplier to projectile.damage, so just mark it
              }
            }
            
            this.eventBus.emit('enemy:damage', {
              enemyId: enemy.id,
              damage: splashDamage,
              isCrit: splashIsCrit, // Crit on splash if enabled
              towerId: projectile.towerId,
              effects: this.getEffectsForType(projectile.towerType),
              // Element effects apply to splash too
              elementEffects: projectile.elementAbilities ? {
                elementPath: projectile.elementPath,
                abilities: projectile.elementAbilities,
              } : null,
            });
          }
        }
      });
      
      // Visual splash effect
      this.addEffect({
        type: 'explosion',
        x: projectile.targetX,
        y: projectile.targetY,
        duration: 0.4,
        radius: projectile.splashRadius,
        color: '#ff6600',
        isSplash: true
      });
      
      // =========================================
      // ARMOR SHRED (Siege unique)
      // Apply to all enemies in splash zone
      // =========================================
      if (projectile.armorShredEnabled) {
        // Apply shred to main target
        this.eventBus.emit('enemy:apply-debuff', {
          enemyId: projectile.targetId,
          debuffType: 'armorShred',
          amount: projectile.armorShredAmount,
          maxStacks: projectile.armorShredMaxStacks,
          duration: projectile.armorShredDuration,
          towerId: projectile.towerId
        });
        
        // Apply shred to all nearby enemies
        this.eventBus.emit('enemies:get-nearby', {
          x: projectile.targetX,
          y: projectile.targetY,
          radius: projectile.splashRadius,
          excludeId: projectile.targetId,
          maxCount: 20,
          callback: (nearbyEnemies) => {
            for (const enemy of nearbyEnemies) {
              this.eventBus.emit('enemy:apply-debuff', {
                enemyId: enemy.id,
                debuffType: 'armorShred',
                amount: projectile.armorShredAmount,
                maxStacks: projectile.armorShredMaxStacks,
                duration: projectile.armorShredDuration,
                towerId: projectile.towerId
              });
            }
          }
        });
        
        // Visual armor shred effect
        this.addEffect({
          type: 'armor-shred',
          x: projectile.targetX,
          y: projectile.targetY,
          duration: 0.3,
          radius: projectile.splashRadius * 0.7,
          color: '#ff4444'
        });
      }
      
      // =========================================
      // GROUND ZONE (Siege unique)
      // Leave slowing crater after explosion
      // =========================================
      if (projectile.groundZoneEnabled) {
        this.eventBus.emit('combat:create-ground-zone', {
          x: projectile.targetX,
          y: projectile.targetY,
          radius: projectile.groundZoneRadius,
          duration: projectile.groundZoneDuration,
          slowPercent: projectile.groundZoneSlow,
          towerId: projectile.towerId,
          color: '#8B4513' // Brown crater
        });
        
        // Visual ground zone effect
        this.addEffect({
          type: 'ground-zone-spawn',
          x: projectile.targetX,
          y: projectile.targetY,
          duration: 0.5,
          radius: projectile.groundZoneRadius,
          color: '#8B4513'
        });
      }
    }
    
    // Tower-specific effects (fire without splash)
    else if (projectile.towerType === 'fire') {
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

  // =========================================
  // GROUND ZONES (Siege craters)
  // =========================================
  
  /**
   * Create a ground zone (crater) that slows enemies
   * @param {Object} data - Zone parameters
   */
  createGroundZone({ x, y, radius, duration, slowPercent, towerId, color }) {
    const zone = {
      id: this.nextZoneId++,
      x,
      y,
      radius: radius || 40,
      duration: duration / 1000, // Convert ms to seconds
      maxDuration: duration / 1000,
      slowPercent: slowPercent || 0.25,
      towerId,
      color: color || '#8B4513',
      affectedEnemies: new Set() // Track who we've slowed this tick
    };
    
    this.groundZones.push(zone);
  }
  
  /**
   * Update ground zones - apply slow to enemies inside
   */
  updateGroundZones(deltaTime, enemies) {
    for (let i = this.groundZones.length - 1; i >= 0; i--) {
      const zone = this.groundZones[i];
      
      // Decrease duration
      zone.duration -= deltaTime;
      
      if (zone.duration <= 0) {
        // Zone expired
        this.groundZones.splice(i, 1);
        continue;
      }
      
      // Clear affected set for this tick
      zone.affectedEnemies.clear();
      
      // Find enemies in zone and apply slow
      for (const enemy of enemies) {
        const dx = enemy.x - zone.x;
        const dy = enemy.y - zone.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= zone.radius) {
          zone.affectedEnemies.add(enemy.id);
          
          // Apply ground zone slow via debuff system
          this.eventBus.emit('enemy:apply-debuff', {
            enemyId: enemy.id,
            debuffType: 'slow',
            amount: zone.slowPercent,
            maxStacks: 1,
            duration: 500, // Short duration, refreshed each tick
            towerId: zone.towerId
          });
        }
      }
    }
  }

  /**
   * Get render data
   */
  getRenderData() {
    return {
      projectiles: this.projectiles,
      effects: this.effects,
      groundZones: this.groundZones
    };
  }
}

module.exports = { CombatModule };
