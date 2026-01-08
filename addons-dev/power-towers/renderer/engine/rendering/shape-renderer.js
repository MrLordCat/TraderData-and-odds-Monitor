/**
 * Power Towers TD - Shape Renderer
 * 
 * Renders geometric primitives (circles, lines, rectangles)
 * Uses batching for efficiency.
 */

class ShapeRenderer {
  constructor(glContext, shaderManager) {
    this.glContext = glContext;
    this.gl = glContext.gl;
    this.shaderManager = shaderManager;
    
    // Batch settings - increased for large maps
    this.maxVertices = 60000;
    this.vertexSize = 6;  // x, y, r, g, b, a
    this.vertexStride = this.vertexSize * 4;
    
    // Buffers
    this.vertices = new Float32Array(this.maxVertices * this.vertexSize);
    this.vertexBuffer = null;
    this.vertexCount = 0;
    
    // State
    this.drawing = false;
    this.primitiveType = null;
    this.currentCamera = null;  // Store camera for flush
    
    // Projection matrix
    this.projectionMatrix = new Float32Array(9);
    
    // Circle quality (segments)
    this.circleSegments = 16;  // Reduced for performance
    
    this._createBuffers();
  }
  
  _createBuffers() {
    const gl = this.gl;
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.byteLength, gl.DYNAMIC_DRAW);
  }
  
  /**
   * Set orthographic projection
   */
  setProjection(width, height) {
    const m = this.projectionMatrix;
    m[0] = 2 / width;   m[1] = 0;            m[2] = 0;
    m[3] = 0;           m[4] = -2 / height;  m[5] = 0;
    m[6] = -1;          m[7] = 1;            m[8] = 1;
  }
  
  /**
   * Begin shape rendering
   */
  begin(primitiveType = 'triangles', camera = null) {
    if (this.drawing) {
      this.end();
    }
    
    this.drawing = true;
    this.vertexCount = 0;
    this.currentCamera = camera;  // Store for flush
    
    const gl = this.gl;
    switch (primitiveType) {
      case 'triangles': this.primitiveType = gl.TRIANGLES; break;
      case 'lines': this.primitiveType = gl.LINES; break;
      case 'points': this.primitiveType = gl.POINTS; break;
      default: this.primitiveType = gl.TRIANGULAR;
    }
    
    // Use color shader
    this.shaderManager.use('color');
    
    // Set projection
    if (camera) {
      this._setCameraProjection(camera);
    } else {
      this.shaderManager.setUniform('u_projection', 'mat3', this.projectionMatrix);
    }
    
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
    
    this.shaderManager.setUniform('u_projection', 'mat3', this.projectionMatrix);
  }
  
  /**
   * Add vertex
   */
  vertex(x, y, r, g, b, a = 1) {
    if (this.vertexCount >= this.maxVertices) {
      this.flush();
    }
    
    const idx = this.vertexCount * this.vertexSize;
    this.vertices[idx + 0] = x;
    this.vertices[idx + 1] = y;
    this.vertices[idx + 2] = r;
    this.vertices[idx + 3] = g;
    this.vertices[idx + 4] = b;
    this.vertices[idx + 5] = a;
    
    this.vertexCount++;
  }
  
  /**
   * Draw filled circle
   */
  circle(x, y, radius, r, g, b, a = 1) {
    const segments = this.circleSegments;
    const angleStep = (Math.PI * 2) / segments;
    
    for (let i = 0; i < segments; i++) {
      const angle1 = i * angleStep;
      const angle2 = (i + 1) * angleStep;
      
      // Center
      this.vertex(x, y, r, g, b, a);
      // Edge 1
      this.vertex(x + Math.cos(angle1) * radius, y + Math.sin(angle1) * radius, r, g, b, a);
      // Edge 2
      this.vertex(x + Math.cos(angle2) * radius, y + Math.sin(angle2) * radius, r, g, b, a);
    }
  }
  
  /**
   * Draw circle outline
   */
  circleOutline(x, y, radius, lineWidth, r, g, b, a = 1) {
    const segments = this.circleSegments;
    const angleStep = (Math.PI * 2) / segments;
    const innerRadius = radius - lineWidth;
    
    for (let i = 0; i < segments; i++) {
      const angle1 = i * angleStep;
      const angle2 = (i + 1) * angleStep;
      
      const cos1 = Math.cos(angle1);
      const sin1 = Math.sin(angle1);
      const cos2 = Math.cos(angle2);
      const sin2 = Math.sin(angle2);
      
      // Inner/outer points
      const ix1 = x + cos1 * innerRadius;
      const iy1 = y + sin1 * innerRadius;
      const ox1 = x + cos1 * radius;
      const oy1 = y + sin1 * radius;
      const ix2 = x + cos2 * innerRadius;
      const iy2 = y + sin2 * innerRadius;
      const ox2 = x + cos2 * radius;
      const oy2 = y + sin2 * radius;
      
      // Two triangles for the segment
      this.vertex(ix1, iy1, r, g, b, a);
      this.vertex(ox1, oy1, r, g, b, a);
      this.vertex(ox2, oy2, r, g, b, a);
      
      this.vertex(ix1, iy1, r, g, b, a);
      this.vertex(ox2, oy2, r, g, b, a);
      this.vertex(ix2, iy2, r, g, b, a);
    }
  }
  
  /**
   * Draw filled rectangle
   */
  rect(x, y, width, height, r, g, b, a = 1) {
    // Two triangles
    this.vertex(x, y, r, g, b, a);
    this.vertex(x + width, y, r, g, b, a);
    this.vertex(x + width, y + height, r, g, b, a);
    
    this.vertex(x, y, r, g, b, a);
    this.vertex(x + width, y + height, r, g, b, a);
    this.vertex(x, y + height, r, g, b, a);
  }
  
  /**
   * Draw rectangle outline
   */
  rectOutline(x, y, width, height, lineWidth, r, g, b, a = 1) {
    // Top
    this.rect(x, y, width, lineWidth, r, g, b, a);
    // Bottom
    this.rect(x, y + height - lineWidth, width, lineWidth, r, g, b, a);
    // Left
    this.rect(x, y, lineWidth, height, r, g, b, a);
    // Right
    this.rect(x + width - lineWidth, y, lineWidth, height, r, g, b, a);
  }
  
  /**
   * Draw line
   */
  line(x1, y1, x2, y2, lineWidth, r, g, b, a = 1) {
    // Calculate perpendicular
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return;
    
    const nx = -dy / len * lineWidth / 2;
    const ny = dx / len * lineWidth / 2;
    
    // Quad as two triangles
    this.vertex(x1 + nx, y1 + ny, r, g, b, a);
    this.vertex(x1 - nx, y1 - ny, r, g, b, a);
    this.vertex(x2 - nx, y2 - ny, r, g, b, a);
    
    this.vertex(x1 + nx, y1 + ny, r, g, b, a);
    this.vertex(x2 - nx, y2 - ny, r, g, b, a);
    this.vertex(x2 + nx, y2 + ny, r, g, b, a);
  }
  
  /**
   * Draw arc (pie slice)
   */
  arc(x, y, radius, startAngle, endAngle, r, g, b, a = 1) {
    const segments = Math.ceil(this.circleSegments * Math.abs(endAngle - startAngle) / (Math.PI * 2));
    const angleStep = (endAngle - startAngle) / segments;
    
    for (let i = 0; i < segments; i++) {
      const angle1 = startAngle + i * angleStep;
      const angle2 = startAngle + (i + 1) * angleStep;
      
      this.vertex(x, y, r, g, b, a);
      this.vertex(x + Math.cos(angle1) * radius, y + Math.sin(angle1) * radius, r, g, b, a);
      this.vertex(x + Math.cos(angle2) * radius, y + Math.sin(angle2) * radius, r, g, b, a);
    }
  }
  
  /**
   * Draw triangle
   */
  triangle(x1, y1, x2, y2, x3, y3, r, g, b, a = 1) {
    this.vertex(x1, y1, r, g, b, a);
    this.vertex(x2, y2, r, g, b, a);
    this.vertex(x3, y3, r, g, b, a);
  }
  
  /**
   * Flush to GPU
   */
  flush() {
    if (this.vertexCount === 0) return;
    
    const gl = this.gl;
    
    // Re-activate shader and projection (may have been changed)
    this.shaderManager.use('color');
    if (this.currentCamera) {
      this._setCameraProjection(this.currentCamera);
    } else {
      this.shaderManager.setUniform('u_projection', 'mat3', this.projectionMatrix);
    }
    
    const shader = this.shaderManager.activeProgram;
    
    // Upload vertex data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, 
      this.vertices.subarray(0, this.vertexCount * this.vertexSize));
    
    // Set up attributes
    gl.enableVertexAttribArray(shader.attributes.a_position);
    gl.vertexAttribPointer(shader.attributes.a_position, 2, gl.FLOAT, false, this.vertexStride, 0);
    
    gl.enableVertexAttribArray(shader.attributes.a_color);
    gl.vertexAttribPointer(shader.attributes.a_color, 4, gl.FLOAT, false, this.vertexStride, 8);
    
    // Draw
    gl.drawArrays(this.primitiveType, 0, this.vertexCount);
    
    this.glContext.stats.drawCalls++;
    this.glContext.stats.triangles += Math.floor(this.vertexCount / 3);
    
    this.vertexCount = 0;
  }
  
  /**
   * End shape rendering
   */
  end() {
    if (!this.drawing) return;
    this.flush();
    this.drawing = false;
  }
  
  destroy() {
    this.gl.deleteBuffer(this.vertexBuffer);
  }
}

module.exports = { ShapeRenderer };
