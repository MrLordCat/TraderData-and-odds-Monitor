/**
 * Power Towers TD - 2D Value Noise Generator
 * Used for natural-looking terrain distribution
 */

const { SeededRandom } = require('./seeded-random');

class NoiseGenerator {
  constructor(seed = 12345) {
    this.rng = new SeededRandom(seed);
    this.permutation = [];
    
    // Create permutation table
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i;
    }
    this.rng.shuffle(this.permutation);
    
    // Double the permutation for overflow
    for (let i = 0; i < 256; i++) {
      this.permutation[256 + i] = this.permutation[i];
    }
  }
  
  /**
   * Smooth interpolation
   */
  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  /**
   * Linear interpolation
   */
  lerp(a, b, t) {
    return a + t * (b - a);
  }
  
  /**
   * Get hash value at integer coordinate
   */
  hash(x, y) {
    return this.permutation[(this.permutation[x & 255] + y) & 255] / 255;
  }
  
  /**
   * Get noise value at coordinate [0, 1]
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} scale - Noise scale (larger = smoother)
   */
  get(x, y, scale = 20) {
    x = x / scale;
    y = y / scale;
    
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    
    const sx = this.fade(x - x0);
    const sy = this.fade(y - y0);
    
    const n00 = this.hash(x0, y0);
    const n10 = this.hash(x1, y0);
    const n01 = this.hash(x0, y1);
    const n11 = this.hash(x1, y1);
    
    const nx0 = this.lerp(n00, n10, sx);
    const nx1 = this.lerp(n01, n11, sx);
    
    return this.lerp(nx0, nx1, sy);
  }
  
  /**
   * Get fractal noise (multiple octaves)
   */
  fractal(x, y, octaves = 3, persistence = 0.5, scale = 20) {
    let total = 0;
    let maxValue = 0;
    let amplitude = 1;
    let frequency = 1;
    
    for (let i = 0; i < octaves; i++) {
      total += this.get(x * frequency, y * frequency, scale) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    
    return total / maxValue;
  }
}

module.exports = { NoiseGenerator };
