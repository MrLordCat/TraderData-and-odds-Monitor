/**
 * Power Towers TD - Object Pool
 * 
 * Reuses objects instead of creating/destroying them.
 * Eliminates garbage collection stutters!
 * 
 * Usage:
 *   const pool = new ObjectPool(() => new Projectile(), 100);
 *   const proj = pool.acquire();
 *   // use proj...
 *   pool.release(proj);
 */

class ObjectPool {
  constructor(factory, initialSize = 50, options = {}) {
    this.factory = factory;
    this.maxSize = options.maxSize || 1000;
    
    // Pool storage
    this.available = [];
    this.active = new Set();
    
    // Stats
    this.stats = {
      created: 0,
      acquired: 0,
      released: 0,
      expanded: 0,
    };
    
    // Reset function (optional)
    this.resetFn = options.reset || null;
    
    // Pre-warm pool
    this._expand(initialSize);
  }
  
  /**
   * Expand pool with new objects
   */
  _expand(count) {
    for (let i = 0; i < count; i++) {
      if (this.available.length + this.active.size >= this.maxSize) break;
      
      const obj = this.factory();
      obj._pooled = true;
      this.available.push(obj);
      this.stats.created++;
    }
    this.stats.expanded++;
  }
  
  /**
   * Get object from pool
   */
  acquire() {
    // Expand if empty
    if (this.available.length === 0) {
      const expandSize = Math.min(50, this.maxSize - this.active.size);
      if (expandSize > 0) {
        this._expand(expandSize);
      }
    }
    
    // Get from pool
    const obj = this.available.pop();
    if (!obj) {
      console.warn('[ObjectPool] Pool exhausted!');
      return null;
    }
    
    this.active.add(obj);
    this.stats.acquired++;
    
    return obj;
  }
  
  /**
   * Return object to pool
   */
  release(obj) {
    if (!obj || !obj._pooled) return;
    if (!this.active.has(obj)) return;
    
    this.active.delete(obj);
    
    // Reset if function provided
    if (this.resetFn) {
      this.resetFn(obj);
    }
    
    this.available.push(obj);
    this.stats.released++;
  }
  
  /**
   * Release all active objects
   */
  releaseAll() {
    for (const obj of this.active) {
      if (this.resetFn) {
        this.resetFn(obj);
      }
      this.available.push(obj);
    }
    this.active.clear();
  }
  
  /**
   * Iterate active objects
   */
  forEach(fn) {
    for (const obj of this.active) {
      fn(obj);
    }
  }
  
  /**
   * Get stats
   */
  getStats() {
    return {
      available: this.available.length,
      active: this.active.size,
      total: this.available.length + this.active.size,
      max: this.maxSize,
      ...this.stats,
    };
  }
  
  /**
   * Clear pool
   */
  clear() {
    this.available = [];
    this.active.clear();
  }
}


/**
 * Typed Pool Manager
 * Manages multiple pools by type name
 */
class PoolManager {
  constructor() {
    this.pools = new Map();
  }
  
  /**
   * Register a pool
   */
  register(name, factory, initialSize = 50, options = {}) {
    if (this.pools.has(name)) {
      console.warn(`[PoolManager] Pool '${name}' already exists`);
      return;
    }
    
    this.pools.set(name, new ObjectPool(factory, initialSize, options));
  }
  
  /**
   * Get pool by name
   */
  get(name) {
    return this.pools.get(name);
  }
  
  /**
   * Acquire from named pool
   */
  acquire(name) {
    const pool = this.pools.get(name);
    if (!pool) {
      console.error(`[PoolManager] Pool '${name}' not found`);
      return null;
    }
    return pool.acquire();
  }
  
  /**
   * Release to named pool
   */
  release(name, obj) {
    const pool = this.pools.get(name);
    if (pool) {
      pool.release(obj);
    }
  }
  
  /**
   * Get all stats
   */
  getStats() {
    const stats = {};
    for (const [name, pool] of this.pools) {
      stats[name] = pool.getStats();
    }
    return stats;
  }
  
  /**
   * Clear all pools
   */
  clear() {
    for (const pool of this.pools.values()) {
      pool.clear();
    }
  }
}

module.exports = { ObjectPool, PoolManager };
