/**
 * Power Towers TD - Upgrades Styles
 * Tower upgrades, ability upgrades, stat upgrades
 */

function getUpgradesStyles() {
  return `
    /* Stat Upgrades Section */
    .tooltip-upgrades {
      max-height: 200px;
      overflow-y: auto;
    }
    .tooltip-upgrades-grid {
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
    .tooltip-abilities-grid {
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
  `;
}

module.exports = { getUpgradesStyles };
