/**
 * Power Towers TD - Energy Tooltip Styles
 * XP bars, energy connections, lightning charge
 */

function getEnergyStyles() {
  return `
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
  `;
}

module.exports = { getEnergyStyles };
