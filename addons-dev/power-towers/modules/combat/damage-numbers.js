/**
 * Power Towers TD - Floating Damage Numbers
 * 
 * Displays animated damage numbers that float up and fade out.
 */

const { GameEvents } = require('../../core/event-bus');

class DamageNumbersModule {
  constructor(eventBus) {
    this.eventBus = eventBus;
    
    // Active damage numbers
    this.damageNumbers = [];
    this.nextId = 1;
    
    // Configuration
    this.config = {
      duration: 0.8,        // Total lifetime in seconds
      riseSpeed: 60,        // Pixels per second (upward)
      fadeStart: 0.4,       // Start fading after this fraction of duration
      spreadX: 20,          // Random horizontal spread
      fontSize: 14,         // Base font size
      critFontSize: 18,     // Font size for crits
      critColor: '#ffd700', // Gold for crits
      normalColor: '#ffffff', // White for normal
      healColor: '#4ade80',   // Green for healing
      dotColor: '#f97316'     // Orange for DoT
    };
  }

  /**
   * Initialize module
   */
  init() {
    // Listen for damage events
    this.eventBus.on('enemy:damaged', (data) => this.onEnemyDamaged(data));
    this.eventBus.on('damage:number', (data) => this.createNumber(data));
    this.eventBus.on(GameEvents.GAME_START, () => this.reset());
  }

  /**
   * Reset all damage numbers
   */
  reset() {
    this.damageNumbers = [];
    this.nextId = 1;
  }

  /**
   * Update damage numbers
   */
  update(deltaTime) {
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const num = this.damageNumbers[i];
      num.elapsed += deltaTime;
      
      // Remove if expired
      if (num.elapsed >= num.duration) {
        this.damageNumbers.splice(i, 1);
        continue;
      }
      
      // Update position (float upward)
      num.y -= this.config.riseSpeed * deltaTime;
      
      // Calculate alpha (fade out)
      const fadeStart = this.config.fadeStart * num.duration;
      if (num.elapsed > fadeStart) {
        const fadeProgress = (num.elapsed - fadeStart) / (num.duration - fadeStart);
        num.alpha = 1 - fadeProgress;
      }
      
      // Scale animation (pop effect)
      if (num.elapsed < 0.1) {
        num.scale = 1 + (1 - num.elapsed / 0.1) * 0.3;
      } else {
        num.scale = 1;
      }
    }
  }

  /**
   * Handle enemy damaged event
   */
  onEnemyDamaged(data) {
    const { enemy, damage, isCrit } = data;
    if (!enemy || damage <= 0) return;
    
    this.createNumber({
      x: enemy.x,
      y: enemy.y,
      value: Math.floor(damage),
      isCrit: isCrit || false,
      type: 'damage'
    });
  }

  /**
   * Create a new damage number
   */
  createNumber({ x, y, value, isCrit = false, type = 'damage' }) {
    // Random horizontal offset for variety
    const offsetX = (Math.random() - 0.5) * this.config.spreadX;
    
    // Determine color and size
    let color = this.config.normalColor;
    let fontSize = this.config.fontSize;
    
    if (isCrit) {
      color = this.config.critColor;
      fontSize = this.config.critFontSize;
    } else if (type === 'heal') {
      color = this.config.healColor;
    } else if (type === 'dot') {
      color = this.config.dotColor;
    }
    
    const number = {
      id: this.nextId++,
      x: x + offsetX,
      y: y - 10, // Start slightly above enemy
      value: Math.abs(Math.floor(value)),
      isCrit,
      type,
      color,
      fontSize,
      duration: this.config.duration,
      elapsed: 0,
      alpha: 1,
      scale: 1.3 // Start enlarged for pop effect
    };
    
    this.damageNumbers.push(number);
    return number;
  }

  /**
   * Get render data
   */
  getRenderData() {
    return this.damageNumbers;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.reset();
  }
}

module.exports = { DamageNumbersModule };
