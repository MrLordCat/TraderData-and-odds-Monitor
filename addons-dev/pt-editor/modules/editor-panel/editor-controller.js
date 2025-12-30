/**
 * PT Editor - Editor Controller
 * Handles editor UI logic and data manipulation
 */

const { FileManager } = require('./file-manager.js');

class EditorController {
  constructor() {
    this.container = null;
    this.config = null;
    this.towerPaths = null;
    this.energyBuildings = null;
    this.hasChanges = false;
  }

  init(container) {
    this.container = container;
    this.loadData();
    this.setupTabs();
    this.setupActions();
    this.populateFields();
    this.showPath();
  }

  loadData() {
    this.config = FileManager.readConfig();
    this.towerPaths = FileManager.readTowerPaths();
    this.energyBuildings = FileManager.readEnergyBuildings();
    
    if (!this.config) {
      this.setStatus('Failed to load config - check Power Towers path', 'error');
    } else {
      this.setStatus('Loaded successfully', 'success');
    }
  }

  showPath() {
    const pathEl = this.container.querySelector('.editor-path');
    if (pathEl) {
      pathEl.textContent = `Path: ${FileManager.getPTPath()}`;
      pathEl.title = FileManager.getPTPath();
    }
  }

  setupTabs() {
    const tabs = this.container.querySelectorAll('.tab-btn');
    const panels = this.container.querySelectorAll('.tab-panel');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        const panel = this.container.querySelector(`[data-panel="${tab.dataset.tab}"]`);
        if (panel) panel.classList.add('active');
      });
    });
  }

  setupActions() {
    const saveBtn = this.container.querySelector('.btn-save');
    const reloadBtn = this.container.querySelector('.btn-reload');
    
    saveBtn?.addEventListener('click', () => this.saveChanges());
    reloadBtn?.addEventListener('click', () => {
      this.loadData();
      this.populateFields();
      this.setStatus('Reloaded from files', 'success');
    });
  }

  populateFields() {
    if (!this.config) return;
    
    // Populate simple config inputs
    this.container.querySelectorAll('[data-config]').forEach(input => {
      const key = input.dataset.config;
      if (this.config[key] !== undefined) {
        input.value = this.config[key];
        input.addEventListener('change', () => {
          const val = input.type === 'number' ? parseFloat(input.value) : input.value;
          this.config[key] = val;
          this.markChanged();
        });
      }
    });
    
    // Populate enemies from CONFIG.ENEMY_TYPES
    this.renderEnemyList();
    
    // Populate tower paths
    this.renderTowerPaths();
    
    // Populate energy buildings
    this.renderEnergyBuildings();
  }

  renderEnemyList() {
    const list = this.container.querySelector('.enemy-list');
    if (!list || !this.config?.ENEMY_TYPES) return;
    
    const enemyTypes = this.config.ENEMY_TYPES;
    
    list.innerHTML = Object.entries(enemyTypes).map(([type, data]) => `
      <div class="enemy-card" data-enemy="${type}">
        <div class="enemy-card-header">
          <span class="enemy-emoji">${data.emoji || '👾'}</span>
          <span class="enemy-name">${data.name}</span>
          <span class="enemy-type">${type}</span>
        </div>
        <div class="enemy-stats">
          <div class="fields-grid">
            <div class="field-group">
              <label>Health</label>
              <input type="number" data-enemy-stat="baseHealth" value="${data.baseHealth}" min="1">
            </div>
            <div class="field-group">
              <label>Speed</label>
              <input type="number" data-enemy-stat="baseSpeed" value="${data.baseSpeed}" min="1">
            </div>
            <div class="field-group">
              <label>Reward 💰</label>
              <input type="number" data-enemy-stat="reward" value="${data.reward}" min="0">
            </div>
            <div class="field-group">
              <label>XP ⭐</label>
              <input type="number" data-enemy-stat="xp" value="${data.xp || 1}" min="1">
            </div>
            <div class="field-group color-field">
              <label>Color</label>
              <input type="color" data-enemy-stat="color" value="${data.color}">
            </div>
            <div class="field-group">
              <label>Emoji</label>
              <input type="text" data-enemy-stat="emoji" value="${data.emoji || '👾'}" maxlength="4">
            </div>
          </div>
        </div>
      </div>
    `).join('');
    
    // Add listeners
    list.querySelectorAll('.enemy-card').forEach(card => {
      const type = card.dataset.enemy;
      card.querySelectorAll('[data-enemy-stat]').forEach(input => {
        const stat = input.dataset.enemyStat;
        
        input.addEventListener('change', () => {
          if (stat === 'emoji' || stat === 'name') {
            this.config.ENEMY_TYPES[type][stat] = input.value;
          } else if (stat === 'color') {
            this.config.ENEMY_TYPES[type].color = input.value;
          } else {
            this.config.ENEMY_TYPES[type][stat] = parseFloat(input.value);
          }
          this.markChanged();
        });
        
        // Sync color picker with text input
        if (stat === 'color') {
          input.addEventListener('input', () => {
            this.config.ENEMY_TYPES[type].color = input.value;
            this.markChanged();
          });
        }
      });
    });
  }

  renderTowerPaths() {
    const list = this.container.querySelector('.tower-paths-list');
    if (!list || !this.towerPaths) return;
    
    list.innerHTML = Object.entries(this.towerPaths).map(([pathKey, pathData]) => `
      <div class="tower-path-card" data-path="${pathKey}">
        <div class="tower-path-header">
          <span class="tower-path-icon">${pathData.icon}</span>
          <span class="tower-path-name">${pathData.name}</span>
          <span class="tower-path-toggle">▼</span>
        </div>
        <div class="tower-path-content">
          ${pathData.tiers ? pathData.tiers.map((tier, idx) => `
            <div class="tier-card" data-tier="${idx}">
              <div class="tier-header">
                Tier ${tier.tier || idx + 1}: ${tier.name || ''}
              </div>
              <div class="tier-stats">
                <div class="fields-grid">
                  <div class="field-group">
                    <label>Damage</label>
                    <input type="number" data-tier-stat="damage" value="${tier.damage || 0}" min="0">
                  </div>
                  <div class="field-group">
                    <label>Range</label>
                    <input type="number" data-tier-stat="range" value="${tier.range || 0}" min="0">
                  </div>
                  <div class="field-group">
                    <label>Fire Rate</label>
                    <input type="number" data-tier-stat="fireRate" value="${tier.fireRate || 1}" min="0.1" step="0.1">
                  </div>
                  <div class="field-group">
                    <label>Energy</label>
                    <input type="number" data-tier-stat="energyCost" value="${tier.energyCost || 0}" min="0">
                  </div>
                </div>
              </div>
            </div>
          `).join('') : '<p class="no-data">No tiers defined</p>'}
        </div>
      </div>
    `).join('');
    
    // Toggle expand/collapse
    list.querySelectorAll('.tower-path-header').forEach(header => {
      header.addEventListener('click', () => {
        const content = header.nextElementSibling;
        const toggle = header.querySelector('.tower-path-toggle');
        content.classList.toggle('open');
        toggle.textContent = content.classList.contains('open') ? '▲' : '▼';
      });
    });
    
    // Add listeners for tier stats
    list.querySelectorAll('.tower-path-card').forEach(pathCard => {
      const pathKey = pathCard.dataset.path;
      pathCard.querySelectorAll('.tier-card').forEach(tierCard => {
        const tierIdx = parseInt(tierCard.dataset.tier);
        tierCard.querySelectorAll('[data-tier-stat]').forEach(input => {
          const stat = input.dataset.tierStat;
          input.addEventListener('change', () => {
            if (this.towerPaths[pathKey]?.tiers?.[tierIdx]) {
              this.towerPaths[pathKey].tiers[tierIdx][stat] = parseFloat(input.value);
              this.markChanged();
            }
          });
        });
      });
    });
  }

  renderEnergyBuildings() {
    const list = this.container.querySelector('.energy-buildings-list');
    if (!list || !this.energyBuildings) return;
    
    list.innerHTML = Object.entries(this.energyBuildings).map(([id, bld]) => {
      const stats = bld.stats || {};
      const isGenerator = bld.category === 'generator';
      const isStorage = bld.category === 'storage';
      
      return `
      <div class="energy-card" data-building="${id}">
        <div class="energy-card-header">
          <span class="energy-icon">${bld.icon || '⚡'}</span>
          <span class="energy-name">${bld.name}</span>
          <span class="energy-category">${bld.category}</span>
        </div>
        <div class="energy-stats">
          <div class="fields-grid">
            <div class="field-group">
              <label>Cost 💰</label>
              <input type="number" data-energy-stat="cost" value="${bld.cost || 0}" min="0">
            </div>
            ${isGenerator && stats.generation !== undefined ? `
              <div class="field-group">
                <label>Generation ⚡</label>
                <input type="number" data-energy-stat="stats.generation" value="${stats.generation}" min="0">
              </div>
            ` : ''}
            ${isGenerator && stats.baseGeneration !== undefined ? `
              <div class="field-group">
                <label>Base Gen ⚡</label>
                <input type="number" data-energy-stat="stats.baseGeneration" value="${stats.baseGeneration}" min="0">
              </div>
            ` : ''}
            ${stats.outputRate !== undefined ? `
              <div class="field-group">
                <label>Output Rate</label>
                <input type="number" data-energy-stat="stats.outputRate" value="${stats.outputRate}" min="0">
              </div>
            ` : ''}
            ${stats.capacity !== undefined ? `
              <div class="field-group">
                <label>Capacity</label>
                <input type="number" data-energy-stat="stats.capacity" value="${stats.capacity}" min="0">
              </div>
            ` : ''}
            ${stats.range !== undefined ? `
              <div class="field-group">
                <label>Range</label>
                <input type="number" data-energy-stat="stats.range" value="${stats.range}" min="1">
              </div>
            ` : ''}
            ${isStorage && stats.inputRate !== undefined ? `
              <div class="field-group">
                <label>Input Rate</label>
                <input type="number" data-energy-stat="stats.inputRate" value="${stats.inputRate}" min="0">
              </div>
            ` : ''}
          </div>
        </div>
      </div>`;
    }).join('');
    
    // Add listeners
    list.querySelectorAll('.energy-card').forEach(card => {
      const id = card.dataset.building;
      card.querySelectorAll('[data-energy-stat]').forEach(input => {
        const statPath = input.dataset.energyStat;
        
        input.addEventListener('change', () => {
          const val = parseFloat(input.value);
          if (statPath.startsWith('stats.')) {
            const stat = statPath.split('.')[1];
            if (this.energyBuildings[id].stats) {
              this.energyBuildings[id].stats[stat] = val;
            }
          } else {
            this.energyBuildings[id][statPath] = val;
          }
          this.markChanged();
        });
      });
    });
  }

  markChanged() {
    this.hasChanges = true;
    this.setStatus('Unsaved changes •', 'warning');
  }

  saveChanges() {
    try {
      if (this.config) {
        FileManager.writeConfig(this.config);
      }
      
      if (this.towerPaths) {
        FileManager.writeTowerPaths(this.towerPaths);
      }
      
      if (this.energyBuildings) {
        FileManager.writeEnergyBuildings(this.energyBuildings);
      }
      
      this.hasChanges = false;
      this.setStatus('✓ Saved! Restart game to apply.', 'success');
    } catch (e) {
      console.error('[pt-editor] Save failed:', e);
      this.setStatus('✗ Save failed: ' + e.message, 'error');
    }
  }

  setStatus(text, type = '') {
    const status = this.container.querySelector('.editor-status');
    if (status) {
      status.textContent = text;
      status.className = 'editor-status ' + type;
    }
  }
}

module.exports = { EditorController };
