/**
 * Power Towers TD - Build Menu Styles
 * Right panel build cards and popups
 */

function getBuildStyles() {
  return `
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
  `;
}

module.exports = { getBuildStyles };
