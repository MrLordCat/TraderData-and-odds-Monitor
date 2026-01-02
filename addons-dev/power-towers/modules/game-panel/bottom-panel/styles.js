/**
 * Power Towers TD - Bottom Panel Styles
 * CSS styles for the 3-section bottom panel
 */

function getBottomPanelStyles() {
  return `
    /* ========================================
       BOTTOM PANEL - 3 Sections Layout
       ======================================== */
    .bottom-panel {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      gap: 2px;
      background: linear-gradient(180deg, rgba(15, 20, 30, 0.98) 0%, rgba(10, 15, 25, 0.99) 100%);
      border-top: 1px solid rgba(100, 150, 255, 0.15);
      height: 140px;
      z-index: 60;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
    }

    .panel-section {
      background: rgba(25, 30, 45, 0.6);
      padding: 10px;
      display: flex;
      flex-direction: column;
      border-radius: 4px;
      margin: 4px;
      overflow: visible;
    }

    /* ========================================
       Section 1: Stats (left)
       ======================================== */
    .panel-stats {
      flex: 28;
      min-width: 200px;
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
      height: 100%;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      height: 100%;
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
    
    /* Stat Detail Popup (on hover) - bottom panel specific */
    .bottom-panel .stat-detail-popup,
    .panel-stats .stat-detail-popup {
      display: none;
      position: absolute !important;
      bottom: 100% !important;
      left: 50% !important;
      top: auto !important;
      right: auto !important;
      transform: translateX(-50%) !important;
      margin-bottom: 8px;
      min-width: 180px;
      padding: 10px 12px;
      background: rgba(10, 15, 28, 0.98) !important;
      border: 1px solid rgba(72, 187, 120, 0.5);
      border-radius: 8px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
      z-index: 9999;
      pointer-events: none;
      font-size: 11px;
      color: #e2e8f0;
    }
    .bottom-panel .stat-item:hover .stat-detail-popup,
    .panel-stats .stat-hoverable:hover .stat-detail-popup {
      display: block;
    }

    /* ========================================
       Section 2: Avatar (center)
       ======================================== */
    .panel-avatar {
      flex: 30;
      min-width: 180px;
      align-items: center;
      justify-content: center;
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
      align-items: center;
      gap: 6px;
      height: 100%;
    }
    .avatar-icon {
      font-size: 32px;
      line-height: 1;
    }
    .avatar-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .avatar-name {
      font-size: 13px;
      font-weight: 700;
      color: #fff;
    }
    .avatar-type {
      font-size: 10px;
      color: #a0aec0;
    }
    .avatar-level {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: #68d391;
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
    
    .sell-btn {
      margin-top: auto;
      padding: 5px 14px;
      border: none;
      border-radius: 4px;
      background: rgba(252, 129, 129, 0.2);
      color: #fc8181;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .sell-btn:hover {
      background: rgba(252, 129, 129, 0.35);
      transform: scale(1.02);
    }

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
    .abilities-panel,
    .energy-upgrades-panel {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    }
    
    .upgrades-grid,
    .abilities-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
    }
  `;
}

module.exports = { getBottomPanelStyles };
