/**
 * Power Towers TD - Enemies Module
 * 
 * Manages enemy spawning, movement along path, and death.
 * Handles wave composition and difficulty scaling.
 * 
 * Uses new modular wave/enemy system from core/config/waves/ and core/config/enemies/
 */

const { GameEvents } = require('../../core/event-bus');
const CONFIG = require('../../core/config/index');
const { EFFECT_TYPES } = require('../../core/element-abilities');
const StatusEffects = require('./status-effects');
const { calculateArmoredDamage, applyArmorShred } = require('../../core/config/enemies/special/armored');
const { isMagicImmune, calculateMagicImmuneDamage } = require('../../core/config/enemies/special/magic-immune');
const { isRegenerating, applyRegeneration } = require('../../core/config/enemies/special/regenerating');
const { isShielded, hasActiveShield, applyShieldedDamage } = require('../../core/config/enemies/special/shielded');

// Get enemy types from config (single source of truth)
const ENEMY_TYPES = CONFIG.ENEMY_TYPES;

// New modular wave generation system
const { generateWave, getWavePreview } = CONFIG.waves || {};
const { applyAurasToEnemy, AURAS } = CONFIG.waves || {};

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
    this.waveStartTime = 0;      // Absolute time when wave started (for new spawn system)
    this.waveInProgress = false;
    
    // Current wave data (from new generation system)
    this.currentWaveData = null;
    this.activeAuras = [];       // Auras active for current wave
    
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
    this.eventBus.on('enemy:apply-debuff', (data) => this.applyDebuff(data));
    this.eventBus.on('enemies:get-nearby', (data) => this.getNearbyEnemies(data));
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
    this.waveStartTime = 0;
    this.waveInProgress = false;
    this.totalKills = 0;
    this.escapedEnemies = 0;
    // New wave system
    this.currentWaveData = null;
    this.activeAuras = [];
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
    this.waveStartTime = 0;
    this.waveInProgress = false;
    // Keep currentWave at 0 for fresh start
    this.currentWave = 0;
    // New wave system
    this.currentWaveData = null;
    this.activeAuras = [];
  }

  /**
   * Receive waypoints from MapModule
   */
  onMapGenerated({ waypoints }) {
    this.waypoints = waypoints;
  }

  /**
   * Start next wave - uses new modular wave generation system
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
    
    // Reset timers for new wave
    this.spawnTimer = 0;
    this.waveStartTime = Date.now();
    
    // Try new wave generation system first
    let waveData = null;
    let waveEnemies = [];
    
    if (typeof generateWave === 'function') {
      // Use new modular system
      waveData = generateWave(this.currentWave);
      this.currentWaveData = waveData;
      this.activeAuras = waveData.auras || [];
      
      // Convert new format spawnQueue to module format
      waveEnemies = waveData.spawnQueue.map((entry, index) => ({
        enemyData: entry.enemy,           // Pre-built enemy data
        delay: index === 0 ? 0.5 : (entry.spawnTime - (waveData.spawnQueue[index - 1]?.spawnTime || 0)) / 1000,
        isBoss: entry.isBoss || false,
      }));
      
      console.log(`[EnemiesModule] Wave ${this.currentWave} generated:`, {
        enemies: waveData.totalEnemies,
        auras: waveData.aurasInfo?.map(a => a.emoji + ' ' + a.name).join(', ') || 'none',
        boss: waveData.boss?.id || 'none',
      });
    } else {
      // Fallback to legacy system
      waveEnemies = this.generateWaveComposition(this.currentWave);
    }
    
    // Add to spawn queue (don't replace - append for overlapping waves)
    this.spawnQueue.push(...waveEnemies);
    
    this.eventBus.emit('wave:started', { 
      wave: this.currentWave, 
      enemyCount: waveEnemies.length,
      auras: this.activeAuras,
      aurasInfo: waveData?.aurasInfo || [],
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
   * Process spawn queue - supports both old and new formats
   * Old format: { type, delay }
   * New format: { enemyData, delay, isBoss }
   */
  processSpawnQueue(deltaTime) {
    if (this.spawnQueue.length === 0) return;
    
    this.spawnTimer += deltaTime;
    
    // Only spawn one enemy at a time when delay is reached
    if (this.spawnTimer >= this.spawnQueue[0].delay) {
      const spawn = this.spawnQueue.shift();
      
      // Check format and spawn accordingly
      if (spawn.enemyData) {
        // New format - pre-built enemy data from generation.js
        this.spawnEnemyFromData(spawn.enemyData, spawn.isBoss);
      } else {
        // Legacy format - just type string
        this.spawnEnemy(spawn.type);
      }
      
      // Reset timer for next spawn (relative delay system)
      this.spawnTimer = 0;
    }
  }

  /**
   * Spawn enemy from pre-built data (new system)
   * @param {Object} enemyData - Enemy data from generation.js
   * @param {boolean} isBoss - Whether this is a boss
   */
  spawnEnemyFromData(enemyData, isBoss = false) {
    if (!enemyData || this.waypoints.length === 0) return;
    
    const spawnPoint = this.waypoints[0];
    
    const enemy = {
      // Core identity
      id: this.nextEnemyId++,
      type: enemyData.type || enemyData.id || 'minion',
      
      // Position
      x: spawnPoint.x,
      y: spawnPoint.y,
      
      // Stats (already scaled by generation.js)
      health: enemyData.currentHealth || enemyData.health || enemyData.maxHealth,
      maxHealth: enemyData.maxHealth || enemyData.health,
      speed: enemyData.speed || enemyData.baseSpeed || 40,
      baseSpeed: enemyData.baseSpeed || enemyData.speed || 40,
      reward: enemyData.reward || 10,
      xp: enemyData.xp || 1,
      
      // Path
      pathProgress: 0,
      waypointIndex: 0,
      
      // Visual
      size: enemyData.size || (isBoss ? 16 : 10),
      emoji: enemyData.emoji || '👾',
      color: enemyData.color || '#ff6b6b',
      displayName: enemyData.displayName || enemyData.name,
      
      // Status effects
      statusEffects: enemyData.statusEffects || [],
      slowMultiplier: 1,
      freezeImmunityTimer: 0,
      
      // New fields from modular system
      isElite: enemyData.isElite || false,
      isBoss: isBoss || enemyData.isBoss || false,
      isFlying: enemyData.isFlying || false,
      isArmored: enemyData.isArmored || false,
      isMagicImmune: enemyData.isMagicImmune || false,
      isRegenerating: enemyData.isRegenerating || false,
      isShielded: enemyData.isShielded || false,
      specialType: enemyData.specialType || null,
      auras: enemyData.auras || this.activeAuras || [],
      wave: enemyData.wave || this.currentWave,
      
      // Armored-specific
      armor: enemyData.armor || 0,
      maxArmor: enemyData.maxArmor || 0,
      
      // Shielded-specific
      shieldHealth: enemyData.shieldHealth || 0,
      maxShieldHealth: enemyData.maxShieldHealth || 0,
      
      // Regenerating-specific
      lastDamageTime: enemyData.lastDamageTime || null,
      lastRegenTime: enemyData.lastRegenTime || null,
      
      // Elite visual properties
      eliteGlow: enemyData.eliteGlow || null,
      eliteParticles: enemyData.eliteParticles || null,
    };
    
    this.enemies.push(enemy);
    this.eventBus.emit('enemy:spawned', { enemy, isBoss, isElite: enemy.isElite });
    
    return enemy;
  }

  /**
   * Spawn an enemy (legacy method - still used for fallback)
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
      // New fields (defaults for legacy)
      isElite: false,
      isBoss: type === 'boss',
      isFlying: false,
      isArmored: false,
      isMagicImmune: false,
      isRegenerating: false,
      isShielded: false,
      specialType: null,
      auras: this.activeAuras || [],
      armor: 0,
      maxArmor: 0,
      shieldHealth: 0,
      maxShieldHealth: 0,
      lastDamageTime: null,
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
    
    // Apply regeneration for regenerating enemies
    if (isRegenerating(enemy)) {
      const healthBefore = enemy.health;
      applyRegeneration(enemy, deltaTime, this.currentWave);
      
      // Emit regen event for visual feedback if healed
      if (enemy.health > healthBefore) {
        this.eventBus.emit('enemy:regenerated', {
          enemyId: enemy.id,
          amount: enemy.health - healthBefore,
          x: enemy.x,
          y: enemy.y,
        });
      }
    }
    
    // Handle stun from shield break
    if (enemy.isStunned && enemy.stunEndTime) {
      if (Date.now() >= enemy.stunEndTime) {
        enemy.isStunned = false;
        enemy.stunEndTime = null;
      }
    }
    
    // Calculate effective speed
    const effectiveSpeed = enemy.speed * enemy.slowMultiplier;
    
    // If stunned, can't move
    if (enemy.isStunned) {
      return;
    }
    
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
   * @param {string} data.attackType - Attack type (normal, magic, siege, piercing)
   * @param {number} data.armorPenetration - Armor penetration (0-1)
   * @param {Object} data.bleedConfig - Bleed config if should apply
   * @param {string} data.element - Element type if any (fire, ice, etc.)
   */
  damageEnemy({ enemyId, damage, towerId, elementEffects, isCrit, attackType, armorPenetration, bleedConfig, element }) {
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
    
    // Store attack type for cascade/overflow handling
    enemy.lastAttackType = attackType || 'normal';
    
    // Track last damage time (for regeneration pause)
    enemy.lastDamageTime = Date.now();
    
    // === MAGIC-IMMUNE CHECK ===
    // Magic-immune enemies are completely immune to Magic attack type
    if (isMagicImmune(enemy)) {
      const modifiedDamage = calculateMagicImmuneDamage(damage, attackType, element, enemy);
      
      // If immune (0 damage), emit immune event and return
      if (modifiedDamage === 0) {
        this.eventBus.emit('enemy:immune', {
          enemy,
          attackType,
          x: enemy.x,
          y: enemy.y,
        });
        return;
      }
      
      // Apply damage modifier for elements against magic-immune
      damage = modifiedDamage;
    }
    
    // Calculate damage with status effect modifiers (curse, weaken)
    let { finalDamage, modifiers } = StatusEffects.calculateDamageWithEffects(enemy, damage);
    
    // === SHIELDED ENEMY HANDLING ===
    // Shielded enemies absorb damage with their shield first
    if (isShielded(enemy) && hasActiveShield(enemy)) {
      const shieldResult = applyShieldedDamage(enemy, finalDamage, attackType);
      
      // Emit shield damage event
      if (shieldResult.shieldDamage > 0) {
        this.eventBus.emit('enemy:shield-hit', {
          enemy,
          shieldDamage: shieldResult.shieldDamage,
          remainingShield: enemy.shieldHealth,
          x: enemy.x,
          y: enemy.y,
        });
        modifiers.push({ type: 'shieldAbsorb', value: shieldResult.shieldDamage });
      }
      
      // Emit shield break event
      if (shieldResult.shieldBroken) {
        this.eventBus.emit('enemy:shield-broken', {
          enemy,
          x: enemy.x,
          y: enemy.y,
        });
        modifiers.push({ type: 'shieldBroken' });
      }
      
      // Only health damage passes through
      finalDamage = shieldResult.healthDamage;
    }
    
    // === ARMORED ENEMY DAMAGE REDUCTION ===
    if (enemy.isArmored && enemy.armor > 0) {
      const armoredResult = calculateArmoredDamage(enemy, finalDamage, attackType, armorPenetration);
      finalDamage = armoredResult.finalDamage;
      
      // Apply armor damage (if attack damages armor)
      if (armoredResult.armorDamage > 0) {
        enemy.armor = Math.max(0, enemy.armor - armoredResult.armorDamage);
        modifiers.push({ type: 'armorDamage', value: armoredResult.armorDamage });
      }
      
      // Track damage reduction
      if (armoredResult.damageReduction > 0) {
        modifiers.push({ type: 'armorBlock', reduction: armoredResult.damageReduction });
      }
    }
    
    // Apply armor penetration (Piercing attack) - additional bonus on top of armored calculation
    // Armor pen reduces the effectiveness of enemy armor
    if (armorPenetration > 0 && enemy.armor) {
      const armorReduction = enemy.armor * (1 - armorPenetration);
      const armorBonus = damage * (armorPenetration * 0.5); // 20% pen = +10% damage
      finalDamage += armorBonus;
      modifiers.push({ type: 'armorPen', bonus: armorBonus });
    }
    
    // Calculate overkill damage for magic cascade
    const healthBeforeDamage = enemy.health;
    enemy.health -= finalDamage;
    
    // Store overkill for cascade processing
    if (enemy.health <= 0) {
      enemy.overkillDamage = Math.abs(enemy.health);
    }
    
    // Apply element effects
    if (elementEffects) {
      this.applyElementEffects(enemy, elementEffects, towerId, isCrit);
    }
    
    // Apply Bleed (Piercing attack - only on crits)
    if (bleedConfig && enemy.health > 0) {
      StatusEffects.applyStatusEffect(enemy, EFFECT_TYPES.BLEED, {
        damage: bleedConfig.damage,
        duration: bleedConfig.duration,
        tickRate: bleedConfig.tickRate,
        stackable: bleedConfig.stackable,
        maxStacks: bleedConfig.maxStacks,
      }, towerId);
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
   * Apply a debuff directly to an enemy (used by Siege Armor Shred)
   * @param {Object} data - Debuff data
   * @param {number} data.enemyId - Target enemy ID
   * @param {string} data.debuffType - Type of debuff (armorShred, etc.)
   * @param {number} data.amount - Amount per stack
   * @param {number} data.maxStacks - Maximum stacks
   * @param {number} data.duration - Duration in ms
   * @param {number} data.towerId - Tower that applied this
   */
  applyDebuff({ enemyId, debuffType, amount, maxStacks, duration, towerId }) {
    const enemy = this.enemies.find(e => e.id === enemyId);
    if (!enemy) return;
    
    // Convert debuff type to EFFECT_TYPE
    let effectType;
    switch (debuffType) {
      case 'armorShred':
        effectType = EFFECT_TYPES.ARMOR_SHRED;
        break;
      case 'slow':
        effectType = EFFECT_TYPES.SLOW;
        break;
      default:
        console.warn(`[EnemiesModule] Unknown debuff type: ${debuffType}`);
        return;
    }
    
    // Apply via status effects system
    StatusEffects.applyStatusEffect(enemy, effectType, {
      value: amount,
      duration: duration / 1000, // Convert ms to seconds
      stackable: true,
      maxStacks: maxStacks,
    }, towerId);
  }

  /**
   * Get enemies near a position (used for splash damage, ground zones)
   * @param {Object} data - Search parameters
   * @param {number} data.x - Center X
   * @param {number} data.y - Center Y  
   * @param {number} data.radius - Search radius
   * @param {number} [data.excludeId] - Enemy ID to exclude
   * @param {number} [data.maxCount] - Max enemies to return
   * @param {Function} data.callback - Callback with results
   */
  getNearbyEnemies({ x, y, radius, excludeId, maxCount, callback }) {
    const nearby = [];
    
    for (const enemy of this.enemies) {
      if (excludeId && enemy.id === excludeId) continue;
      
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= radius) {
        nearby.push({ ...enemy, distance: dist });
      }
      
      if (maxCount && nearby.length >= maxCount) break;
    }
    
    // Sort by distance
    nearby.sort((a, b) => a.distance - b.distance);
    
    if (callback) callback(nearby);
    return nearby;
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
      critBonus,
      overkillDamage: enemy.overkillDamage || 0,
      attackType: enemy.lastAttackType || 'normal'
    });
    
    // Process Magic Cascade (Arcane Overflow)
    if (enemy.lastAttackType === 'magic' && enemy.overkillDamage > 0 && enemy.lastDamagedByTowerId) {
      this.processMagicCascade(enemy);
    }
    
    // Add base reward + any crit bonus
    this.eventBus.emit('economy:gain', enemy.reward + critBonus);
  }
  
  /**
   * Process Magic Cascade (Arcane Overflow)
   * Transfers overkill damage to nearest enemy
   */
  processMagicCascade(killedEnemy) {
    const { processArcaneOverflow } = require('../towers/tower-combat');
    
    // Get the tower that killed this enemy
    this.eventBus.emit('towers:get-by-id', {
      towerId: killedEnemy.lastDamagedByTowerId,
      callback: (tower) => {
        if (!tower || tower.attackTypeId !== 'magic') return;
        
        const result = processArcaneOverflow(
          tower,
          killedEnemy,
          killedEnemy.overkillDamage,
          this.enemies,
          this.eventBus
        );
        
        if (result && result.targetEnemy) {
          // Apply cascade damage
          this.damageEnemy({
            enemyId: result.targetEnemy.id,
            damage: result.overflowDamage,
            towerId: tower.id,
            attackType: 'magic',
            isCrit: false
          });
          
          // Visual effect for cascade
          this.eventBus.emit('effect:magic-cascade', {
            sourceX: killedEnemy.x,
            sourceY: killedEnemy.y,
            targetX: result.targetEnemy.x,
            targetY: result.targetEnemy.y,
            damage: result.overflowDamage
          });
        }
      }
    });
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
      escapedEnemies: this.escapedEnemies,
      // New wave system data
      activeAuras: this.activeAuras,
      waveData: this.currentWaveData ? {
        boss: this.currentWaveData.boss,
        aurasInfo: this.currentWaveData.aurasInfo,
        totalEnemies: this.currentWaveData.totalEnemies,
      } : null,
    };
  }
  
  /**
   * Get current wave info for UI
   */
  getWaveInfo() {
    return {
      wave: this.currentWave,
      inProgress: this.waveInProgress,
      auras: this.activeAuras,
      aurasInfo: this.currentWaveData?.aurasInfo || [],
      boss: this.currentWaveData?.boss || null,
      remainingEnemies: this.spawnQueue.length + this.enemies.length,
    };
  }
}

module.exports = { EnemiesModule, ENEMY_TYPES };
