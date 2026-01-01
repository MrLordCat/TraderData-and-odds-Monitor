/**
 * Power Towers TD - Sprite Batch Renderer
 * 
 * THE KEY OPTIMIZATION: Renders thousands of sprites in a single draw call!
 * 
 * How it works:
 * 1. Collect all sprites to draw
 * 2. Build vertex buffer with all quads
 * 3. One draw call renders everything
 * 
 * Performance: 10,000 sprites = 1 draw call vs 10,000 draw calls
 */

class SpriteBatch {
  constructor(glContext, shaderManager, textureManager) {
    this.glContext = glContext;
    this.gl = glContext.gl;
    this.shaderManager = shaderManager;
    this.textureManager = textureManager;
    
    // Batch settings
    this.maxSprites = 10000;
    this.maxVertices = this.maxSprites * 4;  // 4 vertices per sprite
    this.maxIndices = this.maxSprites * 6;   // 6 indices per sprite (2 triangles)
    
    // Vertex format: x, y, u, v, r, g, b, a (8 floats per vertex)
    this.vertexSize = 8;
    this.vertexStride = this.vertexSize * 4;  // bytes
    
    // Buffers
    this.vertices = new Float32Array(this.maxVertices * this.vertexSize);
    this.vertexBuffer = null;
    this.indexBuffer = null;
    
    // Batch state
    this.spriteCount = 0;
    this.currentTexture = null;
    this.drawing = false;
    
    // Projection matrix (orthographic 2D)
    this.projectionMatrix = new Float32Array(9);
    
    // Initialize
    this._createBuffers();
  }
  
  /**
   * Create WebGL buffers
   */
  _createBuffers() {
    const gl = this.gl;
    
    // Vertex buffer (dynamic)
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW);
    
    // Index buffer (static - same pattern for all quads)
    const indices = new Uint16Array(this.maxIndices);
    for (let i = 0, j = 0; i < this.maxIndices; i += 6, j += 4) {
      indices[i + 0] = j + 0;
      indices[i + 1] = j + 1;
      indices[i + 2] = j + 2;
      indices[i + 3] = j + 2;
      indices[i + 4] = j + 3;
      indices[i + 5] = j + 0;
    }
    
