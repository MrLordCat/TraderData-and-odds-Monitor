/**
 * Power Towers TD - Bottom Panel Styles
 * CSS styles for the 3-section bottom panel
 */

function getBottomPanelStyles() {
  return `
    /* ========================================
       UNIFIED HOVER POPUP SYSTEM
       Used by both build-card and stat-item
       ======================================== */
    .hover-popup {
      display: none;
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: 8px;
      min-width: 180px;
      max-width: 280px;
      padding: 10px 12px;
      background: rgba(10, 15, 28, 0.98);
      border: 1px solid rgba(72, 187, 120, 0.6);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 15px rgba(72, 187, 120, 0.15);
      z-index: 9999;
      pointer-events: none;
      font-size: 11px;
      color: #e2e8f0;
      white-space: normal;
      text-align: left;
    }
    
    /* Hoverable container - parent must have this class */
    .has-popup {
      position: relative;
      overflow: visible;
    }
    .has-popup:hover .hover-popup {
      display: block;
    }
    
    /* ========================================
       BOTTOM PANEL - 3 Sections Layout
       ======================================== */
    .bottom-panel {
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 60px);
      max-width: 990px;
      display: flex;
      gap: 2px;
      background: linear-gradient(180deg, rgba(15, 20, 30, 0.95) 0%, rgba(10, 15, 25, 0.98) 100%);
      border: 1px solid rgba(100, 150, 255, 0.2);
      border-radius: 12px;
      height: 243px;
      z-index: 60;
      box-shadow: 0 -4px 30px rgba(0,0,0,0.5);
      backdrop-filter: blur(10px);
      overflow: visible;
    }

    .panel-section {
      background: rgba(25, 30, 45, 0.6);
      padding: 10px;
      display: flex;
      flex-direction: column;
      border-radius: 4px;
      margin: 4px;
      overflow: visible;
      height: calc(100% - 8px);
      box-sizing: border-box;
    }

    /* ========================================
       Section 1: Stats (left)
       ======================================== */
    .panel-stats {
      flex: 28;
      min-width: 200px;
      overflow: visible;
      position: relative;
      z-index: 100;
    }
    
    .panel-stats-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: rgba(255,255,255,0.3);
    }
    .panel-stats-empty .empty-icon {
      font-size: 28px;
      margin-bottom: 6px;
      opacity: 0.5;
    }
    .panel-stats-empty .empty-text {
      font-size: 11px;
    }
    
    .panel-stats-content {
      overflow: visible;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(55px, 1fr));
      gap: 4px;
      align-content: start;
      overflow: visible;
    }
    
    .stat-item {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.25);
      border-radius: 6px;
      padding: 6px 4px;
      cursor: default;
      overflow: visible;
    }
    .stat-item:hover {
      background: rgba(72, 187, 120, 0.15);
    }
    .stat-label {
      font-size: 9px;
      color: #a0aec0;
      margin-bottom: 2px;
    }
    .stat-value {
      font-size: 13px;
      font-weight: 700;
      color: #fff;
    }
    
    /* Stat popup uses unified .hover-popup class - see top of file */
    .stat-item:hover .hover-popup {
      display: block;
    }
    /* Stat popup content styles */
    .hover-popup .detail-line {
      margin-bottom: 4px;
    }
    .hover-popup .detail-line:last-child {
      margin-bottom: 0;
    }
    .hover-popup .detail-label {
      color: #a0aec0;
    }
    .hover-popup .detail-value {
      color: #68d391;
      font-weight: 600;
    }

    /* ========================================
       Section 2: Avatar (center)
       ======================================== */
    .panel-avatar {
      flex: 35;
      min-width: 220px;
      align-items: center;
      justify-content: flex-start;
      overflow: visible;
    }
    
    .avatar-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: rgba(255,255,255,0.3);
    }
    .avatar-placeholder {
      font-size: 36px;
      opacity: 0.4;
      margin-bottom: 6px;
    }
    .avatar-hint {
      font-size: 10px;
      text-align: center;
      line-height: 1.4;
    }
    
    .avatar-content {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 4px;
      width: 100%;
      height: 100%;
      padding: 4px;
    }
    .avatar-header {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      flex: 0 0 auto;
    }
    .avatar-icon {
      font-size: 28px;
      line-height: 1;
    }
    .avatar-info {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 1px;
      flex: 1;
    }
    .avatar-name {
      font-size: 12px;
      font-weight: 700;
      color: #fff;
    }
    .avatar-type {
      font-size: 9px;
      color: #a0aec0;
    }
    .avatar-level {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: #68d391;
    }
    .avatar-bars {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .avatar-bar-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .avatar-xp-bar {
      width: 50px;
      height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      overflow: hidden;
    }
    .avatar-xp-fill {
      height: 100%;
      background: linear-gradient(90deg, #48bb78, #68d391);
      transition: width 0.3s;
    }
    .avatar-xp-value {
      font-size: 8px;
      color: #68d391;
      min-width: 35px;
    }
    .avatar-energy-bar {
      width: 50px;
      height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      overflow: hidden;
    }
    .avatar-energy-fill {
      height: 100%;
      background: linear-gradient(90deg, #4299e1, #63b3ed);
      transition: width 0.3s;
    }
    .avatar-energy-value {
      font-size: 8px;
      color: #63b3ed;
      min-width: 35px;
    }
    
    /* Biome Effects Section */
    .avatar-biome {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 6px 10px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      cursor: help;
      min-width: 80px;
      max-width: 120px;
    }
    .avatar-biome:hover {
      background: rgba(72, 187, 120, 0.1);
      border-color: rgba(72, 187, 120, 0.3);
    }
    .biome-label {
      font-size: 8px;
      color: #a0aec0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .biome-summary {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 2px 6px;
      font-size: 10px;
      font-weight: 600;
      color: #e2e8f0;
      text-align: center;
      line-height: 1.3;
    }
    .biome-summary .mod-item {
      white-space: nowrap;
    }
    .biome-summary .positive { color: #68d391; }
    .biome-summary .negative { color: #fc8181; }
    
    /* Biome Popup */
    .biome-popup {
      min-width: 200px;
      max-width: 280px;
    }
    .biome-popup-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .biome-source {
      padding: 6px;
      background: rgba(255,255,255,0.03);
      border-radius: 4px;
    }
    .biome-source-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .biome-source-emoji {
      font-size: 14px;
    }
    .biome-source-name {
      font-size: 11px;
      font-weight: 600;
      color: #e2e8f0;
    }
    .biome-source-type {
      font-size: 9px;
      color: #a0aec0;
      margin-left: auto;
    }
    .biome-modifiers {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .biome-mod {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      background: rgba(255,255,255,0.05);
    }
    .biome-mod.positive {
      color: #68d391;
      background: rgba(104, 211, 145, 0.1);
    }
    .biome-mod.negative {
      color: #fc8181;
      background: rgba(252, 129, 129, 0.1);
    }

    /* Avatar inline actions (attack type / element) */
    .avatar-actions {
      width: 100%;
      flex: 1 1 auto;
      display: flex;
      gap: 4px;
      margin-top: 4px;
      min-height: 0;
    }
    .avatar-subsection {
      width: 100%;
      flex: 1 1 auto;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px;
      padding: 4px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-height: 0;
    }
    .avatar-subtitle {
      font-size: 10px;
      color: #a0aec0;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      flex: 0 0 auto;
    }
    .avatar-card-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      grid-auto-rows: 1fr;
      gap: 4px;
      flex: 1 1 auto;
      min-height: 0;
    }
    /* 3 columns for element selection */
    #action-element .avatar-card-row {
      grid-template-columns: repeat(3, 1fr);
    }
    .avatar-action-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      padding: 10px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.05);
      color: #e2e8f0;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s ease;
      min-height: 40px;
    }
    .avatar-action-card:hover {
      background: rgba(104, 211, 145, 0.18);
      border-color: rgba(104, 211, 145, 0.5);
      transform: translateY(-1px);
    }
    .avatar-action-card .card-icon { font-size: 16px; }
    .avatar-action-card .card-label { font-size: 10px; font-weight: 500; }

    /* ========================================
       Section 3: Build/Actions (right)
       ======================================== */
    .panel-build {
      flex: 42;
      min-width: 0;
      overflow: visible;
    }
    
    /* Build Menu - unified grid */
    .build-menu {
      display: flex;
      height: 100%;
      overflow: visible;
    }
    
    .build-cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 4px;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    
    /* Build Card */
    .build-card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      padding: 6px 4px;
      background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      overflow: visible;
    }
    .build-card:hover {
      background: linear-gradient(135deg, rgba(72, 187, 120, 0.2) 0%, rgba(72, 187, 120, 0.1) 100%);
      border-color: rgba(72, 187, 120, 0.5);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .build-card.placing {
      background: linear-gradient(135deg, rgba(236, 201, 75, 0.3) 0%, rgba(236, 201, 75, 0.15) 100%);
      border-color: #ecc94b;
      box-shadow: 0 0 12px rgba(236, 201, 75, 0.4);
    }
    .build-card.disabled {
      opacity: 0.4;
      pointer-events: none;
    }
    
    .build-card-icon {
      font-size: 18px;
      line-height: 1;
    }
    .build-card-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
    }
    .build-card-name {
      font-size: 8px;
      font-weight: 600;
      color: #a0aec0;
      white-space: nowrap;
    }
    .build-card-price {
      font-size: 8px;
      color: #ffd700;
      font-weight: 600;
    }
    
    /* Build Card Popup (tooltip on hover) */
    .build-card-popup {
      display: none;
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: 8px;
      width: 200px;
      padding: 10px 12px;
      background: rgba(10, 15, 28, 0.98);
      border: 1px solid rgba(72, 187, 120, 0.6);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 0 15px rgba(72, 187, 120, 0.15);
      z-index: 9999;
      pointer-events: none;
      text-align: left;
    }
    .build-card:hover .build-card-popup {
      display: block;
    }
    
    .popup-title {
      font-size: 12px;
      font-weight: 700;
      color: #68d391;
      margin-bottom: 4px;
    }
    .popup-price {
      font-size: 10px;
      color: #ffd700;
      margin-bottom: 6px;
    }
    .popup-desc {
      font-size: 10px;
      color: #a0aec0;
      margin-bottom: 8px;
      line-height: 1.3;
    }
    .popup-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
    }
    .popup-stat {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      padding: 3px 6px;
      background: rgba(255,255,255,0.05);
      border-radius: 3px;
    }
    .popup-stat span { color: #a0aec0; }
    .popup-stat b { color: #fff; }
    .popup-stat.highlight {
      background: rgba(72, 187, 120, 0.2);
    }
    .popup-stat.highlight b { color: #68d391; }
    .popup-stat.warning b { color: #f6ad55; }

    /* ========================================
       Actions Menu (when object selected)
       ======================================== */
    .actions-menu {
      display: flex;
      flex-direction: column;
      gap: 8px;
      height: 100%;
    }
    
    /* Tower upgrades two-column layout */
    .tower-upgrades-container {
      display: flex;
      gap: 8px;
      height: 100%;
    }
    .upgrades-column,
    .abilities-column {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .column-header {
      font-size: 10px;
      font-weight: 600;
      color: #a0aec0;
      padding: 4px 6px;
      background: rgba(255,255,255,0.05);
      border-radius: 4px;
      margin-bottom: 4px;
      text-align: center;
    }
    
    .actions-row {
      display: flex;
      gap: 6px;
    }
    
    .action-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      color: #a0aec0;
      cursor: pointer;
      transition: all 0.2s;
    }
    .action-btn:hover {
      background: rgba(72, 187, 120, 0.15);
      border-color: rgba(72, 187, 120, 0.4);
      color: #68d391;
    }
    .action-btn.active {
      background: rgba(72, 187, 120, 0.2);
      border-color: #68d391;
      color: #68d391;
    }
    .action-icon { font-size: 16px; }
    .action-label { font-size: 9px; }
    
    .upgrades-panel,
    .abilities-panel {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }
    
    .energy-actions-grid {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .energy-action {
      flex: none !important;
      width: 100%;
    }
    
    .upgrades-grid,
    .abilities-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4px;
      padding: 2px;
    }
    
    /* Upgrade Card Styles */
    .upgrade-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 6px 4px;
      background: rgba(40, 50, 70, 0.9);
      border: 1px solid rgba(100, 120, 150, 0.5);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      min-height: 50px;
    }
    .upgrade-card:hover {
      background: rgba(72, 187, 120, 0.15);
      border-color: rgba(72, 187, 120, 0.5);
      transform: translateY(-1px);
    }
    .upgrade-card.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .upgrade-card.disabled:hover {
      transform: none;
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.1);
    }
    .upgrade-card.maxed {
      opacity: 0.7;
      cursor: default;
      border-color: rgba(72, 187, 120, 0.6);
      background: rgba(72, 187, 120, 0.1);
    }
    .upgrade-card.maxed:hover {
      transform: none;
    }
    .upgrade-card.maxed .card-cost {
      color: #68d391;
    }
    .ability-hint {
      text-align: center;
      padding: 16px;
      color: rgba(255,255,255,0.5);
      font-size: 11px;
    }
    .upgrade-card .card-top {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 2px;
    }
    .upgrade-card .card-icon {
      font-size: 16px;
    }
    .upgrade-card .card-name {
      font-size: 11px;
      font-weight: 600;
      color: #e2e8f0;
    }
    .upgrade-card .card-bottom {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      font-size: 10px;
      color: #a0aec0;
    }
    .upgrade-card .card-cost {
      color: #ffd700;
      font-weight: 600;
      font-size: 11px;
      display: flex;
      flex-direction: column;
      align-items: center;
      line-height: 1.2;
    }
    .upgrade-card .card-cost .original-price {
      color: #888;
      font-size: 9px;
      text-decoration: line-through;
    }
    .upgrade-card .card-cost .discounted-price {
      color: #4ade80;
      font-size: 12px;
      font-weight: 700;
    }
    .upgrade-card .card-cost .discount-badge {
      color: #4ade80;
      font-size: 8px;
      background: rgba(74, 222, 128, 0.2);
      padding: 1px 4px;
      border-radius: 3px;
      margin-top: 1px;
    }
    .upgrade-card .card-level {
      color: #68d391;
      font-size: 10px;
    }
    .upgrade-card .card-bonus {
      color: #63b3ed;
      font-size: 10px;
    }
    
    /* Attack Type Upgrade Separator */
    .upgrade-separator {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px 0;
      margin: 4px 0;
      border-top: 1px solid rgba(74, 144, 217, 0.3);
    }
    .upgrade-separator span {
      font-size: 10px;
      color: #4a90d9;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    /* Attack Type Specific Upgrades */
    .upgrade-card.attack-type-upgrade {
      border-color: rgba(74, 144, 217, 0.4);
      background: rgba(74, 144, 217, 0.1);
    }
    .upgrade-card.attack-type-upgrade:hover {
      border-color: rgba(74, 144, 217, 0.8);
      background: rgba(74, 144, 217, 0.2);
    }
    .upgrade-card.attack-type-upgrade .card-name {
      color: #63b3ed;
    }
  `;
}

module.exports = { getBottomPanelStyles };
