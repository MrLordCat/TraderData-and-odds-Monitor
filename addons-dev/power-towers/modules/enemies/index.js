/**
 * Power Towers TD - Enemies Module
 * 
 * Manages enemy spawning, movement along path, and death.
 * Handles wave composition and difficulty scaling.
 */

const { GameEvents } = require('../../core/event-bus');
const CONFIG = require('../../core/config/index');
const { EFFECT_TYPES } = require('../../core/element-abilities');
const StatusEffects = require('./status-effects');

// Get enemy types from config (single source of truth)
const ENEMY_TYPES = CONFIG.ENEMY_TYPES;

class EnemiesModule {
  /**
   * @param {EventBus} eventBus - Event system
   * @param {object} config - Game configuration
   */
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    
    // Enemy instances
    this.enemies = [];
    this.nextEnemyId = 1;
    
    // Path data (received from MapModule)
    this.waypoints = [];
    
    // Wave management
    this.currentWave = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveInProgress = false;
    
    // Stats
    this.totalKills = 0;
    this.escapedEnemies = 0;
    
    // Crit bonus gold (will be set by card/upgrade system)
    this.critBonusGoldChance = 0;    // 0 = disabled, 0.5 = 50% chance on crit kill
    this.critBonusGoldAmount = 0.5;  // Bonus as fraction of base reward (0.5 = +50%)
  }

  /**
   * Initialize module
   */
  init() {
    // Don't listen to GAME_START - it causes race condition with wave:start
    // Reset is handled by explicit reset() call from GameCore
    this.eventBus.on('map:generated', (data) => this.onMapGenerated(data));
    this.eventBus.on('wave:start', () => this.startNextWave());
    this.eventBus.on('enemy:damage', (data) => this.damageEnemy(data));
  }

  /**
   * Update enemies
   */
  update(deltaTime) {
    // Process spawn queue
    this.processSpawnQueue(deltaTime);
    
    // Update all enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      
      if (enemy.health <= 0) {
        this.killEnemy(enemy, i);
        continue;
      }
      
      this.updateEnemy(enemy, deltaTime);
      
      // Check if reached end
      if (enemy.pathProgress >= 1) {
        this.enemyReachedBase(enemy, i);
      }
    }
    
    // Check if wave complete
    if (this.waveInProgress && this.enemies.length === 0 && this.spawnQueue.length === 0) {
      this.waveInProgress = false;
      this.eventBus.emit(GameEvents.WAVE_COMPLETE, { wave: this.currentWave });
    }
  }

  /**
   * Reset enemies
   */
  reset() {
    this.enemies = [];
    this.nextEnemyId = 1;
    this.currentWave = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveInProgress = false;
    this.totalKills = 0;
    this.escapedEnemies = 0;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.reset();
  }

  /**
   * On game start - only reset wave state, not everything
   * Full reset happens via reset() method when game is restarted
   */
  onGameStart() {
    // Don't reset everything here - keep waypoints!
    // Just ensure wave state is ready
    this.enemies = [];
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.waveInProgress = false;
    // Keep currentWave at 0 for fresh start
    this.currentWave = 0;
  }

  /**
   * Receive waypoints from MapModule
   */
  onMapGenerated({ waypoints }) {
    this.waypoints = waypoints;
  }

  /**
   * Start next wave
   */
  startNextWave() {
    // Don't block if wave is in progress - allow overlapping waves
    // This enables the 15-second auto-wave system
    
    if (!this.waypoints || this.waypoints.length === 0) {
      console.error('[EnemiesModule] No waypoints! Cannot start wave');
      return;
    }
    
    this.currentWave++;
    this.waveInProgress = true;
    
    // Reset spawn timer for new wave
    this.spawnTimer = 0;
    
    // Generate wave composition
    const waveEnemies = this.generateWaveComposition(this.currentWave);
    
    // Add to spawn queue (don't replace - append for overlapping waves)
    this.spawnQueue.push(...waveEnemies);
    
    this.eventBus.emit('wave:started', { 
      wave: this.currentWave, 
      enemyCount: waveEnemies.length 
    });
  }

  /**
   * Generate enemies for a wave
   * delay = relative time between spawns (not absolute)
   */
  generateWaveComposition(waveNum) {
    const enemies = [];
    
    // Base count scales with wave
    const baseCount = 5 + Math.floor(waveNum * 1.5);
    
    // Add basic enemies (0.5s between each)
    for (let i = 0; i < baseCount; i++) {
      enemies.push({ type: 'basic', delay: 0.5 });
    }
    
    // Add fast enemies (from wave 2, 0.3s between each)
    if (waveNum >= 2) {
      const fastCount = Math.floor(waveNum / 2);
      for (let i = 0; i < fastCount; i++) {
        enemies.push({ type: 'fast', delay: 0.3 });
      }
    }
    
    // Add tank enemies (from wave 3, 1.5s between each)
    if (waveNum >= 3) {
      const tankCount = Math.floor(waveNum / 3);
      for (let i = 0; i < tankCount; i++) {
        enemies.push({ type: 'tank', delay: 1.5 });
      }
    }
    
    // Add swarm (from wave 5, 0.15s between each)
    if (waveNum >= 5) {
      const swarmCount = waveNum;
      for (let i = 0; i < swarmCount; i++) {
        enemies.push({ type: 'swarm', delay: 0.15 });
      }
    }
    
    // Boss every 10 waves (after 2s pause)
    if (waveNum % 10 === 0) {
      enemies.push({ type: 'boss', delay: 2.0 });
    }
    
    // Shuffle enemies for variety (but keep relative delays)
    // Basic -> Fast -> Tank -> Swarm -> Boss order is maintained
    
    return enemies;
  }

  /**
   * Process spawn queue - uses relative delays between spawns
   */
  processSpawnQueue(deltaTime) {
    if (this.spawnQueue.length === 0) return;
    
    this.spawnTimer += deltaTime;
    
    // Only spawn one enemy at a time when delay is reached
    if (this.spawnTimer >= this.spawnQueue[0].delay) {
      const spawn = this.spawnQueue.shift();
      this.spawnEnemy(spawn.type);
      // Reset timer for next spawn (relative delay system)
      this.spawnTimer = 0;
    }
  }

  /**
   * Spawn an enemy
   */
  spawnEnemy(type) {
    const enemyDef = ENEMY_TYPES[type];
    if (!enemyDef || this.waypoints.length === 0) return;

    // Difficulty scaling - multiplicative per wave (from config)
    // HP: baseHealth * (multiplier ^ (wave-1))
    // Speed: baseSpeed * (multiplier ^ (wave-1))
    const hpMult = this.config.ENEMY_HP_MULTIPLIER || 1.1;
    const spdMult = this.config.ENEMY_SPEED_MULTIPLIER || 1.02;
    const healthMultiplier = Math.pow(hpMult, this.currentWave - 1);
    const speedMultiplier = Math.pow(spdMult, this.currentWave - 1);

    const spawnPoint = this.waypoints[0];
    
    // Check for overlapping enemies at spawn point
    const overlapping = this.enemies.filter(e => 
      Math.abs(e.x - spawnPoint.x) < 20 && Math.abs(e.y - spawnPoint.y) < 20
    );
    
    const enemy = {
      id: this.nextEnemyId++,
      type,
      // Position
      x: spawnPoint.x,
      y: spawnPoint.y,
      // Stats
      health: enemyDef.baseHealth * healthMultiplier,
      maxHealth: enemyDef.baseHealth * healthMultiplier,
      speed: enemyDef.baseSpeed * speedMultiplier,
      reward: enemyDef.reward,
      // Path
      pathProgress: 0,
      waypointIndex: 0,
      // Visual
      size: type === 'boss' ? 16 : (type === 'tank' ? 12 : (type === 'swarm' ? 6 : 10)),
      emoji: enemyDef.emoji,
      color: enemyDef.color,
      // Status effects
      statusEffects: [],
      slowMultiplier: 1,
      // Freeze immunity cooldown
      freezeImmunityTimer: 0,
    };

    this.enemies.push(enemy);
    this.eventBus.emit('enemy:spawned', { enemy });
    
    return enemy;
  }

  /**
   * Update single enemy
   */
  updateEnemy(enemy, deltaTime) {
    // Update status effects
    this.updateEffects(enemy, deltaTime);
    
    // Calculate effective speed
    const effectiveSpeed = enemy.speed * enemy.slowMultiplier;
    
    // Move along path
    this.moveAlongPath(enemy, effectiveSpeed * deltaTime);
  }

  /**
   * Move enemy along waypoint path
   */
  moveAlongPath(enemy, distance) {
    if (enemy.waypointIndex >= this.waypoints.length - 1) {
      enemy.pathProgress = 1;
      return;
    }

    let remaining = distance;

    while (remaining > 0 && enemy.waypointIndex < this.waypoints.length - 1) {
      const current = this.waypoints[enemy.waypointIndex];
      const next = this.waypoints[enemy.waypointIndex + 1];

      const dx = next.x - enemy.x;
      const dy = next.y - enemy.y;
      const distToNext = Math.sqrt(dx * dx + dy * dy);

      if (distToNext <= remaining) {
        // Reach waypoint
        enemy.x = next.x;
        enemy.y = next.y;
        enemy.waypointIndex++;
        remaining -= distToNext;
      } else {
        // Move towards waypoint
        const ratio = remaining / distToNext;
        enemy.x += dx * ratio;
        enemy.y += dy * ratio;
        remaining = 0;
      }
    }

    // Calculate total path progress
    enemy.pathProgress = enemy.waypointIndex / (this.waypoints.length - 1);
  }

  /**
   * Update status effects (new unified system)
   */
  updateEffects(enemy, deltaTime) {
    // Update freeze immunity
    if (enemy.freezeImmunityTimer > 0) {
      enemy.freezeImmunityTimer -= deltaTime;
    }
    
    // Process status effects
    const result = StatusEffects.updateStatusEffects(enemy, deltaTime);
    
    // Apply DoT damage and emit events for damage numbers
    if (result.damage > 0) {
      enemy.health -= result.damage;
      
      // Emit individual tick events for damage number display
      for (const tick of result.dotTicks) {
        this.eventBus.emit('enemy:dot-damage', {
          enemyId: enemy.id,
          damage: tick.damage,
          effectType: tick.type,
          stacks: tick.stacks,
          x: enemy.x,
          y: enemy.y,
        });
      }
    }
    
    // Handle fire spread
    for (const spread of result.spreadCandidates) {
      this.handleFireSpread(spread);
    }
    
    // Calculate effective slow from status effects
    enemy.slowMultiplier = 1 - StatusEffects.getTotalSlowPercent(enemy);
    
    // If frozen/shocked, can't move
    if (StatusEffects.isStunned(enemy)) {
      enemy.slowMultiplier = 0;
    }
  }
  
  /**
   * Handle fire spreading to nearby enemies
   */
  handleFireSpread(spread) {
    const nearbyEnemies = this.enemies.filter(e => {
      if (e.id === spread.sourceId) return false;
      const dx = e.x - spread.sourcePos.x;
      const dy = e.y - spread.sourcePos.y;
      return Math.sqrt(dx * dx + dy * dy) <= spread.radius;
    });
    
    if (nearbyEnemies.length > 0) {
      // Spread to random nearby enemy
      const target = nearbyEnemies[Math.floor(Math.random() * nearbyEnemies.length)];
      StatusEffects.applyStatusEffect(target, spread.type, spread.config, spread.sourceId);
      
      this.eventBus.emit('effect:fire-spread', {
        fromX: spread.sourcePos.x,
        fromY: spread.sourcePos.y,
        toX: target.x,
        toY: target.y,
      });
    }
  }

  /**
   * Damage an enemy
   * @param {Object} data - Damage data
   * @param {number} data.enemyId - Target enemy ID
   * @param {number} data.damage - Base damage
   * @param {number} data.towerId - Source tower ID
   * @param {Object} data.elementEffects - Element effects config
   * @param {boolean} data.isCrit - Was critical hit
   */
  damageEnemy({ enemyId, damage, towerId, elementEffects, isCrit }) {
    const enemy = this.enemies.find(e => e.id === enemyId);
    if (!enemy) {
      console.warn(`[EnemiesModule] damageEnemy: enemy ${enemyId} not found! Current enemies:`, 
        this.enemies.map(e => e.id));
      return;
    }
    
    // Store last tower that damaged this enemy for kill credit
    if (towerId) {
      enemy.lastDamagedByTowerId = towerId;
    }
    
    // Store if last hit was a crit (for bonus gold on kill)
    enemy.lastHitWasCrit = isCrit || false;
    
    // Calculate damage with status effect modifiers (curse, weaken)
    const { finalDamage, modifiers } = StatusEffects.calculateDamageWithEffects(enemy, damage);
    enemy.health -= finalDamage;
    
    // Apply element effects
    if (elementEffects) {
      this.applyElementEffects(enemy, elementEffects, towerId, isCrit);
    }

    this.eventBus.emit('enemy:damaged', { 
      enemy, 
      damage: finalDamage,
      baseDamage: damage,
      modifiers,
      isCrit: isCrit || false,
      remaining: enemy.health 
    });
  }
  
  /**
   * Apply element-specific effects based on tower's abilities
   */
  applyElementEffects(enemy, elementEffects, towerId, isCrit) {
    const { elementPath, abilities } = elementEffects;
    if (!abilities) return;
    
    switch (elementPath) {
      case 'fire':
        // Apply burn
        if (abilities.burn?.enabled) {
          StatusEffects.applyStatusEffect(enemy, EFFECT_TYPES.BURN, {
            damage: abilities.burn.baseDamage,
            duration: abilities.burn.baseDuration,
            tickRate: abilities.burn.tickRate,
            stackable: abilities.burn.stackable,
            maxStacks: abilities.burn.maxStacks,
            extra: {
              spreadChance: abilities.ignite?.spreadChance || 0,
              spreadRadius: abilities.ignite?.spreadRadius || 0,
              spreadDamageMod: abilities.ignite?.spreadDamageMod || 0.7,
            },
          }, towerId);
        }
        break;
        
      case 'ice':
        // Apply slow
        if (abilities.slow?.enabled) {
          StatusEffects.applyStatusEffect(enemy, EFFECT_TYPES.SLOW, {
            value: abilities.slow.basePercent,
            duration: abilities.slow.baseDuration,
            stackable: abilities.slow.stackable,
          }, towerId);
        }
        // Check for freeze
        if (abilities.freeze?.enabled && enemy.freezeImmunityTimer <= 0) {
          if (Math.random() < abilities.freeze.baseChance) {
            StatusEffects.applyStatusEffect(enemy, EFFECT_TYPES.FREEZE, {
              duration: abilities.freeze.baseDuration,
            }, towerId);
            // Set immunity cooldown
            enemy.freezeImmunityTimer = abilities.freeze.cooldown || 5;
            
            this.eventBus.emit('effect:freeze', {
              enemyId: enemy.id,
              x: enemy.x,
              y: enemy.y,
              duration: abilities.freeze.baseDuration,
            });
          }
        }
        break;
        
      case 'lightning':
        // Shock on crit
        if (abilities.shock?.enabled && isCrit) {
          StatusEffects.applyStatusEffect(enemy, EFFECT_TYPES.SHOCK, {
            duration: abilities.shock.baseDuration,
          }, towerId);
          
          this.eventBus.emit('effect:shock', {
            enemyId: enemy.id,
            x: enemy.x,
            y: enemy.y,
          });
        }
        break;
        
      case 'nature':
        // Apply poison
        if (abilities.poison?.enabled) {
          StatusEffects.applyStatusEffect(enemy, EFFECT_TYPES.POISON, {
            damage: abilities.poison.baseDamage,
            duration: abilities.poison.baseDuration,
            tickRate: abilities.poison.tickRate,
            stackable: abilities.poison.stackable,
            maxStacks: abilities.poison.maxStacks,
          }, towerId);
        }
        // Apply weaken
        if (abilities.weaken?.enabled) {
          StatusEffects.applyStatusEffect(enemy, EFFECT_TYPES.WEAKEN, {
            value: abilities.weaken.armorReduction,
            duration: abilities.weaken.baseDuration,
            stackable: abilities.weaken.stackable,
            maxStacks: abilities.weaken.maxStacks,
          }, towerId);
        }
        break;
        
      case 'dark':
        // Apply curse
        if (abilities.curse?.enabled) {
          StatusEffects.applyStatusEffect(enemy, EFFECT_TYPES.CURSE, {
            value: abilities.curse.damageAmplify,
            duration: abilities.curse.baseDuration,
            stackable: abilities.curse.stackable,
            maxStacks: abilities.curse.maxStacks,
          }, towerId);
        }
        // Drain is handled in combat module (returns energy)
        break;
    }
  }

  /**
   * Kill enemy
   */
  killEnemy(enemy, index) {
    this.enemies.splice(index, 1);
    this.totalKills++;
    
    // Check for crit bonus gold (placeholder - will be enabled by card system)
    // critBonusGoldChance and critBonusGoldAmount come from player upgrades/cards
    let critBonus = 0;
    if (enemy.lastHitWasCrit && this.critBonusGoldChance > 0) {
      if (Math.random() < this.critBonusGoldChance) {
        critBonus = Math.floor(enemy.reward * (this.critBonusGoldAmount || 0.5));
      }
    }
    
    this.eventBus.emit('enemy:killed', { 
      enemy, 
      reward: enemy.reward,
      killerTowerId: enemy.lastDamagedByTowerId,
      isCrit: enemy.lastHitWasCrit || false,
      critBonus
    });
    
    // Add base reward + any crit bonus
    this.eventBus.emit('economy:gain', enemy.reward + critBonus);
  }

  /**
   * Enemy reached base
   */
  enemyReachedBase(enemy, index) {
    this.enemies.splice(index, 1);
    this.escapedEnemies++;
    
    // Calculate damage based on enemy type
    const damage = enemy.type === 'boss' ? 5 : 1;
    
    this.eventBus.emit('enemy:escaped', { enemy, damage });
    this.eventBus.emit('player:damage', { damage });
  }

  /**
   * Get enemies array for other modules
   */
  getEnemiesArray() {
    return this.enemies;
  }

  /**
   * Get render data
   */
  getRenderData() {
    return {
      enemies: this.enemies,
      currentWave: this.currentWave,
      waveInProgress: this.waveInProgress,
      spawnQueueSize: this.spawnQueue.length,
      totalKills: this.totalKills,
      escapedEnemies: this.escapedEnemies
    };
  }
}

module.exports = { EnemiesModule, ENEMY_TYPES };
