/**
 * Power Towers TD - CSS Styles
 */

/**
 * Launcher styles for attached mode (sidebar)
 */
function getLauncherStyles() {
  return `
    .game-launcher {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 20px;
      box-sizing: border-box;
    }
    .launcher-content { text-align: center; max-width: 280px; }
    .launcher-icon { font-size: 64px; margin-bottom: 12px; }
    .launcher-title { margin: 0 0 4px 0; font-size: 20px; color: #fff; }
    .launcher-subtitle { margin: 0 0 24px 0; font-size: 13px; color: #a0aec0; }
    .launcher-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 14px 24px;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 15px rgba(72, 187, 120, 0.3);
    }
    .launcher-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(72, 187, 120, 0.4);
    }
    .launcher-btn:active { transform: translateY(0); }
    .launcher-btn .btn-icon { font-size: 20px; }
    .launcher-hint { margin: 16px 0 0 0; font-size: 11px; color: #718096; }
  `;
}

/**
 * Full game styles for detached mode
 */
function getGameStyles() {
  return `
    .game-panel-container {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-family: 'Segoe UI', sans-serif;
      height: 100%;
      min-height: 0;
      box-sizing: border-box;
      overflow: hidden;
    }
    
    .game-screen { display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0; overflow: hidden; }
    .game-screen.menu-screen { align-items: center; justify-content: center; padding: 20px; }
    .gameplay-screen { flex: 1; min-height: 0; }
    
    .menu-title { text-align: center; margin-bottom: 24px; }
    .menu-icon { font-size: 64px; display: block; margin-bottom: 12px; }
    .menu-title h2 { margin: 0; font-size: 28px; color: #fff; }
    .menu-subtitle { margin: 6px 0 0; font-size: 15px; color: #a0aec0; }
    
    .menu-buttons { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 260px; }
    .menu-btn {
      padding: 14px 20px; border: none; border-radius: 10px;
      background: rgba(255,255,255,0.1); color: #e2e8f0;
      font-size: 16px; cursor: pointer; transition: all 0.2s;
    }
    .menu-btn:hover { background: rgba(255,255,255,0.15); transform: translateX(4px); }
    .menu-btn.primary { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; font-weight: 600; }
    .menu-btn.primary:hover { box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3); }
    
    .menu-footer { margin-top: 32px; }
    .menu-footer .version { font-size: 11px; color: #718096; }
    
    .screen-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-shrink: 0; }
    .screen-header h3 { margin: 0; font-size: 18px; color: #fff; }
    .back-btn {
      padding: 8px 14px; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px;
      background: transparent; color: #a0aec0; font-size: 13px; cursor: pointer;
    }
    .back-btn:hover { background: rgba(255,255,255,0.1); }
    .back-btn.small { padding: 6px 10px; font-size: 12px; }
    
    .upgrades-list, .tips-list, .settings-list { display: flex; flex-direction: column; gap: 10px; }
    .upgrade-item, .setting-item {
      display: flex; align-items: center; gap: 12px;
      padding: 14px; background: rgba(0,0,0,0.3); border-radius: 10px;
    }
    .upgrade-icon { font-size: 28px; }
    .upgrade-info { flex: 1; }
    .upgrade-name { display: block; font-weight: 500; color: #fff; font-size: 15px; }
    .upgrade-desc { font-size: 12px; color: #a0aec0; }
    .upgrade-btn { padding: 8px 14px; border: none; border-radius: 6px; background: rgba(255,255,255,0.1); color: #a0aec0; }
    .tip-item { padding: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; font-size: 14px; color: #e2e8f0; }
    .setting-item { justify-content: space-between; font-size: 14px; color: #e2e8f0; }
    .toggle-btn { padding: 6px 14px; border: none; border-radius: 6px; background: rgba(255,255,255,0.1); color: #a0aec0; }
    .coming-soon { text-align: center; color: #718096; font-size: 13px; margin-top: 16px; }
    
    .game-stats-bar {
      display: flex; justify-content: space-between;
      padding: 10px 14px; background: rgba(0,0,0,0.4); border-radius: 8px;
      font-size: 15px; flex-shrink: 0;
    }
    .stat-item { display: flex; align-items: center; gap: 6px; }
    .stat-icon { font-size: 18px; }
    .stat-value { font-weight: bold; min-width: 28px; }
    .stat-value.danger { color: #fc8181; }
    .stat-value.warning { color: #f6ad55; }
    
    .canvas-container { 
      position: relative; border-radius: 10px; overflow: hidden; 
      flex: 1; min-height: 0;
      display: flex; align-items: center; justify-content: center;
      background: #0a0a12;
    }
    #game-canvas {
      display: block;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      cursor: crosshair;
    }
    
    .game-overlay {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.85);
      display: flex; align-items: center; justify-content: center;
    }
    .overlay-content { text-align: center; }
    .overlay-content h3 { margin: 0 0 10px; font-size: 28px; color: #fff; }
    .overlay-content p { margin: 0 0 20px; color: #a0aec0; font-size: 16px; }
    
    .build-toolbar {
      padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; flex-shrink: 0;
      display: flex; flex-direction: row; gap: 12px; flex-wrap: wrap; align-items: center;
    }
    .toolbar-section { 
      display: flex; 
      align-items: center;
      gap: 8px;
    }
    .section-label {
      font-size: 12px;
      color: #a0aec0;
      min-width: 70px;
    }
    .tower-select, .attack-type-select, .element-select, .energy-select {
      display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;
    }
    .tower-item, .attack-type-item, .element-item, .energy-item {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      cursor: pointer; transition: all 0.2s;
    }
    .tower-item:hover, .attack-type-item:hover, .element-item:hover, .energy-item:hover { transform: scale(1.05); }
    .tower-item.selected .tower-btn,
    .attack-type-item.selected .type-btn,
    .element-item.selected .element-btn,
    .energy-item.selected .energy-btn { 
      border-color: #48bb78; 
      background: rgba(72,187,120,0.3); 
      box-shadow: 0 0 10px rgba(72,187,120,0.4); 
    }
    .tower-item.placing .tower-btn,
    .energy-item.placing .energy-btn { border-color: #ecc94b; background: rgba(236,201,75,0.3); animation: pulse-build 0.8s infinite; }
    .tower-item.disabled, .attack-type-item.disabled, .element-item.disabled, .energy-item.disabled { opacity: 0.4; pointer-events: none; }
    .tower-btn, .type-btn, .element-btn, .energy-btn {
      width: 42px; height: 42px;
      border: 2px solid rgba(255,255,255,0.2); border-radius: 10px;
      background: rgba(255,255,255,0.1);
      font-size: 20px; transition: all 0.2s;
      pointer-events: none; /* Let parent handle clicks */
    }
    .energy-btn { border-color: rgba(255,193,7,0.4); background: rgba(255,193,7,0.1); }
    .tower-item:hover .tower-btn,
    .attack-type-item:hover .type-btn,
    .element-item:hover .element-btn,
    .energy-item:hover .energy-btn { background: rgba(255,255,255,0.2); }
    .tower-price, .type-price, .element-price, .energy-price {
      font-size: 10px; color: #ffd700; font-weight: 600;
      pointer-events: none; /* Let parent handle clicks */
    }
    .tower-item.disabled .tower-price,
    .attack-type-item.disabled .type-price,
    .element-item.disabled .element-price,
    .energy-item.disabled .energy-price { color: #fc8181; }
    @keyframes pulse-build {
      0%, 100% { box-shadow: 0 0 5px rgba(236,201,75,0.4); }
      50% { box-shadow: 0 0 15px rgba(236,201,75,0.7); }
    }
    
    .game-controls { display: flex; gap: 10px; flex-shrink: 0; }
    .game-btn {
      flex: 1; padding: 14px; border: none; border-radius: 8px;
      font-size: 15px; font-weight: 500; cursor: pointer; transition: all 0.2s;
    }
    .game-btn.primary { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; }
    .game-btn.primary:hover { box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3); }
    .game-btn:not(.primary) { background: rgba(255,255,255,0.1); color: #e2e8f0; }
    .game-btn:not(.primary):hover { background: rgba(255,255,255,0.15); }
    .game-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .game-btn.small { flex: none; padding: 10px 16px; font-size: 13px; }
    .game-btn.danger { background: rgba(252,129,129,0.2); color: #fc8181; }
    .game-btn.active { background: #ecc94b; color: #1a202c; }
    
    /* Tower Tooltip - Floating popup */
    .tower-tooltip {
      position: absolute;
      z-index: 100;
      min-width: 200px;
      max-width: 280px;
      padding: 12px;
      background: rgba(20, 20, 35, 0.95);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      backdrop-filter: blur(10px);
      pointer-events: auto;
      display: none;
      opacity: 0;
      transform: translateY(-10px);
      transition: opacity 0.2s, transform 0.2s;
    }
    .tower-tooltip.visible {
      display: block;
      opacity: 1;
      transform: translateY(0);
    }
    
    .tooltip-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .tooltip-icon { font-size: 28px; }
    .tooltip-title-group { flex: 1; }
    .tooltip-name { display: block; font-weight: 600; color: #fff; font-size: 14px; }
    .tooltip-level { font-size: 11px; color: #48bb78; font-weight: 600; }
    .level-progress-bar {
      height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      margin-top: 4px;
      overflow: hidden;
    }
    .level-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #48bb78, #68d391);
      border-radius: 2px;
      transition: width 0.3s ease;
    }
    .level-progress-text {
      font-size: 9px;
      color: #a0aec0;
      margin-top: 2px;
      display: block;
    }
    .tooltip-close {
      width: 24px; height: 24px;
      border: none; border-radius: 50%;
      background: rgba(255,255,255,0.1);
      color: #a0aec0;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tooltip-close:hover { background: rgba(252,129,129,0.3); color: #fc8181; }
    
    .tooltip-type-row {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      font-size: 12px;
      color: #a0aec0;
    }
    .tooltip-attack-type, .tooltip-element {
      padding: 3px 8px;
      background: rgba(255,255,255,0.08);
      border-radius: 4px;
    }
    
    /* Biome Effects Section */
    .tooltip-biome-section {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      margin-bottom: 10px;
      background: linear-gradient(135deg, rgba(72, 187, 120, 0.15) 0%, rgba(56, 161, 105, 0.1) 100%);
      border: 1px solid rgba(72, 187, 120, 0.3);
      border-radius: 6px;
      font-size: 11px;
      position: relative;
      cursor: pointer;
    }
    .biome-icons {
      font-size: 14px;
      cursor: help;
    }
    .biome-bonus {
      margin-left: auto;
      color: #48bb78;
      font-weight: 600;
    }
    .biome-bonus.penalty {
      color: #fc8181;
    }
    .biome-detail-popup {
      min-width: 160px;
    }
    .detail-header {
      font-weight: 600;
      color: #48bb78;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(72, 187, 120, 0.3);
    }
    .detail-separator {
      height: 1px;
      background: rgba(255,255,255,0.1);
      margin: 6px 0;
    }
    
    .tooltip-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 12px;
    }
    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 8px;
      background: rgba(0,0,0,0.3);
      border-radius: 4px;
      font-size: 11px;
      color: #e2e8f0;
      position: relative;
    }
    .stat-row b { color: #ffd700; }
    
    .stat-hoverable {
      cursor: help;
      transition: background 0.15s;
    }
    .stat-hoverable:hover {
      background: rgba(255,255,255,0.1);
    }
    .stat-hoverable:hover .stat-detail-popup {
      display: block;
    }
    
    .stat-detail-popup {
      display: none;
      position: absolute;
      left: 105%;
      top: 50%;
      transform: translateY(-50%);
      background: #1a1a2e;
      border: 1px solid #4a5568;
      border-radius: 6px;
      padding: 8px 10px;
      min-width: 180px;
      z-index: 1000;
      font-size: 11px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      white-space: nowrap;
    }
    .stat-detail-popup::before {
      content: '';
      position: absolute;
      left: -6px;
      top: 50%;
      transform: translateY(-50%);
      border: 6px solid transparent;
      border-right-color: #4a5568;
    }
    .stat-detail-popup::after {
      content: '';
      position: absolute;
      left: -5px;
      top: 50%;
      transform: translateY(-50%);
      border: 5px solid transparent;
      border-right-color: #1a1a2e;
    }
    
    .detail-line {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      margin-bottom: 3px;
    }
    .detail-line:last-child { margin-bottom: 0; }
    .detail-label { color: #a0aec0; }
    .detail-value { color: #48bb78; font-weight: 600; }
    .detail-value.penalty { color: #fc8181; }
    .detail-value.bonus { color: #48bb78; }
    .detail-base { color: #63b3ed; }
    .detail-level { color: #f6ad55; }
    .detail-upgrade { color: #fc8181; }
    .detail-upgrade.bonus { color: #48bb78; }
    .detail-final { color: #ffd700; font-weight: 700; }
    .detail-formula {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid rgba(255,255,255,0.1);
      font-size: 10px;
      color: #718096;
    }
    
    /* Level bar container for energy buildings */
    .level-bar-container {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      padding: 4px 6px;
      background: rgba(0,0,0,0.3);
      border-radius: 4px;
    }
    .level-bar-container .level-progress-bar {
      flex: 1;
      height: 6px;
    }
    .level-bar-container .level-progress-text {
      font-size: 10px;
      color: #a0aec0;
      min-width: 60px;
      text-align: right;
    }
    
    .tooltip-section {
      margin-bottom: 10px;
      padding: 8px;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
    }
    .section-title {
      font-size: 11px;
      color: #a0aec0;
      margin-bottom: 6px;
    }
    .tooltip-buttons {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .tooltip-type-btn, .tooltip-element-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 48px; height: 48px;
      border: 2px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      background: rgba(255,255,255,0.1);
      font-size: 18px;
      cursor: pointer;
      transition: all 0.2s;
      gap: 2px;
    }
    .tooltip-type-btn .btn-cost, .tooltip-element-btn .btn-cost {
      font-size: 9px;
      color: #ffd700;
    }
    .tooltip-type-btn:hover, .tooltip-element-btn:hover {
      transform: scale(1.05);
      border-color: #48bb78;
      background: rgba(72,187,120,0.2);
    }
    .tooltip-type-btn.active, .tooltip-element-btn.active {
      border-color: #48bb78;
      background: rgba(72,187,120,0.3);
      box-shadow: 0 0 10px rgba(72,187,120,0.5);
    }
    .tooltip-type-btn.disabled, .tooltip-element-btn.disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none !important;
    }
    
    .tooltip-actions {
      display: flex;
      gap: 8px;
    }
    .tooltip-action-btn {
      flex: 1;
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tooltip-action-btn.upgrade {
      background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
      color: white;
    }
    .tooltip-action-btn.upgrade:hover { box-shadow: 0 2px 8px rgba(72, 187, 120, 0.4); }
    .tooltip-action-btn.upgrade.active {
      background: linear-gradient(135deg, #ecc94b 0%, #d69e2e 100%);
      color: #1a202c;
    }
    .tooltip-action-btn.sell {
      background: rgba(252,129,129,0.2);
      color: #fc8181;
    }
    .tooltip-action-btn.sell:hover { background: rgba(252,129,129,0.3); }
    .tooltip-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    
    /* Stat Upgrades Section */
    .tooltip-upgrades {
      max-height: 200px;
      overflow-y: auto;
    }
    .upgrades-grid {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .upgrade-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      background: rgba(0,0,0,0.3);
      border-radius: 6px;
      transition: background 0.2s;
    }
    .upgrade-row:hover {
      background: rgba(72,187,120,0.2);
    }
    .upgrade-row.disabled {
      opacity: 0.5;
    }
    .upgrade-row.disabled:hover {
      background: rgba(0,0,0,0.3);
    }
    .upgrade-emoji {
      font-size: 16px;
      min-width: 24px;
      text-align: center;
    }
    .upgrade-info-col {
      flex: 1;
      min-width: 0;
    }
    .upgrade-name-row {
      font-size: 11px;
      font-weight: 500;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .upgrade-effect {
      font-size: 9px;
      color: #a0aec0;
    }
    .upgrade-lvl {
      font-size: 10px;
      color: #48bb78;
      font-weight: 600;
      min-width: 32px;
      text-align: center;
    }
    .upgrade-buy-btn {
      padding: 4px 8px;
      border: none;
      border-radius: 4px;
      background: rgba(255,215,0,0.2);
      color: #ffd700;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 45px;
    }
    .upgrade-buy-btn:hover:not(:disabled) {
      background: rgba(255,215,0,0.35);
      transform: scale(1.05);
    }
    .upgrade-buy-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      color: #fc8181;
    }
    
    /* Energy Tooltip specific styles */
    .energy-tooltip .energy-connections {
      padding: 3px 8px;
      background: rgba(96,165,250,0.2);
      border-radius: 4px;
      font-size: 11px;
      color: #60a5fa;
    }
    
    /* XP Bar for energy buildings */
    .xp-bar-container {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      margin: 4px 0;
    }
    .xp-bar-bg {
      flex: 1;
      height: 6px;
      background: rgba(0,0,0,0.4);
      border-radius: 3px;
      overflow: hidden;
    }
    .xp-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
    .xp-bar-text {
      font-size: 10px;
      color: #a78bfa;
      min-width: 55px;
      text-align: right;
    }
    
    .energy-tooltip .tooltip-action-btn.connect {
      background: rgba(96,165,250,0.2);
      color: #60a5fa;
    }
    .energy-tooltip .tooltip-action-btn.connect:hover {
      background: rgba(96,165,250,0.3);
    }
    .energy-tooltip .tooltip-action-btn.connect.active {
      background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
      color: white;
    }
    .energy-upgrades .upgrades-grid {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 6px;
    }
    .energy-upgrades .upgrade-stat-btn {
      flex: 1;
      min-width: 60px;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 6px;
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px;
      background: rgba(255,255,255,0.08);
      cursor: pointer;
      transition: all 0.2s;
    }
    .energy-upgrades .upgrade-stat-btn:hover:not(.disabled) {
      border-color: #48bb78;
      background: rgba(72,187,120,0.2);
    }
    .energy-upgrades .upgrade-stat-btn.disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .energy-upgrades .stat-icon { font-size: 16px; }
    .energy-upgrades .stat-label { font-size: 10px; color: #a0aec0; }
    .energy-upgrades .stat-cost { font-size: 10px; color: #ffd700; font-weight: 600; }
    
    /* Element Ability Upgrades Section */
    .tooltip-abilities {
      max-height: 250px;
      overflow-y: auto;
    }
    .tooltip-action-btn.abilities {
      background: rgba(168,85,247,0.2);
      color: #a855f7;
    }
    .tooltip-action-btn.abilities:hover {
      background: rgba(168,85,247,0.3);
    }
    .tooltip-action-btn.abilities.active {
      background: linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%);
      color: white;
    }
    .abilities-grid {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .no-abilities {
      text-align: center;
      padding: 12px;
      color: #718096;
      font-size: 11px;
    }
    .ability-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
      background: rgba(0,0,0,0.3);
      border-radius: 6px;
      transition: background 0.2s;
    }
    .ability-row:hover {
      background: rgba(168,85,247,0.2);
    }
    .ability-row.disabled {
      opacity: 0.5;
    }
    .ability-row.disabled:hover {
      background: rgba(0,0,0,0.3);
    }
    .ability-row.maxed {
      background: rgba(72,187,120,0.15);
      border: 1px solid rgba(72,187,120,0.3);
    }
    .ability-emoji {
      font-size: 16px;
      min-width: 24px;
      text-align: center;
    }
    .ability-info-col {
      flex: 1;
      min-width: 0;
    }
    .ability-name-row {
      font-size: 11px;
      font-weight: 500;
      color: #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ability-effect {
      font-size: 9px;
      color: #a0aec0;
    }
    .ability-value {
      font-size: 10px;
      color: #a855f7;
      font-weight: 600;
      min-width: 50px;
      text-align: center;
    }
    .ability-level {
      font-size: 9px;
      color: #718096;
      font-weight: 400;
    }
    .ability-buy-btn {
      padding: 4px 8px;
      border: none;
      border-radius: 4px;
      background: rgba(168,85,247,0.2);
      color: #a855f7;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 45px;
    }
    .ability-buy-btn:hover:not(:disabled) {
      background: rgba(168,85,247,0.35);
      transform: scale(1.05);
    }
    .ability-buy-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      color: #fc8181;
    }
    .ability-buy-btn.maxed {
      background: rgba(72,187,120,0.2);
      color: #48bb78;
      cursor: default;
    }
    
    /* Lightning Charge Slider */
    .lightning-charge-section {
      padding: 8px;
      margin-bottom: 8px;
      background: rgba(234,179,8,0.1);
      border: 1px solid rgba(234,179,8,0.3);
      border-radius: 6px;
    }
    .lightning-charge-header {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #eab308;
      margin-bottom: 6px;
    }
    .lightning-charge-slider {
      width: 100%;
      height: 6px;
      -webkit-appearance: none;
      background: rgba(0,0,0,0.4);
      border-radius: 3px;
      outline: none;
      cursor: pointer;
    }
    .lightning-charge-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px;
      height: 14px;
      background: linear-gradient(135deg, #eab308 0%, #facc15 100%);
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    .lightning-charge-info {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #a0aec0;
      margin-top: 6px;
    }
    .lightning-charge-info b {
      color: #eab308;
    }
    
    .game-footer { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    .game-footer .hint { margin: 0; font-size: 12px; color: #718096; flex: 1; text-align: right; }
  `;
}

module.exports = {
  getLauncherStyles,
  getGameStyles
};
