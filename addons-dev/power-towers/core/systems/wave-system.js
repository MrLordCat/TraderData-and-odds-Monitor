/**
 * Power Towers TD - Wave System
 * Manages enemy spawning and wave progression
 */

const CONFIG = require('../config');
const { createEnemy } = require('../entities/enemy');

class WaveSystem {
  constructor(eventBus) {
    this.eventBus = eventBus;
    
    this.currentWave = 0;
    this.enemiesRemaining = 0;
    this.enemiesSpawned = 0;
    this.totalEnemiesInWave = 0;
    
    this.isSpawning = false;
    this.spawnTimer = 0;
    this.waveDelayTimer = 0;
    this.waitingForNextWave = false;
    
    this.spawnQueue = [];  // enemy types to spawn
    this.startPosition = { x: 0, y: 0 };
  }

  /**
   * Initialize with start position
   */
  init(startPos) {
    this.startPosition = startPos;
    this.currentWave = 0;
    this.reset();
  }

  /**
   * Reset wave state
   */
  reset() {
    this.enemiesRemaining = 0;
    this.enemiesSpawned = 0;
    this.totalEnemiesInWave = 0;
    this.isSpawning = false;
    this.spawnTimer = 0;
    this.waveDelayTimer = 0;
    this.waitingForNextWave = false;
    this.spawnQueue = [];
  }

  /**
   * Start next wave
   */
  startWave() {
    if (this.isSpawning) return;
    
    this.currentWave++;
    this.generateWave();
    this.isSpawning = true;
    this.spawnTimer = 0;
    this.enemiesSpawned = 0;
    
    this.eventBus.emit('wave:start', {
      wave: this.currentWave,
      enemyCount: this.totalEnemiesInWave
    });
  }

  /**
   * Generate enemy composition for wave
   */
  generateWave() {
    const wave = this.currentWave;
    const baseCount = CONFIG.ENEMIES_BASE_COUNT + CONFIG.ENEMIES_PER_WAVE * wave;
    
    this.spawnQueue = [];
    this.totalEnemiesInWave = 0;
    
    // Wave composition based on wave number
    for (let i = 0; i < baseCount; i++) {
      let type = 'normal';
      
      // Add variety as waves progress
      if (wave >= 3 && Math.random() < 0.2) {
        type = 'fast';
      }
      if (wave >= 5 && Math.random() < 0.15) {
        type = 'tank';
      }
      if (wave >= 7 && Math.random() < 0.1) {
        type = 'flying';
      }
      
      this.spawnQueue.push(type);
      this.totalEnemiesInWave++;
    }
    
    // Boss waves (every 10)
    if (wave % 10 === 0) {
      // Add extra tanks as "boss"
      for (let i = 0; i < Math.ceil(wave / 10); i++) {
        this.spawnQueue.push('tank');
        this.totalEnemiesInWave++;
      }
    }
    
    this.enemiesRemaining = this.totalEnemiesInWave;
  }

  /**
   * Update wave system
   * @param {number} deltaTime - ms since last update
   * @returns {Enemy|null} Spawned enemy or null
   */
  update(deltaTime) {
    // Handle wave delay
    if (this.waitingForNextWave) {
      this.waveDelayTimer -= deltaTime;
      if (this.waveDelayTimer <= 0) {
        this.waitingForNextWave = false;
        this.startWave();
      }
      return null;
    }
    
    // Not spawning
    if (!this.isSpawning || this.spawnQueue.length === 0) {
      return null;
    }
    
    // Spawn timer
    this.spawnTimer -= deltaTime;
    if (this.spawnTimer > 0) {
      return null;
    }
    
    // Spawn next enemy
    const enemyType = this.spawnQueue.shift();
    const enemy = createEnemy(enemyType, this.currentWave, this.startPosition);
    
    this.enemiesSpawned++;
    this.spawnTimer = CONFIG.SPAWN_INTERVAL_MS;
    
    this.eventBus.emit('enemy:spawn', { enemy, wave: this.currentWave });
    
    // Check if all spawned
    if (this.spawnQueue.length === 0) {
      this.isSpawning = false;
      this.eventBus.emit('wave:end', { wave: this.currentWave });
    }
    
    return enemy;
  }

  /**
   * Called when an enemy dies or reaches base
   */
  enemyRemoved() {
    this.enemiesRemaining--;
    
    if (this.enemiesRemaining <= 0 && !this.isSpawning) {
      this.onWaveCleared();
    }
  }

  /**
   * Wave cleared - start timer for next wave
   */
  onWaveCleared() {
    this.eventBus.emit('wave:clear', {
      wave: this.currentWave,
      nextWave: this.currentWave + 1
    });
    
    this.waitingForNextWave = true;
    this.waveDelayTimer = CONFIG.WAVE_DELAY_MS;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      wave: this.currentWave,
      enemiesRemaining: this.enemiesRemaining,
      enemiesSpawned: this.enemiesSpawned,
      totalInWave: this.totalEnemiesInWave,
      isSpawning: this.isSpawning,
      waitingForNext: this.waitingForNextWave,
      nextWaveIn: Math.max(0, Math.ceil(this.waveDelayTimer / 1000))
    };
  }
}

module.exports = { WaveSystem };
