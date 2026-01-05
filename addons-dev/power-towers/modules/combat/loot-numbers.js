/**
 * Power Towers TD - Floating Loot Numbers
 * 
 * Displays animated gold numbers with coin icons that float up when enemies are killed.
 * Supports bonus gold from crits and other sources.
 */

const { GameEvents } = require('../../core/event-bus');

class LootNumbersModule {
  constructor(eventBus) {
    this.eventBus = eventBus;
    
    // Active loot numbers
    this.lootNumbers = [];
    this.nextId = 1;
    
    // Coin particles for extra flair
    this.coinParticles = [];
    
    // Configuration
    this.config = {
      // Timing
      duration: 0.7,           // Total lifetime in seconds (shorter to avoid clutter)
      bonusDuration: 1.0,      // Longer for bonus gold
      riseSpeed: 70,           // Pixels per second (upward) - faster rise
      bonusRiseSpeed: 55,      // Slightly slower for bonus (more visible)
      fadeStart: 0.3,          // Start fading earlier
      
      // Positioning
      spreadX: 30,             // Random horizontal spread (more spread)
      startOffsetY: -15,       // Start above enemy position
      
      // Sizes
      fontSize: 12,            // Base font size (slightly smaller)
      bonusFontSize: 14,       // Larger for bonus gold
      critBonusFontSize: 16,   // Even larger for crit bonus
      
      // Colors
      goldColor: '#ffd700',         // Standard gold
      bonusColor: '#ffec8b',        // Lighter gold for bonus
      critBonusColor: '#fff700',    // Bright yellow for crit bonus
      
      // Coin particles
      coinCount: 2,            // Base coins per kill (fewer)
      bonusCoinCount: 4,       // More coins for bonus
      coinSize: 6,             // Coin particle size (smaller)
      coinDuration: 0.5,       // Coin particle lifetime (shorter)
      coinSpeed: 100,          // Initial velocity (faster)
      coinGravity: 300,        // Gravity for coins (stronger)
      coinSpread: 30,          // Spread radius
      
      // Icons
      coinIcon: '🪙',          // Coin emoji
      critIcon: '⚡',           // Crit bonus icon
      bonusIcon: '✨'          // Generic bonus icon
    };
  }

  /**
   * Initialize module
   */
  init() {
    // Listen for enemy kill events
    this.eventBus.on('enemy:killed', (data) => this.onEnemyKilled(data));
    
    // Listen for direct loot display requests (for testing or special cases)
    this.eventBus.on('loot:display', (data) => this.createLootNumber(data));
    
    // Reset on game start
    this.eventBus.on(GameEvents.GAME_START, () => this.reset());
  }

  /**
   * Reset all loot numbers and particles
   */
  reset() {
    this.lootNumbers = [];
    this.coinParticles = [];
    this.nextId = 1;
  }

  /**
   * Update loot numbers and particles
   */
  update(deltaTime) {
    // Update loot numbers
    for (let i = this.lootNumbers.length - 1; i >= 0; i--) {
      const num = this.lootNumbers[i];
      num.elapsed += deltaTime;
      
      // Remove if expired
      if (num.elapsed >= num.duration) {
        this.lootNumbers.splice(i, 1);
        continue;
      }
      
      // Update position (float upward)
      num.y -= num.riseSpeed * deltaTime;
      
      // Slight horizontal drift
      num.x += num.driftX * deltaTime;
      
      // Calculate alpha (fade out)
      const fadeStart = this.config.fadeStart * num.duration;
      if (num.elapsed > fadeStart) {
        const fadeProgress = (num.elapsed - fadeStart) / (num.duration - fadeStart);
        num.alpha = Math.max(0, 1 - fadeProgress);
      }
      
      // Scale animation (pop effect then settle)
      if (num.elapsed < 0.15) {
        // Pop up
        num.scale = 1 + (1 - num.elapsed / 0.15) * 0.4;
      } else if (num.elapsed < 0.25) {
        // Settle back
        const settle = (num.elapsed - 0.15) / 0.1;
        num.scale = 1.4 - settle * 0.4;
      } else {
        num.scale = 1;
      }
      
      // Coin icon bobbing animation
      if (num.coinBob !== undefined) {
        num.coinBob = Math.sin(num.elapsed * 8) * 2;
      }
    }
    
    // Update coin particles
    for (let i = this.coinParticles.length - 1; i >= 0; i--) {
      const coin = this.coinParticles[i];
      coin.elapsed += deltaTime;
      
      // Remove if expired
      if (coin.elapsed >= coin.duration) {
        this.coinParticles.splice(i, 1);
        continue;
      }
      
      // Physics update
      coin.vy += this.config.coinGravity * deltaTime;
      coin.x += coin.vx * deltaTime;
      coin.y += coin.vy * deltaTime;
      
      // Rotation
      coin.rotation += coin.rotationSpeed * deltaTime;
      
      // Fade out
      const fadeStart = 0.5;
      if (coin.elapsed / coin.duration > fadeStart) {
        const fadeProgress = (coin.elapsed / coin.duration - fadeStart) / (1 - fadeStart);
        coin.alpha = Math.max(0, 1 - fadeProgress);
      }
      
      // Scale down slightly as it falls
      coin.scale = 1 - (coin.elapsed / coin.duration) * 0.3;
    }
  }