    this.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  }
  
  /**
   * Set up orthographic projection
   */
  setProjection(width, height) {
    // Orthographic projection matrix (3x3 for 2D)
    // Maps (0,0)-(width,height) to (-1,-1)-(1,1) clip space
    const m = this.projectionMatrix;
    m[0] = 2 / width;   m[1] = 0;            m[2] = 0;
    m[3] = 0;           m[4] = -2 / height;  m[5] = 0;
    m[6] = -1;          m[7] = 1;            m[8] = 1;
  }
  
  /**
   * Begin batch rendering
   */
  begin(camera = null) {
    if (this.drawing) {
      console.warn('[SpriteBatch] Already drawing, call end() first');
      return;
    }
    
    this.drawing = true;
    this.spriteCount = 0;
    
    // Use sprite shader
    this.shaderManager.use('sprite');
    
    // Set projection (apply camera if provided)
    if (camera) {
      this._setCameraProjection(camera);
    } else {
      this.shaderManager.setUniform('u_projection', 'mat3', this.projectionMatrix);
    }
    
    // Set texture uniform
    this.shaderManager.setUniform('u_texture', '1i', 0);
    
    // Enable blending
    this.glContext.enableBlending();
  }
  
  /**
   * Set projection with camera transform
   */
  _setCameraProjection(camera) {
    const width = camera.viewportWidth;
    const height = camera.viewportHeight;
    const zoom = camera.zoom;
    const camX = camera.x;
    const camY = camera.y;
    
    // Combined projection + camera transform
    const m = this.projectionMatrix;
    const sx = 2 * zoom / width;
    const sy = -2 * zoom / height;
    const tx = -camX * sx - 1;
    const ty = -camY * sy + 1;
    
    m[0] = sx;  m[1] = 0;   m[2] = 0;
    m[3] = 0;   m[4] = sy;  m[5] = 0;
    m[6] = tx;  m[7] = ty;  m[8] = 1;
    
    this.shaderManager.setUniform('u_projection', 'mat3', this.projectionMatrix);
  }
  
  /**
   * Draw a sprite
   */
  draw(texture, x, y, width, height, options = {}) {
    if (!this.drawing) {
      console.warn('[SpriteBatch] Call begin() before draw()');
      return;
    }
    
    // Check if we need to flush (different texture or batch full)
    if (this.currentTexture !== texture) {
      this.flush();
      this.currentTexture = texture;
      this.textureManager.bind(texture, 0);
    }
    
    if (this.spriteCount >= this.maxSprites) {
      this.flush();
    }
    
    // Options
    const {
      u0 = 0, v0 = 0, u1 = 1, v1 = 1,     // UV coordinates
      r = 1, g = 1, b = 1, a = 1,          // Color tint
      rotation = 0,                         // Rotation in radians
      originX = 0.5, originY = 0.5,        // Origin (0-1)
      scaleX = 1, scaleY = 1,              // Scale
    } = options;
    
    // Calculate corners
    const ox = width * originX;
    const oy = height * originY;
    
    let x0 = -ox * scaleX;
    let y0 = -oy * scaleY;
    let x1 = (width - ox) * scaleX;
    let y1 = (height - oy) * scaleY;
    
    // Apply rotation if needed
    let cos = 1, sin = 0;
    if (rotation !== 0) {
      cos = Math.cos(rotation);
      sin = Math.sin(rotation);
    }
    
    // Transform corners
    const ax = x + (cos * x0 - sin * y0);
    const ay = y + (sin * x0 + cos * y0);
    const bx = x + (cos * x1 - sin * y0);
    const by = y + (sin * x1 + cos * y0);
    const cx = x + (cos * x1 - sin * y1);
    const cy = y + (sin * x1 + cos * y1);
    const dx = x + (cos * x0 - sin * y1);
    const dy = y + (sin * x0 + cos * y1);
    
    // Add vertices
    const idx = this.spriteCount * 4 * this.vertexSize;
    const v = this.vertices;
    
    // Top-left
    v[idx + 0] = ax;  v[idx + 1] = ay;
    v[idx + 2] = u0;  v[idx + 3] = v0;
    v[idx + 4] = r;   v[idx + 5] = g;   v[idx + 6] = b;   v[idx + 7] = a;
    
    // Top-right
    v[idx + 8] = bx;  v[idx + 9] = by;
    v[idx + 10] = u1; v[idx + 11] = v0;
    v[idx + 12] = r;  v[idx + 13] = g;  v[idx + 14] = b;  v[idx + 15] = a;
    
    // Bottom-right
    v[idx + 16] = cx; v[idx + 17] = cy;
    v[idx + 18] = u1; v[idx + 19] = v1;
    v[idx + 20] = r;  v[idx + 21] = g;  v[idx + 22] = b;  v[idx + 23] = a;
    
    // Bottom-left
    v[idx + 24] = dx; v[idx + 25] = dy;
    v[idx + 26] = u0; v[idx + 27] = v1;
    v[idx + 28] = r;  v[idx + 29] = g;  v[idx + 30] = b;  v[idx + 31] = a;
    
    this.spriteCount++;
  }
  
  /**
   * Draw sprite centered at position
   */
  drawCentered(texture, x, y, width, height, options = {}) {
    this.draw(texture, x, y, width, height, {
      ...options,
      originX: 0.5,
      originY: 0.5,
    });
  }
  
  /**
   * Draw colored rectangle (no texture)
   */
  drawRect(x, y, width, height, r, g, b, a = 1) {
    this.draw('_white', x, y, width, height, { r, g, b, a, originX: 0, originY: 0 });
  }
  
  /**
   * Flush batch to GPU
   */
  flush() {
    if (this.spriteCount === 0) return;
    
    const gl = this.gl;
    const shader = this.shaderManager.activeProgram;
    
    // Upload vertex data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, 
      this.vertices.subarray(0, this.spriteCount * 4 * this.vertexSize));
    
    // Set up vertex attributes
    const stride = this.vertexStride;
    
    // Position (x, y)
    gl.enableVertexAttribArray(shader.attributes.a_position);
    gl.vertexAttribPointer(shader.attributes.a_position, 2, gl.FLOAT, false, stride, 0);
    
    // Texture coords (u, v)
    gl.enableVertexAttribArray(shader.attributes.a_texCoord);
    gl.vertexAttribPointer(shader.attributes.a_texCoord, 2, gl.FLOAT, false, stride, 8);
    
    // Color (r, g, b, a)
    gl.enableVertexAttribArray(shader.attributes.a_color);
    gl.vertexAttribPointer(shader.attributes.a_color, 4, gl.FLOAT, false, stride, 16);
    
    // Draw
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.drawElements(gl.TRIANGLES, this.spriteCount * 6, gl.UNSIGNED_SHORT, 0);
    
    // Update stats
    this.glContext.stats.drawCalls++;
    this.glContext.stats.triangles += this.spriteCount * 2;
    
    // Reset
    this.spriteCount = 0;
  }
  
  /**
   * End batch rendering
   */
  end() {
    if (!this.drawing) {
      console.warn('[SpriteBatch] Not drawing');
      return;
    }
    
    this.flush();
    this.drawing = false;
    this.currentTexture = null;
  }
  
  /**
   * Destroy buffers
   */
  destroy() {
    const gl = this.gl;
    gl.deleteBuffer(this.vertexBuffer);
    gl.deleteBuffer(this.indexBuffer);
  }
}

module.exports = { SpriteBatch };
