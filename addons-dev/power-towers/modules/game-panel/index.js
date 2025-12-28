/**
 * Power Towers TD - Game Panel Sidebar Module
 * 
 * ATTACHED MODE: Shows launcher button to open game in separate window
 * DETACHED MODE: Full game with dynamic canvas sizing
 * 
 * Split into modules:
 * - templates.js - HTML templates
 * - styles.js - CSS styles
 * - game-controller.js - Game logic and event handling
 */

module.exports = function({ SidebarModule, registerModule }) {
  
  // Import local modules
  const path = require('path');
  const { getLauncherTemplate, getGameTemplate } = require(path.join(__dirname, 'templates.js'));
  const { getLauncherStyles, getGameStyles } = require(path.join(__dirname, 'styles.js'));
  const { GameController } = require(path.join(__dirname, 'game-controller.js'));
  
  // Import game core modules
  let GameCore, GameRenderer, GameEvents, TOWER_PATHS, CONFIG, Camera;
  
  try {
    const corePath = path.join(__dirname, '..', '..', 'core');
    const rendererPath = path.join(__dirname, '..', '..', 'renderer');
    
    const gameCore = require(path.join(corePath, 'game-core.js'));
    GameCore = gameCore.GameCore;
    GameEvents = gameCore.GameEvents;
    
    const renderer = require(path.join(rendererPath, 'game-renderer.js'));
    GameRenderer = renderer.GameRenderer;
    
    const tower = require(path.join(corePath, 'entities', 'tower.js'));
    TOWER_PATHS = tower.TOWER_PATHS;
    
    const cameraModule = require(path.join(corePath, 'systems', 'camera.js'));
    Camera = cameraModule.Camera;
    
    CONFIG = require(path.join(corePath, 'config.js'));
    
    console.log('[game-panel] Game modules loaded');
  } catch (err) {
    console.error('[game-panel] Failed to load game modules:', err);
  }

  class GamePanelModule extends SidebarModule {
    static id = 'game-panel';
    static title = 'Power Towers TD';
    static icon = null;
    static order = 100;
    static detachable = true;
    static detachWidth = 800;
    static detachHeight = 950;

    constructor(options = {}) {
      super(options);
      
      // Detached mode check (base class sets this.isDetached in detached window)
      this.isDetached = this.isDetached || options.isDetached || false;
      
      // Game controller (only used in detached mode)
      this.gameController = null;
      this._savedState = options.savedState || null;
      
      console.log('[game-panel] Constructor, isDetached:', this.isDetached);
    }

    getTemplate() {
      return this.isDetached ? getGameTemplate() : getLauncherTemplate();
    }

    getStyles() {
      return this.isDetached ? getGameStyles() : getLauncherStyles();
    }

    onMount(container) {
      super.onMount(container);
      
      console.log('[game-panel] onMount, isDetached:', this.isDetached);
      
      // ═══════════════════════════════════════════════════════════════
      // ATTACHED MODE: Setup launch button
      // ═══════════════════════════════════════════════════════════════
      if (!this.isDetached) {
        const launchBtn = container.querySelector('#btn-launch');
        if (launchBtn) {
          launchBtn.addEventListener('click', () => {
            console.log('[game-panel] Launch button clicked');
            const { ipcRenderer } = require('electron');
            const modulePath = path.join(__dirname, 'index.js');
            ipcRenderer.invoke('module-detach', { 
              moduleId: 'game-panel',
              modulePath: modulePath,
              title: 'Power Towers TD',
              width: GamePanelModule.detachWidth,
              height: GamePanelModule.detachHeight
            });
          });
        }
        return;
      }
      
      // ═══════════════════════════════════════════════════════════════
      // DETACHED MODE: Initialize game controller
      // ═══════════════════════════════════════════════════════════════
      this.gameController = new GameController({
        GameCore,
        GameRenderer,
        Camera,
        GameEvents,
        TOWER_PATHS,
        CONFIG,
        savedState: this._savedState
      });
      
      this.gameController.init(container);
    }
    
    getSerializedState() {
      if (this.gameController) {
        return this.gameController.getSerializedState();
      }
      return { currentScreen: 'menu' };
    }

    onUnmount() {
      if (this.gameController) {
        this.gameController.destroy();
        this.gameController = null;
      }
      super.onUnmount();
    }
  }

  if (registerModule) registerModule(GamePanelModule);
  return GamePanelModule;
};
