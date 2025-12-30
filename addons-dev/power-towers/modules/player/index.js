/**
 * Power Towers TD - Player Module
 * 
 * Manages player state: lives, XP, level, and progression.
 */

const { GameEvents } = require('../../core/event-bus');

class PlayerModule {
  /**
   * @param {EventBus} eventBus - Event system
   * @param {object} config - Game configuration
   */
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    
    // Lives
    this.lives = 0;
    this.maxLives = 20;
    
    // XP system
    this.xp = 0;
    this.level = 1;
    this.xpToNextLevel = 100;
    
    // Stats
    this.totalXpEarned = 0;
  }

  /**
   * Initialize module
   */
  init() {
    this.eventBus.on(GameEvents.GAME_START, () => this.onGameStart());
    this.eventBus.on('player:damage', ({ damage }) => this.takeDamage(damage));
    this.eventBus.on('player:heal', ({ amount }) => this.heal(amount));
    this.eventBus.on('enemy:killed', ({ enemy }) => this.onEnemyKilled(enemy));
    this.eventBus.on('wave:complete', ({ wave }) => this.onWaveComplete(wave));
  }

  /**
   * Update
   */
  update(deltaTime) {
    // Nothing to update per frame
  }

  /**
   * Reset
   */
  reset() {
    this.lives = this.maxLives;
    this.xp = 0;
    this.level = 1;
    this.xpToNextLevel = 100;
    this.totalXpEarned = 0;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.reset();
  }

  /**
   * On game start - no full reset, just emit update for UI sync
   */
  onGameStart() {
    // Don't reset - lives already set in initModules
    // Only emit update for UI synchronization
    this.emitUpdate();
  }

  /**
   * Take damage
   */
  takeDamage(damage) {
    this.lives = Math.max(0, this.lives - damage);
    this.emitUpdate();
    
    this.eventBus.emit('player:damaged', { 
      damage, 
      remaining: this.lives 
    });
    
    if (this.lives <= 0) {
      this.eventBus.emit(GameEvents.GAME_OVER, { 
        reason: 'lives', 
        level: this.level,
        totalXp: this.totalXpEarned
      });
    }
  }

  /**
   * Heal
   */
  heal(amount) {
    this.lives = Math.min(this.maxLives, this.lives + amount);
    this.emitUpdate();
  }

  /**
   * On enemy killed - gain XP
   */
  onEnemyKilled(enemy) {
    const xpGain = enemy.reward || 10;
    this.addXp(xpGain);
  }

  /**
   * On wave complete - bonus XP
   */
  onWaveComplete(wave) {
    const xpBonus = wave * 50;
    this.addXp(xpBonus);
  }

  /**
   * Add XP
   */
  addXp(amount) {
    this.xp += amount;
    this.totalXpEarned += amount;
    
    // Check level up
    while (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.levelUp();
    }
    
    this.emitUpdate();
  }

  /**
   * Level up
   */
  levelUp() {
    this.level++;
    this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.5);
    
    this.eventBus.emit('player:level-up', {
      level: this.level,
      nextXp: this.xpToNextLevel
    });
  }

  /**
   * Emit update
   */
  emitUpdate() {
    this.eventBus.emit('player:updated', {
      lives: this.lives,
      maxLives: this.maxLives,
      xp: this.xp,
      level: this.level,
      xpToNextLevel: this.xpToNextLevel,
      xpPercent: (this.xp / this.xpToNextLevel) * 100
    });
  }

  /**
   * Is game over?
   */
  isGameOver() {
    return this.lives <= 0;
  }

  /**
   * Get render data
   */
  getRenderData() {
    return {
      lives: this.lives,
      maxLives: this.maxLives,
      xp: this.xp,
      level: this.level,
      xpToNextLevel: this.xpToNextLevel,
      xpPercent: (this.xp / this.xpToNextLevel) * 100
    };
  }
}

module.exports = { PlayerModule };
