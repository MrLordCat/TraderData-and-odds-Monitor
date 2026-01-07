/**
 * Power Towers TD - Upgrade Card Styles
 * Tower stat upgrades, ability upgrades, attack type upgrades
 */

function getUpgradeCardStyles() {
  return `
    /* ========================================
       Upgrade Card Styles
       ======================================== */
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
    
    /* Discount Price Display */
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
    
    /* ========================================
       Attack Type Upgrade Separator
       ======================================== */
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
    
    /* ========================================
       Attack Type Specific Upgrades
       ======================================== */
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

module.exports = { getUpgradeCardStyles };
