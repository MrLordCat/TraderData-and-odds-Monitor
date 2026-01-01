/**
 * Power Towers TD - GPU Particle System
 * 
 * High-performance particle effects using WebGL.
 * Supports: explosions, trails, sparks, smoke, etc.
 * 
 * Can handle 10,000+ particles at 60 FPS!
 */

class ParticleSystem {
  constructor(glContext, shaderManager, textureManager) {
    this.glContext = glContext;
    this.gl = glContext.gl;
    this.shaderManager = shaderManager;
    this.textureManager = textureManager;
    
    // Particle pool
    this.maxParticles = 10000;
    this.particles = new Array(this.maxParticles);
    this.activeCount = 0;
    
    // Vertex buffer (position, color, size)
    // x, y, r, g, b, a, size = 7 floats per particle
    this.vertexSize = 7;
    this.vertices = new Float32Array(this.maxParticles * this.vertexSize);
    this.vertexBuffer = null;
    
    // Projection matrix
    this.projectionMatrix = new Float32Array(9);
    
    // Pre-defined emitter types
    this.emitterTypes = this._createEmitterTypes();
    
    // Active emitters
    this.emitters = [];
    
    // Initialize particles
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles[i] = this._createParticle();
    }
    
    this._createBuffers();
  }
  
  _createBuffers() {
    const gl = this.gl;
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW);
  }
  
  /**
   * Create particle object
   */
  _createParticle() {
    return {
      active: false,
      x: 0, y: 0,
      vx: 0, vy: 0,
      ax: 0, ay: 0,    // acceleration
      r: 1, g: 1, b: 1, a: 1,
      size: 10,
      life: 0,
      maxLife: 1,
      // Color fade
      startR: 1, startG: 1, startB: 1, startA: 1,
      endR: 1, endG: 1, endB: 1, endA: 0,
      // Size fade
      startSize: 10,
      endSize: 0,
    };
  }
  
  /**
   * Create emitter type presets
   */
  _createEmitterTypes() {
    return {
      // Explosion effect
      explosion: {
        count: 30,
        speed: { min: 100, max: 300 },
        life: { min: 0.3, max: 0.6 },
        size: { start: 15, end: 3 },
        color: { start: [1, 0.8, 0.2, 1], end: [1, 0.2, 0, 0] },
        gravity: 200,
        spread: Math.PI * 2,
      },
      
      // Small hit effect
      hit: {
        count: 8,
        speed: { min: 50, max: 150 },
        life: { min: 0.2, max: 0.4 },
        size: { start: 8, end: 2 },
        color: { start: [1, 1, 1, 1], end: [1, 1, 1, 0] },
        gravity: 0,
        spread: Math.PI * 2,
      },
      
      // Fire effect
      fire: {
        count: 15,
        speed: { min: 30, max: 80 },
        life: { min: 0.4, max: 0.8 },
        size: { start: 12, end: 4 },
        color: { start: [1, 0.5, 0, 0.8], end: [0.3, 0, 0, 0] },
        gravity: -50,  // Rise up
        spread: Math.PI * 0.5,
        direction: -Math.PI / 2,  // Up
      },
      
      // Ice effect
      ice: {
        count: 12,
        speed: { min: 40, max: 100 },
        life: { min: 0.5, max: 1 },
        size: { start: 10, end: 3 },
        color: { start: [0.6, 0.9, 1, 0.9], end: [0.2, 0.5, 1, 0] },
        gravity: 100,
        spread: Math.PI * 0.8,
      },
      
      // Lightning spark
      lightning: {
        count: 20,
        speed: { min: 150, max: 400 },
        life: { min: 0.1, max: 0.3 },
        size: { start: 6, end: 2 },
        color: { start: [0.8, 0.9, 1, 1], end: [0.4, 0.6, 1, 0] },
        gravity: 0,
        spread: Math.PI * 2,
      },
      
      // Nature/poison
      nature: {
        count: 10,
        speed: { min: 20, max: 60 },
        life: { min: 0.6, max: 1.2 },
        size: { start: 8, end: 4 },
        color: { start: [0.2, 0.8, 0.3, 0.8], end: [0.1, 0.5, 0.1, 0] },
        gravity: -30,
        spread: Math.PI * 0.6,
        direction: -Math.PI / 2,
      },
      
      // Dark/death
      dark: {
        count: 15,
        speed: { min: 30, max: 80 },
        life: { min: 0.5, max: 1 },
        size: { start: 10, end: 5 },
        color: { start: [0.3, 0, 0.4, 0.8], end: [0, 0, 0, 0] },
        gravity: -20,
        spread: Math.PI * 2,
      },
      
      // Smoke
      smoke: {
        count: 5,
        speed: { min: 10, max: 30 },
        life: { min: 1, max: 2 },
        size: { start: 15, end: 40 },
        color: { start: [0.3, 0.3, 0.3, 0.5], end: [0.5, 0.5, 0.5, 0] },
        gravity: -20,
        spread: Math.PI * 0.4,
        direction: -Math.PI / 2,
      },
      
      // Gold coins (for rewards)
      gold: {
        count: 8,
        speed: { min: 80, max: 150 },
        life: { min: 0.5, max: 0.8 },
        size: { start: 8, end: 4 },
        color: { start: [1, 0.85, 0.2, 1], end: [1, 0.7, 0, 0] },
        gravity: 300,
        spread: Math.PI * 0.6,
        direction: -Math.PI / 2,
      },
      
      // Trail (for projectiles)
      trail: {
        count: 1,
        speed: { min: 0, max: 10 },
        life: { min: 0.2, max: 0.3 },
        size: { start: 6, end: 2 },
        color: { start: [1, 1, 1, 0.6], end: [1, 1, 1, 0] },
        gravity: 0,
        spread: 0,
      },
    };
  }
  
  /**
   * Emit particles at position
   */
  emit(type, x, y, options = {}) {
    const preset = this.emitterTypes[type];
    if (!preset) {
      console.warn(`[ParticleSystem] Unknown emitter type: ${type}`);
      return;
    }
    
    const count = options.count ?? preset.count;
    const direction = options.direction ?? preset.direction ?? 0;
    
    for (let i = 0; i < count; i++) {
      const p = this._getInactiveParticle();
      if (!p) break;  // Pool exhausted
      
      // Position
      p.x = x + (options.offsetX ?? 0);
      p.y = y + (options.offsetY ?? 0);
      
      // Random direction within spread
      const angle = direction + (Math.random() - 0.5) * preset.spread;
      const speed = this._randomRange(preset.speed.min, preset.speed.max);
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      
      // Gravity
      p.ax = 0;
      p.ay = preset.gravity ?? 0;
      
      // Life
      p.life = this._randomRange(preset.life.min, preset.life.max);
      p.maxLife = p.life;
      
      // Size
      p.startSize = options.startSize ?? preset.size.start;
      p.endSize = options.endSize ?? preset.size.end;
      p.size = p.startSize;
      
      // Color
      const startColor = options.startColor ?? preset.color.start;
      const endColor = options.endColor ?? preset.color.end;
      p.startR = startColor[0];
      p.startG = startColor[1];
      p.startB = startColor[2];
      p.startA = startColor[3];
      p.endR = endColor[0];
      p.endG = endColor[1];
      p.endB = endColor[2];
      p.endA = endColor[3];
      p.r = p.startR;
      p.g = p.startG;
      p.b = p.startB;
      p.a = p.startA;
      
      p.active = true;
      this.activeCount++;
    }
  }
  
  /**
   * Get inactive particle from pool
   */
  _getInactiveParticle() {
    for (let i = 0; i < this.maxParticles; i++) {
      if (!this.particles[i].active) {
        return this.particles[i];
      }
    }
    return null;
  }
  
  /**
   * Random range helper
   */
  _randomRange(min, max) {
    return min + Math.random() * (max - min);
  }
  
  /**
   * Update all particles
   */
  update(dt) {
    this.activeCount = 0;
    
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      
      // Update life
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      
      this.activeCount++;
      
      // Life ratio (1 -> 0)
      const t = 1 - (p.life / p.maxLife);
      
      // Update physics
      p.vx += p.ax * dt;
      p.vy += p.ay * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      
      // Interpolate color
      p.r = p.startR + (p.endR - p.startR) * t;
      p.g = p.startG + (p.endG - p.startG) * t;
      p.b = p.startB + (p.endB - p.startB) * t;
      p.a = p.startA + (p.endA - p.startA) * t;
      
      // Interpolate size
      p.size = p.startSize + (p.endSize - p.startSize) * t;
    }
  }
  
  /**
   * Render all particles
   */
  render(camera = null) {
    if (this.activeCount === 0) return;
    
    const gl = this.gl;
    
    // Use particle shader
    this.shaderManager.use('particle');
    
    // Set projection
    if (camera) {
      this._setCameraProjection(camera);
    }
    
    // Point scale (adjust for zoom)
    const pointScale = camera ? camera.zoom : 1;
    this.shaderManager.setUniform('u_pointScale', '1f', pointScale);
    this.shaderManager.setUniform('u_texture', '1i', 0);
    
    // Bind particle texture
    this.textureManager.bind('_particle', 0);
    
    // Enable additive blending for glowing particles
    this.glContext.enableAdditiveBlending();
    
    // Build vertex buffer
    let idx = 0;
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      
      this.vertices[idx++] = p.x;
      this.vertices[idx++] = p.y;
      this.vertices[idx++] = p.r;
      this.vertices[idx++] = p.g;
      this.vertices[idx++] = p.b;
      this.vertices[idx++] = p.a;
      this.vertices[idx++] = p.size;
    }
    
    // Upload
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertices.subarray(0, idx));
    
    // Set attributes
    const shader = this.shaderManager.activeProgram;
    const stride = this.vertexSize * 4;
    
    gl.enableVertexAttribArray(shader.attributes.a_position);
    gl.vertexAttribPointer(shader.attributes.a_position, 2, gl.FLOAT, false, stride, 0);
    
    gl.enableVertexAttribArray(shader.attributes.a_color);
    gl.vertexAttribPointer(shader.attributes.a_color, 4, gl.FLOAT, false, stride, 8);
    
    gl.enableVertexAttribArray(shader.attributes.a_size);
    gl.vertexAttribPointer(shader.attributes.a_size, 1, gl.FLOAT, false, stride, 24);
    
    // Draw points
    gl.drawArrays(gl.POINTS, 0, this.activeCount);
    
    this.glContext.stats.drawCalls++;
    
    // Restore normal blending
    this.glContext.enableBlending();
  }
  
  _setCameraProjection(camera) {
    const width = camera.viewportWidth;
    const height = camera.viewportHeight;
    const zoom = camera.zoom;
    const camX = camera.x;
    const camY = camera.y;
    
    const m = this.projectionMatrix;
    const sx = 2 * zoom / width;
    const sy = -2 * zoom / height;
    const tx = -camX * sx - 1;
    const ty = -camY * sy + 1;
    
    m[0] = sx;  m[1] = 0;   m[2] = 0;
    m[3] = 0;   m[4] = sy;  m[5] = 0;
    m[6] = tx;  m[7] = ty;  m[8] = 1;
    
    this.shaderManager.setUniform('u_projection', 'mat3', m);
  }
  
  /**
   * Clear all particles
   */
  clear() {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles[i].active = false;
    }
    this.activeCount = 0;
  }
  
  /**
   * Get stats
   */
  getStats() {
    return {
      active: this.activeCount,
      max: this.maxParticles,
      usage: (this.activeCount / this.maxParticles * 100).toFixed(1) + '%',
    };
  }
  
  destroy() {
    this.gl.deleteBuffer(this.vertexBuffer);
  }
}

module.exports = { ParticleSystem };
