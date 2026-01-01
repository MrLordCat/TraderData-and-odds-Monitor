/**
 * Power Towers TD - Floating Damage Numbers
 * 
 * Displays animated damage numbers that float up and fade out.
 */

const { GameEvents } = require('../../core/event-bus');
const { EFFECT_TYPES } = require('../../core/element-abilities');

class DamageNumbersModule {
  constructor(eventBus) {
    this.eventBus = eventBus;
    
    // Active damage numbers
    this.damageNumbers = [];
    this.nextId = 1;
    
    // Configuration
    this.config = {
      duration: 0.8,        // Total lifetime in seconds
      dotDuration: 0.5,     // Shorter duration for DoT (less cluttered)
      riseSpeed: 60,        // Pixels per second (upward)
      dotRiseSpeed: 40,     // Slower rise for DoT
      fadeStart: 0.4,       // Start fading after this fraction of duration
      spreadX: 20,          // Random horizontal spread
      dotSpreadX: 30,       // More spread for DoT to avoid overlap
      fontSize: 14,         // Base font size
      dotFontSize: 11,      // Smaller for DoT
      critFontSize: 18,     // Font size for crits
      // Colors
      critColor: '#ffd700',   // Gold for crits
      normalColor: '#ffffff', // White for normal
      healColor: '#4ade80',   // Green for healing
      // DoT colors by element
      dotColors: {
        [EFFECT_TYPES.BURN]: '#ff6b35',    // Fire orange
        [EFFECT_TYPES.POISON]: '#84cc16',  // Nature green
        default: '#f97316'                  // Fallback orange
      }
    };
  }

  /**
   * Initialize module
   */
  init() {
    // Listen for damage events
    this.eventBus.on('enemy:damaged', (data) => this.onEnemyDamaged(data));
    this.eventBus.on('enemy:dot-damage', (data) => this.onDotDamage(data));
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
      
      // Update position (float upward) - use number's own riseSpeed if set
      const riseSpeed = num.riseSpeed || this.config.riseSpeed;
      num.y -= riseSpeed * deltaTime;
      
      // Calculate alpha (fade out)
      const fadeStart = this.config.fadeStart * num.duration;
      if (num.elapsed > fadeStart) {
        const fadeProgress = (num.elapsed - fadeStart) / (num.duration - fadeStart);
        num.alpha = Math.max(0, (num.type === 'dot' ? 0.9 : 1) - fadeProgress);
      }
      
      // Scale animation (pop effect) - smaller pop for DoT
      if (num.elapsed < 0.1) {
        const maxScale = num.type === 'dot' ? 0.15 : 0.3;
        num.scale = 1 + (1 - num.elapsed / 0.1) * maxScale;
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
   * Handle DoT damage event (burn, poison, etc.)
   */
  onDotDamage(data) {
    const { x, y, damage, effectType, stacks } = data;
    if (!x || !y || damage <= 0) return;
    
    this.createDotNumber({
      x,
      y,
      value: damage,
      effectType: effectType || 'burn',
      stacks: stacks || 1
    });
  }

  /**
   * Create a DoT damage number (smaller, faster, element-colored)
   */
  createDotNumber({ x, y, value, effectType, stacks }) {
    // More spread for DoT to avoid overlap with rapid ticks
    const offsetX = (Math.random() - 0.5) * this.config.dotSpreadX;
    const offsetY = (Math.random() - 0.5) * 10; // Small vertical spread too
    
    // Get color based on effect type
    const color = this.config.dotColors[effectType] || this.config.dotColors.default;
    
    // Element emoji prefix
    const prefix = effectType === EFFECT_TYPES.BURN ? '🔥' : 
                   effectType === EFFECT_TYPES.POISON ? '🌿' : '';
    
    const number = {
      id: this.nextId++,
      x: x + offsetX,
      y: y - 5 + offsetY, // Start slightly above enemy
      value: Math.abs(Math.floor(value)),
      prefix, // Emoji prefix for element
      isCrit: false,
      type: 'dot',
      effectType,
      color,
      fontSize: this.config.dotFontSize,
      duration: this.config.dotDuration,
      riseSpeed: this.config.dotRiseSpeed,
      elapsed: 0,
      alpha: 0.9, // Slightly transparent
      scale: 1.1 // Small pop
    };
    
    this.damageNumbers.push(number);
    return number;
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
