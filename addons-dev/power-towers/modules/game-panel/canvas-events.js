/**
 * Power Towers TD - Canvas Event Handlers
 * Handles canvas click, move, wheel, pan events
 * 
 * OPTIMIZED: No direct renderGame() calls - uses dirty flags
 * Render happens on next game tick via requestAnimationFrame
 * 
 * Uses PlacementManager for unified placement logic
 */

const { PlacementManager, BUILDING_TYPES } = require('../placement');

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
        // Close tooltip on right click
        this.hideTowerInfo();
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
      } else if (this.isConnectingEnergy) {
        // Connection mode - find target (energy building OR tower)
        const energyModule = this.game.getModule('energy');
        const targetBuilding = energyModule?.getBuildingAt?.(gridX, gridY);
        
        if (targetBuilding) {
          this.completeEnergyConnection(targetBuilding);
        } else {
          // Check if clicking on a tower (towers are energy consumers)
          const tower = this.game.towers.find(t => t.gridX === gridX && t.gridY === gridY);
          if (tower) {
            this.completeEnergyConnectionToTower(tower);
          } else {
            // Click on empty - cancel connection
            this.cancelEnergyConnectionMode();
          }
        }
      } else {
        // Find tower at grid position
        const tower = this.game.towers.find(t => t.gridX === gridX && t.gridY === gridY);
        if (tower) {
          this.game.selectTower(tower.id);
          this.hideEnergyBuildingInfo(); // Hide energy tooltip when selecting tower
        } else {
          // Check for energy building at this position
          const energyModule = this.game.getModule('energy');
          const energyBuilding = energyModule?.getBuildingAt?.(gridX, gridY);
          if (energyBuilding) {
            this.hideTowerInfo(); // Hide tower tooltip when selecting energy building
            this.showEnergyBuildingInfo(energyBuilding);
          } else {
            // Click on empty cell - deselect and reset bottom panel
            this.game.selectTower(null);
            this.hideTowerInfo();
            this.hideEnergyBuildingInfo();
            // Explicitly reset bottom panel when clicking empty
            if (this.hideBottomPanelSelection) {
              this.hideBottomPanelSelection();
            }
          }
        }
      }
      
      // Click is important - render immediately for feedback
      this.renderGame();
    }

    /**
     * Handle canvas mouse move
     * Shows placement preview (ghost tower/building)
     * Uses PlacementManager for unified hover data
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
        // Use PlacementManager if available
        if (this.placementManager) {
          const canPlace = this.placementManager.canPlaceTower(gridX, gridY);
          const cells = this.placementManager.getCellsForBuilding(gridX, gridY, null);
          this.renderer.setHover(gridX, gridY, canPlace, null, cells);
        } else {
          // Fallback
          const canPlace = this.game.canPlaceTower(gridX, gridY);
          this.renderer.setHover(gridX, gridY, canPlace);
        }
        this.renderGame();
      } else if (this.placingEnergy) {
        // Use PlacementManager for building cells
        if (this.placementManager) {
          const def = this.placementManager.getCurrentDefinition() || 
                      require('./../../modules/energy/building-defs').ENERGY_BUILDINGS[this.placingEnergyType];
          const canPlace = this.placementManager.canPlaceEnergy(gridX, gridY, this.placingEnergyType);
          const cells = this.placementManager.getCellsForBuilding(gridX, gridY, def);
          this.renderer.setHover(gridX, gridY, canPlace, this.placingEnergyType, cells);
        } else {
          // Fallback
          const canPlace = this.canPlaceEnergyAt(gridX, gridY);
          this.renderer.setHover(gridX, gridY, canPlace, this.placingEnergyType);
        }
        this.renderGame();
      } else {
        this.renderer.clearHover();
      }
    }
    
    /**
     * Check if energy building can be placed at position
     * Uses unified PlacementManager
     */
    canPlaceEnergyAt(gridX, gridY) {
      if (!this.placementManager) return false;
      return this.placementManager.canPlaceEnergy(gridX, gridY, this.placingEnergyType);
    }

    /**
     * Check if tower can be placed at position
     * Uses unified PlacementManager
     */
    canPlaceTowerAt(gridX, gridY) {
      if (!this.placementManager) {
        // Fallback to game.canPlaceTower
        return this.game?.canPlaceTower?.(gridX, gridY) ?? false;
      }
      return this.placementManager.canPlaceTower(gridX, gridY);
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
    }
  };
}

module.exports = { CanvasEventsMixin };
