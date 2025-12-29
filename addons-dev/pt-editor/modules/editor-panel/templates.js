/**
 * PT Editor - HTML Templates
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
    <button class="tab-btn active" data-tab="waves">🌊 Waves</button>
    <button class="tab-btn" data-tab="enemies">👾 Enemies</button>
    <button class="tab-btn" data-tab="towers">🗼 Towers</button>
    <button class="tab-btn" data-tab="economy">💰 Economy</button>
  </div>
  
  <div class="editor-content">
    <!-- Waves Tab -->
    <div class="tab-panel active" data-panel="waves">
      <div class="section">
        <h4>Wave Settings</h4>
        <div class="field-group">
          <label>Wave Delay (ms)</label>
          <input type="number" data-config="WAVE_DELAY_MS" min="0" step="100">
        </div>
        <div class="field-group">
          <label>Spawn Interval (ms)</label>
          <input type="number" data-config="SPAWN_INTERVAL_MS" min="100" step="50">
        </div>
        <div class="field-group">
          <label>Base Enemy Count</label>
          <input type="number" data-config="ENEMIES_BASE_COUNT" min="1">
        </div>
        <div class="field-group">
          <label>Enemies per Wave (+)</label>
          <input type="number" data-config="ENEMIES_PER_WAVE" min="0" step="0.5">
        </div>
      </div>
      
      <div class="section">
        <h4>Difficulty Scaling</h4>
        <div class="field-group">
          <label>Enemy HP per Wave (+)</label>
          <input type="number" data-config="ENEMY_HP_PER_WAVE" min="0">
        </div>
        <div class="field-group">
          <label>Enemy Speed per Wave (+)</label>
          <input type="number" data-config="ENEMY_SPEED_PER_WAVE" min="0" step="0.01">
        </div>
      </div>
    </div>
    
    <!-- Enemies Tab -->
    <div class="tab-panel" data-panel="enemies">
      <div class="enemy-list"></div>
    </div>
    
    <!-- Towers Tab -->
    <div class="tab-panel" data-panel="towers">
      <div class="tower-paths-list"></div>
    </div>
    
    <!-- Economy Tab -->
    <div class="tab-panel" data-panel="economy">
      <div class="section">
        <h4>Starting Resources</h4>
        <div class="field-group">
          <label>Starting Gold</label>
          <input type="number" data-config="STARTING_GOLD" min="0">
        </div>
        <div class="field-group">
          <label>Starting Lives</label>
          <input type="number" data-config="STARTING_LIVES" min="1">
        </div>
        <div class="field-group">
          <label>Starting Energy</label>
          <input type="number" data-config="STARTING_ENERGY" min="0">
        </div>
        <div class="field-group">
          <label>Max Energy</label>
          <input type="number" data-config="MAX_ENERGY" min="1">
        </div>
        <div class="field-group">
          <label>Energy Regen/tick</label>
          <input type="number" data-config="ENERGY_REGEN" min="0" step="0.1">
        </div>
      </div>
      
      <div class="section">
        <h4>Tower Costs</h4>
        <div class="field-group">
          <label>Base Tower Cost</label>
          <input type="number" data-config="BASE_TOWER_COST" min="1">
        </div>
        <div class="field-group">
          <label>Upgrade Cost Multiplier</label>
          <input type="number" data-config="UPGRADE_COST_MULTIPLIER" min="1" step="0.1">
        </div>
      </div>
      
      <div class="section">
        <h4>Tower Base Stats</h4>
        <div class="field-group">
          <label>Base Damage</label>
          <input type="number" data-config="TOWER_BASE_DAMAGE" min="1">
        </div>
        <div class="field-group">
          <label>Base Range (px)</label>
          <input type="number" data-config="TOWER_BASE_RANGE" min="10">
        </div>
        <div class="field-group">
          <label>Base Fire Rate (atk/s)</label>
          <input type="number" data-config="TOWER_BASE_FIRE_RATE" min="0.1" step="0.1">
        </div>
        <div class="field-group">
          <label>Base Energy Cost</label>
          <input type="number" data-config="TOWER_BASE_ENERGY_COST" min="0">
        </div>
      </div>
      
      <div class="section">
        <h4>Enemy Rewards</h4>
        <div class="field-group">
          <label>Base Reward</label>
          <input type="number" data-config="ENEMY_BASE_REWARD" min="0">
        </div>
      </div>
    </div>
  </div>
  
  <div class="editor-status"></div>
</div>
`;
}

module.exports = { getLauncherTemplate, getEditorTemplate };
