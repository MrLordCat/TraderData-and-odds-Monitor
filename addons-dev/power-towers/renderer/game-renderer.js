/**
 * Power Towers TD - Complete WebGL Game Renderer
 * 
 * FULL REPLACEMENT for Canvas2D renderer.
 * All rendering now done via WebGL for maximum performance.
 * 
 * Features:
 * - Sprite batching (10,000+ sprites in 1 draw call)
 * - Shape rendering (circles, lines, rects)
 * - Particle system (GPU-accelerated)
 * - Text rendering (via Canvas2D overlay)
 * - Biome decorations
 * - All game entities
 */

const { GLContext } = require('./engine/core/gl-context');
const { ShaderManager } = require('./engine/core/shader-manager');
const { TextureManager } = require('./engine/core/texture-manager');
const { SpriteBatch } = require('./engine/rendering/sprite-batch');
const { ShapeRenderer } = require('./engine/rendering/shape-renderer');
const { ParticleSystem } = require('./engine/rendering/particle-system');
const { ObjectPool, PoolManager } = require('./engine/systems/object-pool');
const CONFIG = require('../core/config');

// Biome colors (RGB 0-1)
const BIOME_COLORS = {
  plains: { r: 0.35, g: 0.55, b: 0.35 },
  forest: { r: 0.18, g: 0.38, b: 0.18 },
  desert: { r: 0.85, g: 0.75, b: 0.5 },
  water: { r: 0.22, g: 0.42, b: 0.62 },
  mountains: { r: 0.45, g: 0.42, b: 0.42 },
  burned: { r: 0.18, g: 0.12, b: 0.12 },
};

