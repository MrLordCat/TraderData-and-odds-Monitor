/**
 * Power Towers TD - Texture Manager
 * 
 * Handles texture loading, caching, and texture atlases.
 * Supports procedural texture generation for game elements.
 */

class TextureManager {
  constructor(glContext) {
    this.glContext = glContext;
    this.gl = glContext.gl;
    
    // Texture cache
    this.textures = new Map();
    
    // Texture atlases
    this.atlases = new Map();
    
    // Default white texture (for untextured rendering)
    this.whiteTexture = this._createWhiteTexture();
    
    // Particle texture (soft circle)
    this.particleTexture = this._createParticleTexture();
  }
  
  /**
   * Create 1x1 white texture (default)
   */
  _createWhiteTexture() {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, 
      new Uint8Array([255, 255, 255, 255]));
    
    this.textures.set('_white', { texture, width: 1, height: 1 });
    return texture;
  }
  
  /**
   * Create soft circle texture for particles
   */
  _createParticleTexture(size = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Radial gradient (soft circle)
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    const texture = this.createFromCanvas(canvas, '_particle');
    return texture;
  }
  
  /**
   * Create texture from canvas
   */
  createFromCanvas(canvas, name) {
    const gl = this.gl;
    const texture = gl.createTexture();
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    
    // Texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    const textureData = { texture, width: canvas.width, height: canvas.height };
    if (name) {
      this.textures.set(name, textureData);
    }
    
    return texture;
  }
  
  /**
   * Load texture from URL
   */
  async load(name, url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const texture = this.createFromImage(image, name);
        resolve(texture);
      };
      image.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
      image.src = url;
    });
  }
  
  /**
   * Create texture from Image
   */
  createFromImage(image, name) {
    const gl = this.gl;
    const texture = gl.createTexture();
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    
    // Check if power of 2
    const isPOT = this._isPowerOf2(image.width) && this._isPowerOf2(image.height);
    
    if (isPOT) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    const textureData = { texture, width: image.width, height: image.height };
    if (name) {
      this.textures.set(name, textureData);
    }
    
    return textureData;
  }
  
  /**
   * Check if number is power of 2
   */
  _isPowerOf2(value) {
    return (value & (value - 1)) === 0;
  }
  
  /**
   * Bind texture to unit
   */
  bind(nameOrTexture, unit = 0) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    
    if (typeof nameOrTexture === 'string') {
      const data = this.textures.get(nameOrTexture);
      gl.bindTexture(gl.TEXTURE_2D, data ? data.texture : this.whiteTexture);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, nameOrTexture || this.whiteTexture);
    }
  }
  
  /**
   * Get texture data
   */
  get(name) {
    return this.textures.get(name);
  }
  
  // ============================================
  // PROCEDURAL TEXTURE GENERATION
  // ============================================
  
  /**
   * Generate tower sprite texture
   */
  generateTowerTexture(size, color, borderColor = '#000') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const half = size / 2;
    const radius = half - 2;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(half, half + 4, radius, radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(half, half, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(half - radius * 0.3, half - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    return this.createFromCanvas(canvas);
  }
  
  /**
   * Generate enemy sprite texture
   */
  generateEnemyTexture(size, color, type = 'normal') {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const half = size / 2;
    const radius = half - 2;
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(half, half + 3, radius * 0.8, radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    if (type === 'boss') {
      // Boss - hexagon
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI * 2) / 6 - Math.PI / 2;
        const x = half + Math.cos(angle) * radius;
        const y = half + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    } else if (type === 'fast') {
      // Fast - diamond
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(half, half - radius);
      ctx.lineTo(half + radius, half);
      ctx.lineTo(half, half + radius);
      ctx.lineTo(half - radius, half);
      ctx.closePath();
      ctx.fill();
    } else {
      // Normal - circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(half, half, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Border
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    return this.createFromCanvas(canvas);
  }
  
  /**
   * Generate glow texture
   */
  generateGlowTexture(size, color) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const half = size / 2;
    
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, this._fadeColor(color, 0.5));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    return this.createFromCanvas(canvas);
  }
  
  /**
   * Helper: fade color alpha
   */
  _fadeColor(color, alpha) {
    // Parse color and apply alpha
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = color;
    const parsed = ctx.fillStyle;
    // Simple hex to rgba
    if (parsed.startsWith('#')) {
      const r = parseInt(parsed.slice(1, 3), 16);
      const g = parseInt(parsed.slice(3, 5), 16);
      const b = parseInt(parsed.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    return color;
  }
  
  // ============================================
  // TEXTURE ATLAS
  // ============================================
  
  /**
   * Create texture atlas from sprite definitions
   */
  createAtlas(name, sprites, padding = 2) {
    // Calculate atlas size
    let totalArea = 0;
    for (const sprite of sprites) {
      totalArea += (sprite.width + padding) * (sprite.height + padding);
    }
    
    // Estimate atlas size (square)
    let atlasSize = Math.ceil(Math.sqrt(totalArea));
    atlasSize = this._nextPowerOf2(atlasSize);
    
    const canvas = document.createElement('canvas');
    canvas.width = atlasSize;
    canvas.height = atlasSize;
    const ctx = canvas.getContext('2d');
    
    // Simple row packing
    const regions = {};
    let x = 0;
    let y = 0;
    let rowHeight = 0;
    
    for (const sprite of sprites) {
      if (x + sprite.width + padding > atlasSize) {
        x = 0;
        y += rowHeight + padding;
        rowHeight = 0;
      }
      
      if (sprite.canvas) {
        ctx.drawImage(sprite.canvas, x, y);
      }
      
      // Store UV coordinates (normalized 0-1)
      regions[sprite.name] = {
        x, y,
        width: sprite.width,
        height: sprite.height,
        u0: x / atlasSize,
        v0: y / atlasSize,
        u1: (x + sprite.width) / atlasSize,
        v1: (y + sprite.height) / atlasSize,
      };
      
      x += sprite.width + padding;
      rowHeight = Math.max(rowHeight, sprite.height);
    }
    
    const texture = this.createFromCanvas(canvas, name);
    this.atlases.set(name, { texture, regions, size: atlasSize });
    
    return this.atlases.get(name);
  }
  
  /**
   * Get atlas region
   */
  getAtlasRegion(atlasName, spriteName) {
    const atlas = this.atlases.get(atlasName);
    if (!atlas) return null;
    return atlas.regions[spriteName];
  }
  
  /**
   * Next power of 2
   */
  _nextPowerOf2(value) {
    let result = 1;
    while (result < value) result *= 2;
    return result;
  }
  
  /**
   * Destroy all textures
   */
  destroy() {
    const gl = this.gl;
    for (const [_, data] of this.textures) {
      gl.deleteTexture(data.texture);
    }
    this.textures.clear();
    this.atlases.clear();
  }
}

module.exports = { TextureManager };
