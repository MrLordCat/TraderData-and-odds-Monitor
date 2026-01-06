/**
 * Power Towers TD - Bottom Panel Templates
 * HTML templates for the 3-section bottom panel
 */

/**
 * Building definitions for build menu
 */
const BUILDINGS = {
  towers: [
    {
      id: 'base',
      name: 'Tower',
      icon: '🗼',
      price: 50,
      desc: 'Basic defense tower. Choose attack type after placing.',
      stats: { dmg: 10, rng: 80, spd: 1.0, pwr: '5/shot' }
    }
  ],
  energy: [
    {
      id: 'debug-generator',
      name: '🔧 Debug Gen',
      shortName: 'DBG',
      icon: '🔧',
      price: 1,
      desc: 'TEST ONLY. Unlimited power.',
      stats: { gen: '999/s', out: '999/s', cap: 9999, rng: '99 tiles' }
    },
    {
      id: 'base-generator',
      name: 'Generator',
      shortName: 'Gen',
      icon: '⚡',
      price: 50,
      desc: 'Stable power. Good starting point.',
      stats: { gen: '5/s', out: '15/s', cap: 50, rng: '4 tiles' }
    },
    {
      id: 'bio-generator',
      name: 'Bio Generator',
      shortName: 'Bio',
      icon: '🌳',
      price: 80,
      desc: 'Tree bonus. L-shape 2x2.',
      stats: { gen: '8/s', out: '20/s', cap: 80, bonus: '+12 trees' }
    },
    {
      id: 'wind-generator',
      name: 'Wind Turbine',
      shortName: 'Wind',
      icon: '💨',
      price: 100,
      desc: 'Unstable. Mountain bonus.',
      stats: { gen: '12/s', out: '25/s', cap: 60, var: '±30%' }
    },
    {
      id: 'solar-generator',
      name: 'Solar Panel',
      shortName: 'Solar',
      icon: '☀️',
      price: 90,
      desc: 'Biome efficiency varies.',
      stats: { gen: '10/s', out: '18/s', cap: 70, biome: '40-150%' }
    },
    {
      id: 'water-generator',
      name: 'Hydro Gen',
      shortName: 'Hydro',
      icon: '💧',
      price: 95,
      desc: 'Water tile bonus. Stable.',
      stats: { gen: '10/s', out: '22/s', cap: 65, bonus: '9 tiles' }
    },
    {
      id: 'battery',
      name: 'Battery',
      shortName: 'Batt',
      icon: '🔋',
      price: 60,
      desc: 'Storage only. Stacking bonus.',
      stats: { gen: '0/s', cap: 200, io: '20/s', decay: '0.5%/m' }
    },
    {
      id: 'power-transfer',
      name: 'Power Relay',
      shortName: 'Relay',
      icon: '🔌',
      price: 75,
      desc: 'Long range. Small loss.',
      stats: { ch: '2/2', rate: '30/s', buf: 50, loss: '5%' }
    }
  ]
};

/**
 * Generate stat rows HTML
 */
function generateStatRows(stats, highlight = null) {
  const labels = {
    dmg: '⚔️ DMG', rng: '📍 RNG', spd: '⚡ SPD', pwr: '🔋 PWR',
    gen: '⚡ Gen', out: '📤 Out', cap: '🔋 Cap', bonus: '🎁 Bonus',
    var: '🎲 Var', biome: '🏜️ Biome', io: '📤 I/O', decay: '📉 Decay',
    ch: '🔌 Ch', rate: '📤 Rate', buf: '📦 Buf', loss: '⚡ Loss'
  };
  
  return Object.entries(stats).map(([key, val]) => {
    const isHighlight = key === highlight;
    return `<div class="popup-stat${isHighlight ? ' highlight' : ''}">
      <span>${labels[key] || key}</span><b>${val}</b>
    </div>`;
  }).join('');
}

/**
 * Generate build card HTML
 */
