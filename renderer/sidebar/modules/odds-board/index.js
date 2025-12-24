/**
 * Odds Board Module - Aggregated odds table with auto trading controls
 */

const { SidebarModule, registerModule } = require('../../core/sidebar-base');

class OddsBoardModule extends SidebarModule {
  static id = 'odds-board';
  static title = 'Aggregated Odds';
  static order = 10;
  
  constructor(options) {
    super(options);
    this.oddsData = new Map(); // brokerId -> odds
    this.autoActive = false;
  }
  
  getTemplate() {
    return `
      <div class="odds-header">
        <label class="map-selector">
          Map
          <select id="map-select" class="md-select">
            <option value="0">Match</option>
            <option value="1" selected>1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </label>
        <button id="map-refresh" class="md-icon-btn md-icon-btn--small" data-tooltip="Refresh odds">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
        </button>
        <label class="md-checkbox" title="Use match market for final map">
          <input type="checkbox" id="is-last-chk" class="md-checkbox__input" />
          <span class="md-checkbox__box"></span>
          <span class="md-checkbox__label">Last</span>
        </label>
        <span id="tol-badge" class="md-badge md-badge--large md-badge--secondary" data-tooltip="Auto tolerance">Tol: —</span>
      </div>
      
      <div class="odds-table-wrap">
        <table class="odds-table">
          <thead>
            <tr>
              <th class="col-broker">Broker</th>
              <th id="side1-header" class="col-odds">Side 1</th>
              <th id="side2-header" class="col-odds">Side 2</th>
            </tr>
          </thead>
          <tbody id="odds-rows"></tbody>
          <tfoot>
            <tr id="mid-row">
              <th>Mid</th>
              <td colspan="2" id="mid-value">—</td>
            </tr>
            <tr id="excel-row">
              <th>
                <div class="excel-controls">
                  Excel
                  <button id="auto-btn" class="auto-btn">Auto</button>
                  <button id="script-btn" class="script-btn">S</button>
                  <span id="script-map-badge" class="md-badge md-badge--dot md-badge--secondary">—</span>
                </div>
              </th>
              <td colspan="2">
                <span id="excel-odds">—</span>
                <span id="excel-status" class="md-text-muted md-text-xs md-hidden">idle</span>
              </td>
            </tr>
            <tr id="auto-row" class="md-hidden">
              <th></th>
              <td colspan="2">
                <div class="auto-indicators">
                  <span class="auto-dot side1" data-tooltip="Adjusting side 1"></span>
                  <span class="auto-dot side2" data-tooltip="Adjusting side 2"></span>
                  <span id="auto-status" class="auto-status"></span>
                </div>
              </td>
            </tr>
            <tr id="arb-row">
              <th>Arb</th>
              <td colspan="2" id="arb-value">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }
  
  onMount(container) {
    super.onMount(container);
    
    // Remove header (we have our own in template)
    const header = container.querySelector('.module-header');
    if (header) header.remove();
    
    const content = container.querySelector('.module-content');
    if (content) content.classList.add('no-padding');
    
    this.bindEvents();
    this.loadInitialState();
  }
  
  bindEvents() {
    const api = window.desktopAPI;
    if (!api) return;
    
    // Map selector
    const mapSelect = this.$('#map-select');
    if (mapSelect) {
      mapSelect.addEventListener('change', () => {
        const map = parseInt(mapSelect.value, 10);
        api.setMap?.(map);
        this.emit('mapChanged', map);
      });
    }
    
    // Map refresh
    this.$('#map-refresh')?.addEventListener('click', () => {
      api.refreshMap?.();
    });
    
    // Is last checkbox
    const isLastChk = this.$('#is-last-chk');
    if (isLastChk) {
      isLastChk.addEventListener('change', () => {
        api.setIsLast?.(isLastChk.checked);
      });
    }
    
    // Auto button
    this.$('#auto-btn')?.addEventListener('click', () => {
      this.toggleAuto();
    });
    
    // Script button
    this.$('#script-btn')?.addEventListener('click', () => {
      api.toggleExcelScript?.();
    });
    
    // Subscribe to odds updates
    this.subscribeIpc('onOddsUpdate', (payload) => {
      this.handleOddsUpdate(payload);
    });
    
    // Subscribe to team names
    this.subscribeIpc('onExcelTeamNames', ({ team1, team2 }) => {
      this.setTeamHeaders(team1, team2);
    });
    
    // Subscribe to auto state
    this.subscribeIpc('onAutoStateUpdated', (state) => {
      this.updateAutoState(state);
    });
  }
  
  loadInitialState() {
    const api = window.desktopAPI;
    if (!api) return;
    
    // Load current map
    api.getMap?.().then(map => {
      const sel = this.$('#map-select');
      if (sel && map !== undefined) sel.value = String(map);
    }).catch(() => {});
    
    // Load team names
    api.getTeamNames?.().then(names => {
      if (names) this.setTeamHeaders(names.team1, names.team2);
    }).catch(() => {});
    
    // Load tolerance
    api.getTolerance?.().then(tol => {
      this.updateTolerance(tol);
    }).catch(() => {});
  }
  
  handleOddsUpdate(payload) {
    if (!payload || !payload.broker) return;
    
    const { broker, odds, frozen } = payload;
    this.oddsData.set(broker, { odds, frozen, ts: Date.now() });
    
    this.renderRows();
    this.calculateDerived();
  }
  
  renderRows() {
    const tbody = this.$('#odds-rows');
    if (!tbody) return;
    
    // Clear and rebuild rows
    tbody.innerHTML = '';
    
    this.oddsData.forEach((data, brokerId) => {
      if (brokerId === 'excel') return; // Excel shown in footer
      
      const tr = document.createElement('tr');
      tr.dataset.broker = brokerId;
      if (data.frozen) tr.classList.add('frozen');
      
      const odds = data.odds || ['-', '-'];
      tr.innerHTML = `
        <td class="col-broker">${this.formatBrokerName(brokerId)}</td>
        <td class="col-odds numeric">${this.formatOdds(odds[0])}</td>
        <td class="col-odds numeric">${this.formatOdds(odds[1])}</td>
      `;
      
      tbody.appendChild(tr);
    });
  }
  
  calculateDerived() {
    // Calculate mid odds
    const validOdds = [];
    this.oddsData.forEach((data, id) => {
      if (id !== 'excel' && data.odds) {
        const o1 = parseFloat(data.odds[0]);
        const o2 = parseFloat(data.odds[1]);
        if (!isNaN(o1) && !isNaN(o2)) {
          validOdds.push([o1, o2]);
        }
      }
    });
    
    if (validOdds.length > 0) {
      const mid1 = validOdds.reduce((s, o) => s + o[0], 0) / validOdds.length;
      const mid2 = validOdds.reduce((s, o) => s + o[1], 0) / validOdds.length;
      
      const midEl = this.$('#mid-value');
      if (midEl) midEl.textContent = `${mid1.toFixed(2)} / ${mid2.toFixed(2)}`;
      
      // Calculate arb
      const arb = (1 / mid1 + 1 / mid2 - 1) * 100;
      const arbEl = this.$('#arb-value');
      if (arbEl) {
        arbEl.textContent = `${arb.toFixed(2)}%`;
        arbEl.className = arb < 0 ? 'md-text-success positive' : 'md-text-error negative';
      }
    }
    
    // Update Excel odds
    const excelData = this.oddsData.get('excel');
    if (excelData && excelData.odds) {
      const excelEl = this.$('#excel-odds');
      if (excelEl) {
        excelEl.textContent = `${excelData.odds[0]} / ${excelData.odds[1]}`;
      }
    }
  }
  
  formatBrokerName(id) {
    // Capitalize first letter
    return id.charAt(0).toUpperCase() + id.slice(1);
  }
  
  formatOdds(val) {
    if (val === '-' || val === '' || val == null) return '-';
    const num = parseFloat(val);
    return isNaN(num) ? '-' : num.toFixed(2);
  }
  
  setTeamHeaders(team1, team2) {
    const h1 = this.$('#side1-header');
    const h2 = this.$('#side2-header');
    if (h1) h1.textContent = team1 || 'Side 1';
    if (h2) h2.textContent = team2 || 'Side 2';
  }
  
  updateTolerance(tol) {
    const badge = this.$('#tol-badge');
    if (badge) {
      badge.textContent = `Tol: ${typeof tol === 'number' ? tol.toFixed(1) + '%' : '—'}`;
    }
  }
  
  toggleAuto() {
    // Emit event for auto toggle (handled by auto_core)
    window.desktopAPI?.toggleAuto?.();
    this.emit('autoToggle');
  }
  
  updateAutoState(state) {
    const btn = this.$('#auto-btn');
    const row = this.$('#auto-row');
    const status = this.$('#auto-status');
    
    if (btn) {
      btn.classList.toggle('active', state?.active);
      btn.textContent = state?.active ? 'Auto ●' : 'Auto';
    }
    
    if (row) {
      row.classList.toggle('sb-hidden', !state?.active);
    }
    
    if (status && state?.status) {
      status.textContent = state.status;
    }
  }
}

// Register module
registerModule(OddsBoardModule);

module.exports = OddsBoardModule;
