/**
 * Power Towers TD - Game Panel Sidebar Module
 * 
 * ATTACHED MODE: Shows launcher button to open game in separate window
 * DETACHED MODE: Full game with dynamic canvas sizing
 */

module.exports = function({ SidebarModule, registerModule }) {
  
  // Import game modules
  let GameCore, GameRenderer, GameEvents, TOWER_PATHS, CONFIG, Camera;
  
  try {
    const path = require('path');
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
      
      // Game state (only used in detached mode)
      this.game = null;
      this.renderer = null;
      this.camera = null;
      this.canvas = null;
      this.canvasContainer = null;
      this.elements = {};
      this.resizeObserver = null;
      
      this.placingTower = false;
      this.selectedPath = null;
      this.currentScreen = 'menu';
      
      this._savedState = options.savedState || null;
      
      console.log('[game-panel] Constructor, isDetached:', this.isDetached);
    }

    getTemplate() {
      // ═══════════════════════════════════════════════════════════════
      // ATTACHED MODE: Simple launcher
      // ═══════════════════════════════════════════════════════════════
      if (!this.isDetached) {
        return `
          <div class="game-launcher">
            <div class="launcher-content">
              <div class="launcher-icon">🗼</div>
              <h2 class="launcher-title">Power Towers TD</h2>
              <p class="launcher-subtitle">Roguelike Tower Defense</p>
              <button class="launcher-btn" id="btn-launch">
                <span class="btn-icon">🎮</span>
                <span class="btn-text">Запустить игру</span>
              </button>
              <p class="launcher-hint">Игра откроется в отдельном окне</p>
            </div>
          </div>
        `;
      }
      
      // ═══════════════════════════════════════════════════════════════
      // DETACHED MODE: Full game
      // ═══════════════════════════════════════════════════════════════
      return `
        <div class="game-panel-container">
          <!-- Main Menu Screen -->
          <div class="game-screen menu-screen" id="screen-menu">
            <div class="menu-title">
              <span class="menu-icon">🗼</span>
              <h2>Power Towers TD</h2>
              <p class="menu-subtitle">Roguelike Tower Defense</p>
            </div>
            <div class="menu-buttons">
              <button class="menu-btn primary" data-screen="game">▶ Start Game</button>
              <button class="menu-btn" data-screen="upgrades">🔧 Upgrades</button>
              <button class="menu-btn" data-screen="tips">💡 Tips</button>
              <button class="menu-btn" data-screen="settings">⚙️ Settings</button>
            </div>
            <div class="menu-footer">
              <p class="version">v0.1.0</p>
            </div>
          </div>
          
          <!-- Upgrades Screen -->
          <div class="game-screen upgrades-screen" id="screen-upgrades" style="display: none;">
            <div class="screen-header">
              <button class="back-btn" data-screen="menu">← Back</button>
              <h3>Permanent Upgrades</h3>
            </div>
            <div class="upgrades-list">
              <div class="upgrade-item">
                <span class="upgrade-icon">💰</span>
                <div class="upgrade-info">
                  <span class="upgrade-name">Starting Gold</span>
                  <span class="upgrade-desc">+50 gold per level</span>
                </div>
                <button class="upgrade-btn" disabled>Lvl 0</button>
              </div>
              <div class="upgrade-item">
                <span class="upgrade-icon">⚡</span>
                <div class="upgrade-info">
                  <span class="upgrade-name">Max Energy</span>
                  <span class="upgrade-desc">+25 energy per level</span>
                </div>
                <button class="upgrade-btn" disabled>Lvl 0</button>
              </div>
            </div>
            <p class="coming-soon">Coming in future update!</p>
          </div>
          
          <!-- Tips Screen -->
          <div class="game-screen tips-screen" id="screen-tips" style="display: none;">
            <div class="screen-header">
              <button class="back-btn" data-screen="menu">← Back</button>
              <h3>Tips & Guide</h3>
            </div>
            <div class="tips-list">
              <div class="tip-item">🔥 <b>Fire</b> - Burn DoT, AoE upgrades</div>
              <div class="tip-item">❄️ <b>Ice</b> - Slows, can freeze</div>
              <div class="tip-item">⚡ <b>Lightning</b> - Chain attacks</div>
              <div class="tip-item">🌿 <b>Nature</b> - Poison + regen</div>
              <div class="tip-item">💀 <b>Dark</b> - True damage</div>
              <div class="tip-item">💡 Energy regenerates each wave!</div>
            </div>
          </div>
          
          <!-- Settings Screen -->
          <div class="game-screen settings-screen" id="screen-settings" style="display: none;">
            <div class="screen-header">
              <button class="back-btn" data-screen="menu">← Back</button>
              <h3>Settings</h3>
            </div>
            <div class="settings-list">
              <div class="setting-item"><span>Sound Effects</span><button class="toggle-btn" disabled>OFF</button></div>
              <div class="setting-item"><span>Music</span><button class="toggle-btn" disabled>OFF</button></div>
            </div>
            <p class="coming-soon">Coming in future update!</p>
          </div>
          
          <!-- Game Screen -->
          <div class="game-screen gameplay-screen" id="screen-game" style="display: none;">
            <div class="game-stats-bar">
              <div class="stat-item"><span class="stat-icon">💰</span><span class="stat-value" id="stat-gold">100</span></div>
              <div class="stat-item"><span class="stat-icon">❤️</span><span class="stat-value" id="stat-lives">20</span></div>
              <div class="stat-item"><span class="stat-icon">⚡</span><span class="stat-value" id="stat-energy">50</span></div>
              <div class="stat-item"><span class="stat-icon">🌊</span><span class="stat-value" id="stat-wave">0</span></div>
            </div>
            
            <div class="canvas-container">
              <canvas id="game-canvas"></canvas>
              <div class="game-overlay" id="game-overlay" style="display: none;">
                <div class="overlay-content">
                  <h3 id="overlay-title">Game Over</h3>
                  <p id="overlay-message">Wave 5</p>
                  <button id="overlay-btn" class="game-btn primary">Restart</button>
                </div>
              </div>
            </div>
            
            <div class="tower-select" id="tower-select">
              <button class="tower-btn" data-path="fire" title="Fire">🔥</button>
              <button class="tower-btn" data-path="ice" title="Ice">❄️</button>
              <button class="tower-btn" data-path="lightning" title="Lightning">⚡</button>
              <button class="tower-btn" data-path="nature" title="Nature">🌿</button>
              <button class="tower-btn" data-path="dark" title="Dark">💀</button>
            </div>
            
            <div class="game-controls">
              <button id="btn-start" class="game-btn primary">▶ Start Wave</button>
              <button id="btn-tower" class="game-btn" disabled>🗼 Tower (50g)</button>
            </div>
            
            <div class="tower-info" id="tower-info" style="display: none;">
              <div class="tower-info-header">
                <span id="tower-name">Tower</span>
                <span id="tower-tier">Tier 0</span>
              </div>
              <div class="tower-info-stats">
                <span>DMG: <b id="tower-dmg">10</b></span>
                <span>RNG: <b id="tower-rng">60</b></span>
                <span>SPD: <b id="tower-spd">1.0</b></span>
              </div>
              <div class="tower-info-actions">
                <button id="btn-upgrade" class="game-btn small">⬆️ Upgrade</button>
                <button id="btn-sell" class="game-btn small danger">💰 Sell</button>
              </div>
            </div>
            
            <div class="game-footer">
              <button class="back-btn small" data-screen="menu">☰ Menu</button>
              <p class="hint">Select tower, click to place</p>
            </div>
          </div>
        </div>
      `;
    }

    getStyles() {
      // ═══════════════════════════════════════════════════════════════
      // ATTACHED MODE: Launcher styles
      // ═══════════════════════════════════════════════════════════════
      if (!this.isDetached) {
        return `
          .game-launcher {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            padding: 20px;
            box-sizing: border-box;
          }
          .launcher-content { text-align: center; max-width: 280px; }
          .launcher-icon { font-size: 64px; margin-bottom: 12px; }
          .launcher-title { margin: 0 0 4px 0; font-size: 20px; color: #fff; }
          .launcher-subtitle { margin: 0 0 24px 0; font-size: 13px; color: #a0aec0; }
          .launcher-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            padding: 14px 24px;
            border: none;
            border-radius: 12px;
            background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
            color: white;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 15px rgba(72, 187, 120, 0.3);
          }
          .launcher-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(72, 187, 120, 0.4);
          }
          .launcher-btn:active { transform: translateY(0); }
          .launcher-btn .btn-icon { font-size: 20px; }
          .launcher-hint { margin: 16px 0 0 0; font-size: 11px; color: #718096; }
        `;
      }
      
      // ═══════════════════════════════════════════════════════════════
      // DETACHED MODE: Full game styles
      // ═══════════════════════════════════════════════════════════════
      return `
        .game-panel-container {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-family: 'Segoe UI', sans-serif;
          height: 100%;
          min-height: 0;
          box-sizing: border-box;
          overflow: hidden;
        }
        
        .game-screen { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; overflow: hidden; }
        .game-screen.menu-screen { align-items: center; justify-content: center; padding: 20px; }
        .gameplay-screen { flex: 1; min-height: 0; }
        
        .menu-title { text-align: center; margin-bottom: 24px; }
        .menu-icon { font-size: 64px; display: block; margin-bottom: 12px; }
        .menu-title h2 { margin: 0; font-size: 28px; color: #fff; }
        .menu-subtitle { margin: 6px 0 0; font-size: 15px; color: #a0aec0; }
        
        .menu-buttons { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 260px; }
        .menu-btn {
          padding: 14px 20px; border: none; border-radius: 10px;
          background: rgba(255,255,255,0.1); color: #e2e8f0;
          font-size: 16px; cursor: pointer; transition: all 0.2s;
        }
        .menu-btn:hover { background: rgba(255,255,255,0.15); transform: translateX(4px); }
        .menu-btn.primary { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; font-weight: 600; }
        .menu-btn.primary:hover { box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3); }
        
        .menu-footer { margin-top: 32px; }
        .menu-footer .version { font-size: 11px; color: #718096; }
        
        .screen-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-shrink: 0; }
        .screen-header h3 { margin: 0; font-size: 18px; color: #fff; }
        .back-btn {
          padding: 8px 14px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px;
          background: transparent; color: #a0aec0; font-size: 13px; cursor: pointer;
        }
        .back-btn:hover { background: rgba(255,255,255,0.1); }
        .back-btn.small { padding: 6px 10px; font-size: 12px; }
        
        .upgrades-list, .tips-list, .settings-list { display: flex; flex-direction: column; gap: 10px; }
        .upgrade-item, .setting-item {
          display: flex; align-items: center; gap: 12px;
          padding: 14px; background: rgba(0,0,0,0.3); border-radius: 10px;
        }
        .upgrade-icon { font-size: 28px; }
        .upgrade-info { flex: 1; }
        .upgrade-name { display: block; font-weight: 500; color: #fff; font-size: 15px; }
        .upgrade-desc { font-size: 12px; color: #a0aec0; }
        .upgrade-btn { padding: 8px 14px; border: none; border-radius: 6px; background: rgba(255,255,255,0.1); color: #a0aec0; }
        .tip-item { padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; font-size: 14px; color: #e2e8f0; }
        .setting-item { justify-content: space-between; font-size: 14px; color: #e2e8f0; }
        .toggle-btn { padding: 6px 14px; border: none; border-radius: 6px; background: rgba(255,255,255,0.1); color: #a0aec0; }
        .coming-soon { text-align: center; color: #718096; font-size: 13px; margin-top: 16px; }
        
        .game-stats-bar {
          display: flex; justify-content: space-between;
          padding: 10px 14px; background: rgba(0,0,0,0.4); border-radius: 8px;
          font-size: 15px; flex-shrink: 0;
        }
        .stat-item { display: flex; align-items: center; gap: 6px; }
        .stat-icon { font-size: 18px; }
        .stat-value { font-weight: bold; min-width: 28px; }
        .stat-value.danger { color: #fc8181; }
        .stat-value.warning { color: #f6ad55; }
        
        .canvas-container { 
          position: relative; border-radius: 10px; overflow: hidden; 
          flex: 1; min-height: 0;
          display: flex; align-items: center; justify-content: center;
          background: #0a0a12;
        }
        #game-canvas {
          display: block;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          cursor: crosshair;
        }
        
        .game-overlay {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.85);
          display: flex; align-items: center; justify-content: center;
        }
        .overlay-content { text-align: center; }
        .overlay-content h3 { margin: 0 0 10px; font-size: 28px; color: #fff; }
        .overlay-content p { margin: 0 0 20px; color: #a0aec0; font-size: 16px; }
        
        .tower-select {
          display: flex; justify-content: center; gap: 10px;
          padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; flex-shrink: 0;
        }
        .tower-btn {
          width: 52px; height: 52px;
          border: 2px solid transparent; border-radius: 10px;
          background: rgba(255,255,255,0.1);
          font-size: 24px; cursor: pointer; transition: all 0.2s;
        }
        .tower-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.1); }
        .tower-btn.selected { border-color: #48bb78; background: rgba(72,187,120,0.2); }
        
        .game-controls { display: flex; gap: 10px; flex-shrink: 0; }
        .game-btn {
          flex: 1; padding: 14px; border: none; border-radius: 8px;
          font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s;
        }
        .game-btn.primary { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; }
        .game-btn.primary:hover { box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3); }
        .game-btn:not(.primary) { background: rgba(255,255,255,0.1); color: #e2e8f0; }
        .game-btn:not(.primary):hover { background: rgba(255,255,255,0.15); }
        .game-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .game-btn.small { flex: none; padding: 10px 16px; font-size: 13px; }
        .game-btn.danger { background: rgba(252,129,129,0.2); color: #fc8181; }
        .game-btn.active { background: #ecc94b; color: #1a202c; }
        
        .tower-info {
          padding: 12px; background: rgba(0,0,0,0.4); border-radius: 8px; flex-shrink: 0;
        }
        .tower-info-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .tower-info-header span:first-child { font-weight: 600; color: #fff; font-size: 15px; }
        .tower-info-header span:last-child { color: #a0aec0; font-size: 13px; }
        .tower-info-stats { display: flex; gap: 16px; margin-bottom: 10px; font-size: 14px; color: #e2e8f0; }
        .tower-info-actions { display: flex; gap: 10px; }
        
        .game-footer { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .game-footer .hint { margin: 0; font-size: 12px; color: #718096; flex: 1; text-align: right; }
      `;
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
            // Request detach via IPC
            const { ipcRenderer } = require('electron');
            ipcRenderer.invoke('module-detach', { moduleId: 'game-panel' });
          });
        }
        return;
      }
      
      // ═══════════════════════════════════════════════════════════════
      // DETACHED MODE: Full game setup
      // ═══════════════════════════════════════════════════════════════
      this.setupDetachedGame(container);
    }
    
    setupDetachedGame(container) {
      // Cache screen elements
      this.screens = {
        menu: container.querySelector('#screen-menu'),
        upgrades: container.querySelector('#screen-upgrades'),
        tips: container.querySelector('#screen-tips'),
        settings: container.querySelector('#screen-settings'),
        game: container.querySelector('#screen-game')
      };
      
      // Cache game elements
      this.canvas = container.querySelector('#game-canvas');
      this.canvasContainer = container.querySelector('.canvas-container');
      this.elements = {
        gold: container.querySelector('#stat-gold'),
        lives: container.querySelector('#stat-lives'),
        energy: container.querySelector('#stat-energy'),
        wave: container.querySelector('#stat-wave'),
        overlay: container.querySelector('#game-overlay'),
        overlayTitle: container.querySelector('#overlay-title'),
        overlayMessage: container.querySelector('#overlay-message'),
        overlayBtn: container.querySelector('#overlay-btn'),
        towerSelect: container.querySelector('#tower-select'),
        towerInfo: container.querySelector('#tower-info'),
        towerName: container.querySelector('#tower-name'),
        towerTier: container.querySelector('#tower-tier'),
        towerDmg: container.querySelector('#tower-dmg'),
        towerRng: container.querySelector('#tower-rng'),
        towerSpd: container.querySelector('#tower-spd'),
        btnStart: container.querySelector('#btn-start'),
        btnTower: container.querySelector('#btn-tower'),
        btnUpgrade: container.querySelector('#btn-upgrade'),
        btnSell: container.querySelector('#btn-sell')
      };
      
      // Setup navigation
      this.setupScreenNavigation(container);
      
      // Setup resize observer
      this.setupResizeObserver();
      
      // Check saved state
      if (this._savedState) {
        this.restoreFromSavedState(this._savedState);
      } else {
        this.showScreen('menu');
      }
    }
    
    setupResizeObserver() {
      if (!this.canvasContainer) return;
      
      this.resizeObserver = new ResizeObserver(() => {
        this.resizeCanvas();
      });
      this.resizeObserver.observe(this.canvasContainer);
      
      // Initial resize
      setTimeout(() => this.resizeCanvas(), 50);
    }
    
    resizeCanvas() {
      if (!this.canvas || !this.canvasContainer) return;
      
      const rect = this.canvasContainer.getBoundingClientRect();
      const size = Math.floor(Math.min(rect.width, rect.height) - 10);
      
      if (size < 200 || Math.abs(this.canvas.width - size) < 5) return;
      
      console.log('[game-panel] Canvas resize:', size);
      
      this.canvas.width = size;
      this.canvas.height = size;
      
      if (this.camera) {
        this.camera.setViewportSize(size, size);
      }
      if (this.renderer) {
        this.renderer.width = size;
        this.renderer.height = size;
      }
      
      this.renderGame();
    }
    
    getSerializedState() {
      const state = { currentScreen: this.currentScreen };
      if (this.game) state.gameState = this.game.serialize();
      return state;
    }
    
    setupScreenNavigation(container) {
      container.querySelectorAll('.menu-btn[data-screen]').forEach(btn => {
        btn.addEventListener('click', () => {
          const screen = btn.dataset.screen;
          this.showScreen(screen);
          if (screen === 'game' && !this.game) {
            this.initializeGame();
          }
        });
      });
      
      container.querySelectorAll('.back-btn[data-screen]').forEach(btn => {
        btn.addEventListener('click', () => {
          const screen = btn.dataset.screen;
          this.showScreen(screen);
          if (screen === 'menu' && this.game) {
            this.resetGame();
          }
        });
      });
    }
    
    resetGame() {
      if (this.game) {
        if (this.game.running && !this.game.paused) this.game.pause();
        this.game = null;
      }
      this.renderer = null;
      this.placingTower = false;
      this.selectedPath = null;
      if (this.elements.btnStart) this.elements.btnStart.textContent = '▶ Start Wave';
    }
    
    showScreen(screenId) {
      this.currentScreen = screenId;
      Object.entries(this.screens).forEach(([id, el]) => {
        if (el) el.style.display = id === screenId ? 'flex' : 'none';
      });
      if (screenId === 'game') {
        requestAnimationFrame(() => this.resizeCanvas());
      }
    }
    
    initializeGame() {
      if (!GameCore || !GameRenderer || !Camera) {
        this.showError('Failed to load game engine');
        return;
      }
      
      // Initial canvas size
      this.resizeCanvas();
      
      this.camera = new Camera();
      this.camera.setViewportSize(this.canvas.width, this.canvas.height);
      
      this.game = new GameCore();
      this.renderer = new GameRenderer(this.canvas, this.camera);
      
      // Center on base
      const basePos = this.game.map.base;
      if (basePos) this.camera.centerOn(basePos.x, basePos.y);
      
      this.setupEventListeners();
      this.setupGameEvents();
      this.renderGame();
      this.updateUI(this.game.getState());
      
      console.log('[game-panel] Game initialized');
    }
    
    restoreFromSavedState(state) {
      if (!state) return;
      
      this.currentScreen = state.currentScreen || 'menu';
      
      if (state.currentScreen === 'game' && state.gameState) {
        this.resizeCanvas();
        
        this.camera = new Camera();
        this.camera.setViewportSize(this.canvas.width, this.canvas.height);
        
        this.game = GameCore.deserialize(state.gameState);
        this.renderer = new GameRenderer(this.canvas, this.camera);
        
        const basePos = this.game.map.base;
        if (basePos) this.camera.centerOn(basePos.x, basePos.y);
        
        this.setupEventListeners();
        this.setupGameEvents();
        this.showScreen('game');
        this.renderGame();
        this.updateUI(this.game.getState());
        
        // Update buttons
        if (this.game.gameOver) {
          this.elements.btnStart.textContent = '▶ Start';
          this.elements.btnTower.disabled = true;
        } else if (this.game.running && !this.game.paused) {
          this.elements.btnStart.textContent = '⏸ Pause';
          this.elements.btnTower.disabled = this.game.economy.gold < 50;
        } else if (this.game.paused) {
          this.elements.btnStart.textContent = '▶ Resume';
          this.elements.btnTower.disabled = true;
        }
      } else {
        this.showScreen(this.currentScreen);
      }
    }

    setupEventListeners() {
      const el = this.elements;
      
      el.btnStart.addEventListener('click', () => this.toggleGame());
      el.btnTower.addEventListener('click', () => this.togglePlacementMode());
      el.overlayBtn.addEventListener('click', () => this.restartGame());
      el.btnUpgrade.addEventListener('click', () => this.upgradeSelectedTower());
      el.btnSell.addEventListener('click', () => this.sellSelectedTower());
      
      // Tower path selection
      el.towerSelect.querySelectorAll('.tower-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          el.towerSelect.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          this.selectedPath = btn.dataset.path;
        });
      });
      
      // Select fire by default
      const fireBtn = el.towerSelect.querySelector('[data-path="fire"]');
      if (fireBtn) {
        fireBtn.classList.add('selected');
        this.selectedPath = 'fire';
      }
      
      // Canvas events
      this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
      this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMove(e));
      this.canvas.addEventListener('wheel', (e) => this.handleCanvasWheel(e));
      
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
          this.renderGame();
        }
      });
      
      window.addEventListener('mouseup', (e) => {
        if (e.button === 1 || e.button === 2) isPanning = false;
      });
      
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    setupGameEvents() {
      if (!this.game) return;
      
      this.game.on(GameEvents.STATE_CHANGE, (state) => {
        this.updateUI(state);
        this.renderGame();
      });
      
      this.game.on(GameEvents.TOWER_PLACED, () => {
        this.placingTower = false;
        this.elements.btnTower.classList.remove('active');
      });
      
      this.game.on(GameEvents.TOWER_SELECTED, (tower) => {
        tower ? this.showTowerInfo(tower) : this.hideTowerInfo();
      });
      
      this.game.on(GameEvents.WAVE_COMPLETE, () => {
        this.elements.btnStart.textContent = '▶ Start Wave';
        this.elements.btnTower.disabled = false;
      });
      
      this.game.on(GameEvents.GAME_OVER, (data) => {
        this.showOverlay('Game Over!', `Reached Wave ${data.wave}`, 'Try Again');
        this.elements.btnStart.disabled = true;
        this.elements.btnTower.disabled = true;
      });
    }

    toggleGame() {
      if (!this.game) return;
      
      if (this.game.gameOver) {
        this.restartGame();
        return;
      }
      
      if (!this.game.running) {
        this.game.start();
        this.elements.btnStart.textContent = '⏸ Pause';
        this.elements.btnTower.disabled = true;
        this.gameLoop();
      } else if (this.game.paused) {
        this.game.resume();
        this.elements.btnStart.textContent = '⏸ Pause';
        this.gameLoop();
      } else {
        this.game.pause();
        this.elements.btnStart.textContent = '▶ Resume';
      }
    }

    gameLoop() {
      if (!this.game || !this.game.running || this.game.paused) return;
      this.game.tick();
      this.renderGame();
      requestAnimationFrame(() => this.gameLoop());
    }

    restartGame() {
      this.hideOverlay();
      this.game = new GameCore();
      
      const basePos = this.game.map.base;
      if (basePos && this.camera) this.camera.centerOn(basePos.x, basePos.y);
      
      this.setupGameEvents();
      this.renderGame();
      this.updateUI(this.game.getState());
      
      this.elements.btnStart.disabled = false;
      this.elements.btnStart.textContent = '▶ Start Wave';
      this.elements.btnTower.disabled = true;
    }

    togglePlacementMode() {
      this.placingTower = !this.placingTower;
      this.elements.btnTower.classList.toggle('active', this.placingTower);
      if (this.placingTower && this.game.selectedTower) {
        this.game.deselectTower();
      }
    }

    handleCanvasClick(e) {
      if (!this.game || !this.camera) return;
      
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      
      const worldPos = this.camera.screenToWorld(screenX, screenY);
      const gridX = Math.floor(worldPos.x / CONFIG.GRID_SIZE);
      const gridY = Math.floor(worldPos.y / CONFIG.GRID_SIZE);
      
      if (this.placingTower) {
        const pathIndex = TOWER_PATHS.findIndex(p => p.id === this.selectedPath);
        this.game.placeTower(gridX, gridY, pathIndex >= 0 ? pathIndex : 0);
      } else {
        this.game.selectTowerAt(gridX, gridY);
      }
      
      this.renderGame();
    }

    handleCanvasMove(e) {
      if (!this.game || !this.renderer || !this.camera) return;
      
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      
      const worldPos = this.camera.screenToWorld(screenX, screenY);
      const gridX = Math.floor(worldPos.x / CONFIG.GRID_SIZE);
      const gridY = Math.floor(worldPos.y / CONFIG.GRID_SIZE);
      
      if (this.placingTower) {
        const canPlace = this.game.canPlaceTower(gridX, gridY);
        this.renderer.setHoverCell(gridX, gridY, canPlace);
      } else {
        this.renderer.setHoverCell(-1, -1, false);
      }
      
      this.renderGame();
    }

    handleCanvasWheel(e) {
      if (!this.camera) return;
      e.preventDefault();
      
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.camera.zoomAt(mouseX, mouseY, zoomFactor);
      this.renderGame();
    }

    showTowerInfo(tower) {
      const el = this.elements;
      const pathInfo = TOWER_PATHS[tower.pathIndex];
      
      el.towerName.textContent = pathInfo ? pathInfo.name : 'Tower';
      el.towerTier.textContent = `Tier ${tower.tier}`;
      el.towerDmg.textContent = tower.damage.toFixed(0);
      el.towerRng.textContent = tower.range.toFixed(0);
      el.towerSpd.textContent = tower.attackSpeed.toFixed(1);
      
      el.towerInfo.style.display = 'block';
      
      const canUpgrade = this.game.economy.gold >= tower.upgradeCost && tower.tier < 3;
      el.btnUpgrade.disabled = !canUpgrade;
      el.btnUpgrade.textContent = tower.tier >= 3 ? 'MAX' : `⬆️ ${tower.upgradeCost}g`;
    }

    hideTowerInfo() {
      this.elements.towerInfo.style.display = 'none';
    }

    upgradeSelectedTower() {
      if (!this.game?.selectedTower) return;
      this.game.upgradeTower(this.game.selectedTower.id);
      this.showTowerInfo(this.game.selectedTower);
    }

    sellSelectedTower() {
      if (!this.game?.selectedTower) return;
      this.game.sellTower(this.game.selectedTower.id);
      this.hideTowerInfo();
    }

    updateUI(state) {
      const el = this.elements;
      if (!el.gold) return;
      
      el.gold.textContent = state.gold;
      el.lives.textContent = state.lives;
      el.lives.classList.toggle('danger', state.lives <= 5);
      el.lives.classList.toggle('warning', state.lives > 5 && state.lives <= 10);
      el.energy.textContent = state.energy.current;
      el.wave.textContent = state.wave.wave;
    }

    renderGame() {
      if (!this.game || !this.renderer) return;
      if (this.camera) this.camera.update();
      this.renderer.render(this.game.getRenderData());
    }

    showOverlay(title, message, buttonText) {
      const el = this.elements;
      el.overlayTitle.textContent = title;
      el.overlayMessage.textContent = message;
      el.overlayBtn.textContent = buttonText;
      el.overlay.style.display = 'flex';
    }

    hideOverlay() {
      this.elements.overlay.style.display = 'none';
    }

    showError(message) {
      const el = this.elements;
      if (el.overlay) {
        el.overlayTitle.textContent = 'Error';
        el.overlayTitle.style.color = '#fc8181';
        el.overlayMessage.textContent = message;
        el.overlayBtn.style.display = 'none';
        el.overlay.style.display = 'flex';
      }
    }

    onUnmount() {
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
      }
      
      if (this.game && this.game.running && !this.game.paused) {
        this.game.pause();
      }
      
      this.renderer = null;
      this.camera = null;
      
      super.onUnmount();
    }
  }

  if (registerModule) registerModule(GamePanelModule);
  return GamePanelModule;
};
