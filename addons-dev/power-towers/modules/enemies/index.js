/**
 * Power Towers TD - Enemies Module
 * 
 * Manages enemy spawning, movement along path, and death.
 * Handles wave composition and difficulty scaling.
 */

const { GameEvents } = require('../../core/event-bus');

// Enemy type definitions
const ENEMY_TYPES = {
  basic: {
    name: 'Minion',
    emoji: '👾',
    baseHealth: 20,
    baseSpeed: 40,   // pixels per second
    reward: 10,
    color: '#ff6b6b'
  },
  fast: {
    name: 'Scout',
    emoji: '🦎',
    baseHealth: 20,
    baseSpeed: 80,
    reward: 15,
    color: '#4ecdc4'
  },
  tank: {
    name: 'Brute',
    emoji: '🐗',
    baseHealth: 100,
    baseSpeed: 25,
    reward: 30,
    color: '#a55eea'
  },
  swarm: {
    name: 'Swarmling',
    emoji: '🐜',
    baseHealth: 15,
    baseSpeed: 60,
    reward: 5,
    color: '#26de81'
  },
  boss: {
    name: 'Boss',
    emoji: '👹',
    baseHealth: 1000,
    baseSpeed: 20,
    reward: 200,
    color: '#eb3b5a'
  }
};

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

    // Difficulty scaling
    const healthMultiplier = 1 + (this.currentWave - 1) * 0.15;
    const speedMultiplier = 1 + (this.currentWave - 1) * 0.02;

    const spawnPoint = this.waypoints[0];
    
    // Check for overlapping enemies at spawn point
    const overlapping = this.enemies.filter(e => 
      Math.abs(e.x - spawnPoint.x) < 20 && Math.abs(e.y - spawnPoint.y) < 20
    );
    if (overlapping.length > 0) {
      console.log(`[EnemiesModule] Spawning enemy while ${overlapping.length} enemies near spawn point`);
    }
    
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
      effects: [],
      slowMultiplier: 1,
      slowDuration: 0,
      burnDuration: 0
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
   * Update status effects
   */
  updateEffects(enemy, deltaTime) {
    enemy.slowMultiplier = 1;
    
    for (let i = enemy.effects.length - 1; i >= 0; i--) {
      const effect = enemy.effects[i];
      effect.duration -= deltaTime;
      
      if (effect.duration <= 0) {
        enemy.effects.splice(i, 1);
        continue;
      }
      
      // Apply effect
      switch (effect.type) {
        case 'slow':
          enemy.slowMultiplier = Math.min(enemy.slowMultiplier, effect.value);
          break;
        case 'poison':
          enemy.health -= effect.value * deltaTime;
          break;
      }
    }
  }

  /**
   * Damage an enemy
   */
  damageEnemy({ enemyId, damage, towerId, effects }) {
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

    enemy.health -= damage;
    
    // Apply effects
    if (effects && effects.length > 0) {
      for (const effect of effects) {
        // Check if same effect exists, refresh it
        const existing = enemy.effects.find(e => e.type === effect.type);
        if (existing) {
          existing.duration = effect.duration;
          existing.value = Math.min(existing.value, effect.value);
        } else {
          enemy.effects.push({ ...effect });
        }
      }
    }

    this.eventBus.emit('enemy:damaged', { 
      enemy, 
      damage, 
      remaining: enemy.health 
    });
  }

  /**
   * Kill enemy
   */
  killEnemy(enemy, index) {
    console.log(`[EnemiesModule] Killing enemy #${enemy.id} at (${Math.round(enemy.x)}, ${Math.round(enemy.y)}), pathProgress: ${enemy.pathProgress.toFixed(2)}`);
    this.enemies.splice(index, 1);
    this.totalKills++;
    
    this.eventBus.emit('enemy:killed', { 
      enemy, 
      reward: enemy.reward,
      killerTowerId: enemy.lastDamagedByTowerId 
    });
    this.eventBus.emit('economy:gain', enemy.reward);
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
