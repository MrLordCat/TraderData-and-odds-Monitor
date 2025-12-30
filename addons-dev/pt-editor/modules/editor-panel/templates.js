/**
 * PT Editor - HTML Templates
 * Full config editor for Power Towers balance testing
 */

function getLauncherTemplate() {
  return `
<div class="pt-editor-launcher">
  <div class="launcher-icon">⚙️</div>
  <h2>PT Editor</h2>
  <p class="launcher-desc">Game Balance Editor</p>
  <button id="btn-launch" class="btn-launch">
    <span class="btn-icon">🛠️</span>
    <span>Open Editor</span>
  </button>
  <p class="launcher-hint">Opens in a separate window</p>
</div>
`;
}

function getEditorTemplate() {
  return `
<div class="pt-editor">
  <div class="editor-header">
    <h3>⚙️ PT Editor</h3>
    <div class="editor-actions">
      <button class="btn-save" title="Save Changes">💾 Save</button>
      <button class="btn-reload" title="Reload from files">🔄</button>
    </div>
  </div>
  
  <div class="editor-tabs">
    <button class="tab-btn active" data-tab="general">🎮 General</button>
    <button class="tab-btn" data-tab="enemies">👾 Enemies</button>
    <button class="tab-btn" data-tab="towers">🗼 Towers</button>
    <button class="tab-btn" data-tab="energy">⚡ Energy</button>
  </div>
  
  <div class="editor-content">
    <!-- General Tab -->
    <div class="tab-panel active" data-panel="general">
      <div class="section">
        <h4>💰 Starting Resources</h4>
        <div class="fields-grid">
          <div class="field-group">
            <label>Starting Gold</label>
            <input type="number" data-config="STARTING_GOLD" min="0">
          </div>
          <div class="field-group">
            <label>Starting Lives</label>
            <input type="number" data-config="STARTING_LIVES" min="1">
          </div>
        </div>
      </div>
      
      <div class="section">
        <h4>🌊 Wave Settings</h4>
        <div class="fields-grid">
          <div class="field-group">
            <label>Wave Delay (ms)</label>
            <input type="number" data-config="WAVE_DELAY_MS" min="0" step="100">
          </div>
          <div class="field-group">
            <label>Spawn Interval (ms)</label>
            <input type="number" data-config="SPAWN_INTERVAL_MS" min="100" step="50">
          </div>
        </div>
      </div>
      
      <div class="section">
        <h4>📈 Enemy Scaling (per wave)</h4>
        <div class="fields-grid">
          <div class="field-group">
            <label>HP Multiplier</label>
            <input type="number" data-config="ENEMY_HP_MULTIPLIER" min="1" step="0.01">
            <span class="field-hint">x1.1 = +10% HP per wave</span>
          </div>
          <div class="field-group">
            <label>Speed Multiplier</label>
            <input type="number" data-config="ENEMY_SPEED_MULTIPLIER" min="1" step="0.01">
            <span class="field-hint">x1.02 = +2% speed per wave</span>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h4>⭐ XP Settings</h4>
        <div class="fields-grid">
          <div class="field-group">
            <label>XP Multiplier</label>
            <input type="number" data-config="XP_MULTIPLIER" min="0.1" step="0.1">
            <span class="field-hint">1.0 = normal, 2.0 = double XP</span>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h4>🗼 Tower Base Stats</h4>
        <div class="fields-grid">
          <div class="field-group">
            <label>Base Cost</label>
            <input type="number" data-config="BASE_TOWER_COST" min="1">
          </div>
          <div class="field-group">
            <label>Upgrade Cost ×</label>
            <input type="number" data-config="UPGRADE_COST_MULTIPLIER" min="1" step="0.1">
          </div>
          <div class="field-group">
            <label>Base Damage</label>
            <input type="number" data-config="TOWER_BASE_DAMAGE" min="1">
          </div>
          <div class="field-group">
            <label>Base Range (px)</label>
            <input type="number" data-config="TOWER_BASE_RANGE" min="10">
          </div>
          <div class="field-group">
            <label>Base Fire Rate</label>
            <input type="number" data-config="TOWER_BASE_FIRE_RATE" min="0.1" step="0.1">
          </div>
          <div class="field-group">
            <label>Base Energy Cost</label>
            <input type="number" data-config="TOWER_BASE_ENERGY_COST" min="0">
          </div>
        </div>
      </div>
      
      <div class="section">
        <h4>🎯 Projectile</h4>
        <div class="fields-grid">
          <div class="field-group">
            <label>Projectile Speed</label>
            <input type="number" data-config="PROJECTILE_SPEED" min="1">
          </div>
        </div>
      </div>
    </div>
    
    <!-- Enemies Tab -->
    <div class="tab-panel" data-panel="enemies">
      <div class="section">
        <h4>👾 Enemy Types</h4>
        <p class="section-hint">Edit base stats for each enemy type. Actual stats scale with wave.</p>
      </div>
      <div class="enemy-list"></div>
    </div>
    
    <!-- Towers Tab -->
    <div class="tab-panel" data-panel="towers">
      <div class="section">
        <h4>🗼 Element Paths</h4>
        <p class="section-hint">Click path header to expand/collapse tier details.</p>
      </div>
      <div class="tower-paths-list"></div>
    </div>
    
    <!-- Energy Tab -->
    <div class="tab-panel" data-panel="energy">
      <div class="section">
        <h4>⚡ Energy Buildings</h4>
        <p class="section-hint">Configure generators, batteries, and relays.</p>
      </div>
      <div class="energy-buildings-list"></div>
    </div>
  </div>
  
  <div class="editor-footer">
    <div class="editor-status"></div>
    <div class="editor-path"></div>
  </div>
</div>
`;
}

module.exports = { getLauncherTemplate, getEditorTemplate };
