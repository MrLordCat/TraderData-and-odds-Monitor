/**
 * Power Towers TD - WebGL Game Renderer
 * 
 * Modular renderer with WebGL backend.
 * Rendering logic split into modules:
 * - renderers/terrain-renderer.js - Biomes, grid, path, decorations
 * - renderers/energy-renderer.js - Energy nodes, buildings, connections
 * - renderers/entity-renderer.js - Towers, enemies, projectiles, effects
 * - renderers/ui-renderer.js - Hover, range, minimap, FPS
 * 
 * Features:
 * - Sprite batching (10,000+ sprites in 1 draw call)
 * - Shape rendering (circles, lines, rects)
 * - Particle system (GPU-accelerated)
 * - Text rendering (via Canvas2D overlay)
 */

const { GLContext } = require('./engine/core/gl-context');
const { ShaderManager } = require('./engine/core/shader-manager');
const { TextureManager } = require('./engine/core/texture-manager');
const { SpriteBatch } = require('./engine/rendering/sprite-batch');
const { ShapeRenderer } = require('./engine/rendering/shape-renderer');
const { ParticleSystem } = require('./engine/rendering/particle-system');
const { ObjectPool, PoolManager } = require('./engine/systems/object-pool');
const CONFIG = require('../core/config');

// Import color utilities
const { BIOME_COLORS, BIOME_VARIANTS, parseColor } = require('./utils/color-utils');

// Import renderer mixins
const { TerrainRendererMixin } = require('./renderers/terrain-renderer');
const { EnergyRendererMixin } = require('./renderers/energy-renderer');
const { EntityRendererMixin } = require('./renderers/entity-renderer');
const { UIRendererMixin } = require('./renderers/ui-renderer');

/**
 * Base GameRenderer class
 * Handles WebGL initialization, render loop, and utility methods.
 * Rendering methods are added via mixins.
 */
class GameRenderer {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;
    this.camera = camera;
    
