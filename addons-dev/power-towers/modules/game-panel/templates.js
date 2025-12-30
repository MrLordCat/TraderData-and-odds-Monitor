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
          
          <!-- Tower Tooltip (floating popup) -->
          <div class="tower-tooltip" id="tower-tooltip">
            <div class="tooltip-header">
              <span class="tooltip-icon" id="tooltip-icon">🏗️</span>
              <div class="tooltip-title-group">
                <span class="tooltip-name" id="tooltip-name">Tower</span>
                <span class="tooltip-level" id="tooltip-level">Lvl 1</span>
                <div class="level-progress-bar">
                  <div class="level-progress-fill" id="tooltip-level-progress"></div>
                </div>
                <span class="level-progress-text" id="tooltip-level-text">0/10 XP</span>
              </div>
              <button class="tooltip-close" id="tooltip-close">✕</button>
            </div>
            
            <div class="tooltip-type-row">
              <span class="tooltip-attack-type" id="tooltip-attack-type">⚪ Base</span>
              <span class="tooltip-element" id="tooltip-element"></span>
            </div>
            
            <div class="tooltip-stats">
              <div class="stat-row"><span>⚔️ DMG</span><b id="tooltip-dmg">10</b></div>
              <div class="stat-row"><span>📏 RNG</span><b id="tooltip-rng">60</b></div>
              <div class="stat-row"><span>⚡ SPD</span><b id="tooltip-spd">1.0</b></div>
              <div class="stat-row"><span>🎯 CRIT</span><b id="tooltip-crit">5%</b></div>
              <div class="stat-row"><span>💥 CDMG</span><b id="tooltip-critdmg">150%</b></div>
              <div class="stat-row"><span>❤️ HP</span><b id="tooltip-hp">100/100</b></div>
              <div class="stat-row"><span>🔋 Energy</span><b id="tooltip-energy">50</b></div>
            </div>
            
            <!-- Attack Type Selection -->
            <div class="tooltip-section" id="tooltip-attack-section" style="display: none;">
              <div class="section-title">Select Attack Type:</div>
              <div class="tooltip-buttons">
                <button class="tooltip-type-btn" data-type="siege" data-cost="75" title="Siege - AoE (75g)">💥<span class="btn-cost">75g</span></button>
                <button class="tooltip-type-btn" data-type="normal" data-cost="50" title="Normal - Fast (50g)">🎯<span class="btn-cost">50g</span></button>
                <button class="tooltip-type-btn" data-type="magic" data-cost="100" title="Magic - Power (100g)">✨<span class="btn-cost">100g</span></button>
                <button class="tooltip-type-btn" data-type="piercing" data-cost="60" title="Piercing - Crit (60g)">🗡️<span class="btn-cost">60g</span></button>
              </div>
            </div>
            
            <!-- Element Selection -->
            <div class="tooltip-section" id="tooltip-element-section" style="display: none;">
              <div class="section-title">Select Element:</div>
              <div class="tooltip-buttons">
                <button class="tooltip-element-btn" data-element="fire" data-cost="100" title="Fire (100g)">🔥<span class="btn-cost">100g</span></button>
                <button class="tooltip-element-btn" data-element="ice" data-cost="100" title="Ice (100g)">❄️<span class="btn-cost">100g</span></button>
                <button class="tooltip-element-btn" data-element="lightning" data-cost="120" title="Lightning (120g)">⚡<span class="btn-cost">120g</span></button>
                <button class="tooltip-element-btn" data-element="nature" data-cost="100" title="Nature (100g)">🌿<span class="btn-cost">100g</span></button>
                <button class="tooltip-element-btn" data-element="dark" data-cost="150" title="Dark (150g)">💀<span class="btn-cost">150g</span></button>
              </div>
            </div>
            
            <!-- Stat Upgrades Section -->
            <div class="tooltip-section tooltip-upgrades" id="tooltip-upgrades-section" style="display: none;">
              <div class="section-title">Stat Upgrades:</div>
              <div class="upgrades-grid" id="upgrades-grid">
                <!-- Dynamically populated -->
              </div>
            </div>
            
            <div class="tooltip-actions">
              <button id="btn-upgrade" class="tooltip-action-btn upgrade">⬆️ Upgrade</button>
              <button id="btn-sell" class="tooltip-action-btn sell">💰 Sell</button>
            </div>
          </div>
        </div>
        
        <div class="build-toolbar" id="build-toolbar">
          <div class="toolbar-section towers-section">
            <div class="tower-select" id="tower-select">
              <!-- Single tower type -->
              <div class="tower-item" data-tower="base" title="Build Tower (50g)">
                <button class="tower-btn">🏗️</button>
                <span class="tower-price">50g</span>
              </div>
            </div>
          </div>
          
          <!-- Attack Type Selection (shows after tower is selected) -->
          <div class="toolbar-section attack-type-section" id="attack-type-section" style="display: none;">
            <div class="section-label">Attack Type:</div>
            <div class="attack-type-select" id="attack-type-select">
              <div class="attack-type-item" data-type="siege" title="Siege - AoE damage, slower">
                <button class="type-btn">💥</button>
                <span class="type-price">75g</span>
              </div>
              <div class="attack-type-item" data-type="normal" title="Normal - Fast attacks">
                <button class="type-btn">🎯</button>
                <span class="type-price">50g</span>
              </div>
              <div class="attack-type-item" data-type="magic" title="Magic - Power scaling">
                <button class="type-btn">✨</button>
                <span class="type-price">100g</span>
              </div>
              <div class="attack-type-item" data-type="piercing" title="Piercing - High crit">
                <button class="type-btn">🗡️</button>
                <span class="type-price">60g</span>
              </div>
            </div>
          </div>
          
          <!-- Element Path Selection -->
          <div class="toolbar-section element-section" id="element-section" style="display: none;">
            <div class="section-label">Element:</div>
            <div class="element-select" id="element-select">
              <div class="element-item" data-element="fire" title="Fire - Burn DoT">
                <button class="element-btn">🔥</button>
                <span class="element-price">100g</span>
              </div>
              <div class="element-item" data-element="ice" title="Ice - Slow enemies">
                <button class="element-btn">❄️</button>
                <span class="element-price">100g</span>
              </div>
              <div class="element-item" data-element="lightning" title="Lightning - Chain attacks">
                <button class="element-btn">⚡</button>
                <span class="element-price">120g</span>
              </div>
              <div class="element-item" data-element="nature" title="Nature - Poison + Life">
                <button class="element-btn">🌿</button>
                <span class="element-price">100g</span>
              </div>
              <div class="element-item" data-element="dark" title="Dark - True damage">
                <button class="element-btn">💀</button>
                <span class="element-price">150g</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="game-controls">
          <button id="btn-start" class="game-btn primary">▶ Start Wave</button>
        </div>
        
        <div class="game-footer">
          <button class="back-btn small" data-screen="menu">☰ Menu</button>
          <p class="hint">Click tower icon to build</p>
        </div>
      </div>
    </div>
  `;
}

module.exports = {
  getLauncherTemplate,
  getGameTemplate
};
