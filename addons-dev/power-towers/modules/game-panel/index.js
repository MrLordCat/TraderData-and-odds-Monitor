/**
 * Power Towers TD - Game Panel Sidebar Module
 * 
 * Integrates GameCore with sidebar UI
 * Exports factory function that receives { SidebarModule, registerModule }
 */

module.exports = function({ SidebarModule, registerModule }) {
  
  // Import game modules
  let GameCore, GameRenderer, GameEvents, TOWER_PATHS, CONFIG;
  
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
    
    CONFIG = require(path.join(corePath, 'config.js'));
    
    console.log('[game-panel] Game modules loaded successfully');
  } catch (err) {
    console.error('[game-panel] Failed to load game modules:', err);
  }

  class GamePanelModule extends SidebarModule {
    static id = 'game-panel';
    static title = 'Power Towers TD';
    static icon = null;
    static order = 100;

    constructor(options = {}) {
      super(options);
      
      this.game = null;
      this.renderer = null;
      this.canvas = null;
      this.elements = {};
      
      this.placingTower = false;
      this.selectedPath = null;
    }

    getTemplate() {
      return `
        <div class="game-panel-container">
          <!-- Stats Bar -->
          <div class="game-stats-bar">
            <div class="stat-item">
              <span class="stat-icon">💰</span>
              <span class="stat-value" id="stat-gold">100</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">❤️</span>
              <span class="stat-value" id="stat-lives">20</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">⚡</span>
              <span class="stat-value" id="stat-energy">50</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">🌊</span>
              <span class="stat-value" id="stat-wave">0</span>
            </div>
          </div>
          
          <!-- Game Canvas -->
          <div class="canvas-container">
            <canvas id="game-canvas" width="300" height="300"></canvas>
            
            <!-- Overlay -->
            <div class="game-overlay" id="game-overlay" style="display: none;">
              <div class="overlay-content">
                <h3 id="overlay-title">Game Over</h3>
                <p id="overlay-message">Wave 5</p>
                <button id="overlay-btn" class="game-btn primary">Restart</button>
              </div>
            </div>
          </div>
          
          <!-- Tower Selection -->
          <div class="tower-select" id="tower-select">
            <button class="tower-btn" data-path="fire" title="Fire - Burn, AoE">🔥</button>
            <button class="tower-btn" data-path="ice" title="Ice - Slow, Freeze">❄️</button>
            <button class="tower-btn" data-path="lightning" title="Lightning - Chain">⚡</button>
            <button class="tower-btn" data-path="nature" title="Nature - Poison">🌿</button>
            <button class="tower-btn" data-path="dark" title="Dark - True DMG">💀</button>
          </div>
          
          <!-- Controls -->
          <div class="game-controls">
            <button id="btn-start" class="game-btn primary">▶ Start</button>
            <button id="btn-tower" class="game-btn" disabled>🗼 Tower (50g)</button>
          </div>
          
          <!-- Tower Info -->
          <div class="tower-info" id="tower-info" style="display: none;">
            <div class="tower-info-header">
              <span id="tower-name">Base Tower</span>
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
          
          <!-- Info -->
          <div class="game-info">
            <p>Select tower type, click canvas to place</p>
            <p class="version">Power Towers TD v0.1.0</p>
          </div>
        </div>
      `;
    }

    getStyles() {
      return `
        .game-panel-container {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-family: 'Segoe UI', sans-serif;
        }
        .game-stats-bar {
          display: flex;
          justify-content: space-between;
          padding: 6px 10px;
          background: rgba(0,0,0,0.4);
          border-radius: 6px;
          font-size: 12px;
        }
        .stat-item { display: flex; align-items: center; gap: 4px; }
        .stat-icon { font-size: 14px; }
        .stat-value { font-weight: bold; min-width: 24px; }
        .stat-value.danger { color: #fc8181; }
        .stat-value.warning { color: #f6ad55; }
        
        .canvas-container { position: relative; border-radius: 8px; overflow: hidden; }
        #game-canvas {
          display: block; width: 100%; aspect-ratio: 1;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          cursor: crosshair;
        }
        
        .game-overlay {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8);
          display: flex; align-items: center; justify-content: center;
        }
        .overlay-content { text-align: center; padding: 20px; }
        .overlay-content h3 { margin: 0 0 10px; font-size: 20px; color: #fc8181; }
        .overlay-content p { margin: 0 0 15px; color: #a0aec0; white-space: pre-line; }
        
        .tower-select {
          display: flex; gap: 4px; justify-content: center;
          padding: 6px; background: rgba(0,0,0,0.3); border-radius: 6px;
          opacity: 0.5; pointer-events: none; transition: opacity 0.2s;
        }
        .tower-select.active { opacity: 1; pointer-events: auto; }
        .tower-btn {
          width: 36px; height: 36px;
          border: 2px solid #4a5568; border-radius: 6px;
          background: #2d3748; font-size: 18px;
          cursor: pointer; transition: all 0.2s;
        }
        .tower-btn:hover { border-color: #718096; background: #3d4758; }
        .tower-btn.selected { border-color: #48bb78; background: rgba(72, 187, 120, 0.2); }
        
        .game-controls { display: flex; gap: 8px; }
        .game-btn {
          flex: 1; padding: 10px; border: none; border-radius: 6px;
          background: #4a5568; color: white; cursor: pointer;
          font-size: 12px; font-weight: 500; transition: all 0.2s;
        }
        .game-btn:hover:not(:disabled) { background: #5a6578; }
        .game-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .game-btn.primary { background: #48bb78; }
        .game-btn.primary:hover:not(:disabled) { background: #38a169; }
        .game-btn.active { background: #ecc94b; color: #1a202c; }
        .game-btn.danger { background: #e53e3e; }
        .game-btn.small { padding: 6px 10px; font-size: 11px; }
        
        .tower-info {
          padding: 8px; background: rgba(0,0,0,0.4);
          border-radius: 6px; font-size: 11px;
        }
        .tower-info-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: bold; }
        .tower-info-stats { display: flex; gap: 12px; margin-bottom: 8px; color: #a0aec0; }
        .tower-info-actions { display: flex; gap: 6px; }
        
        .game-info { text-align: center; font-size: 10px; color: #718096; }
        .game-info p { margin: 2px 0; }
        .version { opacity: 0.6; }
      `;
    }

    onMount(container) {
      super.onMount(container);
      
      // Inject styles
      const styleEl = document.createElement('style');
      styleEl.textContent = this.getStyles();
      container.appendChild(styleEl);
      
      // Get DOM refs
      this.canvas = container.querySelector('#game-canvas');
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
      
      // Check modules loaded
      if (!GameCore || !GameRenderer) {
        this.showError('Failed to load game engine');
        return;
      }
      
      // Init game
      this.game = new GameCore();
      this.renderer = new GameRenderer(this.canvas);
      
      this.setupEventListeners();
      this.setupGameEvents();
      
      this.renderGame();
      this.updateUI(this.game.getState());
      
      console.log('[game-panel] Mounted with GameCore');
    }

    setupEventListeners() {
      const el = this.elements;
      
      el.btnStart.addEventListener('click', () => this.toggleGame());
      el.btnTower.addEventListener('click', () => this.togglePlacementMode());
      
      el.towerSelect.querySelectorAll('.tower-btn').forEach(btn => {
        btn.addEventListener('click', (e) => this.selectPath(e.currentTarget.dataset.path));
      });
      
      this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
      this.canvas.addEventListener('mousemove', (e) => this.handleCanvasHover(e));
      this.canvas.addEventListener('mouseleave', () => this.renderer.clearHover());
      
      el.overlayBtn.addEventListener('click', () => this.restartGame());
      el.btnUpgrade.addEventListener('click', () => this.upgradeSelectedTower());
      el.btnSell.addEventListener('click', () => this.sellSelectedTower());
    }

    setupGameEvents() {
      this.game.on(GameEvents.GAME_TICK, ({ state }) => {
        this.updateUI(state);
        this.renderGame();
      });
      
      this.game.on(GameEvents.GAME_OVER, ({ wave, stats }) => {
        this.showOverlay('Game Over', `Reached Wave ${wave}\nKills: ${stats.enemiesKilled}`, 'Restart');
        this.elements.btnStart.textContent = '▶ Start';
        this.elements.btnTower.disabled = true;
        this.exitPlacementMode();
      });
      
      this.game.on(GameEvents.GOLD_CHANGED, ({ gold }) => {
        this.elements.btnTower.disabled = !this.game.running || gold < 50;
      });
      
      this.game.on(GameEvents.TOWER_PLACED, () => {
        this.exitPlacementMode();
      });
    }

    toggleGame() {
      if (!this.game) return;
      
      if (this.game.gameOver) {
        this.restartGame();
        return;
      }
      
      if (this.game.running && !this.game.paused) {
        this.game.pause();
        this.elements.btnStart.textContent = '▶ Resume';
        this.elements.btnTower.disabled = true;
      } else if (this.game.paused) {
        this.game.resume();
        this.elements.btnStart.textContent = '⏸ Pause';
        this.elements.btnTower.disabled = this.game.economy.gold < 50;
      } else {
        this.game.start();
        this.elements.btnStart.textContent = '⏸ Pause';
        this.elements.btnTower.disabled = this.game.economy.gold < 50;
      }
    }

    restartGame() {
      if (!this.game) return;
      this.game.reset();
      this.hideOverlay();
      this.elements.btnStart.textContent = '▶ Start';
      this.elements.btnTower.disabled = true;
      this.exitPlacementMode();
      this.updateUI(this.game.getState());
      this.renderGame();
    }

    togglePlacementMode() {
      if (this.placingTower) {
        this.exitPlacementMode();
      } else {
        this.enterPlacementMode();
      }
    }

    enterPlacementMode() {
      this.placingTower = true;
      this.elements.btnTower.classList.add('active');
      this.elements.towerSelect.classList.add('active');
      if (!this.selectedPath) this.selectPath('fire');
    }

    exitPlacementMode() {
      this.placingTower = false;
      this.selectedPath = null;
      this.elements.btnTower.classList.remove('active');
      this.elements.towerSelect.classList.remove('active');
      this.elements.towerSelect.querySelectorAll('.tower-btn').forEach(btn => {
        btn.classList.remove('selected');
      });
      this.renderer.clearHover();
    }

    selectPath(path) {
      this.selectedPath = path;
      this.elements.towerSelect.querySelectorAll('.tower-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.path === path);
      });
    }

    handleCanvasClick(e) {
      if (!this.game) return;
      
      const { gridX, gridY, canvasX, canvasY } = this.renderer.screenToGrid(e.clientX, e.clientY);
      
      if (this.placingTower && this.selectedPath) {
        if (this.game.placeTower(gridX, gridY, this.selectedPath)) {
          if (!e.shiftKey) this.exitPlacementMode();
        }
        return;
      }
      
      // Tower selection
      const clickedTower = this.game.towers.find(t => {
        const dx = t.x - canvasX, dy = t.y - canvasY;
        return Math.sqrt(dx * dx + dy * dy) < t.size;
      });
      
      if (clickedTower) {
        this.game.selectTower(clickedTower.id);
        this.showTowerInfo(clickedTower);
      } else {
        this.game.selectTower(null);
        this.hideTowerInfo();
      }
    }

    handleCanvasHover(e) {
      if (!this.placingTower || !this.game) return;
      
      const { gridX, gridY } = this.renderer.screenToGrid(e.clientX, e.clientY);
      const isValid = !this.game.pathCells.some(c => c.x === gridX && c.y === gridY) &&
                     !this.game.towers.some(t => t.gridX === gridX && t.gridY === gridY) &&
                     gridX >= 0 && gridX < 10 && gridY >= 0 && gridY < 10;
      
      this.renderer.setHover(gridX, gridY, isValid);
    }

    showTowerInfo(tower) {
      const el = this.elements;
      el.towerInfo.style.display = 'block';
      el.towerName.textContent = tower.type || 'Base Tower';
      el.towerTier.textContent = `Tier ${tower.tier}`;
      el.towerDmg.textContent = tower.damage;
      el.towerRng.textContent = tower.range;
      el.towerSpd.textContent = tower.fireRate.toFixed(1);
      el.btnUpgrade.disabled = tower.tier >= 3;
    }

    hideTowerInfo() {
      this.elements.towerInfo.style.display = 'none';
    }

    upgradeSelectedTower() {
      if (!this.game?.selectedTower) return;
      const tower = this.game.selectedTower;
      
      if (tower.tier === 0) {
        this.game.upgradeTower(tower.id, this.selectedPath || 'fire');
      } else {
        this.game.upgradeTower(tower.id);
      }
      
      if (this.game.selectedTower) this.showTowerInfo(this.game.selectedTower);
    }

    sellSelectedTower() {
      if (!this.game?.selectedTower) return;
      this.game.sellTower(this.game.selectedTower.id);
      this.hideTowerInfo();
    }

    updateUI(state) {
      const el = this.elements;
      el.gold.textContent = state.gold;
      el.lives.textContent = state.lives;
      el.lives.classList.toggle('danger', state.lives <= 5);
      el.lives.classList.toggle('warning', state.lives > 5 && state.lives <= 10);
      el.energy.textContent = state.energy.current;
      el.wave.textContent = state.wave.wave;
    }

    renderGame() {
      if (!this.game || !this.renderer) return;
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
      if (this.game) {
        this.game.destroy();
        this.game = null;
      }
      this.renderer = null;
      super.onUnmount();
    }
  }

  if (registerModule) registerModule(GamePanelModule);
  return GamePanelModule;
};
