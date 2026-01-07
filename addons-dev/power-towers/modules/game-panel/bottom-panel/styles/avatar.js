/**
 * Power Towers TD - Avatar Section Styles
 * Center panel with tower/building avatar and actions
 */

function getAvatarStyles() {
  return `
    /* ========================================
       Section 2: Avatar (center)
       ======================================== */
    .panel-avatar {
      flex: 35;
      min-width: 220px;
      align-items: center;
      justify-content: flex-start;
      overflow: visible;
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
      align-items: stretch;
      gap: 4px;
      width: 100%;
      height: 100%;
      padding: 4px;
    }
    .avatar-header {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      flex: 0 0 auto;
    }
    .avatar-icon {
      font-size: 28px;
      line-height: 1;
    }
    .avatar-info {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 1px;
      flex: 1;
    }
    .avatar-name {
      font-size: 12px;
      font-weight: 700;
      color: #fff;
    }
    .avatar-type {
      font-size: 9px;
      color: #a0aec0;
    }
    .avatar-level {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: #68d391;
    }
    .avatar-bars {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .avatar-bar-row {
      display: flex;
      align-items: center;
      gap: 4px;
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
    .avatar-xp-value {
      font-size: 8px;
      color: #68d391;
      min-width: 35px;
    }
    .avatar-energy-bar {
      width: 50px;
      height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      overflow: hidden;
    }
    .avatar-energy-fill {
      height: 100%;
      background: linear-gradient(90deg, #4299e1, #63b3ed);
      transition: width 0.3s;
    }
    .avatar-energy-value {
      font-size: 8px;
      color: #63b3ed;
      min-width: 35px;
    }
    
    /* Biome Effects Section */
    .avatar-biome {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 6px 10px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      cursor: help;
      min-width: 80px;
      max-width: 120px;
    }
    .avatar-biome:hover {
      background: rgba(72, 187, 120, 0.1);
      border-color: rgba(72, 187, 120, 0.3);
    }
    .biome-label {
      font-size: 8px;
      color: #a0aec0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .biome-summary {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 2px 6px;
      font-size: 10px;
      font-weight: 600;
      color: #e2e8f0;
      text-align: center;
      line-height: 1.3;
    }
    .biome-summary .mod-item {
      white-space: nowrap;
    }
    .biome-summary .positive { color: #68d391; }
    .biome-summary .negative { color: #fc8181; }
    
    /* Biome Popup */
    .biome-popup {
      min-width: 200px;
      max-width: 280px;
    }
    .biome-popup-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .biome-source {
      padding: 6px;
      background: rgba(255,255,255,0.03);
      border-radius: 4px;
    }
    .biome-source-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
    }
    .biome-source-emoji {
      font-size: 14px;
    }
    .biome-source-name {
      font-size: 11px;
      font-weight: 600;
      color: #e2e8f0;
    }
    .biome-source-type {
      font-size: 9px;
      color: #a0aec0;
      margin-left: auto;
    }
    .biome-modifiers {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .biome-mod {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      background: rgba(255,255,255,0.05);
    }
    .biome-mod.positive {
      color: #68d391;
      background: rgba(104, 211, 145, 0.1);
    }
    .biome-mod.negative {
      color: #fc8181;
      background: rgba(252, 129, 129, 0.1);
    }

    /* Avatar inline actions (attack type / element) */
    .avatar-actions {
      width: 100%;
      flex: 1 1 auto;
      display: flex;
      gap: 4px;
      margin-top: 4px;
      min-height: 0;
    }
    .avatar-subsection {
      width: 100%;
      flex: 1 1 auto;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 6px;
      padding: 4px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-height: 0;
    }
    .avatar-subtitle {
      font-size: 10px;
      color: #a0aec0;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      flex: 0 0 auto;
    }
    .avatar-card-row {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      grid-auto-rows: 1fr;
      gap: 4px;
      flex: 1 1 auto;
      min-height: 0;
    }
    /* 3 columns for element selection */
    #action-element .avatar-card-row {
      grid-template-columns: repeat(3, 1fr);
    }
    .avatar-action-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      padding: 10px;
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.05);
      color: #e2e8f0;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s ease;
      min-height: 40px;
    }
    .avatar-action-card:hover {
      background: rgba(104, 211, 145, 0.18);
      border-color: rgba(104, 211, 145, 0.5);
      transform: translateY(-1px);
    }
    .avatar-action-card .card-icon { font-size: 16px; }
    .avatar-action-card .card-label { font-size: 10px; font-weight: 500; }
    
    /* ========================================
       Magic Charge Control Panel
       ======================================== */
    .magic-charge-control {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(124, 58, 237, 0.05)) !important;
      border-color: rgba(139, 92, 246, 0.3) !important;
    }
    .magic-charge-row {
      display: flex;
      gap: 10px;
      align-items: stretch;
    }
    .charge-slider-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
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
      width: 14px;
      height: 14px;
      background: linear-gradient(135deg, #a78bfa, #8b5cf6);
      border-radius: 50%;
      cursor: pointer;
      box-shadow: 0 0 6px rgba(139, 92, 246, 0.5);
    }
    .charge-slider::-moz-range-thumb {
      width: 14px;
      height: 14px;
      background: linear-gradient(135deg, #a78bfa, #8b5cf6);
      border-radius: 50%;
      cursor: pointer;
      border: none;
      box-shadow: 0 0 6px rgba(139, 92, 246, 0.5);
    }
    .charge-labels {
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: #a0aec0;
    }
    #charge-percent-label {
      color: #a78bfa;
      font-weight: 600;
      font-size: 10px;
    }
    .charge-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 80px;
    }
    .charge-info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
    }
    .charge-info-label {
      color: #a0aec0;
    }
    .charge-info-value {
      color: #e2e8f0;
      font-weight: 600;
    }
    #magic-bonus-damage {
      color: #68d391;
    }
    #magic-final-damage {
      color: #ffd700;
    }
    .charge-progress-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }
    .charge-progress-bar {
      flex: 1;
      height: 6px;
      background: rgba(139, 92, 246, 0.15);
      border-radius: 3px;
      overflow: hidden;
    }
    .charge-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #8b5cf6, #a78bfa);
      transition: width 0.1s ease-out;
      box-shadow: 0 0 8px rgba(139, 92, 246, 0.4);
    }
    .charge-progress-text {
      font-size: 9px;
      color: #a78bfa;
      font-weight: 600;
      min-width: 55px;
      text-align: right;
    }
  `;
}

module.exports = { getAvatarStyles };
