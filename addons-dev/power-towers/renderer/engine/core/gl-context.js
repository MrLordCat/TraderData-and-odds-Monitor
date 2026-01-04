/**
 * Power Towers TD - WebGL Context Manager
 * 
 * Handles WebGL context creation, extensions, and utilities.
 * Provides fallback to Canvas 2D if WebGL unavailable.
 */

class GLContext {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.gl = null;
    this.isWebGL2 = false;
    this.isWebGL = false;
    this.extensions = {};
    
    // Options
    this.options = {
      antialias: options.antialias ?? false,  // Better perf without
      alpha: options.alpha ?? false,
      premultipliedAlpha: options.premultipliedAlpha ?? false,
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
      powerPreference: options.powerPreference ?? 'high-performance',
      ...options
    };
    
    // Stats
    this.stats = {
      drawCalls: 0,
      triangles: 0,
      textureSwitches: 0,
      shaderSwitches: 0,
    };
    
    this._initContext();
  }
  
  /**
   * Initialize WebGL context
   */
  _initContext() {
    // Try WebGL 2 first
    this.gl = this.canvas.getContext('webgl2', this.options);
    if (this.gl) {
      this.isWebGL2 = true;
      this.isWebGL = true;
      this._initExtensions();
      return;
    }
    
    // Fallback to WebGL 1
    this.gl = this.canvas.getContext('webgl', this.options) ||
              this.canvas.getContext('experimental-webgl', this.options);
    if (this.gl) {
      this.isWebGL = true;
      this._initExtensions();
      return;
    }
    
    // WebGL not available - log detailed error
    console.error('[GLContext] WebGL not available!');
    console.error('[GLContext] Possible causes:');
    console.error('  - GPU drivers need update');
    console.error('  - Hardware acceleration disabled in browser/Electron');
    console.error('  - Running in software rendering mode');
    console.error('  - Canvas already has a different context type');
  }
  
  /**
   * Load useful extensions
   */
  _initExtensions() {
    const gl = this.gl;
    
    // Extensions we want
    const extensionNames = [
      'ANGLE_instanced_arrays',    // Instanced rendering (WebGL 1)
      'OES_vertex_array_object',   // VAOs (WebGL 1)
      'OES_element_index_uint',    // 32-bit indices
      'OES_standard_derivatives',  // For effects
      'EXT_blend_minmax',
      'WEBGL_lose_context',        // For testing context loss
    ];
    
    for (const name of extensionNames) {
      try {
        this.extensions[name] = gl.getExtension(name);
      } catch (e) {
        this.extensions[name] = null;
      }
    }
    
    // Log available extensions
    const available = Object.entries(this.extensions)
      .filter(([_, ext]) => ext !== null)
      .map(([name]) => name);
  }
  
  /**
   * Check if extension is available
   */
  hasExtension(name) {
    return this.extensions[name] !== null;
  }
  
  /**
   * Get extension
   */
  getExtension(name) {
    return this.extensions[name];
  }
  
  /**
   * Resize viewport
   */
  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
    }
  }
  
  /**
   * Clear the canvas
   */
  clear(r = 0, g = 0, b = 0, a = 1) {
    const gl = this.gl;
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  
  /**
   * Enable standard 2D blending (alpha)
   */
  enableBlending() {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  
  /**
   * Enable additive blending (for particles, glow)
   */
  enableAdditiveBlending() {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  }
  
  /**
   * Disable blending
   */
  disableBlending() {
    this.gl.disable(this.gl.BLEND);
  }
  
  /**
   * Reset stats for new frame
   */
  resetStats() {
    this.stats.drawCalls = 0;
    this.stats.triangles = 0;
    this.stats.textureSwitches = 0;
    this.stats.shaderSwitches = 0;
  }
  
  /**
   * Get WebGL info
   */
  getInfo() {
    const gl = this.gl;
    if (!gl) return { webgl: false };
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    
    return {
      webgl: true,
      version: this.isWebGL2 ? '2.0' : '1.0',
      vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown',
      renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
    };
  }
  
  /**
   * Check for WebGL errors (debug mode)
   */
  checkError(label = '') {
    const gl = this.gl;
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      const errors = {
        [gl.INVALID_ENUM]: 'INVALID_ENUM',
        [gl.INVALID_VALUE]: 'INVALID_VALUE',
        [gl.INVALID_OPERATION]: 'INVALID_OPERATION',
        [gl.INVALID_FRAMEBUFFER_OPERATION]: 'INVALID_FRAMEBUFFER_OPERATION',
        [gl.OUT_OF_MEMORY]: 'OUT_OF_MEMORY',
        [gl.CONTEXT_LOST_WEBGL]: 'CONTEXT_LOST_WEBGL',
      };
      console.error(`[GLContext] ${label} Error: ${errors[error] || error}`);
      return false;
    }
    return true;
  }
  
  /**
   * Destroy context
   */
  destroy() {
    const loseContext = this.extensions['WEBGL_lose_context'];
    if (loseContext) {
      loseContext.loseContext();
    }
    this.gl = null;
  }
}

module.exports = { GLContext };
