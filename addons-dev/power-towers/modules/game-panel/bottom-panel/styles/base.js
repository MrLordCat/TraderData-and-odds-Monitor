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
  `;
}

module.exports = { getBaseStyles };
