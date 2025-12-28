/**
 * Power Towers TD - HTML Templates
 */

/**
 * Launcher template for attached mode (sidebar)
 */
function getLauncherTemplate() {
  return `
    <div class="game-launcher">
      <div class="launcher-content">
        <div class="launcher-icon">🗼</div>
        <h2 class="launcher-title">Power Towers TD</h2>
        <p class="launcher-subtitle">Roguelike Tower Defense</p>
        <button class="launcher-btn" id="btn-launch">
          <span class="btn-icon">🎮</span>
          <span class="btn-text">Launch Game</span>
        </button>
        <p class="launcher-hint">Opens in a separate window</p>
      </div>
    </div>
  `;
}

/**
 * Full game template for detached mode
 */
function getGameTemplate() {
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

module.exports = {
  getLauncherTemplate,
  getGameTemplate
};