// Biome color variants for visual variety (more variants for richer look)
const BIOME_VARIANTS = {
  plains: [
    { r: 0.38, g: 0.58, b: 0.38 },
    { r: 0.32, g: 0.52, b: 0.32 },
    { r: 0.36, g: 0.54, b: 0.34 },
    { r: 0.34, g: 0.56, b: 0.36 },
  ],
  forest: [
    { r: 0.16, g: 0.35, b: 0.16 },
    { r: 0.2, g: 0.4, b: 0.2 },
    { r: 0.17, g: 0.36, b: 0.17 },
    { r: 0.19, g: 0.39, b: 0.19 },
  ],
  desert: [
    { r: 0.88, g: 0.78, b: 0.53 },
    { r: 0.82, g: 0.72, b: 0.47 },
    { r: 0.85, g: 0.74, b: 0.48 },
    { r: 0.87, g: 0.76, b: 0.52 },
  ],
  water: [
    { r: 0.2, g: 0.4, b: 0.6 },
    { r: 0.24, g: 0.44, b: 0.64 },
    { r: 0.21, g: 0.41, b: 0.61 },
  ],
  mountains: [
    { r: 0.43, g: 0.4, b: 0.4 },
    { r: 0.47, g: 0.44, b: 0.44 },
    { r: 0.44, g: 0.41, b: 0.41 },
  ],
  burned: [
    { r: 0.16, g: 0.1, b: 0.1 },
    { r: 0.2, g: 0.14, b: 0.14 },
    { r: 0.17, g: 0.11, b: 0.11 },
  ],
};

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
    
    // Decoration cache (trees, rocks positions)
    this.decorationCache = null;
    this.decorationCacheDirty = true;
    
    console.log('[GameRenderer] WebGL initialized', this.glContext.getInfo());
  }
  
  /**
   * Initialize text overlay canvas (Canvas2D for text rendering)
   * Creates a separate canvas positioned over WebGL canvas for text
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
    
    // Create texture for text overlay (not used in current impl)
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
  
  /**
   * Invalidate static cache (when map changes)
   */
  invalidateStaticCache() {
    this.decorationCacheDirty = true;
    this._pathCellSetDirty = true;  // Also invalidate path cell cache
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
    
    // 0. Outside area (dark wasteland beyond walls)
    this._renderOutsideArea(data);
    
    // 1. Terrain/Biomes (buildable area)
    this._renderBiomes(data);
    
    // 2. Boundary wall
    this._renderBoundaryWall(data);
    
    // 3. Grid (only in buildable area)
    this._renderGrid(data);
    
    // 4. Path
    this._renderPath(data);
    
    // 5. Decorations (trees, rocks)
    this._renderDecorations(data);
    
    // 5. Special elements (energy nodes)
    this._renderSpecialElements(data);
    
    // 6. Spawn portal
    this._renderSpawnPortal(data);
    
    // 7. Base
    this._renderBase(data);
    
    // 8. Energy connections
    this._renderEnergyConnections(data);
    
    // 9. Energy buildings
    this._renderEnergyBuildings(data);
    
    // 10. Towers
    this._renderTowers(data);
    
    // 11. Enemies
    this._renderEnemies(data);
    
    // 12. Projectiles
    this._renderProjectiles(data);
    
    // 13. Particles (GPU)
    this.particles.render(this.camera);
    
    // 14. Effects (explosions, etc.)
    this._renderEffects(data);
    
    // 15. Damage numbers
    this._renderDamageNumbers(data);
    
    // 16. Hover indicator
    this._renderHoverIndicator();
    
    // 17. Range indicator
    this._renderRangeIndicator(data);
    
    // 18. Connection range (when connecting buildings)
    if (data.connectingFromBuilding) {
      this._renderConnectionRange(data.connectingFromBuilding);
    }
    
    // === UI OVERLAY (screen space) ===
    
    // 19. Minimap
    this._renderMinimap(data);
    
    // 20. FPS counter
    if (this.showFps) {
      this._renderFps();
    }
    
    // Store draw calls for stats
    this.stats.drawCalls = this.glContext.stats.drawCalls;
  }
  
  // ============================================
  // TERRAIN RENDERING
  // ============================================
  
  /**
   * Render outside area (dark wasteland beyond buildable zone)
   */
  _renderOutsideArea(data) {
    const camera = this.camera;
    const gridSize = CONFIG.GRID_SIZE;
    const padding = CONFIG.VISUAL_PADDING;
    const mapW = CONFIG.MAP_WIDTH;
    const mapH = CONFIG.MAP_HEIGHT;
    
    // Calculate outside region bounds
    const outsideLeft = -mapW * padding;
    const outsideTop = -mapH * padding;
    const outsideRight = mapW + mapW * padding;
    const outsideBottom = mapH + mapH * padding;
    
    const visible = camera.getVisibleArea();
    
    this.shapeRenderer.begin('triangles', camera);
    
    // Dark wasteland color
    const wastelandColor = { r: 0.08, g: 0.08, b: 0.1 };
    
    // Top strip (above buildable)
    if (visible.y < 0) {
      const h = Math.min(0, visible.bottom) - visible.y;
      this.shapeRenderer.rect(visible.x, visible.y, visible.width, h, 
        wastelandColor.r, wastelandColor.g, wastelandColor.b, 1);
    }
    
    // Bottom strip (below buildable)
    if (visible.bottom > mapH) {
      const y = Math.max(mapH, visible.y);
      const h = visible.bottom - y;
      this.shapeRenderer.rect(visible.x, y, visible.width, h,
        wastelandColor.r, wastelandColor.g, wastelandColor.b, 1);
    }
    
    // Left strip (left of buildable, between top and bottom)
    if (visible.x < 0) {
      const y = Math.max(0, visible.y);
      const h = Math.min(mapH, visible.bottom) - y;
      const w = Math.min(0, visible.right) - visible.x;
      if (h > 0 && w > 0) {
        this.shapeRenderer.rect(visible.x, y, w, h,
          wastelandColor.r, wastelandColor.g, wastelandColor.b, 1);
      }
    }
    
    // Right strip (right of buildable, between top and bottom)
    if (visible.right > mapW) {
      const x = Math.max(mapW, visible.x);
      const y = Math.max(0, visible.y);
      const h = Math.min(mapH, visible.bottom) - y;
      const w = visible.right - x;
      if (h > 0 && w > 0) {
        this.shapeRenderer.rect(x, y, w, h,
          wastelandColor.r, wastelandColor.g, wastelandColor.b, 1);
      }
    }
    
    // Add some wasteland texture (rocks, debris)
    const texStartX = Math.floor(Math.max(outsideLeft, visible.x) / gridSize);
    const texStartY = Math.floor(Math.max(outsideTop, visible.y) / gridSize);
    const texEndX = Math.ceil(Math.min(outsideRight, visible.right) / gridSize);
    const texEndY = Math.ceil(Math.min(outsideBottom, visible.bottom) / gridSize);
    
    for (let y = texStartY; y < texEndY; y++) {
      for (let x = texStartX; x < texEndX; x++) {
        // Skip buildable area
        if (x >= 0 && x < mapW / gridSize && y >= 0 && y < mapH / gridSize) continue;
        
        const hash = (x * 31 + y * 17) % 100;
        if (hash < 15) {
          // Random debris
          const cx = x * gridSize + gridSize * 0.5;
          const cy = y * gridSize + gridSize * 0.5;
          const size = gridSize * (0.1 + (hash % 10) * 0.02);
          this.shapeRenderer.circle(cx, cy, size, 0.12, 0.1, 0.1, 0.6);
        }
      }
    }
    
    this.shapeRenderer.end();
  }
  
  /**
   * Render boundary wall around buildable area
   */
  _renderBoundaryWall(data) {
    const camera = this.camera;
    const mapW = CONFIG.MAP_WIDTH;
    const mapH = CONFIG.MAP_HEIGHT;
    const wallThickness = 8;  // pixels
    
    this.shapeRenderer.begin('triangles', camera);
    
    // Wall color (dark stone)
    const wallColor = { r: 0.25, g: 0.22, b: 0.2 };
    const wallHighlight = { r: 0.35, g: 0.32, b: 0.3 };
    
    // Top wall
    this.shapeRenderer.rect(-wallThickness, -wallThickness, mapW + wallThickness * 2, wallThickness,
      wallColor.r, wallColor.g, wallColor.b, 1);
    // Top wall highlight
    this.shapeRenderer.rect(-wallThickness, 0, mapW + wallThickness * 2, 2,
      wallHighlight.r, wallHighlight.g, wallHighlight.b, 0.5);
    
    // Bottom wall  
    this.shapeRenderer.rect(-wallThickness, mapH, mapW + wallThickness * 2, wallThickness,
      wallColor.r, wallColor.g, wallColor.b, 1);
    // Bottom wall shadow
    this.shapeRenderer.rect(-wallThickness, mapH - 2, mapW + wallThickness * 2, 2,
      0.1, 0.1, 0.1, 0.3);
    
    // Left wall
    this.shapeRenderer.rect(-wallThickness, 0, wallThickness, mapH,
      wallColor.r, wallColor.g, wallColor.b, 1);
    // Left wall highlight
    this.shapeRenderer.rect(0, 0, 2, mapH,
      wallHighlight.r, wallHighlight.g, wallHighlight.b, 0.5);
    
    // Right wall
    this.shapeRenderer.rect(mapW, 0, wallThickness, mapH,
      wallColor.r, wallColor.g, wallColor.b, 1);
    // Right wall shadow
    this.shapeRenderer.rect(mapW - 2, 0, 2, mapH,
      0.1, 0.1, 0.1, 0.3);
    
    // Corner towers (decorative)
    const towerSize = 16;
    const towerColor = { r: 0.3, g: 0.27, b: 0.25 };
    
    // Top-left tower
    this.shapeRenderer.rect(-towerSize, -towerSize, towerSize * 1.5, towerSize * 1.5,
      towerColor.r, towerColor.g, towerColor.b, 1);
    
    // Top-right tower
    this.shapeRenderer.rect(mapW - towerSize * 0.5, -towerSize, towerSize * 1.5, towerSize * 1.5,
      towerColor.r, towerColor.g, towerColor.b, 1);
    
    // Bottom-left tower
    this.shapeRenderer.rect(-towerSize, mapH - towerSize * 0.5, towerSize * 1.5, towerSize * 1.5,
      towerColor.r, towerColor.g, towerColor.b, 1);
    
    // Bottom-right tower
    this.shapeRenderer.rect(mapW - towerSize * 0.5, mapH - towerSize * 0.5, towerSize * 1.5, towerSize * 1.5,
      towerColor.r, towerColor.g, towerColor.b, 1);
    
    this.shapeRenderer.end();
  }
  
  _renderBiomes(data) {
    if (!data.biomeMap) return;
    
    const camera = this.camera;
    const gridSize = CONFIG.GRID_SIZE;
    const visible = camera.getVisibleArea();
    
    // Calculate visible tile range
    const startX = Math.max(0, Math.floor(visible.x / gridSize));
    const startY = Math.max(0, Math.floor(visible.y / gridSize));
    const endX = Math.min(data.biomeMap[0]?.length || 0, Math.ceil(visible.right / gridSize) + 1);
    const endY = Math.min(data.biomeMap.length || 0, Math.ceil(visible.bottom / gridSize) + 1);
    
    this.shapeRenderer.begin('triangles', camera);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const biome = data.biomeMap[y]?.[x] || 'plains';
        
        // Get color with variation
        let color = BIOME_COLORS[biome] || BIOME_COLORS.plains;
        const variants = BIOME_VARIANTS[biome];
        if (variants) {
          const variantIndex = (x * 7 + y * 11) % (variants.length + 1);
          if (variantIndex > 0) {
            color = variants[variantIndex - 1];
          }
        }
        
        this.shapeRenderer.rect(
          x * gridSize, y * gridSize,
          gridSize, gridSize,
          color.r, color.g, color.b, 1
        );
      }
    }
    
    this.shapeRenderer.end();
  }
  
  _renderGrid(data) {
    if (data.showGrid === false) return;
    
    const camera = this.camera;
    const gridSize = CONFIG.GRID_SIZE;
    const visible = camera.getVisibleArea();
    
    this.shapeRenderer.begin('triangles', camera);
    
    const lineWidth = 1 / camera.zoom;
    
    // Vertical lines
    const startX = Math.floor(visible.x / gridSize) * gridSize;
    for (let x = startX; x <= visible.right; x += gridSize) {
      this.shapeRenderer.rect(x, visible.y, lineWidth, visible.height, 0.3, 0.3, 0.3, 0.2);
    }
    
    // Horizontal lines
    const startY = Math.floor(visible.y / gridSize) * gridSize;
    for (let y = startY; y <= visible.bottom; y += gridSize) {
      this.shapeRenderer.rect(visible.x, y, visible.width, lineWidth, 0.3, 0.3, 0.3, 0.2);
    }
    
    this.shapeRenderer.end();
  }
  
  _renderPath(data) {
    if (!data.pathCells || data.pathCells.length === 0) return;
    
    const camera = this.camera;
    const gridSize = CONFIG.GRID_SIZE;
    
    // Create path cell lookup Set for fast checking
    if (!this._pathCellSet || this._pathCellSetDirty) {
      this._pathCellSet = new Set();
      for (const cell of data.pathCells) {
        this._pathCellSet.add(`${cell.x},${cell.y}`);
      }
      this._pathCellSetDirty = false;
    }
    
    this.shapeRenderer.begin('triangles', camera);
    
    // Colors for road path
    const roadBase = { r: 0.32, g: 0.30, b: 0.28 };       // Main road surface
    const roadDark = { r: 0.25, g: 0.23, b: 0.21 };       // Road shadows/variation
    const roadLight = { r: 0.38, g: 0.36, b: 0.34 };      // Road highlights
    const borderOuter = { r: 0.45, g: 0.40, b: 0.35 };    // Outer border (stone)
    const borderInner = { r: 0.28, g: 0.25, b: 0.22 };    // Inner border shadow
    
    const borderWidth = 3;  // Border thickness in pixels
    
    // First pass: Draw the road surface for all cells
    for (const cell of data.pathCells) {
      const cx = cell.x * gridSize;
      const cy = cell.y * gridSize;
      
      // Base road surface
      const hash = (cell.x * 17 + cell.y * 31) % 100;
      const baseColor = hash < 50 ? roadBase : (hash < 80 ? roadDark : roadLight);
      
      this.shapeRenderer.rect(cx, cy, gridSize, gridSize, baseColor.r, baseColor.g, baseColor.b, 1);
    }
    
    // Second pass: Draw borders only on outer edges
    for (const cell of data.pathCells) {
      const cx = cell.x * gridSize;
      const cy = cell.y * gridSize;
      
      // Check adjacent cells
      const hasTop = this._pathCellSet.has(`${cell.x},${cell.y - 1}`);
      const hasBottom = this._pathCellSet.has(`${cell.x},${cell.y + 1}`);
      const hasLeft = this._pathCellSet.has(`${cell.x - 1},${cell.y}`);
      const hasRight = this._pathCellSet.has(`${cell.x + 1},${cell.y}`);
      
      // Draw borders only where there's no adjacent path cell
      
      // Top border
      if (!hasTop) {
        // Outer stone border
        this.shapeRenderer.rect(cx, cy, gridSize, borderWidth, 
          borderOuter.r, borderOuter.g, borderOuter.b, 1);
        // Inner shadow line
        this.shapeRenderer.rect(cx, cy + borderWidth, gridSize, 1, 
          borderInner.r, borderInner.g, borderInner.b, 0.6);
      }
      
      // Bottom border
      if (!hasBottom) {
        // Inner shadow
        this.shapeRenderer.rect(cx, cy + gridSize - borderWidth - 1, gridSize, 1, 
          borderInner.r, borderInner.g, borderInner.b, 0.4);
        // Outer stone border
        this.shapeRenderer.rect(cx, cy + gridSize - borderWidth, gridSize, borderWidth, 
          borderOuter.r, borderOuter.g, borderOuter.b, 1);
      }
      
      // Left border
      if (!hasLeft) {
        // Outer stone border
        this.shapeRenderer.rect(cx, cy, borderWidth, gridSize, 
          borderOuter.r, borderOuter.g, borderOuter.b, 1);
        // Inner shadow line
        this.shapeRenderer.rect(cx + borderWidth, cy, 1, gridSize, 
          borderInner.r, borderInner.g, borderInner.b, 0.5);
      }
      
      // Right border
      if (!hasRight) {
        // Inner shadow
        this.shapeRenderer.rect(cx + gridSize - borderWidth - 1, cy, 1, gridSize, 
          borderInner.r, borderInner.g, borderInner.b, 0.3);
        // Outer stone border
        this.shapeRenderer.rect(cx + gridSize - borderWidth, cy, borderWidth, gridSize, 
          borderOuter.r, borderOuter.g, borderOuter.b, 1);
      }
      
      // Corner overlaps - make them look nicer
      if (!hasTop && !hasLeft) {
        this.shapeRenderer.rect(cx, cy, borderWidth, borderWidth, 
          borderOuter.r * 1.1, borderOuter.g * 1.1, borderOuter.b * 1.1, 1);
      }
      if (!hasTop && !hasRight) {
        this.shapeRenderer.rect(cx + gridSize - borderWidth, cy, borderWidth, borderWidth, 
          borderOuter.r * 1.1, borderOuter.g * 1.1, borderOuter.b * 1.1, 1);
      }
      if (!hasBottom && !hasLeft) {
        this.shapeRenderer.rect(cx, cy + gridSize - borderWidth, borderWidth, borderWidth, 
          borderOuter.r * 1.1, borderOuter.g * 1.1, borderOuter.b * 1.1, 1);
      }
      if (!hasBottom && !hasRight) {
        this.shapeRenderer.rect(cx + gridSize - borderWidth, cy + gridSize - borderWidth, borderWidth, borderWidth, 
          borderOuter.r * 1.1, borderOuter.g * 1.1, borderOuter.b * 1.1, 1);
      }
    }
    
    // Third pass: Add subtle road details (cracks, worn spots) - sparse
    for (const cell of data.pathCells) {
      const cx = cell.x * gridSize;
      const cy = cell.y * gridSize;
      const hash = (cell.x * 13 + cell.y * 29) % 100;
      
      // Occasional worn spot
      if (hash < 8) {
        const wx = cx + gridSize * 0.3 + (hash % 8);
        const wy = cy + gridSize * 0.4 + ((hash * 2) % 8);
        this.shapeRenderer.circle(wx, wy, 2, roadDark.r, roadDark.g, roadDark.b, 0.4);
      }
      
      // Rare crack line
      if (hash > 90) {
        const lx = cx + 5 + (hash % 10);
        const ly = cy + 3;
        this.shapeRenderer.rect(lx, ly, 1, gridSize - 6, 0.2, 0.18, 0.16, 0.3);
      }
    }
    
    this.shapeRenderer.end();
  }
  
  /**
   * Check if a cell is on the path
   */
  _isPathCell(x, y) {
    if (!this._pathCellSet) return false;
    return this._pathCellSet.has(`${x},${y}`);
  }
  
  _renderDecorations(data) {
    if (!data.biomeMap) return;
    
    const camera = this.camera;
    const gridSize = CONFIG.GRID_SIZE;
    const visible = camera.getVisibleArea();
    
    const startX = Math.max(0, Math.floor(visible.x / gridSize));
    const startY = Math.max(0, Math.floor(visible.y / gridSize));
    const endX = Math.min(data.biomeMap[0]?.length || 0, Math.ceil(visible.right / gridSize) + 1);
    const endY = Math.min(data.biomeMap.length || 0, Math.ceil(visible.bottom / gridSize) + 1);
    
    this.shapeRenderer.begin('triangles', camera);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        // Skip path cells - no decorations on the path!
        if (this._isPathCell(x, y)) continue;
        
        const biome = data.biomeMap[y]?.[x];
        if (!biome) continue;
        
        const cellX = x * gridSize;
        const cellY = y * gridSize;
        const hash = (x * 31 + y * 17) % 100;
        const hash2 = (x * 13 + y * 23) % 100;  // Second hash for more variety
        
        switch (biome) {
          case 'forest':
            // Primary trees - dense placement
            if (hash < 35) {
              const offsetX = (hash % 5) * gridSize / 6;
              const offsetY = ((hash * 3) % 5) * gridSize / 6;
              const treeX = cellX + gridSize * 0.2 + offsetX;
              const treeY = cellY + gridSize * 0.2 + offsetY;
              const size = gridSize * (0.22 + (hash % 10) * 0.01);
              
              // Tree shadow
              this.shapeRenderer.circle(treeX + 2, treeY + 3, size * 0.9, 0.05, 0.12, 0.05, 0.4);
              // Tree crown (darker green circle)
              this.shapeRenderer.circle(treeX, treeY, size, 0.08, 0.25, 0.08, 0.95);
              // Crown depth layer
              this.shapeRenderer.circle(treeX + size * 0.15, treeY + size * 0.15, size * 0.7, 0.06, 0.2, 0.06, 0.8);
              // Highlight
              this.shapeRenderer.circle(treeX - size * 0.25, treeY - size * 0.25, size * 0.35, 0.18, 0.45, 0.18, 0.7);
            }
            // Secondary smaller bushes
            if (hash2 < 20 && hash >= 35) {
              const bx = cellX + gridSize * 0.6;
              const by = cellY + gridSize * 0.5;
              this.shapeRenderer.circle(bx, by, gridSize * 0.12, 0.1, 0.28, 0.1, 0.8);
              this.shapeRenderer.circle(bx - 1, by - 1, gridSize * 0.06, 0.15, 0.35, 0.15, 0.6);
            }
            // Grass tufts
            if (hash2 > 60 && hash2 < 75) {
              const gx = cellX + (hash2 % 15);
              const gy = cellY + ((hash2 * 2) % 15);
              this.shapeRenderer.circle(gx, gy, 1.5, 0.2, 0.4, 0.15, 0.5);
            }
            break;
            
          case 'desert':
            // Sand dunes - layered
            if (hash < 25) {
              const cx = cellX + gridSize * 0.5;
              const cy = cellY + gridSize * 0.5;
              // Dune shadow
              this.shapeRenderer.circle(cx + 3, cy + 2, gridSize * 0.25, 0.65, 0.55, 0.35, 0.4);
              // Main dune
              this.shapeRenderer.circle(cx, cy, gridSize * 0.22, 0.8, 0.7, 0.45, 0.6);
              // Dune highlight
              this.shapeRenderer.circle(cx - 2, cy - 2, gridSize * 0.1, 0.9, 0.8, 0.55, 0.4);
            }
            // Cacti (sparse)
            if (hash2 < 8) {
              const cx = cellX + gridSize * 0.3 + (hash2 % 8);
              const cy = cellY + gridSize * 0.4;
              // Cactus body (vertical ellipse-ish)
              this.shapeRenderer.rect(cx - 2, cy - 6, 4, 10, 0.2, 0.45, 0.2, 0.9);
              this.shapeRenderer.rect(cx - 1, cy - 5, 2, 8, 0.25, 0.5, 0.25, 0.8);
              // Cactus arms
              if (hash2 > 4) {
                this.shapeRenderer.rect(cx + 2, cy - 2, 4, 2, 0.2, 0.45, 0.2, 0.9);
                this.shapeRenderer.rect(cx + 4, cy - 4, 2, 4, 0.2, 0.45, 0.2, 0.9);
              }
            }
            // Sand ripples
            if (hash > 50 && hash < 70) {
              const rx = cellX + 3;
              const ry = cellY + gridSize * 0.5 + (hash % 8);
              this.shapeRenderer.rect(rx, ry, gridSize - 6, 1, 0.75, 0.65, 0.4, 0.3);
            }
            break;
            
          case 'mountains':
            // Large rocks
            if (hash < 25) {
              const rx = cellX + gridSize * 0.3 + (hash % 4) * 2;
              const ry = cellY + gridSize * 0.4 + ((hash * 2) % 4) * 2;
              const size = gridSize * (0.15 + (hash % 8) * 0.01);
              // Rock shadow
              this.shapeRenderer.circle(rx + 2, ry + 2, size, 0.2, 0.18, 0.2, 0.5);
              // Rock body
              this.shapeRenderer.circle(rx, ry, size, 0.4, 0.38, 0.42, 0.9);
              // Rock highlight
              this.shapeRenderer.circle(rx - size * 0.3, ry - size * 0.3, size * 0.4, 0.5, 0.48, 0.52, 0.6);
            }
            // Small pebbles
            if (hash2 < 30 && hash >= 25) {
              const px = cellX + (hash2 % 16);
              const py = cellY + ((hash2 * 3) % 16);
              this.shapeRenderer.circle(px, py, 2, 0.35, 0.33, 0.38, 0.7);
            }
            // Mountain cracks/shadows
            if (hash > 70) {
              const lx = cellX + 4;
              const ly = cellY + (hash % 12);
              this.shapeRenderer.rect(lx, ly, 1, 6, 0.25, 0.23, 0.28, 0.4);
            }
            break;
            
          case 'plains':
            // Grass patches - more detailed
            if (hash < 15) {
              const gx = cellX + gridSize * 0.5;
              const gy = cellY + gridSize * 0.5;
              // Grass clump shadow
              this.shapeRenderer.circle(gx + 1, gy + 1, 3, 0.25, 0.4, 0.2, 0.3);
              // Grass clump
              this.shapeRenderer.circle(gx, gy, 2.5, 0.4, 0.6, 0.3, 0.6);
            }
            // Small flowers (rare)
            if (hash2 < 5) {
              const fx = cellX + gridSize * 0.3 + (hash2 % 10);
              const fy = cellY + gridSize * 0.6;
              // Flower colors based on hash
              const flowerColors = [
                { r: 0.9, g: 0.3, b: 0.3 },  // Red
                { r: 0.9, g: 0.9, b: 0.3 },  // Yellow
                { r: 0.6, g: 0.3, b: 0.8 },  // Purple
                { r: 0.9, g: 0.6, b: 0.8 },  // Pink
              ];
              const fc = flowerColors[hash2 % flowerColors.length];
              this.shapeRenderer.circle(fx, fy, 2, fc.r, fc.g, fc.b, 0.8);
              this.shapeRenderer.circle(fx, fy, 1, 1, 1, 0.5, 0.9);
            }
            // Dirt patches
            if (hash > 85) {
              const dx = cellX + (hash % 10);
              const dy = cellY + ((hash * 2) % 10);
              this.shapeRenderer.circle(dx, dy, 3, 0.45, 0.4, 0.3, 0.4);
            }
            break;
            
          case 'burned':
            // Ash piles
            if (hash < 25) {
              const ax = cellX + gridSize * 0.5 + (hash % 6) - 3;
              const ay = cellY + gridSize * 0.5 + ((hash * 2) % 6) - 3;
              this.shapeRenderer.circle(ax, ay, gridSize * 0.12, 0.12, 0.08, 0.08, 0.6);
            }
            // Embers (glowing)
            if (hash2 < 10) {
              const ex = cellX + gridSize * 0.3 + (hash2 % 12);
              const ey = cellY + gridSize * 0.4 + ((hash2 * 2) % 10);
              const pulse = Math.sin(this.frameCount * 0.08 + hash2) * 0.3 + 0.7;
              this.shapeRenderer.circle(ex, ey, 1.5, 0.9 * pulse, 0.3 * pulse, 0.1, 0.8);
            }
            // Charred wood
            if (hash > 60 && hash < 75) {
              const wx = cellX + 4 + (hash % 8);
              const wy = cellY + gridSize * 0.5;
              this.shapeRenderer.rect(wx, wy - 1, 6, 2, 0.1, 0.08, 0.06, 0.7);
            }
            // Smoke wisps
            if (hash2 > 80) {
              const sx = cellX + gridSize * 0.5;
              const sy = cellY + gridSize * 0.3;
              const smokeY = sy - Math.sin(this.frameCount * 0.02 + x) * 3;
              this.shapeRenderer.circle(sx, smokeY, 2, 0.3, 0.3, 0.35, 0.2);
            }
            break;
            
          case 'water':
            // Animated wave highlights - more detailed
            const wavePhase = Math.sin(this.frameCount * 0.02 + x * 0.3 + y * 0.2);
            const wavePhase2 = Math.sin(this.frameCount * 0.025 + x * 0.25 + y * 0.35);
            
            // Primary wave
            if (wavePhase > 0.2) {
              const wy = cellY + gridSize * 0.4 + wavePhase * 4;
              this.shapeRenderer.rect(cellX + 3, wy, gridSize - 6, 2, 0.45, 0.75, 0.9, 0.35 * wavePhase);
            }
            // Secondary wave
            if (wavePhase2 > 0.3) {
              const wy2 = cellY + gridSize * 0.7 + wavePhase2 * 3;
              this.shapeRenderer.rect(cellX + 5, wy2, gridSize - 10, 1.5, 0.5, 0.8, 0.95, 0.25 * wavePhase2);
            }
            // Water sparkles
            if (hash < 10) {
              const sparkle = Math.sin(this.frameCount * 0.1 + hash) * 0.5 + 0.5;
              const sx = cellX + (hash % 15) + 2;
              const sy = cellY + ((hash * 3) % 15) + 2;
              this.shapeRenderer.circle(sx, sy, 1, 1, 1, 1, sparkle * 0.4);
            }
            break;
        }
      }
    }
    
    this.shapeRenderer.end();
  }
  
  _renderSpecialElements(data) {
    if (!data.energyNodes) return;
    
    const gridSize = CONFIG.GRID_SIZE;
    
    this.shapeRenderer.begin('triangles', this.camera);
    
    for (const node of data.energyNodes) {
      const x = node.x * gridSize + gridSize / 2;
      const y = node.y * gridSize + gridSize / 2;
      
      // Pulsing glow
      const pulse = 0.5 + 0.5 * Math.sin(this.frameCount * 0.05);
      const glowRadius = gridSize * (0.4 + pulse * 0.2);
      
      // Glow effect (multiple circles with decreasing alpha)
      this.shapeRenderer.circle(x, y, glowRadius, 0.29, 0.56, 0.85, 0.3 * pulse);
      this.shapeRenderer.circle(x, y, glowRadius * 0.6, 0.39, 0.66, 0.95, 0.5 * pulse);
      
      // Core
      this.shapeRenderer.circle(x, y, gridSize * 0.2, 0.6, 0.8, 1, 1);
    }
    
    this.shapeRenderer.end();
  }
  
  _renderSpawnPortal(data) {
    if (!data.waypoints || data.waypoints.length === 0) return;
    
    const spawn = data.waypoints[0];
    const gridSize = CONFIG.GRID_SIZE;
    const x = spawn.x;
    const y = spawn.y;
    
    this.shapeRenderer.begin('triangles', this.camera);
    
    // Animated portal effect
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 0.003);
    const rotation = this.time * 0.001;
    
    // Outer ring
    this.shapeRenderer.circleOutline(x, y, gridSize * 0.8 + pulse * 5, 3 / this.camera.zoom, 0.9, 0.2, 0.2, 0.6);
    
    // Inner glow
    this.shapeRenderer.circle(x, y, gridSize * 0.5 + pulse * 3, 0.8, 0.1, 0.1, 0.4);
    
    // Core
    this.shapeRenderer.circle(x, y, gridSize * 0.3, 1, 0.3, 0.3, 0.8);
    
    this.shapeRenderer.end();
  }
  
  _renderBase(data) {
    if (!data.waypoints || data.waypoints.length < 2) return;
    
    const base = data.waypoints[data.waypoints.length - 1];
    const gridSize = CONFIG.GRID_SIZE;
    
    this.shapeRenderer.begin('triangles', this.camera);
    
    // Base platform
    this.shapeRenderer.circle(base.x, base.y, gridSize * 0.6, 0.2, 0.5, 0.2, 0.8);
    this.shapeRenderer.circleOutline(base.x, base.y, gridSize * 0.6, 2 / this.camera.zoom, 0.3, 0.7, 0.3, 1);
    
    // Shield effect (pulsing)
    const pulse = 0.5 + 0.5 * Math.sin(this.frameCount * 0.03);
    this.shapeRenderer.circleOutline(base.x, base.y, gridSize * 0.8 + pulse * 3, 2 / this.camera.zoom, 0.3, 0.8, 0.3, 0.3 * pulse);
    
    this.shapeRenderer.end();
  }
  
  // ============================================
  // ENTITY RENDERING
  // ============================================
  
  _renderEnergyConnections(data) {
    if (!data.energyNetwork?.connections) return;
    
    this.shapeRenderer.begin('triangles', this.camera);
    
    for (const conn of data.energyNetwork.connections) {
      // Use direct coordinates from connection data
      const fromX = conn.fromX;
      const fromY = conn.fromY;
      const toX = conn.toX;
      const toY = conn.toY;
      
      if (!fromX || !fromY || !toX || !toY) continue;
      
      // Connection line color based on active state
      const isActive = conn.active;
      const baseColor = isActive 
        ? { r: 0.3, g: 0.9, b: 1.0 }   // Cyan for active
        : { r: 0.4, g: 0.4, b: 0.5 };  // Gray for inactive
      
      // Animated energy flow pulse
      const pulse = Math.sin(this.time * 0.005) * 0.3 + 0.7;
      const alpha = isActive ? pulse * 0.8 : 0.4;
      
      // Main connection line
      this.shapeRenderer.line(fromX, fromY, toX, toY, 3 / this.camera.zoom, 
        baseColor.r, baseColor.g, baseColor.b, alpha);
      
      // Glow outline
      this.shapeRenderer.line(fromX, fromY, toX, toY, 5 / this.camera.zoom, 
        baseColor.r, baseColor.g, baseColor.b, alpha * 0.3);
      
      // Animated energy particles along the line (if active)
      if (isActive) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const len = Math.sqrt(dx * dx + dy * dy);
        const particleCount = Math.max(2, Math.floor(len / 40));
        
        for (let i = 0; i < particleCount; i++) {
          // Animate particles along line
          const t = ((this.time * 0.002 + i / particleCount) % 1);
          const px = fromX + dx * t;
          const py = fromY + dy * t;
          
          this.shapeRenderer.circle(px, py, 3 / this.camera.zoom, 0.5, 1, 1, 0.9);
        }
      }
      
      // Connection endpoints
      this.shapeRenderer.circle(fromX, fromY, 5 / this.camera.zoom, baseColor.r, baseColor.g, baseColor.b, 0.8);
      this.shapeRenderer.circle(toX, toY, 5 / this.camera.zoom, baseColor.r, baseColor.g, baseColor.b, 0.8);
    }
    
    this.shapeRenderer.end();
  }
  
  _renderConnectionRange(building) {
    const gridSize = CONFIG.GRID_SIZE;
    // Use effective range (in tiles) converted to pixels
    const rangeInTiles = building.getEffectiveRange?.() || building.range || 4;
    const range = rangeInTiles * gridSize;
    
    // Use center coordinates (same as _renderEnergyBuildings)
    const centerX = building.worldX ?? building.x;
    const centerY = building.worldY ?? building.y;
    
    this.shapeRenderer.begin('triangles', this.camera);
    this.shapeRenderer.circle(centerX, centerY, range, 0.3, 0.8, 1, 0.1);
    this.shapeRenderer.circleOutline(centerX, centerY, range, 2 / this.camera.zoom, 0.3, 0.8, 1, 0.5);
    this.shapeRenderer.end();
  }
  
  _renderEnergyBuildings(data) {
    if (!data.energyBuildings || data.energyBuildings.length === 0) return;
    
    const camera = this.camera;
    const gridSize = CONFIG.GRID_SIZE;
    
    this.shapeRenderer.begin('triangles', camera);
    
    for (const building of data.energyBuildings) {
      const bx = building.worldX ?? building.x;
      const by = building.worldY ?? building.y;
      if (bx === undefined || by === undefined) continue;
      
      const gw = building.gridWidth || 1;
      const gh = building.gridHeight || 1;
      const shape = building.shape || 'rect';
      const nodeType = building.nodeType || 'generator';
      const buildingType = building.type || 'base-generator';
      const fillPct = building.fillPercent || 0;
      
      // Unique colors per building type
      const typeColors = {
        'base-generator': { base: '#2d5a27', accent: '#4CAF50', glow: '#7fff7f' },
        'bio-generator': { base: '#1a4a1a', accent: '#2e7d32', glow: '#81c784' },
        'wind-generator': { base: '#37474f', accent: '#78909c', glow: '#b0bec5' },
        'solar-generator': { base: '#e65100', accent: '#ff9800', glow: '#ffcc02' },
        'water-generator': { base: '#01579b', accent: '#0288d1', glow: '#4fc3f7' },
        'basic-battery': { base: '#1a3a5c', accent: '#2196F3', glow: '#6fc3ff' },
        'power-transfer': { base: '#5c3a1a', accent: '#FF9800', glow: '#ffcc66' }
      };
      const c = typeColors[buildingType] || typeColors['base-generator'];
      const baseColor = this._parseColor(c.base);
      const accentColor = this._parseColor(c.accent);
      const glowColor = this._parseColor(c.glow);
      
      // Calculate building dimensions
      const w = gw * gridSize;
      const h = gh * gridSize;
      const cx = bx;  // Center X
      const cy = by;  // Center Y
      
      // === WARCRAFT 3 STYLE RENDERING ===
      
      // Ground shadow
      this.shapeRenderer.rect(cx - w/2 + 3, cy - h/2 + 3, w, h, 0, 0, 0, 0.4);
      
      if (shape === 'L' && gw === 2) {
        // L-shaped bio generator (2x1 with angle piece)
        this._renderLShapedBuilding(cx, cy, gridSize, baseColor, accentColor, glowColor, fillPct);
      } else if (gw === 2 && gh === 2) {
        // 2x2 Battery - large square building
        this._renderLargeBattery(cx, cy, gridSize, baseColor, accentColor, glowColor, fillPct);
      } else {
        // Standard 1x1 building - render based on specific type
        this._renderEnergyBuildingByType(cx, cy, gridSize, buildingType, baseColor, accentColor, glowColor, fillPct);
      }
      
      // === ENERGY BAR UNDER BUILDING ===
      this._renderEnergyBar({
        x: cx,
        y: cy + h / 2 + 4,
        width: Math.max(w * 0.8, 24),
        current: building.stored || building.energy || 0,
        max: building.capacity || building.maxEnergy || 100,
        type: building.nodeType || 'generator',
        showGenIcon: building.nodeType === 'generator' && building.generation > 0
      });
      
      // Pulse glow effect
      const pulse = Math.sin(this.time * 0.004) * 0.3 + 0.5;
      const glowRadius = Math.max(w, h) / 2 + 5;
      this.shapeRenderer.circleOutline(cx, cy, glowRadius, 2 / camera.zoom, 
        glowColor.r, glowColor.g, glowColor.b, pulse * 0.4);
    }
    
    this.shapeRenderer.end();
  }
  
  /**
   * Render L-shaped bio generator (WC3 style)
   * L-shape: 3 cells arranged as:
   *   [X]
   *   [X][X]
   */
  _renderLShapedBuilding(cx, cy, gridSize, baseColor, accentColor, glowColor, fillPct) {
    const s = gridSize;
    
    // L-shape is 2x2 with top-right cell empty
    // Cells: top-left, bottom-left, bottom-right
    const cells = [
      { x: cx - s/2, y: cy - s/2 },   // Top-left
      { x: cx - s/2, y: cy + s/2 },   // Bottom-left  
      { x: cx + s/2, y: cy + s/2 }    // Bottom-right
    ];
    
    // Draw each cell
    for (const cell of cells) {
      // Cell base
      this.shapeRenderer.rect(cell.x - s/2 + 1, cell.y - s/2 + 1, s - 2, s - 2, 
        baseColor.r, baseColor.g, baseColor.b, 1);
      // Cell inner
      this.shapeRenderer.rect(cell.x - s/2 + 3, cell.y - s/2 + 3, s - 6, s - 6,
        baseColor.r * 1.2, baseColor.g * 1.2, baseColor.b * 1.2, 1);
    }
    
    // Main bio tank in center of L (bottom-left cell)
    const tankX = cx - s/2;
    const tankY = cy + s/2;
    this.shapeRenderer.circle(tankX, tankY, s * 0.35, accentColor.r * 0.6, accentColor.g * 0.6, accentColor.b * 0.6, 1);
    this.shapeRenderer.circle(tankX, tankY, s * 0.25, accentColor.r, accentColor.g, accentColor.b, 0.9);
    
    // Fill level in tank
    if (fillPct > 0) {
      const fillH = s * 0.35 * fillPct;
      this.shapeRenderer.rect(tankX - s * 0.15, tankY + s * 0.15 - fillH, s * 0.3, fillH,
        glowColor.r, glowColor.g, glowColor.b, 0.8);
    }
    
    // Tree/leaf decorations in top-left cell
    const leafX = cx - s/2;
    const leafY = cy - s/2;
    this.shapeRenderer.circle(leafX - 3, leafY - 2, 5, 0.2, 0.5, 0.2, 1);
    this.shapeRenderer.circle(leafX + 3, leafY - 3, 4, 0.25, 0.55, 0.25, 1);
    this.shapeRenderer.circle(leafX, leafY + 2, 4, 0.3, 0.6, 0.3, 1);
    
    // Processing unit in bottom-right cell
    const procX = cx + s/2;
    const procY = cy + s/2;
    this.shapeRenderer.rect(procX - s * 0.25, procY - s * 0.25, s * 0.5, s * 0.5,
      accentColor.r * 0.4, accentColor.g * 0.4, accentColor.b * 0.4, 1);
    // Spinning gear
    const gearAngle = this.time * 0.003;
    for (let i = 0; i < 4; i++) {
      const a = gearAngle + i * Math.PI / 2;
      const gx = procX + Math.cos(a) * s * 0.15;
      const gy = procY + Math.sin(a) * s * 0.15;
      this.shapeRenderer.rect(gx - 2, gy - 2, 4, 4, accentColor.r * 0.7, accentColor.g * 0.7, accentColor.b * 0.7, 1);
    }
    
    // Connection pipe between cells
    this.shapeRenderer.rect(cx - s/2 - 2, cy, 4, s, accentColor.r * 0.5, accentColor.g * 0.5, accentColor.b * 0.5, 1);
    this.shapeRenderer.rect(cx, cy + s/2 - 2, s, 4, accentColor.r * 0.5, accentColor.g * 0.5, accentColor.b * 0.5, 1);
  }
  
  /**
   * Render large 2x2 battery (WC3 style)
   */
  _renderLargeBattery(cx, cy, gridSize, baseColor, accentColor, glowColor, fillPct) {
    const s = gridSize;
    const w = s * 2 - 4;
    const h = s * 2 - 4;
    
    // Main housing
    this.shapeRenderer.rect(cx - w/2, cy - h/2, w, h, baseColor.r, baseColor.g, baseColor.b, 1);
    
    // Inner structure - 4 battery cells
    const cellSize = s * 0.7;
    const cellGap = s * 0.15;
    const positions = [
      { x: cx - cellSize/2 - cellGap, y: cy - cellSize/2 - cellGap },
      { x: cx + cellGap, y: cy - cellSize/2 - cellGap },
      { x: cx - cellSize/2 - cellGap, y: cy + cellGap },
      { x: cx + cellGap, y: cy + cellGap }
    ];
    
    for (let i = 0; i < 4; i++) {
      const p = positions[i];
      // Cell frame
      this.shapeRenderer.rect(p.x, p.y, cellSize, cellSize, 
        baseColor.r * 0.6, baseColor.g * 0.6, baseColor.b * 0.6, 1);
      // Cell interior
      this.shapeRenderer.rect(p.x + 2, p.y + 2, cellSize - 4, cellSize - 4,
        accentColor.r * 0.3, accentColor.g * 0.3, accentColor.b * 0.3, 1);
      // Energy fill
      if (fillPct > 0) {
        const fillH = (cellSize - 6) * fillPct;
        this.shapeRenderer.rect(p.x + 3, p.y + cellSize - 3 - fillH, cellSize - 6, fillH,
          accentColor.r, accentColor.g, accentColor.b, 0.9);
      }
    }
    
    // Central connector
    this.shapeRenderer.circle(cx, cy, s * 0.2, accentColor.r * 0.8, accentColor.g * 0.8, accentColor.b * 0.8, 1);
    
    // Lightning bolt icon in center
    const boltSize = s * 0.15;
    this.shapeRenderer.line(cx, cy - boltSize, cx - boltSize * 0.3, cy, 2, 1, 1, 0.2, 1);
    this.shapeRenderer.line(cx - boltSize * 0.3, cy, cx + boltSize * 0.3, cy, 2, 1, 1, 0.2, 1);
    this.shapeRenderer.line(cx + boltSize * 0.3, cy, cx, cy + boltSize, 2, 1, 1, 0.2, 1);
    
    // Border
    this.shapeRenderer.rectOutline(cx - w/2, cy - h/2, w, h, 2, 0.1, 0.1, 0.1, 0.7);
  }
  
  /**
   * Render energy building by specific type with unique visuals
   */
  _renderEnergyBuildingByType(cx, cy, gridSize, buildingType, baseColor, accentColor, glowColor, fillPct) {
    const s = gridSize;
    const size = s * 0.8;
    
    switch (buildingType) {
      case 'solar-generator':
        this._renderSolarPanel(cx, cy, s, baseColor, accentColor, glowColor, fillPct);
        break;
      case 'wind-generator':
        this._renderWindTurbine(cx, cy, s, baseColor, accentColor, glowColor, fillPct);
        break;
      case 'water-generator':
        this._renderHydroGenerator(cx, cy, s, baseColor, accentColor, glowColor, fillPct);
        break;
      case 'power-transfer':
        this._renderPowerRelay(cx, cy, s, baseColor, accentColor, glowColor, fillPct);
        break;
      case 'basic-battery':
        this._renderSmallBattery(cx, cy, s, baseColor, accentColor, glowColor, fillPct);
        break;
      case 'base-generator':
      default:
        this._renderBaseGenerator(cx, cy, s, baseColor, accentColor, glowColor, fillPct);
        break;
    }
  }
  
  /**
   * Base Generator - Industrial turbine with rotating gear
   */
  _renderBaseGenerator(cx, cy, s, baseColor, accentColor, glowColor, fillPct) {
    const size = s * 0.8;
    
    // Base platform - hexagonal look
    this.shapeRenderer.circle(cx, cy, size * 0.85, baseColor.r * 0.4, baseColor.g * 0.4, baseColor.b * 0.4, 1);
    
    // Main housing
    this.shapeRenderer.circle(cx, cy, size * 0.7, baseColor.r, baseColor.g, baseColor.b, 1);
    this.shapeRenderer.circle(cx, cy, size * 0.55, baseColor.r * 0.8, baseColor.g * 0.8, baseColor.b * 0.8, 1);
    
    // Rotating turbine
    const gearAngle = this.time * 0.003;
    for (let i = 0; i < 6; i++) {
      const a = gearAngle + (i * Math.PI / 3);
      const gx = cx + Math.cos(a) * size * 0.35;
      const gy = cy + Math.sin(a) * size * 0.35;
      this.shapeRenderer.rect(gx - 3, gy - 3, 6, 6, accentColor.r, accentColor.g, accentColor.b, 1);
    }
    
    // Center core with spark
    this.shapeRenderer.circle(cx, cy, size * 0.2, accentColor.r, accentColor.g, accentColor.b, 1);
    const spark = Math.sin(this.time * 0.008) * 0.5 + 0.5;
    this.shapeRenderer.circle(cx, cy, size * 0.12, glowColor.r, glowColor.g, glowColor.b, spark);
  }
  
  /**
   * Solar Panel - Flat panel with grid pattern, tilted appearance
   */
  _renderSolarPanel(cx, cy, s, baseColor, accentColor, glowColor, fillPct) {
    const size = s * 0.85;
    
    // Support stand
    this.shapeRenderer.rect(cx - 3, cy + size * 0.2, 6, size * 0.4, 0.2, 0.2, 0.2, 1);
    
    // Panel frame (dark border)
    this.shapeRenderer.rect(cx - size * 0.5, cy - size * 0.4, size, size * 0.6, 0.15, 0.15, 0.15, 1);
    
    // Solar cells (dark blue with grid)
    const panelW = size * 0.9;
    const panelH = size * 0.5;
    this.shapeRenderer.rect(cx - panelW/2, cy - size * 0.35, panelW, panelH, 
      baseColor.r * 0.5, baseColor.g * 0.5, baseColor.b * 0.5, 1);
    
    // Grid lines on panel (horizontal)
    for (let i = 1; i < 4; i++) {
      const y = cy - size * 0.35 + (panelH / 4) * i;
      this.shapeRenderer.rect(cx - panelW/2, y - 1, panelW, 2, 0.1, 0.1, 0.1, 0.8);
    }
    // Grid lines (vertical)
    for (let i = 1; i < 4; i++) {
      const x = cx - panelW/2 + (panelW / 4) * i;
      this.shapeRenderer.rect(x - 1, cy - size * 0.35, 2, panelH, 0.1, 0.1, 0.1, 0.8);
    }
    
    // Sun reflection effect
    const pulse = Math.sin(this.time * 0.003) * 0.3 + 0.7;
    this.shapeRenderer.rect(cx - panelW * 0.2, cy - size * 0.3, panelW * 0.15, panelH * 0.3, 
      glowColor.r, glowColor.g, glowColor.b, pulse * 0.4);
    
    // Status LED
    this.shapeRenderer.circle(cx + size * 0.35, cy + size * 0.25, 3, glowColor.r, glowColor.g, glowColor.b, pulse);
  }
  
  /**
   * Wind Turbine - Tall pole with rotating blades
   */
  _renderWindTurbine(cx, cy, s, baseColor, accentColor, glowColor, fillPct) {
    const size = s * 0.8;
    
    // Base platform
    this.shapeRenderer.circle(cx, cy + size * 0.3, size * 0.35, baseColor.r * 0.5, baseColor.g * 0.5, baseColor.b * 0.5, 1);
    
    // Pole/tower
    this.shapeRenderer.rect(cx - 4, cy - size * 0.1, 8, size * 0.6, 0.4, 0.4, 0.45, 1);
    this.shapeRenderer.rect(cx - 3, cy - size * 0.1, 6, size * 0.6, 0.5, 0.5, 0.55, 1);
    
    // Nacelle (hub housing) - slightly larger
    this.shapeRenderer.circle(cx, cy - size * 0.25, size * 0.22, baseColor.r, baseColor.g, baseColor.b, 1);
    this.shapeRenderer.circle(cx, cy - size * 0.25, size * 0.15, accentColor.r, accentColor.g, accentColor.b, 1);
    
    // Rotating blades (3 blades) - LARGER blades
    const bladeAngle = this.time * 0.005;
    const bladeLength = size * 0.75;  // Increased from 0.5 to 0.75
    const hubY = cy - size * 0.25;
    
    for (let i = 0; i < 3; i++) {
      const a = bladeAngle + (i * Math.PI * 2 / 3);
      const bx = cx + Math.cos(a) * bladeLength;
      const by = hubY + Math.sin(a) * bladeLength;
      
      // Blade body (wider tapered blades)
      this.shapeRenderer.line(cx, hubY, bx, by, 7, 0.85, 0.85, 0.9, 1);  // Increased width from 5 to 7
      this.shapeRenderer.line(cx, hubY, bx, by, 4, 0.95, 0.95, 1, 1);     // Increased width from 3 to 4
      
      // Blade tip highlight
      this.shapeRenderer.circle(bx, by, 2, 1, 1, 1, 0.7);
    }
    
    // Center hub - slightly larger
    this.shapeRenderer.circle(cx, hubY, size * 0.1, 0.25, 0.25, 0.3, 1);
    this.shapeRenderer.circle(cx, hubY, size * 0.06, 0.4, 0.4, 0.45, 1);
  }
  
  /**
   * Hydro Generator - Water wheel / turbine with waves
   */
  _renderHydroGenerator(cx, cy, s, baseColor, accentColor, glowColor, fillPct) {
    const size = s * 0.8;
    
    // Water base with wave effect
    const waveOffset = Math.sin(this.time * 0.004) * 3;
    this.shapeRenderer.rect(cx - size * 0.5, cy + size * 0.1, size, size * 0.3, 
      accentColor.r * 0.3, accentColor.g * 0.5, accentColor.b * 0.8, 0.7);
    
    // Building frame
    this.shapeRenderer.rect(cx - size * 0.4, cy - size * 0.35, size * 0.8, size * 0.5, 
      baseColor.r, baseColor.g, baseColor.b, 1);
    
    // Water wheel (rotating)
    const wheelAngle = this.time * 0.003;
    const wheelR = size * 0.3;
    this.shapeRenderer.circle(cx, cy, wheelR, baseColor.r * 0.6, baseColor.g * 0.6, baseColor.b * 0.6, 1);
    
    // Wheel spokes
    for (let i = 0; i < 8; i++) {
      const a = wheelAngle + (i * Math.PI / 4);
      const sx = cx + Math.cos(a) * wheelR * 0.9;
      const sy = cy + Math.sin(a) * wheelR * 0.9;
      this.shapeRenderer.line(cx, cy, sx, sy, 3, accentColor.r, accentColor.g, accentColor.b, 1);
    }
    
    // Center hub
    this.shapeRenderer.circle(cx, cy, size * 0.1, accentColor.r, accentColor.g, accentColor.b, 1);
    
    // Water droplet decorations
    const dropY = cy + size * 0.2 + waveOffset;
    this.shapeRenderer.circle(cx - size * 0.25, dropY, 4, glowColor.r, glowColor.g, glowColor.b, 0.6);
    this.shapeRenderer.circle(cx + size * 0.2, dropY - 2, 3, glowColor.r, glowColor.g, glowColor.b, 0.5);
  }
  
  /**
   * Power Relay - Antenna/transmission node
   */
  _renderPowerRelay(cx, cy, s, baseColor, accentColor, glowColor, fillPct) {
    const size = s * 0.8;
    
    // Base platform
    this.shapeRenderer.circle(cx, cy + size * 0.2, size * 0.4, baseColor.r * 0.5, baseColor.g * 0.5, baseColor.b * 0.5, 1);
    
    // Main column
    this.shapeRenderer.rect(cx - 5, cy - size * 0.2, 10, size * 0.5, baseColor.r, baseColor.g, baseColor.b, 1);
    
    // Antenna dish
    const dishY = cy - size * 0.35;
    this.shapeRenderer.circle(cx, dishY, size * 0.25, accentColor.r * 0.7, accentColor.g * 0.7, accentColor.b * 0.7, 1);
    this.shapeRenderer.circle(cx, dishY, size * 0.18, accentColor.r, accentColor.g, accentColor.b, 1);
    
    // Antenna spike
    this.shapeRenderer.line(cx, dishY, cx, dishY - size * 0.25, 3, accentColor.r, accentColor.g, accentColor.b, 1);
    
    // Signal rings (pulsing)
    const pulse = Math.sin(this.time * 0.006) * 0.5 + 0.5;
    this.shapeRenderer.circleOutline(cx, dishY, size * 0.35 + pulse * 5, 2, glowColor.r, glowColor.g, glowColor.b, pulse * 0.5);
    this.shapeRenderer.circleOutline(cx, dishY, size * 0.45 + pulse * 8, 2, glowColor.r, glowColor.g, glowColor.b, pulse * 0.3);
  }
  
  /**
   * Small Battery - Compact energy storage
   */
  _renderSmallBattery(cx, cy, s, baseColor, accentColor, glowColor, fillPct) {
    const size = s * 0.8;
    
    // Base shadow
    this.shapeRenderer.rect(cx - size * 0.4 + 2, cy - size * 0.35 + 2, size * 0.8, size * 0.7, 0, 0, 0, 0.3);
    
    // Battery body
    this.shapeRenderer.rect(cx - size * 0.4, cy - size * 0.35, size * 0.8, size * 0.7, baseColor.r, baseColor.g, baseColor.b, 1);
    
    // Battery terminal (top bump)
    this.shapeRenderer.rect(cx - size * 0.15, cy - size * 0.45, size * 0.3, size * 0.12, 
      baseColor.r * 0.8, baseColor.g * 0.8, baseColor.b * 0.8, 1);
    
    // Inner chamber
    this.shapeRenderer.rect(cx - size * 0.3, cy - size * 0.25, size * 0.6, size * 0.5, 
      accentColor.r * 0.2, accentColor.g * 0.2, accentColor.b * 0.2, 1);
    
    // Energy fill level
    if (fillPct > 0) {
      const fillH = size * 0.45 * fillPct;
      this.shapeRenderer.rect(cx - size * 0.25, cy + size * 0.2 - fillH, size * 0.5, fillH,
        accentColor.r, accentColor.g, accentColor.b, 0.9);
    }
    
    // Charge indicator lights
    const litCount = Math.floor(fillPct * 4);
    for (let i = 0; i < 4; i++) {
      const lx = cx - size * 0.25 + (size * 0.5 / 3) * i;
      const isLit = i < litCount;
      this.shapeRenderer.circle(lx, cy + size * 0.28, 3, 
        isLit ? glowColor.r : 0.2, isLit ? glowColor.g : 0.2, isLit ? glowColor.b : 0.2, isLit ? 1 : 0.5);
    }
  }
  
  /**
   * Render standard 1x1 energy building (WC3 style)
   */
  _renderStandardEnergyBuilding(cx, cy, gridSize, nodeType, baseColor, accentColor, glowColor, fillPct) {
    const s = gridSize;
    const size = s * 0.8;
    
    // Base platform
    this.shapeRenderer.circle(cx, cy, size * 0.9, baseColor.r * 0.5, baseColor.g * 0.5, baseColor.b * 0.5, 1);
    
    // Main structure based on type
    if (nodeType === 'generator') {
      // Generator - cylindrical with gear
      this.shapeRenderer.circle(cx, cy, size * 0.7, baseColor.r, baseColor.g, baseColor.b, 1);
      this.shapeRenderer.circle(cx, cy, size * 0.5, accentColor.r, accentColor.g, accentColor.b, 1);
      
      // Rotating gear effect
      const gearAngle = this.time * 0.002;
      for (let i = 0; i < 6; i++) {
        const a = gearAngle + (i * Math.PI / 3);
        const gx = cx + Math.cos(a) * size * 0.35;
        const gy = cy + Math.sin(a) * size * 0.35;
        this.shapeRenderer.rect(gx - 2, gy - 2, 4, 4, accentColor.r * 0.7, accentColor.g * 0.7, accentColor.b * 0.7, 1);
      }
      
      // Center spark
      const spark = Math.sin(this.time * 0.01) * 0.5 + 0.5;
      this.shapeRenderer.circle(cx, cy, size * 0.15, 1, 1, spark, 1);
      
    } else if (nodeType === 'storage') {
      // Storage - box with energy meter
      this.shapeRenderer.rect(cx - size * 0.5, cy - size * 0.5, size, size, baseColor.r, baseColor.g, baseColor.b, 1);
      this.shapeRenderer.rect(cx - size * 0.4, cy - size * 0.4, size * 0.8, size * 0.8, 
        accentColor.r * 0.3, accentColor.g * 0.3, accentColor.b * 0.3, 1);
      
      // Fill meter
      if (fillPct > 0) {
        const fillH = size * 0.7 * fillPct;
        this.shapeRenderer.rect(cx - size * 0.35, cy + size * 0.35 - fillH, size * 0.7, fillH,
          accentColor.r, accentColor.g, accentColor.b, 0.9);
      }
      
    } else {
      // Transfer - relay node
      this.shapeRenderer.circle(cx, cy, size * 0.6, baseColor.r, baseColor.g, baseColor.b, 1);
      
      // Antenna
      this.shapeRenderer.line(cx, cy - size * 0.3, cx, cy - size * 0.7, 2, accentColor.r, accentColor.g, accentColor.b, 1);
      this.shapeRenderer.circle(cx, cy - size * 0.7, 3, accentColor.r, accentColor.g, accentColor.b, 1);
      
      // Signal rings
      const ringPulse = (this.time * 0.003) % 1;
      this.shapeRenderer.circleOutline(cx, cy, size * 0.3 + ringPulse * size * 0.3, 1, 
        accentColor.r, accentColor.g, accentColor.b, 0.5 * (1 - ringPulse));
    }
    
    // Border
    this.shapeRenderer.circleOutline(cx, cy, size * 0.7, 1, 0.1, 0.1, 0.1, 0.5);
  }
  
  /**
   * UNIFIED energy bar renderer for ALL buildings (towers, generators, storage, relay)
   * @param {Object} opts - Options
   * @param {number} opts.x - Center X position
   * @param {number} opts.y - Top Y position of bar
   * @param {number} opts.width - Bar width
   * @param {number} opts.current - Current energy
   * @param {number} opts.max - Max energy capacity
   * @param {string} opts.type - Building type: 'generator', 'storage', 'relay', 'consumer'
   * @param {boolean} [opts.showGenIcon] - Show + icon for generators
   * @param {boolean} [opts.showEmptyWarning] - Show ! when empty (for consumers)
   */
  _renderEnergyBar(opts) {
    const { x, y, width, current, max, type, showGenIcon, showEmptyWarning } = opts;
    const camera = this.camera;
    const fillPct = max > 0 ? Math.min(1, current / max) : 0;
    
    const barHeight = 5;
    const barX = x - width / 2;
    const barY = y;
    
    // Background (dark)
    this.shapeRenderer.rect(barX - 1, barY - 1, width + 2, barHeight + 2, 0, 0, 0, 0.7);
    
    // Empty bar (dark gray)
    this.shapeRenderer.rect(barX, barY, width, barHeight, 0.15, 0.15, 0.2, 1);
    
    // Determine color based on type and fill level
    if (fillPct > 0) {
      let fillColor;
      let pulseCondition;
      
      // Type-based colors
      switch (type) {
        case 'generator':
          fillColor = { r: 0.3, g: 0.9, b: 0.4 };  // Green
          pulseCondition = fillPct >= 0.9;  // Pulse when full
          break;
        case 'storage':
          fillColor = { r: 0.3, g: 0.7, b: 1.0 };  // Blue
          pulseCondition = fillPct >= 0.9;
          break;
        case 'relay':
          fillColor = { r: 1.0, g: 0.7, b: 0.3 };  // Orange
          pulseCondition = false;
          break;
        case 'consumer':  // Towers
        default:
          // Color based on energy level for consumers
          if (fillPct < 0.25) {
            fillColor = { r: 1.0, g: 0.2, b: 0.2 };  // Red warning
            pulseCondition = true;  // Pulse when low
          } else if (fillPct < 0.5) {
            fillColor = { r: 1.0, g: 0.6, b: 0.2 };  // Orange
            pulseCondition = false;
          } else {
            fillColor = { r: 0.2, g: 0.8, b: 1.0 };  // Cyan
            pulseCondition = false;
          }
          break;
      }
      
      // Animated pulse
      const pulse = pulseCondition ? Math.sin(this.time * 0.01) * 0.25 + 0.75 : 1;
      
      this.shapeRenderer.rect(barX, barY, width * fillPct, barHeight, 
        fillColor.r * pulse, fillColor.g * pulse, fillColor.b * pulse, 1);
      
      // Glow effect for high energy (producers)
      if (type !== 'consumer' && fillPct >= 0.5) {
        this.shapeRenderer.rect(barX, barY, width * fillPct, barHeight, 
          fillColor.r, fillColor.g, fillColor.b, 0.25);
      }
    }
    
    // Border
    this.shapeRenderer.rectOutline(barX, barY, width, barHeight, 1 / camera.zoom, 0.3, 0.3, 0.3, 0.8);
    
    // Generation rate indicator (+ icon for generators)
    if (showGenIcon) {
      const iconX = barX + width + 4;
      const iconY = barY + barHeight / 2;
      this.shapeRenderer.rect(iconX - 1, iconY - 3, 2, 6, 0.5, 1, 0.5, 1);
      this.shapeRenderer.rect(iconX - 3, iconY - 1, 6, 2, 0.5, 1, 0.5, 1);
    }
    
    // Empty warning (! icon for consumers)
    if (showEmptyWarning && fillPct === 0) {
      const blink = Math.sin(this.time * 0.02) > 0;
      if (blink) {
        this.shapeRenderer.rect(x - 2, barY - 8, 4, 6, 1, 0.3, 0.3, 1);
        this.shapeRenderer.rect(x - 1.5, barY - 1, 3, 2, 1, 0.3, 0.3, 1);
      }
    }
  }
  
  _renderTowers(data) {
    if (!data.towers || data.towers.length === 0) return;
    
    const camera = this.camera;
    
    this.shapeRenderer.begin('triangles', camera);
    
    for (const tower of data.towers) {
      this._renderTowerWC3Style(tower, data.selectedTower === tower);
    }
    
    this.shapeRenderer.end();
  }
  
  /**
   * Render tower in Warcraft 3 style
   */
  _renderTowerWC3Style(tower, isSelected) {
    const camera = this.camera;
    const x = tower.x;
    const y = tower.y;
    const baseSize = (tower.size || 20);
    const level = tower.level || 1;
    const attackType = tower.attackTypeId || 'base';
    
    // Get element colors
    const elementColors = {
      fire: { base: '#8B0000', accent: '#FF4500', glow: '#FF6B35' },
      ice: { base: '#1a3a5c', accent: '#00BFFF', glow: '#87CEEB' },
      lightning: { base: '#4a4a00', accent: '#FFD700', glow: '#FFFF88' },
      nature: { base: '#2d5a27', accent: '#32CD32', glow: '#90EE90' },
      dark: { base: '#2a1a3a', accent: '#8B008B', glow: '#DA70D6' },
      none: { base: '#3a3a3a', accent: '#718096', glow: '#A0AEC0' }
    };
    
    // Attack type visual modifiers
    const attackTypeVisuals = {
      base: { platformScale: 1.0, bodyScale: 1.0, turretStyle: 'standard' },
      siege: { platformScale: 1.15, bodyScale: 1.1, turretStyle: 'siege' },
      normal: { platformScale: 1.0, bodyScale: 0.95, turretStyle: 'normal' },
      magic: { platformScale: 1.0, bodyScale: 1.0, turretStyle: 'magic' },
      piercing: { platformScale: 0.95, bodyScale: 0.9, turretStyle: 'piercing' }
    };
    
    const element = tower.elementPath || 'none';
    const colors = elementColors[element] || elementColors.none;
    const atkVisuals = attackTypeVisuals[attackType] || attackTypeVisuals.base;
    const baseColor = this._parseColor(colors.base);
    const accentColor = this._parseColor(colors.accent);
    const glowColor = this._parseColor(colors.glow);
    
    // Selection ring
    if (isSelected) {
      this.shapeRenderer.circleOutline(x, y, baseSize * 0.8, 3 / camera.zoom, 1, 0.84, 0, 0.9);
    }
    
    // === BASE PLATFORM ===
    const platformScale = atkVisuals.platformScale;
    // Shadow
    this.shapeRenderer.circle(x + 2, y + 3, baseSize * 0.55 * platformScale, 0, 0, 0, 0.4);
    
    // Stone base (octagon-ish) - siege gets reinforced look
    if (attackType === 'siege') {
      // Siege: reinforced heavy platform with metal rim
      this.shapeRenderer.circle(x, y, baseSize * 0.6, 0.25, 0.22, 0.2, 1);
      this.shapeRenderer.circle(x, y, baseSize * 0.55, 0.35, 0.32, 0.3, 1);
      this.shapeRenderer.circleOutline(x, y, baseSize * 0.58, 2 / camera.zoom, 0.4, 0.35, 0.3, 0.8);
    } else {
      this.shapeRenderer.circle(x, y, baseSize * 0.55 * platformScale, 0.3, 0.28, 0.25, 1);
      this.shapeRenderer.circle(x, y, baseSize * 0.48 * platformScale, 0.4, 0.38, 0.35, 1);
    }
    
    // === TOWER BODY ===
    const bodySize = baseSize * 0.4 * atkVisuals.bodyScale;
    
    // Main tower structure
    this.shapeRenderer.circle(x, y, bodySize, baseColor.r, baseColor.g, baseColor.b, 1);
    this.shapeRenderer.circle(x, y, bodySize * 0.85, baseColor.r * 1.2, baseColor.g * 1.2, baseColor.b * 1.2, 1);
    
    // Tower accent ring
    this.shapeRenderer.circleOutline(x, y, bodySize * 0.7, 2 / camera.zoom, 
      accentColor.r, accentColor.g, accentColor.b, 0.8);
    
    // === TURRET / WEAPON (attack type specific) ===
    const rotation = tower.rotation || 0;
    this._renderTowerTurret(x, y, baseSize, rotation, attackType, accentColor, glowColor, camera);
    
    // === CENTER CRYSTAL / ORB ===
    const orbPulse = Math.sin(this.time * 0.005) * 0.2 + 0.8;
    
    if (attackType === 'magic') {
      // Magic: larger pulsing orb with orbiting particles
      const magicPulse = Math.sin(this.time * 0.004) * 0.3 + 0.7;
      this.shapeRenderer.circle(x, y, bodySize * 0.4, glowColor.r * magicPulse, glowColor.g * magicPulse, glowColor.b * magicPulse, 0.9);
      this.shapeRenderer.circle(x, y, bodySize * 0.25, 1, 1, 1, 0.7);
      
      // Orbiting magic particles
      for (let i = 0; i < 3; i++) {
        const orbitAngle = this.time * 0.006 + (i * Math.PI * 2 / 3);
        const orbitDist = bodySize * 0.9;
        const px = x + Math.cos(orbitAngle) * orbitDist;
        const py = y + Math.sin(orbitAngle) * orbitDist;
        this.shapeRenderer.circle(px, py, 2.5 / camera.zoom, accentColor.r, accentColor.g, accentColor.b, 0.8);
      }
    } else {
      this.shapeRenderer.circle(x, y, bodySize * 0.3, glowColor.r * orbPulse, glowColor.g * orbPulse, glowColor.b * orbPulse, 1);
      this.shapeRenderer.circle(x, y, bodySize * 0.15, 1, 1, 1, 0.6);
    }
    
    // === ATTACK TYPE INDICATOR ===
    if (attackType !== 'base') {
      this._renderAttackTypeIndicator(x, y, baseSize, attackType, camera);
    }
    
    // === LEVEL INDICATORS ===
    if (level > 1) {
      const indicatorRadius = baseSize * 0.6;
      const numDots = Math.min(level - 1, 5);
      for (let i = 0; i < numDots; i++) {
        const angle = -Math.PI / 2 + (i - (numDots - 1) / 2) * 0.4;
        const dx = x + Math.cos(angle) * indicatorRadius;
        const dy = y + Math.sin(angle) * indicatorRadius;
        this.shapeRenderer.circle(dx, dy, 2.5 / camera.zoom, 1, 0.9, 0.3, 1);
      }
    }
    
    // === ELEMENT TIER GLOW ===
    if (tower.elementTier && tower.elementTier > 0) {
      const tierGlow = Math.sin(this.time * 0.003) * 0.2 + 0.6;
      this.shapeRenderer.circleOutline(x, y, baseSize * 0.65 + tower.elementTier * 2, 
        1 / camera.zoom, glowColor.r, glowColor.g, glowColor.b, tierGlow * 0.5);
    }
    
    // === ENERGY BAR ===
    this._renderEnergyBar({
      x: x,
      y: y + baseSize * 0.7,
      width: baseSize * 1.2,
      current: tower.currentEnergy || 0,
      max: tower.maxEnergy || 100,
      type: 'consumer',  // Towers are energy consumers
      showEmptyWarning: true
    });
  }
  
  /**
   * Render tower turret based on attack type
   * - Siege: dual heavy barrels
   * - Normal: single accurate barrel with scope
   * - Magic: no barrel, energy streams
   * - Piercing: long spear-like barrel
   * - Base: standard single barrel
   */
  _renderTowerTurret(x, y, baseSize, rotation, attackType, accentColor, glowColor, camera) {
    const turretLen = baseSize * 0.5;
    const turretWidth = 4 / camera.zoom;
    
    switch (attackType) {
      case 'siege': {
        // Siege: dual heavy cannons
        const spread = 0.25; // angle spread between barrels
        const barrelWidth = turretWidth * 1.4;
        
        for (const offset of [-spread, spread]) {
          const r = rotation + offset;
          const tx = x + Math.cos(r) * turretLen * 0.2;
          const ty = y + Math.sin(r) * turretLen * 0.2;
          const tex = x + Math.cos(r) * turretLen * 0.9;
          const tey = y + Math.sin(r) * turretLen * 0.9;
          
          // Heavy barrel outline
          this.shapeRenderer.line(tx, ty, tex, tey, barrelWidth + 3, 0.15, 0.15, 0.15, 1);
          this.shapeRenderer.line(tx, ty, tex, tey, barrelWidth, accentColor.r * 0.8, accentColor.g * 0.8, accentColor.b * 0.8, 1);
          
          // Muzzle
          this.shapeRenderer.circle(tex, tey, 4 / camera.zoom, glowColor.r, glowColor.g, glowColor.b, 0.7);
        }
        
        // Center mount
        this.shapeRenderer.circle(x + Math.cos(rotation) * turretLen * 0.15, 
                                   y + Math.sin(rotation) * turretLen * 0.15, 
                                   5 / camera.zoom, 0.3, 0.3, 0.35, 1);
        break;
      }
      
      case 'normal': {
        // Normal: sleek accurate barrel with scope
        const tx = x + Math.cos(rotation) * turretLen * 0.3;
        const ty = y + Math.sin(rotation) * turretLen * 0.3;
        const tex = x + Math.cos(rotation) * turretLen;
        const tey = y + Math.sin(rotation) * turretLen;
        
        // Main barrel (thinner, more precise)
        this.shapeRenderer.line(tx, ty, tex, tey, turretWidth, 0.2, 0.2, 0.2, 1);
        this.shapeRenderer.line(tx, ty, tex, tey, turretWidth - 1, accentColor.r, accentColor.g, accentColor.b, 1);
        
        // Scope/sight on top
        const scopeX = x + Math.cos(rotation) * turretLen * 0.5;
        const scopeY = y + Math.sin(rotation) * turretLen * 0.5;
        const perpAngle = rotation + Math.PI / 2;
        const scopeOffset = 3 / camera.zoom;
        this.shapeRenderer.circle(scopeX + Math.cos(perpAngle) * scopeOffset, 
                                   scopeY + Math.sin(perpAngle) * scopeOffset, 
                                   2.5 / camera.zoom, 0.2, 0.5, 0.8, 1);
        
        // Targeting reticle glow at tip
        this.shapeRenderer.circle(tex, tey, 3 / camera.zoom, glowColor.r, glowColor.g, glowColor.b, 0.9);
        this.shapeRenderer.circleOutline(tex, tey, 5 / camera.zoom, 1 / camera.zoom, 
          glowColor.r, glowColor.g, glowColor.b, 0.5);
        break;
      }
      
      case 'magic': {
        // Magic: energy streams instead of barrels
        const streamCount = 2;
        const streamPulse = Math.sin(this.time * 0.008) * 0.3 + 0.7;
        
        for (let i = 0; i < streamCount; i++) {
          const streamAngle = rotation + (i - 0.5) * 0.4;
          const streamLen = turretLen * (0.7 + Math.sin(this.time * 0.01 + i) * 0.2);
          const sex = x + Math.cos(streamAngle) * streamLen;
          const sey = y + Math.sin(streamAngle) * streamLen;
          
          // Ethereal energy stream
          this.shapeRenderer.line(x, y, sex, sey, 2 / camera.zoom, 
            glowColor.r * streamPulse, glowColor.g * streamPulse, glowColor.b * streamPulse, 0.6);
          
          // Energy tip
          this.shapeRenderer.circle(sex, sey, 2.5 / camera.zoom, 
            accentColor.r, accentColor.g, accentColor.b, streamPulse);
        }
        break;
      }
      
      case 'piercing': {
        // Piercing: long spear-like barrel
        const spearLen = turretLen * 1.3;
        const tx = x + Math.cos(rotation) * turretLen * 0.1;
        const ty = y + Math.sin(rotation) * turretLen * 0.1;
        const tex = x + Math.cos(rotation) * spearLen;
        const tey = y + Math.sin(rotation) * spearLen;
        
        // Spear shaft (tapered)
        this.shapeRenderer.line(tx, ty, tex, tey, turretWidth - 1, 0.2, 0.2, 0.2, 1);
        this.shapeRenderer.line(tx, ty, tex, tey, turretWidth - 2, accentColor.r, accentColor.g, accentColor.b, 1);
        
        // Spear tip (arrowhead shape using small lines)
        const tipLen = 6 / camera.zoom;
        const tipSpread = 0.4;
        for (const side of [-1, 1]) {
          const tipAngle = rotation + Math.PI + (tipSpread * side);
          const tipX = tex + Math.cos(tipAngle) * tipLen;
          const tipY = tey + Math.sin(tipAngle) * tipLen;
          this.shapeRenderer.line(tex, tey, tipX, tipY, 2 / camera.zoom, 
            glowColor.r, glowColor.g, glowColor.b, 1);
        }
        
        // Sharp tip glow
        this.shapeRenderer.circle(tex, tey, 2 / camera.zoom, 1, 1, 1, 0.9);
        break;
      }
      
      default: {
        // Base: standard single barrel
        const tx = x + Math.cos(rotation) * turretLen * 0.3;
        const ty = y + Math.sin(rotation) * turretLen * 0.3;
        const tex = x + Math.cos(rotation) * turretLen;
        const tey = y + Math.sin(rotation) * turretLen;
        
        this.shapeRenderer.line(tx, ty, tex, tey, turretWidth + 2, 0.2, 0.2, 0.2, 1);
        this.shapeRenderer.line(tx, ty, tex, tey, turretWidth, accentColor.r, accentColor.g, accentColor.b, 1);
        
        // Turret tip glow
        this.shapeRenderer.circle(tex, tey, 3 / camera.zoom, glowColor.r, glowColor.g, glowColor.b, 0.8);
        break;
      }
    }
  }
  
  /**
   * Render small attack type indicator icon near tower
   */
  _renderAttackTypeIndicator(x, y, baseSize, attackType, camera) {
    // Position at bottom-left of tower
    const ix = x - baseSize * 0.45;
    const iy = y + baseSize * 0.45;
    const iconSize = 4 / camera.zoom;
    
    // Attack type colors
    const typeColors = {
      siege: { r: 1.0, g: 0.4, b: 0.2 },    // Orange-red
      normal: { r: 0.3, g: 0.6, b: 0.9 },   // Blue
      magic: { r: 0.6, g: 0.3, b: 0.8 },    // Purple
      piercing: { r: 0.9, g: 0.8, b: 0.2 }  // Gold
    };
    
    const color = typeColors[attackType] || { r: 0.5, g: 0.5, b: 0.5 };
    
    // Background circle
    this.shapeRenderer.circle(ix, iy, iconSize + 1, 0, 0, 0, 0.5);
    this.shapeRenderer.circle(ix, iy, iconSize, color.r, color.g, color.b, 0.9);
    
    // Inner symbol based on type
    switch (attackType) {
      case 'siege':
        // Explosion shape - small star
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2;
          const sx = ix + Math.cos(a) * iconSize * 0.6;
          const sy = iy + Math.sin(a) * iconSize * 0.6;
          this.shapeRenderer.circle(sx, sy, 1 / camera.zoom, 1, 1, 1, 0.9);
        }
        break;
      case 'normal':
        // Crosshair
        this.shapeRenderer.circle(ix, iy, iconSize * 0.4, 1, 1, 1, 0.9);
        break;
      case 'magic':
        // Sparkle
        this.shapeRenderer.circle(ix, iy, iconSize * 0.3, 1, 1, 1, 0.9);
        break;
      case 'piercing':
        // Arrow point
        this.shapeRenderer.circle(ix, iy, iconSize * 0.35, 1, 1, 1, 0.9);
        break;
    }
  }
  
  _renderEnemies(data) {
    if (!data.enemies) return;
    
    const camera = this.camera;
    const time = this.frameCount * 0.05; // Smooth animation time
    
    this.shapeRenderer.begin('triangles', camera);
    
    for (const enemy of data.enemies) {
      if (!camera.isVisible(enemy.x - enemy.size * 2, enemy.y - enemy.size * 2, enemy.size * 4, enemy.size * 4)) continue;
      
      const color = this._parseColor(enemy.color);
      const size = enemy.size;
      
      // Check status effects (new system)
      const hasBurn = this._hasStatusEffect(enemy, 'burn');
      const hasPoison = this._hasStatusEffect(enemy, 'poison');
      const hasSlow = this._hasStatusEffect(enemy, 'slow');
      const hasFreeze = this._hasStatusEffect(enemy, 'freeze');
      const hasShock = this._hasStatusEffect(enemy, 'shock');
      const hasCurse = this._hasStatusEffect(enemy, 'curse');
      
      // Shadow
      this.shapeRenderer.circle(enemy.x, enemy.y + size * 0.8, size * 0.8, 0, 0, 0, 0.3);
      
      // Body with status tint
      let bodyR = color.r, bodyG = color.g, bodyB = color.b;
      if (hasFreeze) {
        // Frozen - blue tint
        bodyR = bodyR * 0.5 + 0.2;
        bodyG = bodyG * 0.5 + 0.4;
        bodyB = 0.9;
      } else if (hasBurn) {
        // Burning - orange tint
        const flicker = Math.sin(time * 6) * 0.15;
        bodyR = Math.min(1, bodyR + 0.3 + flicker);
        bodyG = bodyG * 0.7;
        bodyB = bodyB * 0.5;
      }
      this.shapeRenderer.circle(enemy.x, enemy.y, size, bodyR, bodyG, bodyB, 1);
      
      // Border
      this.shapeRenderer.circleOutline(enemy.x, enemy.y, size, 1 / camera.zoom, 0, 0, 0, 0.4);
      
      // === STATUS EFFECT VISUALS ===
      
      // BURN - animated fire particles around enemy
      if (hasBurn) {
        const burnEffect = this._getStatusEffect(enemy, 'burn');
        const stacks = burnEffect?.stacks || 1;
        // Multiple flame particles based on stacks
        for (let i = 0; i < Math.min(stacks, 5); i++) {
          const angle = (time * 3 + i * (Math.PI * 2 / stacks)) % (Math.PI * 2);
          const flameX = enemy.x + Math.cos(angle) * (size + 3);
          const flameY = enemy.y + Math.sin(angle) * (size + 3);
          const flicker = Math.sin(time * 10 + i * 2) * 2;
          // Flame core
          this.shapeRenderer.circle(flameX, flameY - flicker, 3, 1, 0.5, 0.1, 0.9);
          // Flame glow
          this.shapeRenderer.circle(flameX, flameY - flicker, 5, 1, 0.3, 0, 0.3);
        }
        // Fire ring
        const fireAlpha = 0.3 + Math.sin(time * 8) * 0.1;
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 2, 2 / camera.zoom, 1, 0.4, 0.1, fireAlpha);
      }
      
      // POISON - green bubbling effect
      if (hasPoison) {
        const poisonEffect = this._getStatusEffect(enemy, 'poison');
        const stacks = poisonEffect?.stacks || 1;
        // Poison aura
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 3, 2 / camera.zoom, 0.3, 0.8, 0.2, 0.5);
        // Bubble particles
        for (let i = 0; i < Math.min(stacks * 2, 6); i++) {
          const bubbleTime = (time * 2 + i * 0.5) % 3;
          const bubbleY = enemy.y + size - bubbleTime * 8;
          const bubbleX = enemy.x + Math.sin(time * 3 + i * 1.5) * (size * 0.5);
          const bubbleAlpha = Math.max(0, 1 - bubbleTime / 3);
          const bubbleSize = 2 + bubbleTime * 0.5;
          this.shapeRenderer.circle(bubbleX, bubbleY, bubbleSize, 0.4, 0.9, 0.3, bubbleAlpha * 0.7);
        }
      }
      
      // SLOW - blue spiral
      if (hasSlow && !hasFreeze) {
        const slowAlpha = 0.4 + Math.sin(time * 4) * 0.1;
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 2, 2 / camera.zoom, 0.4, 0.7, 0.95, slowAlpha);
        // Ice crystals
        for (let i = 0; i < 3; i++) {
          const angle = time * 2 + i * (Math.PI * 2 / 3);
          const crystalX = enemy.x + Math.cos(angle) * (size + 4);
          const crystalY = enemy.y + Math.sin(angle) * (size + 4);
          this.shapeRenderer.circle(crystalX, crystalY, 2, 0.7, 0.9, 1, 0.6);
        }
      }
      
      // FREEZE - solid ice effect
      if (hasFreeze) {
        // Ice shell
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 1, 3 / camera.zoom, 0.6, 0.9, 1, 0.8);
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 4, 2 / camera.zoom, 0.4, 0.7, 1, 0.4);
        // Ice crystals
        for (let i = 0; i < 6; i++) {
          const angle = i * (Math.PI / 3);
          const crystalX = enemy.x + Math.cos(angle) * (size + 5);
          const crystalY = enemy.y + Math.sin(angle) * (size + 5);
          this.shapeRenderer.circle(crystalX, crystalY, 3, 0.8, 0.95, 1, 0.7);
        }
      }
      
      // SHOCK - electric sparks
      if (hasShock) {
        const sparkAlpha = 0.5 + Math.sin(time * 20) * 0.3;
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 2, 2 / camera.zoom, 1, 1, 0.3, sparkAlpha);
        // Lightning bolts
        for (let i = 0; i < 4; i++) {
          const angle = (time * 15 + i * (Math.PI / 2)) % (Math.PI * 2);
          const boltX = enemy.x + Math.cos(angle) * (size + 6);
          const boltY = enemy.y + Math.sin(angle) * (size + 6);
          if (Math.random() > 0.5) {
            this.shapeRenderer.circle(boltX, boltY, 2, 1, 1, 0.5, 0.8);
          }
        }
      }
      
      // CURSE - dark aura
      if (hasCurse) {
        const curseAlpha = 0.3 + Math.sin(time * 2) * 0.1;
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 4, 3 / camera.zoom, 0.4, 0.1, 0.5, curseAlpha);
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 6, 2 / camera.zoom, 0.3, 0, 0.4, curseAlpha * 0.5);
      }
      
      // Fallback to legacy effects
      if (!hasBurn && enemy.burnDuration > 0) {
        const flicker = Math.sin(this.frameCount * 0.3) * 2;
        this.shapeRenderer.circle(enemy.x + flicker, enemy.y - size - 3, 3, 0.96, 0.4, 0.4, 1);
      }
      if (!hasSlow && enemy.slowDuration > 0) {
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 2, 2 / camera.zoom, 0.39, 0.7, 0.93, 0.8);
      }
      if (!hasPoison && enemy.poisonDuration > 0) {
        this.shapeRenderer.circleOutline(enemy.x, enemy.y, size + 3, 2 / camera.zoom, 0.2, 0.8, 0.3, 0.6);
      }
      
      // Health bar
      const hpRatio = enemy.maxHealth > 0 ? enemy.health / enemy.maxHealth : (enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1);
      const barWidth = size * 2;
      const barHeight = 4;
      const barY = enemy.y - size - 8;
      
      // Background
      this.shapeRenderer.rect(enemy.x - barWidth/2, barY, barWidth, barHeight, 0.2, 0.2, 0.2, 0.8);
      
      // Health fill
      const hpColor = hpRatio > 0.5 ? { r: 0.3, g: 0.8, b: 0.3 } :
                      hpRatio > 0.25 ? { r: 0.9, g: 0.7, b: 0.2 } :
                      { r: 0.9, g: 0.3, b: 0.3 };
      this.shapeRenderer.rect(enemy.x - barWidth/2, barY, barWidth * Math.max(0, hpRatio), barHeight, hpColor.r, hpColor.g, hpColor.b, 1);
      
      // Status effect icons above health bar
      this._renderStatusIcons(enemy, barY - 8);
    }
    
    this.shapeRenderer.end();
  }
  
  /**
   * Check if enemy has a specific status effect
   */
  _hasStatusEffect(enemy, type) {
    if (enemy.statusEffects && enemy.statusEffects.length > 0) {
      return enemy.statusEffects.some(e => e.type === type);
    }
    // Fallback to legacy
    if (type === 'burn') return enemy.burnDuration > 0;
    if (type === 'slow') return enemy.slowDuration > 0;
    if (type === 'poison') return enemy.poisonDuration > 0;
    return false;
  }
  
  /**
   * Get status effect data
   */
  _getStatusEffect(enemy, type) {
    if (enemy.statusEffects && enemy.statusEffects.length > 0) {
      return enemy.statusEffects.find(e => e.type === type);
    }
    return null;
  }
  
  /**
   * Render status effect icons above enemy
   */
  _renderStatusIcons(enemy, y) {
    if (!enemy.statusEffects || enemy.statusEffects.length === 0) return;
    
    // Icons are rendered in text overlay later
    // This is placeholder for shape-based indicators
  }
  
  _renderProjectiles(data) {
    if (!data.projectiles) return;
    
    this.shapeRenderer.begin('triangles', this.camera);
    
    for (const proj of data.projectiles) {
      const color = this._parseColor(proj.color || '#fff');
      const size = proj.size || 4;
      
      // Trail
      if (proj.trail && proj.trail.length > 1) {
        for (let i = 1; i < proj.trail.length; i++) {
          const alpha = i / proj.trail.length * 0.5;
          this.shapeRenderer.line(
            proj.trail[i-1].x, proj.trail[i-1].y,
            proj.trail[i].x, proj.trail[i].y,
            2 / this.camera.zoom, color.r, color.g, color.b, alpha
          );
        }
        // Last segment to current position
        const last = proj.trail[proj.trail.length - 1];
        this.shapeRenderer.line(last.x, last.y, proj.x, proj.y, 2 / this.camera.zoom, color.r, color.g, color.b, 0.5);
      }
      
      // Projectile body
      this.shapeRenderer.circle(proj.x, proj.y, size, color.r, color.g, color.b, 1);
      
      // Glow
      this.shapeRenderer.circle(proj.x, proj.y, size * 2, color.r, color.g, color.b, 0.3);
      
      // Emit trail particle
      this.particles.emit('trail', proj.x, proj.y, {
        count: 1,
        startColor: [color.r, color.g, color.b, 0.5],
        endColor: [color.r, color.g, color.b, 0],
      });
    }
    
    this.shapeRenderer.end();
  }
  
  _renderEffects(data) {
    if (!data.effects) return;
    
    this.shapeRenderer.begin('triangles', this.camera);
    
    for (const effect of data.effects) {
      const progress = effect.elapsed / effect.duration;
      const alpha = 1 - progress;
      
      switch (effect.type) {
        case 'explosion':
          const expandedRadius = effect.radius * (0.5 + progress * 0.5);
          const color = this._parseColor(effect.color || '#ff6600');
          
          // Outer glow
          this.shapeRenderer.circle(effect.x, effect.y, expandedRadius, color.r, color.g * 0.6, 0, alpha * 0.5);
          // Inner
          this.shapeRenderer.circle(effect.x, effect.y, expandedRadius * 0.6, color.r, color.g, 0, alpha * 0.8);
          // Core
          this.shapeRenderer.circle(effect.x, effect.y, expandedRadius * 0.3, 1, 1, 0.8, alpha);
          break;
          
        case 'lightning':
          // Lightning bolt effect (simplified)
          if (effect.target) {
            const segments = 5;
            let prevX = effect.x;
            let prevY = effect.y;
            const dx = (effect.target.x - effect.x) / segments;
            const dy = (effect.target.y - effect.y) / segments;
            
            for (let i = 1; i <= segments; i++) {
              const nextX = effect.x + dx * i + (i < segments ? (Math.random() - 0.5) * 20 : 0);
              const nextY = effect.y + dy * i + (i < segments ? (Math.random() - 0.5) * 20 : 0);
              this.shapeRenderer.line(prevX, prevY, nextX, nextY, 3 / this.camera.zoom, 0.8, 0.9, 1, alpha);
              prevX = nextX;
              prevY = nextY;
            }
          }
          break;
          
        case 'ice':
          const iceRadius = effect.radius || 30;
          this.shapeRenderer.circle(effect.x, effect.y, iceRadius * (1 - progress * 0.3), 0.6, 0.85, 1, alpha * 0.5);
          break;
          
        case 'nature':
        case 'poison':
          const natureRadius = effect.radius || 25;
          this.shapeRenderer.circle(effect.x, effect.y, natureRadius, 0.2, 0.7, 0.3, alpha * 0.4);
          break;
      }
    }
    
    this.shapeRenderer.end();
  }
  
  _renderDamageNumbers(data) {
    if (!data.damageNumbers || data.damageNumbers.length === 0) return;
    
    // Use Canvas2D overlay for text
    this.textCtx.clearRect(0, 0, this.width, this.height);
    
    for (const num of data.damageNumbers) {
      const screen = this.camera.worldToScreen(num.x, num.y);
      
      this.textCtx.save();
      this.textCtx.globalAlpha = num.alpha;
      
      const fontSize = (num.fontSize || 14) * (num.scale || 1);
      this.textCtx.font = `bold ${fontSize}px Arial, sans-serif`;
      this.textCtx.textAlign = 'center';
      this.textCtx.textBaseline = 'middle';
      
      // Build text with optional prefix (emoji for DoT)
      let text;
      if (num.type === 'dot' && num.prefix) {
        text = `${num.prefix}${num.value}`;
      } else {
        text = num.isCrit ? `${num.value}!` : String(num.value);
      }
      
      // Outline
      this.textCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      this.textCtx.lineWidth = num.type === 'dot' ? 2 : 3;
      this.textCtx.strokeText(text, screen.x, screen.y);
      
      // Fill
      this.textCtx.fillStyle = num.color || '#fff';
      this.textCtx.fillText(text, screen.x, screen.y);
      
      this.textCtx.restore();
    }
    
    // Draw text canvas over WebGL
    this._drawTextOverlay();
  }
  
  _drawTextOverlay() {
    // Composite text canvas onto WebGL canvas via a separate overlay
    // Note: WebGL canvas cannot use getContext('2d'), so we position overlay canvas on top
    if (this.textOverlayCanvas) {
      const overlayCtx = this.textOverlayCanvas.getContext('2d');
      if (overlayCtx) {
        overlayCtx.clearRect(0, 0, this.width, this.height);
        overlayCtx.drawImage(this.textCanvas, 0, 0);
      }
    }
  }
  
  // ============================================
  // UI RENDERING
  // ============================================
  
  _renderHoverIndicator() {
    if (this.hoverGridX < 0 || this.hoverGridY < 0) return;
    
    const gridSize = CONFIG.GRID_SIZE;
    const x = this.hoverGridX * gridSize;
    const y = this.hoverGridY * gridSize;
    
    // Use pre-calculated cells if available (from PlacementManager)
    let cells = this.hoverCells;
    let gw = 1, gh = 1;
    
    if (!cells) {
      // Fallback: calculate cells from building definition
      if (this.hoverBuildingType) {
        const ENERGY_BUILDINGS = require('../modules/energy/building-defs').ENERGY_BUILDINGS;
        const def = ENERGY_BUILDINGS[this.hoverBuildingType];
        if (def) {
          gw = def.gridWidth || 1;
          gh = def.gridHeight || 1;
          const shape = def.shape || 'rect';
          
          cells = [];
          if (shape === 'L' && gw === 2 && gh === 2) {
            // L-shape: top-left, bottom-left, bottom-right
            cells = [
              { x: this.hoverGridX, y: this.hoverGridY },
              { x: this.hoverGridX, y: this.hoverGridY + 1 },
              { x: this.hoverGridX + 1, y: this.hoverGridY + 1 }
            ];
          } else {
            // Rectangular
            for (let dy = 0; dy < gh; dy++) {
              for (let dx = 0; dx < gw; dx++) {
                cells.push({ x: this.hoverGridX + dx, y: this.hoverGridY + dy });
              }
            }
          }
        }
      }
      
      // Default: single cell
      if (!cells) {
        cells = [{ x: this.hoverGridX, y: this.hoverGridY }];
      }
    }
    
    this.shapeRenderer.begin('triangles', this.camera);
    
    const colorOk = { r: 0.28, g: 0.73, b: 0.47 };
    const colorBad = { r: 0.96, g: 0.4, b: 0.4 };
    const color = this.canPlaceHover ? colorOk : colorBad;
    
    // Render all cells
    for (const cell of cells) {
      const cx = cell.x * gridSize;
      const cy = cell.y * gridSize;
      this.shapeRenderer.rect(cx, cy, gridSize, gridSize, color.r, color.g, color.b, 0.3);
      this.shapeRenderer.rectOutline(cx, cy, gridSize, gridSize, 2 / this.camera.zoom, color.r, color.g, color.b, 1);
    }
    
    // Calculate center for range preview
    let centerX, centerY;
    if (cells.length === 3) {
      // L-shape center (at junction)
      centerX = x + gridSize;
      centerY = y + gridSize;
    } else if (cells.length > 1) {
      // Multi-cell: geometric center
      const minX = Math.min(...cells.map(c => c.x)) * gridSize;
      const maxX = (Math.max(...cells.map(c => c.x)) + 1) * gridSize;
      const minY = Math.min(...cells.map(c => c.y)) * gridSize;
      const maxY = (Math.max(...cells.map(c => c.y)) + 1) * gridSize;
      centerX = (minX + maxX) / 2;
      centerY = (minY + maxY) / 2;
    } else {
      // Single cell center
      centerX = x + gridSize / 2;
      centerY = y + gridSize / 2;
    }
    
    // Preview range based on building type
    if (this.canPlaceHover) {
      let previewRange;
      let rangeColor = { r: color.r, g: color.g, b: color.b };
      
      if (this.hoverBuildingType) {
        // Energy building - show connection range in tiles * gridSize
        const ENERGY_BUILDINGS = require('../modules/energy/building-defs').ENERGY_BUILDINGS;
        const def = ENERGY_BUILDINGS[this.hoverBuildingType];
        if (def && def.range) {
          previewRange = def.range * gridSize; // Convert tiles to pixels
          rangeColor = { r: 0.29, g: 0.56, b: 0.85 }; // Blue for energy range
        } else {
          previewRange = CONFIG.TOWER_BASE_RANGE || 60;
        }
      } else {
        // Tower - show attack range
        previewRange = CONFIG.TOWER_BASE_RANGE || 60;
      }
      
      this.shapeRenderer.circleOutline(centerX, centerY, previewRange, 1 / this.camera.zoom, rangeColor.r, rangeColor.g, rangeColor.b, 0.4);
      // Also draw filled circle for better visibility
      this.shapeRenderer.circle(centerX, centerY, previewRange, rangeColor.r, rangeColor.g, rangeColor.b, 0.08);
    }
    
    this.shapeRenderer.end();
  }
  
  _renderRangeIndicator(data) {
    // Tower range indicator (yellow)
    if (data.selectedTower) {
      const tower = data.selectedTower;
      this.shapeRenderer.begin('triangles', this.camera);
      this.shapeRenderer.circle(tower.x, tower.y, tower.range, 1, 0.84, 0, 0.1);
      this.shapeRenderer.circleOutline(tower.x, tower.y, tower.range, 1 / this.camera.zoom, 1, 0.84, 0, 0.3);
      this.shapeRenderer.end();
    }
    
    // Energy building connection range indicator (blue)
    if (data.selectedEnergyBuilding) {
      const building = data.selectedEnergyBuilding;
      const gridSize = CONFIG.GRID_SIZE;
      
      // Use worldX/worldY or x/y for center position
      const centerX = building.worldX ?? building.x;
      const centerY = building.worldY ?? building.y;
      const rangeInTiles = building.getEffectiveRange?.() || building.range || 4;
      const range = rangeInTiles * gridSize; // Convert tiles to pixels
      
      this.shapeRenderer.begin('triangles', this.camera);
      this.shapeRenderer.circle(centerX, centerY, range, 0.29, 0.56, 0.85, 0.1);
      this.shapeRenderer.circleOutline(centerX, centerY, range, 1.5 / this.camera.zoom, 0.29, 0.56, 0.85, 0.5);
      this.shapeRenderer.end();
    }
  }
  
  _renderMinimap(data) {
    const minimapSize = 80;
    const margin = 10;
    const x = this.width - minimapSize - margin;
    const y = this.height - minimapSize - margin;
    const scale = minimapSize / CONFIG.MAP_WIDTH;
    
    // Screen space rendering
    this.shapeRenderer.setProjection(this.width, this.height);
    this.shapeRenderer.begin('triangles');
    
    // Background
    this.shapeRenderer.rect(x, y, minimapSize, minimapSize, 0, 0, 0, 0.5);
    
    // Path
    if (data.pathCells) {
      const pathColor = this._parseColor(CONFIG.COLORS.path);
      for (const cell of data.pathCells) {
        this.shapeRenderer.rect(
          x + cell.x * CONFIG.GRID_SIZE * scale,
          y + cell.y * CONFIG.GRID_SIZE * scale,
          Math.max(1, CONFIG.GRID_SIZE * scale),
          Math.max(1, CONFIG.GRID_SIZE * scale),
          pathColor.r, pathColor.g, pathColor.b, 0.8
        );
      }
    }
    
    // Towers
    if (data.towers) {
      for (const tower of data.towers) {
        this.shapeRenderer.circle(x + tower.x * scale, y + tower.y * scale, 2, 0.28, 0.73, 0.47, 1);
      }
    }
    
    // Enemies
    if (data.enemies) {
      for (const enemy of data.enemies) {
        this.shapeRenderer.circle(x + enemy.x * scale, y + enemy.y * scale, 1.5, 0.99, 0.5, 0.5, 1);
      }
    }
    
    // Viewport rectangle
    if (this.camera) {
      const visible = this.camera.getVisibleArea();
      this.shapeRenderer.rectOutline(
        x + visible.x * scale,
        y + visible.y * scale,
        visible.width * scale,
        visible.height * scale,
        1, 1, 1, 1, 1
      );
    }
    
    // Border
    this.shapeRenderer.rectOutline(x, y, minimapSize, minimapSize, 1, 1, 1, 1, 0.3);
    
    this.shapeRenderer.end();
  }
  
  _renderFps() {
    // Use text overlay canvas for FPS display
    if (!this.textOverlayCanvas) return;
    const ctx = this.textOverlayCanvas.getContext('2d');
    if (!ctx) return;
    
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(5, 5, 100, 55);
    
    // FPS
    ctx.fillStyle = this.stats.fps >= 50 ? '#4ade80' : this.stats.fps >= 30 ? '#fbbf24' : '#ef4444';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`FPS: ${this.stats.fps}`, 10, 22);
    
    // Draw calls
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(`Draw: ${this.stats.drawCalls}`, 10, 38);
    
    // Particles
    ctx.fillText(`Particles: ${this.particles.activeCount}`, 10, 52);
  }
  
  // ============================================
  // UTILITY METHODS
  // ============================================
  
  _parseColor(color) {
    if (!color) return { r: 1, g: 1, b: 1, a: 1 };
    
    // Handle hex
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16) / 255,
          g: parseInt(hex[1] + hex[1], 16) / 255,
          b: parseInt(hex[2] + hex[2], 16) / 255,
          a: 1,
        };
      }
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
    
    // Handle rgba()
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      return {
        r: parseInt(match[1]) / 255,
        g: parseInt(match[2]) / 255,
        b: parseInt(match[3]) / 255,
        a: match[4] ? parseFloat(match[4]) : 1,
      };
    }
    
    return { r: 1, g: 1, b: 1, a: 1 };
  }
  
  /**
   * Emit particle effect (public API)
   */
  emitEffect(type, x, y, options = {}) {
    this.particles.emit(type, x, y, options);
  }
  
  /**
   * Set hover position
   * @param {number} gridX - Grid X
   * @param {number} gridY - Grid Y  
   * @param {boolean} canPlace - Can place here
   * @param {string|null} buildingType - Building type ID (for size)
   * @param {Array|null} cells - Pre-calculated cells from PlacementManager
   */
  setHover(gridX, gridY, canPlace, buildingType = null, cells = null) {
    this.hoverGridX = gridX;
    this.hoverGridY = gridY;
    this.canPlaceHover = canPlace;
    this.hoverBuildingType = buildingType;
    this.hoverCells = cells; // Optional pre-calculated cells
  }
  
  /**
   * Clear hover
   */
  clearHover() {
    this.hoverGridX = -1;
    this.hoverGridY = -1;
    this.hoverBuildingType = null;
    this.hoverCells = null;
  }
  
  /**
   * Convert screen coords to world coords
   */
  screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const canvasX = (screenX - rect.left) * scaleX;
    const canvasY = (screenY - rect.top) * scaleY;
    
    if (this.camera) {
      return this.camera.screenToWorld(canvasX, canvasY);
    }
    return { x: canvasX, y: canvasY };
  }
  
  /**
   * Convert screen coords to grid coords
   */
  screenToGrid(screenX, screenY) {
    const world = this.screenToWorld(screenX, screenY);
    const gridSize = CONFIG.GRID_SIZE;
    return {
      gridX: Math.floor(world.x / gridSize),
      gridY: Math.floor(world.y / gridSize),
      worldX: world.x,
      worldY: world.y,
    };
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
   * Toggle FPS display
   */
  toggleFps() {
    this.showFps = !this.showFps;
  }
  
  /**
   * Get stats
   */
  getStats() {
    return {
      fps: this.stats.fps,
      frameTime: this.stats.frameTime.toFixed(2) + 'ms',
      drawCalls: this.stats.drawCalls,
      particles: this.particles.activeCount,
      webgl: this.glContext.getInfo(),
    };
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

module.exports = { GameRenderer };
