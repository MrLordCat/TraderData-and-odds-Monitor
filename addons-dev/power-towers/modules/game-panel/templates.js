/**
 * Power Towers TD - HTML Templates
 */

const { getBottomPanelTemplate } = require('./bottom-panel/templates');

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
        
        <div class="canvas-container">
          <canvas id="game-canvas"></canvas>
          
          <!-- Top HUD - centered stats -->
          <div class="top-hud-wrapper">
            <div class="top-hud">
              <div class="hud-section hud-gold">
                <span class="hud-icon">💰</span>
                <span class="hud-value" id="stat-gold">100</span>
              </div>
              <div class="hud-divider"></div>
              <div class="hud-section hud-lives">
                <span class="hud-icon">❤️</span>
                <span class="hud-value" id="stat-lives">20</span>
              </div>
              <div class="hud-divider"></div>
              <div class="hud-section hud-wave">
                <span class="hud-icon">🌊</span>
                <span class="hud-value" id="stat-wave">0</span>
              </div>
              <div class="hud-divider"></div>
              <div class="hud-section hud-energy">
                <span class="hud-icon">⚡</span>
                <div class="hud-energy-group">
                  <span class="energy-stored" id="stat-energy-stored">0</span>
                  <span class="energy-sep">/</span>
                  <span class="energy-cap" id="stat-energy-cap">100</span>
                  <span class="energy-sep">|</span>
                  <span class="energy-prod" id="stat-energy-prod">+0</span>
                  <span class="energy-cons" id="stat-energy-cons">-0</span>
                </div>
              </div>
            </div>
          </div>
          
          <div class="game-overlay" id="game-overlay" style="display: none;">
            <div class="overlay-content">
              <h3 id="overlay-title">Game Over</h3>
              <p id="overlay-message">Wave 5</p>
              <button id="overlay-btn" class="game-btn primary">Restart</button>
            </div>
          </div>
          
          <!-- Bottom HUD - Wave control button -->
          <div class="bottom-hud-wrapper">
            <button id="btn-start" class="wave-control-btn">▶ Start Wave <span class="hotkey-hint">[Space]</span></button>
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
            
            <!-- Biome Effects Section (Tower) -->
            <div class="tooltip-biome-section stat-hoverable" id="tower-biome-section" style="display: none;">
              <span class="biome-icons" id="tower-biome-icons" title="">🌲</span>
              <span class="biome-bonus" id="tower-biome-bonus">+10% DMG</span>
              <div class="stat-detail-popup biome-detail-popup" id="detail-biome"></div>
            </div>
            
            <div class="tooltip-stats">
              <div class="stat-row stat-hoverable" data-stat="damage"><span>⚔️ DMG</span><b id="tooltip-dmg">10</b><div class="stat-detail-popup" id="detail-dmg"></div></div>
              <div class="stat-row stat-hoverable" data-stat="range"><span>📏 RNG</span><b id="tooltip-rng">60</b><div class="stat-detail-popup" id="detail-rng"></div></div>
              <div class="stat-row stat-hoverable" data-stat="speed"><span>⚡ SPD</span><b id="tooltip-spd">1.0</b><div class="stat-detail-popup" id="detail-spd"></div></div>
              <div class="stat-row stat-hoverable" data-stat="crit"><span>🎯 CRIT</span><b id="tooltip-crit">5%</b><div class="stat-detail-popup" id="detail-crit"></div></div>
              <div class="stat-row stat-hoverable" data-stat="critdmg"><span>💥 CDMG</span><b id="tooltip-critdmg">150%</b><div class="stat-detail-popup" id="detail-critdmg"></div></div>
              <div class="stat-row stat-hoverable" id="tooltip-splash-row" data-stat="splash" style="display:none;"><span>💣 SPLASH</span><b id="tooltip-splash">60</b><div class="stat-detail-popup" id="detail-splash"></div></div>
              <div class="stat-row stat-hoverable" data-stat="hp"><span>❤️ HP</span><b id="tooltip-hp">100/100</b><div class="stat-detail-popup" id="detail-hp"></div></div>
              <div class="stat-row stat-hoverable" data-stat="energy"><span>🔋 Energy</span><b id="tooltip-energy">50</b><div class="stat-detail-popup" id="detail-energy"></div></div>
              <div class="stat-row stat-hoverable" data-stat="powercost"><span>⚡ PWR/Shot</span><b id="tooltip-powercost">5</b><div class="stat-detail-popup" id="detail-powercost"></div></div>
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
            
            <!-- Element Ability Upgrades Section -->
            <div class="tooltip-section tooltip-abilities" id="tooltip-abilities-section" style="display: none;">
              <div class="section-title">✨ Element Abilities:</div>
              <!-- Lightning Charge Slider (only for Lightning towers) -->
              <div id="lightning-charge-section" class="lightning-charge-section" style="display: none;">
                <div class="lightning-charge-header">
                  <span>⚡ Charge Target:</span>
                  <span id="lightning-charge-value">50%</span>
                </div>
                <input type="range" id="lightning-charge-slider" class="lightning-charge-slider" 
                       min="0" max="100" value="50" step="5">
                <div class="lightning-charge-info">
                  <span>Cost: <b id="lightning-charge-cost">1.0x</b></span>
                  <span>Damage: <b id="lightning-charge-damage">1.0x</b></span>
                </div>
              </div>
              <div class="abilities-grid" id="abilities-grid">
                <!-- Dynamically populated -->
              </div>
            </div>
            
            <div class="tooltip-actions">
              <button id="btn-upgrade" class="tooltip-action-btn upgrade">⬆️ Stats</button>
              <button id="btn-abilities" class="tooltip-action-btn abilities" style="display: none;">✨ Abilities</button>
              <button id="btn-sell" class="tooltip-action-btn sell">💰 Sell</button>
            </div>
          </div>
          
          <!-- Energy Building Tooltip (floating popup) -->
          <div class="tower-tooltip energy-tooltip" id="energy-tooltip">
            <div class="tooltip-header">
              <span class="tooltip-icon" id="energy-tooltip-icon">⚡</span>
              <div class="tooltip-title-group">
                <span class="tooltip-name" id="energy-tooltip-name">Generator</span>
                <span class="tooltip-level" id="energy-tooltip-level">Lvl 1</span>
              </div>
              <button class="tooltip-close" id="energy-tooltip-close">✕</button>
            </div>
            
            <!-- Level Progress Bar (like towers have) -->
            <div class="level-bar-container" id="energy-level-bar-container">
              <div class="level-progress-bar">
                <div class="level-progress-fill" id="energy-level-progress"></div>
              </div>
              <span class="level-progress-text" id="energy-level-text">0/10 XP</span>
            </div>
            
            <div class="tooltip-type-row">
              <span class="tooltip-attack-type" id="energy-tooltip-type">⚡ Generator</span>
              <span class="energy-connections" id="energy-tooltip-connections">0 links</span>
            </div>
            
            <!-- Biome Effects Section -->
            <div class="tooltip-biome-section" id="energy-biome-section" style="display: none;">
              <span class="biome-icon" id="energy-biome-icon">🌲</span>
              <span class="biome-name" id="energy-biome-name">Forest</span>
              <span class="biome-bonus" id="energy-biome-bonus">+15% Gen</span>
            </div>
            
            <div class="tooltip-stats">
              <div class="stat-row stat-hoverable" data-stat="stored">
                <span>🔋 Stored</span><b id="energy-tooltip-stored">0/100</b>
                <div class="stat-detail-popup" id="energy-detail-stored">
                  <div class="detail-line"><span class="detail-label">Current energy</span></div>
                </div>
              </div>
              <div class="stat-row stat-hoverable" data-stat="output">
                <span>⚡ Output</span><b id="energy-tooltip-output">10/s</b>
                <div class="stat-detail-popup" id="energy-detail-output">
                  <div class="detail-line"><span class="detail-label">Energy per second</span></div>
                </div>
              </div>
              <div class="stat-row stat-hoverable" data-stat="range">
                <span>📡 Range</span><b id="energy-tooltip-range">4</b>
                <div class="stat-detail-popup" id="energy-detail-range">
                  <div class="detail-line"><span class="detail-label">Grid cells</span></div>
                </div>
              </div>
              <div class="stat-row stat-hoverable" id="energy-tooltip-gen-row" data-stat="gen">
                <span class="stat-label">🔌 Gen</span><b id="energy-tooltip-gen">5/s</b>
                <div class="stat-detail-popup" id="energy-detail-gen">
                  <div class="detail-line"><span class="detail-label">Generation rate</span></div>
                </div>
              </div>
              <div class="stat-row stat-hoverable" id="energy-tooltip-eff-row" data-stat="efficiency">
                <span class="stat-label">📈 Efficiency</span><b id="energy-tooltip-eff">100%</b>
                <div class="stat-detail-popup" id="energy-detail-efficiency">
                  <div class="detail-line"><span class="detail-label">Biome bonus</span></div>
                </div>
              </div>
              <div class="stat-row stat-hoverable" id="energy-tooltip-special-row" style="display:none;" data-stat="special">
                <span class="stat-label">🌳 Trees</span><b id="energy-tooltip-special">0/12</b>
                <div class="stat-detail-popup" id="energy-detail-special">
                  <div class="detail-line"><span class="detail-label">Resources</span></div>
                </div>
              </div>
            </div>
            
            <!-- Upgrades Section -->
            <div class="tooltip-section energy-upgrades" id="energy-upgrades-section" style="display: none;">
              <div class="section-title">Upgrades:</div>
              <div class="upgrades-grid" id="energy-upgrades-grid">
                <button class="upgrade-stat-btn" data-stat="capacity" title="Increase capacity">
                  <span class="stat-icon">🔋</span>
                  <span class="stat-label">Cap</span>
                  <span class="stat-cost" id="energy-upgrade-capacity-cost">20g</span>
                </button>
                <button class="upgrade-stat-btn" data-stat="outputRate" title="Increase output rate">
                  <span class="stat-icon">⚡</span>
                  <span class="stat-label">Out</span>
                  <span class="stat-cost" id="energy-upgrade-output-cost">25g</span>
                </button>
                <button class="upgrade-stat-btn" data-stat="range" title="Increase connection range">
                  <span class="stat-icon">📡</span>
                  <span class="stat-label">Rng</span>
                  <span class="stat-cost" id="energy-upgrade-range-cost">30g</span>
                </button>
                <button class="upgrade-stat-btn" data-stat="channels" title="Add I/O channel (Relay only)" id="energy-upgrade-channels-btn" style="display:none;">
                  <span class="stat-icon">🔌</span>
                  <span class="stat-label">I/O</span>
                  <span class="stat-cost" id="energy-upgrade-channels-cost">50g</span>
                </button>
              </div>
            </div>
            
            <div class="tooltip-actions">
              <button id="energy-btn-connect" class="tooltip-action-btn connect">🔗 Connect</button>
              <button id="energy-btn-upgrade" class="tooltip-action-btn upgrade">⬆️ Upgrade</button>
              <button id="energy-btn-sell" class="tooltip-action-btn sell">💰 Sell</button>
            </div>
          </div>
        </div>
        

        
        <!-- Bottom Panel (3-section layout) -->
        ${getBottomPanelTemplate()}
        
        <div class="game-footer">
          <button class="back-btn small" data-screen="menu">☰ Menu</button>
          <p class="hint">Space = Start/Pause | ESC = Menu</p>
        </div>
      </div>
    </div>
  `;
}

module.exports = {
  getLauncherTemplate,
  getGameTemplate
};
