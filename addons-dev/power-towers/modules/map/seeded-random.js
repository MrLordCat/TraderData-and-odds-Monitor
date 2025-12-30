/**
 * Power Towers TD - Seeded Random Number Generator
 * Simple Mulberry32 implementation for reproducible random generation
 */

class SeededRandom {
  constructor(seed = Date.now()) {
    this.seed = seed;
  }
  
  /**
   * Get next random number [0, 1)
   */
  next() {
    let t = this.seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  
  /**
   * Get random integer [min, max]
   */
  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  
  /**
   * Get random float [min, max)
   */
  float(min, max) {
    return this.next() * (max - min) + min;
  }
  
  /**
   * Pick random element from array
   */
  pick(array) {
    return array[this.int(0, array.length - 1)];
  }
  
  /**
   * Shuffle array in place
   */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

module.exports = { SeededRandom };
