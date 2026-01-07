/**
 * Power Towers TD - Tooltip Styles
 * Tower tooltips, stat popups, biome effects
 */

function getTooltipStyles() {
  return `
    /* Tower Tooltip - HIDDEN (now using bottom panel) */
    .tower-tooltip {
      display: none !important;
    }
    .tower-tooltip.visible {
      display: none !important;
    }
    
    /* Energy Tooltip - HIDDEN (now using bottom panel) */
    .energy-tooltip {
      display: none !important;
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
    .detail-locked { color: #718096; font-style: italic; }
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
  `;
}

module.exports = { getTooltipStyles };
