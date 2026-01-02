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
              <div class="stat-detail-popup" id="panel-detail-dmg"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="range">
              <span class="stat-label">📍 RNG</span>
              <span class="stat-value" id="panel-rng">80</span>
              <div class="stat-detail-popup" id="panel-detail-rng"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="speed">
              <span class="stat-label">⚡ SPD</span>
              <span class="stat-value" id="panel-spd">1.0</span>
              <div class="stat-detail-popup" id="panel-detail-spd"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="crit">
              <span class="stat-label">🎯 CRIT</span>
              <span class="stat-value" id="panel-crit">5%</span>
              <div class="stat-detail-popup" id="panel-detail-crit"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="critdmg">
              <span class="stat-label">💥 CDMG</span>
              <span class="stat-value" id="panel-critdmg">150%</span>
              <div class="stat-detail-popup" id="panel-detail-critdmg"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="energy">
              <span class="stat-label">🔋 PWR</span>
              <span class="stat-value" id="panel-power">5</span>
              <div class="stat-detail-popup" id="panel-detail-power"></div>
            </div>
          </div>
          <!-- Energy Stats Grid -->
          <div class="stats-grid stats-grid-energy" id="stats-grid-energy" style="display: none;">
            <div class="stat-item stat-hoverable" data-stat="stored">
              <span class="stat-label">🔋 Stored</span>
              <span class="stat-value" id="panel-stored">0/50</span>
              <div class="stat-detail-popup" id="panel-detail-stored"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="output">
              <span class="stat-label">📤 Output</span>
              <span class="stat-value" id="panel-output">15/s</span>
              <div class="stat-detail-popup" id="panel-detail-output"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="range">
              <span class="stat-label">📍 Range</span>
              <span class="stat-value" id="panel-range">4</span>
              <div class="stat-detail-popup" id="panel-detail-range"></div>
            </div>
            <div class="stat-item stat-hoverable" data-stat="gen">
              <span class="stat-label">⚡ Gen</span>
              <span class="stat-value" id="panel-gen">5/s</span>
              <div class="stat-detail-popup" id="panel-detail-gen"></div>
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
          <div class="avatar-icon" id="avatar-icon">🗼</div>
          <div class="avatar-info">
            <div class="avatar-name" id="avatar-name">Tower</div>
            <div class="avatar-type" id="avatar-type">⚪ Base</div>
            <div class="avatar-level">
              <span id="avatar-level-text">Lvl 1</span>
              <div class="avatar-xp-bar">
                <div class="avatar-xp-fill" id="avatar-xp-fill" style="width: 0%"></div>
              </div>
            </div>
          </div>
          <button class="sell-btn" id="avatar-btn-sell" title="Sell">💰 Sell</button>
        </div>
      </div>
      
      <!-- Section 3: Build/Actions (right) -->
      <div class="panel-section panel-build" id="panel-build">
        <!-- Build Menu (default) -->
        <div class="build-menu" id="build-menu">
          ${generateBuildMenu()}
        </div>
        
        <!-- Tower Actions (when tower selected) -->
        <div class="actions-menu actions-tower" id="actions-tower" style="display: none;">
          <div class="actions-row">
            <button class="action-btn" id="action-upgrades" title="Stat Upgrades">
              <span class="action-icon">⬆️</span>
              <span class="action-label">Upgrades</span>
            </button>
            <button class="action-btn" id="action-abilities" title="Element Abilities">
              <span class="action-icon">✨</span>
              <span class="action-label">Abilities</span>
            </button>
          </div>
          <div class="upgrades-panel" id="upgrades-panel" style="display: none;">
            <div class="upgrades-grid" id="tower-upgrades-grid"></div>
          </div>
          <div class="abilities-panel" id="abilities-panel" style="display: none;">
            <div class="abilities-grid" id="tower-abilities-grid"></div>
          </div>
        </div>
        
        <!-- Energy Actions (when energy selected) -->
        <div class="actions-menu actions-energy" id="actions-energy" style="display: none;">
          <div class="actions-row">
            <button class="action-btn" id="action-connect" title="Connect to network">
              <span class="action-icon">🔗</span>
              <span class="action-label">Connect</span>
            </button>
            <button class="action-btn" id="action-upgrade-energy" title="Upgrade building">
              <span class="action-icon">⬆️</span>
              <span class="action-label">Upgrade</span>
            </button>
          </div>
          <div class="energy-upgrades-panel" id="energy-upgrades-panel" style="display: none;">
            <div class="upgrades-grid" id="energy-upgrades-grid"></div>
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
