/**
 * Power Towers TD - Stats Section Styles
 * Left panel with tower/building stats
 */

function getStatsStyles() {
  return `
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
    
    /* Stat popup uses unified .hover-popup class - see base.js */
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
  `;
}

module.exports = { getStatsStyles };
