/**
 * Power Towers TD - Terrain Renderer
 * 
 * Renders terrain layers: biomes, grid, path, decorations, walls.
 */

const CONFIG = require('../../core/config');
const { BIOME_COLORS, BIOME_VARIANTS } = require('../utils/color-utils');

/**
 * Mixin for terrain rendering methods
 * @param {Class} Base - Base GameRenderer class
 */
function TerrainRendererMixin(Base) {
  return class extends Base {
    
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
    
    /**
     * Render biome tiles
     */
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
    
    /**
     * Render grid lines
     */
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
    
    /**
     * Render road path
     */
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
      const roadBase = { r: 0.32, g: 0.30, b: 0.28 };
      const roadDark = { r: 0.25, g: 0.23, b: 0.21 };
      const roadLight = { r: 0.38, g: 0.36, b: 0.34 };
      const borderOuter = { r: 0.45, g: 0.40, b: 0.35 };
      const borderInner = { r: 0.28, g: 0.25, b: 0.22 };
      
      const borderWidth = 3;
      
      // First pass: Draw the road surface for all cells
      for (const cell of data.pathCells) {
        const cx = cell.x * gridSize;
        const cy = cell.y * gridSize;
        
        const hash = (cell.x * 17 + cell.y * 31) % 100;
        const baseColor = hash < 50 ? roadBase : (hash < 80 ? roadDark : roadLight);
        
        this.shapeRenderer.rect(cx, cy, gridSize, gridSize, baseColor.r, baseColor.g, baseColor.b, 1);
      }
      
      // Second pass: Draw borders only on outer edges
      for (const cell of data.pathCells) {
        const cx = cell.x * gridSize;
        const cy = cell.y * gridSize;
        
        const hasTop = this._pathCellSet.has(`${cell.x},${cell.y - 1}`);
        const hasBottom = this._pathCellSet.has(`${cell.x},${cell.y + 1}`);
        const hasLeft = this._pathCellSet.has(`${cell.x - 1},${cell.y}`);
        const hasRight = this._pathCellSet.has(`${cell.x + 1},${cell.y}`);
        
        // Top border
        if (!hasTop) {
          this.shapeRenderer.rect(cx, cy, gridSize, borderWidth, borderOuter.r, borderOuter.g, borderOuter.b, 1);
          this.shapeRenderer.rect(cx, cy + borderWidth, gridSize, 1, borderInner.r, borderInner.g, borderInner.b, 0.6);
        }
        
        // Bottom border
        if (!hasBottom) {
          this.shapeRenderer.rect(cx, cy + gridSize - borderWidth - 1, gridSize, 1, borderInner.r, borderInner.g, borderInner.b, 0.4);
          this.shapeRenderer.rect(cx, cy + gridSize - borderWidth, gridSize, borderWidth, borderOuter.r, borderOuter.g, borderOuter.b, 1);
        }
        
        // Left border
        if (!hasLeft) {
          this.shapeRenderer.rect(cx, cy, borderWidth, gridSize, borderOuter.r, borderOuter.g, borderOuter.b, 1);
          this.shapeRenderer.rect(cx + borderWidth, cy, 1, gridSize, borderInner.r, borderInner.g, borderInner.b, 0.5);
        }
        
        // Right border
        if (!hasRight) {
          this.shapeRenderer.rect(cx + gridSize - borderWidth - 1, cy, 1, gridSize, borderInner.r, borderInner.g, borderInner.b, 0.3);
          this.shapeRenderer.rect(cx + gridSize - borderWidth, cy, borderWidth, gridSize, borderOuter.r, borderOuter.g, borderOuter.b, 1);
        }
        
        // Corner overlaps
        if (!hasTop && !hasLeft) {
          this.shapeRenderer.rect(cx, cy, borderWidth, borderWidth, borderOuter.r * 1.1, borderOuter.g * 1.1, borderOuter.b * 1.1, 1);
        }
        if (!hasTop && !hasRight) {
          this.shapeRenderer.rect(cx + gridSize - borderWidth, cy, borderWidth, borderWidth, borderOuter.r * 1.1, borderOuter.g * 1.1, borderOuter.b * 1.1, 1);
        }
        if (!hasBottom && !hasLeft) {
          this.shapeRenderer.rect(cx, cy + gridSize - borderWidth, borderWidth, borderWidth, borderOuter.r * 1.1, borderOuter.g * 1.1, borderOuter.b * 1.1, 1);
        }
        if (!hasBottom && !hasRight) {
          this.shapeRenderer.rect(cx + gridSize - borderWidth, cy + gridSize - borderWidth, borderWidth, borderWidth, borderOuter.r * 1.1, borderOuter.g * 1.1, borderOuter.b * 1.1, 1);
        }
      }
      
      // Third pass: Add subtle road details
      for (const cell of data.pathCells) {
        const cx = cell.x * gridSize;
        const cy = cell.y * gridSize;
        const hash = (cell.x * 13 + cell.y * 29) % 100;
        
        if (hash < 8) {
          const wx = cx + gridSize * 0.3 + (hash % 8);
          const wy = cy + gridSize * 0.4 + ((hash * 2) % 8);
          this.shapeRenderer.circle(wx, wy, 2, roadDark.r, roadDark.g, roadDark.b, 0.4);
        }
        
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
    
    /**
     * Render biome decorations (trees, rocks, etc.)
     */
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
          if (this._isPathCell(x, y)) continue;
          
          const biome = data.biomeMap[y]?.[x];
          if (!biome) continue;
          
          const cellX = x * gridSize;
          const cellY = y * gridSize;
          const hash = (x * 31 + y * 17) % 100;
          const hash2 = (x * 13 + y * 23) % 100;
          
          this._renderBiomeDecoration(biome, cellX, cellY, gridSize, hash, hash2);
        }
      }
      
      this.shapeRenderer.end();
    }
    
    /**
     * Render decoration for specific biome
     */
    _renderBiomeDecoration(biome, cellX, cellY, gridSize, hash, hash2) {
      switch (biome) {
        case 'forest':
          this._renderForestDecoration(cellX, cellY, gridSize, hash, hash2);
          break;
        case 'desert':
          this._renderDesertDecoration(cellX, cellY, gridSize, hash, hash2);
          break;
        case 'mountains':
          this._renderMountainDecoration(cellX, cellY, gridSize, hash, hash2);
          break;
        case 'plains':
          this._renderPlainsDecoration(cellX, cellY, gridSize, hash, hash2);
          break;
        case 'burned':
          this._renderBurnedDecoration(cellX, cellY, gridSize, hash, hash2);
          break;
        case 'water':
          this._renderWaterDecoration(cellX, cellY, gridSize, hash, hash2);
          break;
      }
    }
    
    _renderForestDecoration(cellX, cellY, gridSize, hash, hash2) {
      // Primary trees
      if (hash < 35) {
        const offsetX = (hash % 5) * gridSize / 6;
        const offsetY = ((hash * 3) % 5) * gridSize / 6;
        const treeX = cellX + gridSize * 0.2 + offsetX;
        const treeY = cellY + gridSize * 0.2 + offsetY;
        const size = gridSize * (0.22 + (hash % 10) * 0.01);
        
        this.shapeRenderer.circle(treeX + 2, treeY + 3, size * 0.9, 0.05, 0.12, 0.05, 0.4);
        this.shapeRenderer.circle(treeX, treeY, size, 0.08, 0.25, 0.08, 0.95);
        this.shapeRenderer.circle(treeX + size * 0.15, treeY + size * 0.15, size * 0.7, 0.06, 0.2, 0.06, 0.8);
        this.shapeRenderer.circle(treeX - size * 0.25, treeY - size * 0.25, size * 0.35, 0.18, 0.45, 0.18, 0.7);
      }
      // Bushes
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
    }
    
    _renderDesertDecoration(cellX, cellY, gridSize, hash, hash2) {
      // Sand dunes
      if (hash < 25) {
        const cx = cellX + gridSize * 0.5;
        const cy = cellY + gridSize * 0.5;
        this.shapeRenderer.circle(cx + 3, cy + 2, gridSize * 0.25, 0.65, 0.55, 0.35, 0.4);
        this.shapeRenderer.circle(cx, cy, gridSize * 0.22, 0.8, 0.7, 0.45, 0.6);
        this.shapeRenderer.circle(cx - 2, cy - 2, gridSize * 0.1, 0.9, 0.8, 0.55, 0.4);
      }
      // Cacti
      if (hash2 < 8) {
        const cx = cellX + gridSize * 0.3 + (hash2 % 8);
        const cy = cellY + gridSize * 0.4;
        this.shapeRenderer.rect(cx - 2, cy - 6, 4, 10, 0.2, 0.45, 0.2, 0.9);
        this.shapeRenderer.rect(cx - 1, cy - 5, 2, 8, 0.25, 0.5, 0.25, 0.8);
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
    }
    
    _renderMountainDecoration(cellX, cellY, gridSize, hash, hash2) {
      // Large rocks
      if (hash < 25) {
        const rx = cellX + gridSize * 0.3 + (hash % 4) * 2;
        const ry = cellY + gridSize * 0.4 + ((hash * 2) % 4) * 2;
        const size = gridSize * (0.15 + (hash % 8) * 0.01);
        this.shapeRenderer.circle(rx + 2, ry + 2, size, 0.2, 0.18, 0.2, 0.5);
        this.shapeRenderer.circle(rx, ry, size, 0.4, 0.38, 0.42, 0.9);
        this.shapeRenderer.circle(rx - size * 0.3, ry - size * 0.3, size * 0.4, 0.5, 0.48, 0.52, 0.6);
      }
      // Pebbles
      if (hash2 < 30 && hash >= 25) {
        const px = cellX + (hash2 % 16);
        const py = cellY + ((hash2 * 3) % 16);
        this.shapeRenderer.circle(px, py, 2, 0.35, 0.33, 0.38, 0.7);
      }
      // Cracks
      if (hash > 70) {
        const lx = cellX + 4;
        const ly = cellY + (hash % 12);
        this.shapeRenderer.rect(lx, ly, 1, 6, 0.25, 0.23, 0.28, 0.4);
      }
    }
    
    _renderPlainsDecoration(cellX, cellY, gridSize, hash, hash2) {
      // Grass patches
      if (hash < 15) {
        const gx = cellX + gridSize * 0.5;
        const gy = cellY + gridSize * 0.5;
        this.shapeRenderer.circle(gx + 1, gy + 1, 3, 0.25, 0.4, 0.2, 0.3);
        this.shapeRenderer.circle(gx, gy, 2.5, 0.4, 0.6, 0.3, 0.6);
      }
      // Flowers
      if (hash2 < 5) {
        const fx = cellX + gridSize * 0.3 + (hash2 % 10);
        const fy = cellY + gridSize * 0.6;
        const flowerColors = [
          { r: 0.9, g: 0.3, b: 0.3 },
          { r: 0.9, g: 0.9, b: 0.3 },
          { r: 0.6, g: 0.3, b: 0.8 },
          { r: 0.9, g: 0.6, b: 0.8 },
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
    }
    
    _renderBurnedDecoration(cellX, cellY, gridSize, hash, hash2) {
      // Ash piles
      if (hash < 25) {
        const ax = cellX + gridSize * 0.5 + (hash % 6) - 3;
        const ay = cellY + gridSize * 0.5 + ((hash * 2) % 6) - 3;
        this.shapeRenderer.circle(ax, ay, gridSize * 0.12, 0.12, 0.08, 0.08, 0.6);
      }
      // Embers
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
        const smokeY = sy - Math.sin(this.frameCount * 0.02 + cellX / gridSize) * 3;
        this.shapeRenderer.circle(sx, smokeY, 2, 0.3, 0.3, 0.35, 0.2);
      }
    }
    
    _renderWaterDecoration(cellX, cellY, gridSize, hash, hash2) {
      const x = cellX / gridSize;
      const y = cellY / gridSize;
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
      // Sparkles
      if (hash < 10) {
        const sparkle = Math.sin(this.frameCount * 0.1 + hash) * 0.5 + 0.5;
        const sx = cellX + (hash % 15) + 2;
        const sy = cellY + ((hash * 3) % 15) + 2;
        this.shapeRenderer.circle(sx, sy, 1, 1, 1, 1, sparkle * 0.4);
      }
    }
  };
}

module.exports = { TerrainRendererMixin };