    // Initialize WebGL
    this.glContext = new GLContext(canvas, {
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    
    // WebGL required
    if (!this.glContext.isWebGL) {
      const error = new Error('[GameRenderer] WebGL is required but not available! Check GPU drivers.');
      console.error(error.message);
      throw error;
    }
    
    this.gl = this.glContext.gl;
    
    // Initialize subsystems
    this.shaderManager = new ShaderManager(this.glContext);
    this.textureManager = new TextureManager(this.glContext);
    this.spriteBatch = new SpriteBatch(this.glContext, this.shaderManager, this.textureManager);
    this.shapeRenderer = new ShapeRenderer(this.glContext, this.shaderManager);
    this.particles = new ParticleSystem(this.glContext, this.shaderManager, this.textureManager);
    
    // Object pools
    this.pools = new PoolManager();
    this._registerPools();
    
    // Set initial projection
    this.spriteBatch.setProjection(this.width, this.height);
    this.shapeRenderer.setProjection(this.width, this.height);
    
    // Animation state
    this.frameCount = 0;
    this.time = 0;
    this.lastFrameTime = performance.now();
    
    // Hover state
    this.hoverGridX = -1;
    this.hoverGridY = -1;
    this.canPlaceHover = false;
    
    // Debug/UI
    this.showFps = true;
    
    // Stats
    this.stats = {
      fps: 60,
      frameTime: 0,
      drawCalls: 0,
    };
    
    // Text overlay canvas (for damage numbers, FPS, etc.)
    this._initTextCanvas();
  }
  
  /**
   * Initialize text overlay canvas (Canvas2D for text rendering)
   */
  _initTextCanvas() {
    // Internal canvas for text composition
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = this.width;
    this.textCanvas.height = this.height;
    this.textCtx = this.textCanvas.getContext('2d');
    
    // Create visible overlay canvas on top of WebGL canvas
    this.textOverlayCanvas = document.createElement('canvas');
    this.textOverlayCanvas.width = this.width;
    this.textOverlayCanvas.height = this.height;
    this.textOverlayCanvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    `;
    
    // Insert overlay canvas after main canvas
    if (this.canvas.parentElement) {
      this.canvas.parentElement.style.position = 'relative';
      this.canvas.parentElement.appendChild(this.textOverlayCanvas);
    }
    
    this.textTexture = null;
  }
  
  /**
   * Register object pools
   */
  _registerPools() {
    this.pools.register('damageNumber', () => ({
      x: 0, y: 0,
      value: 0,
      color: '#fff',
      alpha: 1,
      scale: 1,
      fontSize: 14,
      isCrit: false,
      life: 0,
      maxLife: 1,
    }), 100, {
      reset: (n) => { n.alpha = 1; n.scale = 1; n.life = 0; }
    });
  }
  
  /**
   * Set camera reference
   */
  setCamera(camera) {
    this.camera = camera;
  }
  
  // ============================================
  // MAIN RENDER LOOP
  // ============================================
  
  /**
   * Main render function
   */
  render(data) {
    // Update timing
    const now = performance.now();
    this.stats.frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.frameCount++;
    this.time = now;
    
    // Update FPS every 30 frames
    if (this.frameCount % 30 === 0) {
      this.stats.fps = Math.round(1000 / this.stats.frameTime);
    }
    
    // Reset stats
    this.glContext.resetStats();
    
    // Clear screen
    this.glContext.clear(0.1, 0.1, 0.12, 1);
    
    // Update particles
    this.particles.update(this.stats.frameTime / 1000);
    
    // === RENDER LAYERS ===
    
    // 1. Outside area (dark wasteland beyond walls)
    this._renderOutsideArea(data);
    
    // 2. Terrain/Biomes (buildable area)
    this._renderBiomes(data);
    
    // 3. Boundary wall
    this._renderBoundaryWall(data);
    
    // 4. Grid (only in buildable area)
    this._renderGrid(data);
    
    // 5. Path
    this._renderPath(data);
    
    // 6. Decorations (trees, rocks)
    this._renderDecorations(data);
    
    // 7. Energy nodes (map pickups)
    this._renderEnergyNodes(data);
    
    // 8. Spawn portal
    this._renderSpawnPortal(data);
    
    // 9. Base
    this._renderBase(data);
    
    // 10. Energy connections
    this._renderEnergyConnections(data);
    
    // 11. Energy buildings
    this._renderEnergyBuildings(data);
    
    // 12. Towers
    this._renderTowers(data);
    
    // 13. Enemies
    this._renderEnemies(data);
    
    // 14. Projectiles
    this._renderProjectiles(data);
    
    // 15. Particles (GPU)
    this.particles.render(this.camera);
    
    // 16. Effects (explosions, etc.)
    this._renderEffects(data);
    
    // 17. Damage numbers
    this._renderDamageNumbers(data);
    
    // 18. Loot numbers (gold from kills)
    this._renderLootNumbers(data);
    
    // 19. Hover indicator
    this._renderHoverIndicator();
    
    // 20. Range indicator
    this._renderRangeIndicator(data);
    
    // 21. Connection range (when connecting buildings)
    if (data.connectingFromBuilding) {
      this._renderConnectionRange(data.connectingFromBuilding);
    }
    
    // === UI OVERLAY (screen space) ===
    
    // 22. Minimap
    this._renderMinimap(data);
    
    // 23. FPS counter
    if (this.showFps) {
      this._renderFps();
    }
    
    // Store draw calls for stats
    this.stats.drawCalls = this.glContext.stats.drawCalls;
  }
  
  // ============================================
  // UTILITY METHODS
  // ============================================
  
  /**
   * Parse color string to RGBA object
   */
  _parseColor(color) {
    return parseColor(color);
  }
  
  /**
   * Resize canvas
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    
    this.glContext.resize(width, height);
    this.spriteBatch.setProjection(width, height);
    this.shapeRenderer.setProjection(width, height);
    
    // Resize text canvases
    this.textCanvas.width = width;
    this.textCanvas.height = height;
    
    if (this.textOverlayCanvas) {
      this.textOverlayCanvas.width = width;
      this.textOverlayCanvas.height = height;
    }
    
    if (this.camera) {
      this.camera.setViewportSize(width, height);
    }
  }
  
  /**
   * Destroy renderer
   */
  destroy() {
    // Remove overlay canvas from DOM
    if (this.textOverlayCanvas && this.textOverlayCanvas.parentElement) {
      this.textOverlayCanvas.parentElement.removeChild(this.textOverlayCanvas);
    }
    this.textOverlayCanvas = null;
    this.textCanvas = null;
    
    // Destroy WebGL resources
    this.spriteBatch.destroy();
    this.shapeRenderer.destroy();
    this.particles.destroy();
    this.textureManager.destroy();
    this.shaderManager.destroy();
    this.glContext.destroy();
  }
}

// Apply mixins to create final renderer class
// Each mixin adds rendering methods for a specific domain
const MixedRenderer = UIRendererMixin(
  EntityRendererMixin(
    EnergyRendererMixin(
      TerrainRendererMixin(GameRenderer)
    )
  )
);

module.exports = { GameRenderer: MixedRenderer };

