/**
 * Power Towers TD - UI Renderer
 * 
 * Renders UI elements: hover indicator, range indicators, minimap, FPS.
 */

const CONFIG = require('../../core/config/index');

/**
 * Mixin for UI rendering methods
 * @param {Class} Base - Base GameRenderer class
 */
function UIRendererMixin(Base) {
  return class extends Base {
    
    /**
     * Render hover placement indicator
     */
    _renderHoverIndicator() {
      if (this.hoverGridX < 0 || this.hoverGridY < 0) return;
      
      const gridSize = CONFIG.GRID_SIZE;
      const x = this.hoverGridX * gridSize;
      const y = this.hoverGridY * gridSize;
      
      // Use pre-calculated cells if available
      let cells = this.hoverCells;
      
      if (!cells) {
        // Fallback: calculate cells from building definition
        if (this.hoverBuildingType) {
          const ENERGY_BUILDINGS = require('../../modules/energy/building-defs').ENERGY_BUILDINGS;
          const def = ENERGY_BUILDINGS[this.hoverBuildingType];
          if (def) {
            const gw = def.gridWidth || 1;
            const gh = def.gridHeight || 1;
            const shape = def.shape || 'rect';
            
            cells = [];
            if (shape === 'L' && gw === 2 && gh === 2) {
              cells = [
                { x: this.hoverGridX, y: this.hoverGridY },
                { x: this.hoverGridX, y: this.hoverGridY + 1 },
                { x: this.hoverGridX + 1, y: this.hoverGridY + 1 }
              ];
            } else {
              for (let dy = 0; dy < gh; dy++) {
                for (let dx = 0; dx < gw; dx++) {
                  cells.push({ x: this.hoverGridX + dx, y: this.hoverGridY + dy });
                }
              }
            }
          }
        }
        
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
        centerX = x + gridSize;
        centerY = y + gridSize;
      } else if (cells.length > 1) {
        const minX = Math.min(...cells.map(c => c.x)) * gridSize;
        const maxX = (Math.max(...cells.map(c => c.x)) + 1) * gridSize;
        const minY = Math.min(...cells.map(c => c.y)) * gridSize;
        const maxY = (Math.max(...cells.map(c => c.y)) + 1) * gridSize;
        centerX = (minX + maxX) / 2;
        centerY = (minY + maxY) / 2;
      } else {
        centerX = x + gridSize / 2;
        centerY = y + gridSize / 2;
      }
      
      // Preview range
      if (this.canPlaceHover) {
        let previewRange;
        let rangeColor = { r: color.r, g: color.g, b: color.b };
        
        if (this.hoverBuildingType) {
          const ENERGY_BUILDINGS = require('../../modules/energy/building-defs').ENERGY_BUILDINGS;
          const def = ENERGY_BUILDINGS[this.hoverBuildingType];
          if (def && def.range) {
            previewRange = def.range * gridSize;
            rangeColor = { r: 0.29, g: 0.56, b: 0.85 };
          } else {
            previewRange = CONFIG.TOWER_BASE_RANGE || 60;
          }
        } else {
          previewRange = CONFIG.TOWER_BASE_RANGE || 60;
        }
        
        this.shapeRenderer.circleOutline(centerX, centerY, previewRange, 1 / this.camera.zoom, rangeColor.r, rangeColor.g, rangeColor.b, 0.4);
        this.shapeRenderer.circle(centerX, centerY, previewRange, rangeColor.r, rangeColor.g, rangeColor.b, 0.08);
      }
      
      this.shapeRenderer.end();
    }
    
    /**
     * Render range indicator for selected entities
     */
    _renderRangeIndicator(data) {
      // Tower range (yellow)
      if (data.selectedTower) {
        const tower = data.selectedTower;
        this.shapeRenderer.begin('triangles', this.camera);
        this.shapeRenderer.circle(tower.x, tower.y, tower.range, 1, 0.84, 0, 0.1);
        this.shapeRenderer.circleOutline(tower.x, tower.y, tower.range, 1 / this.camera.zoom, 1, 0.84, 0, 0.3);
        this.shapeRenderer.end();
      }
      
      // Energy building range (blue)
      if (data.selectedEnergyBuilding) {
        const building = data.selectedEnergyBuilding;
        const gridSize = CONFIG.GRID_SIZE;
        
        const centerX = building.worldX ?? building.x;
        const centerY = building.worldY ?? building.y;
        const rangeInTiles = building.getEffectiveRange?.() || building.range || 4;
        const range = rangeInTiles * gridSize;
        
        this.shapeRenderer.begin('triangles', this.camera);
        this.shapeRenderer.circle(centerX, centerY, range, 0.29, 0.56, 0.85, 0.1);
        this.shapeRenderer.circleOutline(centerX, centerY, range, 1.5 / this.camera.zoom, 0.29, 0.56, 0.85, 0.5);
        this.shapeRenderer.end();
      }
    }
    
    /**
     * Render minimap
     */
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
    
    /**
     * Render FPS counter
     */
    _renderFps() {
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
    
    /**
     * Set hover position
     */
    setHover(gridX, gridY, canPlace, buildingType = null, cells = null) {
      this.hoverGridX = gridX;
      this.hoverGridY = gridY;
      this.canPlaceHover = canPlace;
      this.hoverBuildingType = buildingType;
      this.hoverCells = cells;
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
  };
}

module.exports = { UIRendererMixin };
