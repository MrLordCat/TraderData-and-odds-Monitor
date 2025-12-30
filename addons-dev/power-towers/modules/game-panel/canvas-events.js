/**
 * Power Towers TD - Canvas Event Handlers
 * Handles canvas click, move, wheel, pan events
 * 
 * OPTIMIZED: No direct renderGame() calls - uses dirty flags
 * Render happens on next game tick via requestAnimationFrame
 */

/**
 * Mixin for canvas event functionality
 * @param {Class} Base - GameController base class
 */
function CanvasEventsMixin(Base) {
  return class extends Base {
    /**
     * Setup canvas event listeners
     */
    setupCanvasEvents() {
      // Throttle mousemove for performance
      let lastMoveTime = 0;
      const MOVE_THROTTLE = 16; // ~60fps max for hover updates
      
      // Canvas events
      this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
      this.canvas.addEventListener('mousemove', (e) => {
        const now = performance.now();
        if (now - lastMoveTime < MOVE_THROTTLE) return;
        lastMoveTime = now;
        this.handleCanvasMove(e);
      });
      this.canvas.addEventListener('wheel', (e) => this.handleCanvasWheel(e), { passive: false });
      
      // Pan with middle/right mouse
      let isPanning = false, lastX = 0, lastY = 0;
      
      this.canvas.addEventListener('mousedown', (e) => {
        if (e.button === 1 || e.button === 2) {
          isPanning = true;
          lastX = e.clientX;
          lastY = e.clientY;
          e.preventDefault();
        }
      });
      
      this.canvas.addEventListener('mousemove', (e) => {
        if (isPanning && this.camera) {
          this.camera.pan(-(e.clientX - lastX) / this.camera.zoom, -(e.clientY - lastY) / this.camera.zoom);
          lastX = e.clientX;
          lastY = e.clientY;
          // Must render immediately for smooth panning feedback
          this.renderGame();
          // Update tooltip position if visible
          this.updateTooltipPosition();
        }
      });
      
      window.addEventListener('mouseup', (e) => {
        if (e.button === 1 || e.button === 2) isPanning = false;
      });
      
      this.canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // Right click exits placement mode
        if (this.placingTower) {
          this.exitPlacementMode();
        }
        if (this.placingEnergy) {
          this.exitEnergyPlacementMode();
        }
      });
    }

    /**
     * Handle canvas click
     */
    handleCanvasClick(e) {
      if (!this.game || !this.camera) return;
      
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      
      const worldPos = this.camera.screenToWorld(screenX, screenY);
      const gridX = Math.floor(worldPos.x / this.CONFIG.GRID_SIZE);
      const gridY = Math.floor(worldPos.y / this.CONFIG.GRID_SIZE);
      
      if (this.placingTower) {
        // Place base tower (no path needed anymore)
        try {
          const result = this.game.placeTower(gridX, gridY);
          if (result) {
            // Stay in placement mode for quick building
            this.updateTowerAffordability();
          }
        } catch (err) {
          console.error('[game-controller] placeTower error:', err);
        }
      } else if (this.placingEnergy) {
        // Place energy building
        this.placeEnergyBuilding(gridX, gridY);
      } else {
        // Find tower at grid position
        const tower = this.game.towers.find(t => t.gridX === gridX && t.gridY === gridY);
        if (tower) {
          this.game.selectTower(tower.id);
        } else {
          this.game.selectTower(null);
        }
      }
      
      // Click is important - render immediately for feedback
      this.renderGame();
    }

    /**
     * Handle canvas mouse move
     * Shows placement preview (ghost tower/building)
     */
    handleCanvasMove(e) {
      if (!this.game || !this.renderer || !this.camera) return;
      
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      
      const worldPos = this.camera.screenToWorld(screenX, screenY);
      const gridX = Math.floor(worldPos.x / this.CONFIG.GRID_SIZE);
      const gridY = Math.floor(worldPos.y / this.CONFIG.GRID_SIZE);
      
      if (this.placingTower) {
        const canPlace = this.game.canPlaceTower(gridX, gridY);
        this.renderer.setHover(gridX, gridY, canPlace);
        // Must render for placement preview (ghost) to show
        this.renderGame();
      } else if (this.placingEnergy) {
        // Check if can place energy building
        const canPlace = this.canPlaceEnergyAt(gridX, gridY);
        this.renderer.setHover(gridX, gridY, canPlace, this.placingEnergyType);
        this.renderGame();
      } else {
        this.renderer.clearHover();
      }
    }
    
    /**
     * Check if energy building can be placed at position
     */
    canPlaceEnergyAt(gridX, gridY) {
      if (!this.game) return false;
      
      const map = this.game.map;
      if (!map) return true;
      
      // Check terrain
      const terrain = map.terrain?.[gridY]?.[gridX];
      if (terrain === 'water') return false;
      
      // Check if path
      if (map.isPath?.(gridX, gridY)) return false;
      
      // Check if occupied by tower
      if (this.game.towers.find(t => t.gridX === gridX && t.gridY === gridY)) return false;
      
      // Check if occupied by energy building
      const energyModule = this.game.getModule?.('energy');
      if (energyModule?.buildingManager?.buildings) {
        for (const building of energyModule.buildingManager.buildings.values()) {
          if (building.gridX === gridX && building.gridY === gridY) return false;
        }
      }
      
      return true;
    }

    /**
     * Handle canvas wheel (zoom)
     */
    handleCanvasWheel(e) {
      if (!this.camera) return;
      e.preventDefault();
      
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.camera.zoomBy(zoomFactor);
      // Must render immediately for zoom feedback
      this.renderGame();
      // Update tooltip position if visible
      this.updateTooltipPosition();
    }
  };
}

module.exports = { CanvasEventsMixin };