function generateBuildCard(item, type) {
  const dataAttr = type === 'tower' 
    ? `data-type="tower" data-building="${item.id}"`
    : `data-type="energy" data-building="${item.id}"`;
  
  const displayName = item.shortName || item.name;
  const highlightStat = type === 'energy' ? 'gen' : 'dmg';
  
  return `
    <div class="build-card" ${dataAttr}>
      <div class="build-card-icon">${item.icon}</div>
      <div class="build-card-info">
        <div class="build-card-name">${displayName}</div>
        <div class="build-card-price">${item.price}g</div>
      </div>
      <div class="build-card-popup">
        <div class="popup-title">${item.icon} ${item.name}</div>
        <div class="popup-price">💰 ${item.price} gold</div>
        <div class="popup-desc">${item.desc}</div>
        <div class="popup-stats">
          ${generateStatRows(item.stats, highlightStat)}
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate build menu HTML - unified grid without categories
 */
function generateBuildMenu() {
  const allCards = [
    ...BUILDINGS.towers.map(t => generateBuildCard(t, 'tower')),
    ...BUILDINGS.energy.map(e => generateBuildCard(e, 'energy'))
  ].join('');
  
  return `<div class="build-cards-grid">${allCards}</div>`;
}

/**
 * Main bottom panel template
 */
function getBottomPanelTemplate() {
  return `
    <div class="bottom-panel" id="bottom-panel">
      <!-- Section 1: Stats (left) -->
      <div class="panel-section panel-stats" id="panel-stats">
        <div class="panel-stats-empty">
          <div class="empty-icon">🎯</div>
          <div class="empty-text">Select a building</div>
        </div>
        <div class="panel-stats-content" id="panel-stats-content" style="display: none;">
          <!-- Tower Stats Grid -->
          <div class="stats-grid stats-grid-tower" id="stats-grid-tower">
            <div class="stat-item stat-hoverable" data-stat="damage">
              <span class="stat-label">⚔️ DMG</span>
              <span class="stat-value" id="panel-dmg">10</span>
              <div class="hover-popup" id="panel-detail-dmg">
                <div class="detail-line"><span class="detail-label">Base damage per hit</span></div>
              </div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="range">
              <span class="stat-label">📍 RNG</span>
              <span class="stat-value" id="panel-rng">80</span>
              <div class="hover-popup" id="panel-detail-rng">
                <div class="detail-line"><span class="detail-label">Attack range in pixels</span></div>
              </div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="speed">
              <span class="stat-label">⚡ SPD</span>
              <span class="stat-value" id="panel-spd">1.0</span>
              <div class="hover-popup" id="panel-detail-spd">
                <div class="detail-line"><span class="detail-label">Attacks per second</span></div>
              </div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="crit">
              <span class="stat-label">🎯 CRIT</span>
              <span class="stat-value" id="panel-crit">5%</span>
              <div class="hover-popup" id="panel-detail-crit">
                <div class="detail-line"><span class="detail-label">Critical hit chance</span></div>
              </div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="critdmg">
              <span class="stat-label">💥 CDMG</span>
              <span class="stat-value" id="panel-critdmg">150%</span>
              <div class="hover-popup" id="panel-detail-critdmg">
                <div class="detail-line"><span class="detail-label">Critical damage multiplier</span></div>
              </div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="energy">
              <span class="stat-label">🔋 PWR/Hit</span>
              <span class="stat-value" id="panel-power">5</span>
              <div class="hover-popup" id="panel-detail-power">
                <div class="detail-line"><span class="detail-label">Energy cost per shot</span></div>
              </div>
            </div>
            <!-- Conditional stats - hidden by default -->
            <div class="stat-item stat-hoverable" data-stat="hp" id="stat-row-hp" style="display: none;">
              <span class="stat-label">❤️ HP</span>
              <span class="stat-value" id="panel-hp">100/100</span>
              <div class="hover-popup" id="panel-detail-hp"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="splash" id="stat-row-splash" style="display: none;">
              <span class="stat-label">💣 SPLASH</span>
              <span class="stat-value" id="panel-splash">60</span>
              <div class="hover-popup" id="panel-detail-splash"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="chain" id="stat-row-chain" style="display: none;">
              <span class="stat-label">⛓️ CHAIN</span>
              <span class="stat-value" id="panel-chain">3</span>
              <div class="hover-popup" id="panel-detail-chain"></div>
            </div>
            <!-- Element ability stats -->
            <div class="stat-item stat-hoverable" data-stat="burn" id="stat-row-burn" style="display: none;">
              <span class="stat-label">🔥 BURN</span>
              <span class="stat-value" id="panel-burn">5/s</span>
              <div class="hover-popup" id="panel-detail-burn"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="spread" id="stat-row-spread" style="display: none;">
              <span class="stat-label">🔥 SPREAD</span>
              <span class="stat-value" id="panel-spread">15%</span>
              <div class="hover-popup" id="panel-detail-spread"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="slow" id="stat-row-slow" style="display: none;">
              <span class="stat-label">❄️ SLOW</span>
              <span class="stat-value" id="panel-slow">30%</span>
              <div class="hover-popup" id="panel-detail-slow"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="freeze" id="stat-row-freeze" style="display: none;">
              <span class="stat-label">❄️ FREEZE</span>
              <span class="stat-value" id="panel-freeze">5%</span>
              <div class="hover-popup" id="panel-detail-freeze"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="poison" id="stat-row-poison" style="display: none;">
              <span class="stat-label">🌿 POISON</span>
              <span class="stat-value" id="panel-poison">3/s</span>
              <div class="hover-popup" id="panel-detail-poison"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="shock" id="stat-row-shock" style="display: none;">
              <span class="stat-label">⚡ SHOCK</span>
              <span class="stat-value" id="panel-shock">10%</span>
              <div class="hover-popup" id="panel-detail-shock"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="drain" id="stat-row-drain" style="display: none;">
              <span class="stat-label">💀 DRAIN</span>
              <span class="stat-value" id="panel-drain">10%</span>
              <div class="hover-popup" id="panel-detail-drain"></div>
            </div>
            <!-- Normal Attack Type Stats -->
            <div class="stat-item stat-hoverable" data-stat="combo" id="stat-row-combo" style="display: none;">
              <span class="stat-label">🎯 COMBO</span>
              <span class="stat-value" id="panel-combo">0/10</span>
              <div class="hover-popup" id="panel-detail-combo"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="focus" id="stat-row-focus" style="display: none;">
              <span class="stat-label">🔥 FOCUS</span>
              <span class="stat-value" id="panel-focus">0/5</span>
              <div class="hover-popup" id="panel-detail-focus"></div>
            </div>
          </div>
          <!-- Energy Stats Grid -->
          <div class="stats-grid stats-grid-energy" id="stats-grid-energy" style="display: none;">
            <div class="stat-item stat-hoverable" data-stat="stored">
              <span class="stat-label">🔋 Stored</span>
              <span class="stat-value" id="panel-stored">0/50</span>
              <div class="hover-popup" id="panel-detail-stored"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="output">
              <span class="stat-label">📤 Output</span>
              <span class="stat-value" id="panel-output">15/s</span>
              <div class="hover-popup" id="panel-detail-output"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="channels">
              <span class="stat-label">🔌 In/Out</span>
              <span class="stat-value" id="panel-channels">0/1 : 0/1</span>
              <div class="hover-popup" id="panel-detail-channels"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="range">
              <span class="stat-label">📍 Range</span>
              <span class="stat-value" id="panel-range">4</span>
              <div class="hover-popup" id="panel-detail-range"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="gen">
              <span class="stat-label">⚡ Gen</span>
              <span class="stat-value" id="panel-gen">5/s</span>
              <div class="hover-popup" id="panel-detail-gen"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="trees" id="stat-row-trees" style="display: none;">
              <span class="stat-label">🌲 Trees</span>
              <span class="stat-value" id="panel-trees">0/12</span>
              <div class="hover-popup" id="panel-detail-trees"></div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Section 2: Avatar (center) -->
      <div class="panel-section panel-avatar" id="panel-avatar">
        <div class="avatar-empty">
          <div class="avatar-placeholder">🏗️</div>
          <div class="avatar-hint">Select a building<br>to see details</div>
        </div>
        <div class="avatar-content" id="avatar-content" style="display: none;">
          <div class="avatar-header">
            <div class="avatar-icon" id="avatar-icon">🗼</div>
            <div class="avatar-info">
              <div class="avatar-name" id="avatar-name">Tower</div>
              <div class="avatar-type" id="avatar-type">⚪ Base</div>
              <div class="avatar-level">
                <span id="avatar-level-text">Lvl 1</span>
                <div class="avatar-bars">
                  <div class="avatar-bar-row" title="Experience">
                    <div class="avatar-xp-bar">
                      <div class="avatar-xp-fill" id="avatar-xp-fill" style="width: 0%"></div>
                    </div>
                    <span class="avatar-xp-value" id="avatar-xp-value">0/100</span>
                  </div>
                  <div class="avatar-bar-row" title="Energy">
                    <div class="avatar-energy-bar">
                      <div class="avatar-energy-fill" id="avatar-energy-fill" style="width: 0%"></div>
                    </div>
                    <span class="avatar-energy-value" id="avatar-energy-value">0/100</span>
                  </div>
                </div>
              </div>
            </div>
            <!-- Biome Effects -->
            <div class="avatar-biome has-popup" id="avatar-biome">
              <div class="biome-label">Biome</div>
              <div class="biome-summary" id="biome-summary">-</div>
              <div class="hover-popup biome-popup" id="biome-popup">
                <div class="biome-popup-content" id="biome-popup-content"></div>
              </div>
            </div>
          </div>

          <!-- Inline actions: attack type / element selection -->
          <div class="avatar-actions">
            <div class="avatar-subsection" id="action-attack-type" style="display: none;">
              <div class="avatar-subtitle">Attack Type</div>
              <div class="avatar-card-row">
                <button class="avatar-action-card" data-action="attack-type" data-type="normal" title="Normal">
                  <span class="card-icon">🎯</span>
                  <span class="card-label">Normal</span>
                </button>
                <button class="avatar-action-card" data-action="attack-type" data-type="siege" title="Siege">
                  <span class="card-icon">💥</span>
                  <span class="card-label">Siege</span>
                </button>
                <button class="avatar-action-card" data-action="attack-type" data-type="magic" title="Magic">
                  <span class="card-icon">✨</span>
                  <span class="card-label">Magic</span>
                </button>
                <button class="avatar-action-card" data-action="attack-type" data-type="piercing" title="Piercing">
                  <span class="card-icon">🗡️</span>
                  <span class="card-label">Piercing</span>
                </button>
              </div>
            </div>

            <div class="avatar-subsection" id="action-element" style="display: none;">
              <div class="avatar-subtitle">Element</div>
              <div class="avatar-card-row">
                <button class="avatar-action-card" data-action="element" data-element="fire" title="Fire">
                  <span class="card-icon">🔥</span>
                  <span class="card-label">Fire</span>
                </button>
                <button class="avatar-action-card" data-action="element" data-element="ice" title="Ice">
                  <span class="card-icon">❄️</span>
                  <span class="card-label">Ice</span>
                </button>
                <button class="avatar-action-card" data-action="element" data-element="lightning" title="Lightning">
                  <span class="card-icon">⚡</span>
                  <span class="card-label">Lightning</span>
                </button>
                <button class="avatar-action-card" data-action="element" data-element="nature" title="Nature">
                  <span class="card-icon">🌿</span>
                  <span class="card-label">Nature</span>
                </button>
                <button class="avatar-action-card" data-action="element" data-element="dark" title="Dark">
                  <span class="card-icon">💀</span>
                  <span class="card-label">Dark</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Section 3: Build/Actions (right) -->
      <div class="panel-section panel-build" id="panel-build">
        <!-- Build Menu (default) -->
        <div class="build-menu" id="build-menu">
          ${generateBuildMenu()}
        </div>
        
        <!-- Tower Actions (when tower selected) - Two columns: Upgrades | Abilities -->
        <div class="actions-menu actions-tower" id="actions-tower" style="display: none;">
          <div class="tower-upgrades-container">
            <!-- Upgrades Column -->
            <div class="upgrades-column">
              <div class="column-header">⬆️ Upgrades</div>
              <div class="upgrades-panel" id="upgrades-panel">
                <div class="upgrades-grid" id="upgrades-grid-panel"></div>
              </div>
            </div>
            <!-- Abilities Column -->
            <div class="abilities-column">
              <div class="column-header">✨ Abilities</div>
              <div class="abilities-panel" id="abilities-panel">
                <div class="abilities-grid" id="abilities-grid-panel"></div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Energy Actions (when energy selected) - Upgrades grid like towers -->
        <div class="actions-menu actions-energy" id="actions-energy" style="display: none;">
          <div class="tower-upgrades-container">
            <!-- Upgrades Column -->
            <div class="upgrades-column">
              <div class="column-header">⬆️ Upgrades</div>
              <div class="upgrades-panel" id="energy-upgrades-panel">
                <div class="upgrades-grid" id="energy-upgrades-grid"></div>
              </div>
            </div>
            <!-- Actions Column -->
            <div class="abilities-column">
              <div class="column-header">🔧 Actions</div>
              <div class="abilities-panel" id="energy-actions-panel">
                <div class="energy-actions-grid">
                  <button class="action-btn energy-action" id="action-connect" title="Connect to network">
                    <span class="action-icon">🔗</span>
                    <span class="action-label">Connect</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

module.exports = {
  getBottomPanelTemplate,
  generateBuildMenu,
  generateBuildCard,
  BUILDINGS
};