  /**
   * Handle enemy killed event
   */
  onEnemyKilled(data) {
    const { enemy, reward, killerTowerId, isCrit, critBonus } = data;
    if (!enemy || reward <= 0) return;
    
    // Create main loot number
    this.createLootNumber({
      x: enemy.x,
      y: enemy.y,
      value: reward,
      type: 'normal'
    });
    
    // Spawn coin particles
    this.spawnCoinParticles(enemy.x, enemy.y, this.config.coinCount);
    
    // If there's crit bonus gold, show it separately
    if (critBonus && critBonus > 0) {
      // Delay slightly so it appears after main gold
      setTimeout(() => {
        this.createLootNumber({
          x: enemy.x,
          y: enemy.y - 20, // Slightly higher
          value: critBonus,
          type: 'crit_bonus'
        });
        // Extra coins for crit
        this.spawnCoinParticles(enemy.x, enemy.y - 10, this.config.bonusCoinCount, true);
      }, 100);
    }
  }

  /**
   * Create a loot number
   * @param {Object} options
   * @param {number} options.x - World X position
   * @param {number} options.y - World Y position
   * @param {number} options.value - Gold amount
   * @param {string} [options.type='normal'] - 'normal', 'bonus', 'crit_bonus'
   */
  createLootNumber({ x, y, value, type = 'normal' }) {
    // Random horizontal offset
    const offsetX = (Math.random() - 0.5) * this.config.spreadX;
    
    // Determine style based on type
    let color, fontSize, duration, riseSpeed, prefix;
    
    switch (type) {
      case 'crit_bonus':
        color = this.config.critBonusColor;
        fontSize = this.config.critBonusFontSize;
        duration = this.config.bonusDuration;
        riseSpeed = this.config.bonusRiseSpeed;
        prefix = this.config.critIcon;
        break;
      case 'bonus':
        color = this.config.bonusColor;
        fontSize = this.config.bonusFontSize;
        duration = this.config.bonusDuration;
        riseSpeed = this.config.bonusRiseSpeed;
        prefix = this.config.bonusIcon;
        break;
      default: // normal
        color = this.config.goldColor;
        fontSize = this.config.fontSize;
        duration = this.config.duration;
        riseSpeed = this.config.riseSpeed;
        prefix = this.config.coinIcon;
    }
    
    const number = {
      id: this.nextId++,
      x: x + offsetX,
      y: y + this.config.startOffsetY,
      value: Math.floor(value),
      type,
      color,
      fontSize,
      duration,
      riseSpeed,
      prefix,
      driftX: (Math.random() - 0.5) * 10, // Slight horizontal drift
      elapsed: 0,
      alpha: 1,
      scale: 1.5, // Start enlarged for pop effect
      coinBob: 0 // For bobbing animation
    };
    
    this.lootNumbers.push(number);
    return number;
  }

  /**
   * Spawn coin particles for visual effect
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} count - Number of coins
   * @param {boolean} [isBonus=false] - If true, coins are golden/brighter
   */
  spawnCoinParticles(x, y, count, isBonus = false) {
    for (let i = 0; i < count; i++) {
      // Random angle for spread
      const angle = Math.random() * Math.PI * 2;
      const speed = this.config.coinSpeed * (0.5 + Math.random() * 0.5);
      
      const coin = {
        id: this.nextId++,
        x: x + (Math.random() - 0.5) * 10,
        y: y,
        vx: Math.cos(angle) * speed * 0.5,
        vy: -speed * (0.5 + Math.random() * 0.5), // Mostly upward
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 10,
        size: this.config.coinSize * (0.8 + Math.random() * 0.4),
        duration: this.config.coinDuration * (0.8 + Math.random() * 0.4),
        elapsed: 0,
        alpha: 1,
        scale: 1,
        isBonus
      };
      
      this.coinParticles.push(coin);
    }
  }

  /**
   * Get render data for renderer
   */
  getRenderData() {
    return {
      lootNumbers: this.lootNumbers,
      coinParticles: this.coinParticles
    };
  }

  /**
   * Cleanup
   */
  destroy() {
    this.reset();
  }
}

module.exports = { LootNumbersModule };
