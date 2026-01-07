/**
 * Power Towers TD - Bottom Panel Base Styles
 * Layout, popup system, common styles
 */

function getBaseStyles() {
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
       FLOATING MAGIC CHARGE PANEL
       Positioned above Build/Upgrades section (right side of bottom panel)
       Width matches panel-build (flex: 42 of 100 = 42%)
       ======================================== */
    .magic-charge-floating {
      position: absolute;
      bottom: 265px;
      left: 50%;
      transform: translateX(calc(-50% + 295px));
      width: calc((min(100% - 60px, 990px) - 4px) * 0.40);
      max-width: 390px;
      min-width: 280px;
      background: linear-gradient(135deg, rgba(88, 28, 135, 0.95), rgba(76, 29, 149, 0.9));
      border: 1px solid rgba(167, 139, 250, 0.5);
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(139, 92, 246, 0.3), 0 0 30px rgba(139, 92, 246, 0.1);
      z-index: 65;
      overflow: hidden;
    }
    
    .magic-charge-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 12px;
      background: rgba(0, 0, 0, 0.3);
      border-bottom: 1px solid rgba(167, 139, 250, 0.3);
    }
    
    .magic-charge-title {
      font-size: 11px;
      font-weight: 600;
      color: #e9d5ff;
      letter-spacing: 0.5px;
    }
    
    .magic-charge-status {
      font-size: 10px;
      color: #a78bfa;
      font-style: italic;
    }
    
    .magic-charge-body {
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    /* Main row: slider left, stats right */
    .charge-main-row {
      display: flex;
      gap: 12px;
      align-items: stretch;
    }
    
    .charge-slider-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 120px;
    }
    
    .slider-label {
      font-size: 9px;
      color: rgba(233, 213, 255, 0.7);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .charge-slider {
      width: 100%;
      height: 8px;
      -webkit-appearance: none;
      appearance: none;
      background: rgba(139, 92, 246, 0.2);
      border-radius: 4px;
      outline: none;
      cursor: pointer;
    }
    
    .charge-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 16px;
      background: linear-gradient(135deg, #c4b5fd, #a78bfa);
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 0 8px rgba(167, 139, 250, 0.6);
      transition: transform 0.1s;
    }
    
    .charge-slider::-webkit-slider-thumb:hover {
      transform: scale(1.1);
    }
    
    .charge-slider::-moz-range-thumb {
      width: 16px;
      height: 16px;
      background: linear-gradient(135deg, #c4b5fd, #a78bfa);
      border-radius: 50%;
      cursor: pointer;
      border: none;
      box-shadow: 0 0 8px rgba(167, 139, 250, 0.6);
    }
    
    .charge-labels {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: rgba(233, 213, 255, 0.6);
    }
    
    .charge-labels .charge-percent {
      color: #c4b5fd;
      font-weight: 600;
      font-size: 11px;
    }
    
    .charge-stats-section {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }
    
    .charge-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 6px 10px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 6px;
      border: 1px solid rgba(167, 139, 250, 0.2);
      min-width: 60px;
    }
    
    .charge-stat .stat-label {
      font-size: 8px;
      color: rgba(233, 213, 255, 0.6);
      text-transform: uppercase;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    
    .charge-stat .stat-value {
      font-size: 14px;
      font-weight: 700;
      color: #e9d5ff;
      margin-top: 2px;
    }
    
    .charge-stat .stat-value.bonus {
      color: #86efac;
    }
    
    .charge-stat .stat-value.final {
      color: #fde047;
    }
    
    .charge-bar-section {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .charge-bar-label {
      font-size: 9px;
      color: rgba(233, 213, 255, 0.6);
      flex-shrink: 0;
    }
    
    .charge-bar {
      flex: 1;
      height: 6px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 3px;
      overflow: hidden;
      border: 1px solid rgba(167, 139, 250, 0.3);
    }
    
    .charge-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #8b5cf6, #a78bfa, #c4b5fd);
      transition: width 0.1s ease-out;
      box-shadow: 0 0 10px rgba(167, 139, 250, 0.5);
    }
    
    .charge-bar-text {
      font-size: 10px;
      color: #c4b5fd;
      font-weight: 600;
      min-width: 60px;
      text-align: right;
      flex-shrink: 0;
    }
  `;
}

module.exports = { getBaseStyles };
