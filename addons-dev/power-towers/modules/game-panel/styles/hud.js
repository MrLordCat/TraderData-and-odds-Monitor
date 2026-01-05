/**
 * Power Towers TD - HUD Styles
 * Top HUD, energy display, stats bar
 */

function getHudStyles() {
  return `
    /* Top HUD - Centered compact block */
    .top-hud-wrapper {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 50;
      pointer-events: auto;
    }
    .top-hud {
      display: flex;
      align-items: center;
      gap: 0;
      padding: 6px 12px;
      background: rgba(15, 15, 25, 0.9);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    .hud-section {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
    }
    .hud-divider {
      width: 1px;
      height: 20px;
      background: rgba(255,255,255,0.15);
    }
    .hud-icon {
      font-size: 16px;
    }
    .hud-value {
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      min-width: 24px;
    }
    .hud-gold .hud-value { color: #ffd700; }
    .hud-lives .hud-value { color: #fc8181; }
    .hud-lives .hud-value.danger { color: #f56565; animation: pulse-danger 1s infinite; }
    .hud-lives .hud-value.warning { color: #f6ad55; }
    .hud-wave .hud-value { color: #60a5fa; }
    
    .hud-energy-group {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 12px;
    }
    .energy-prod { color: #48bb78; font-weight: 600; }
    .energy-cons { color: #fc8181; font-weight: 600; }
    .energy-stored { color: #ffd700; font-weight: 600; }
    .energy-cap { color: #a0aec0; }
    .energy-sep { color: #4a5568; font-size: 10px; }
    
    @keyframes pulse-danger {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
    
    /* Bottom HUD - Wave control button */
    .bottom-hud-wrapper {
      position: absolute;
      bottom: 251px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 50;
      pointer-events: auto;
    }
    .wave-control-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 24px;
      background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 20px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 20px rgba(72, 187, 120, 0.4);
      transition: all 0.2s ease;
    }
    .wave-control-btn:hover {
      background: linear-gradient(135deg, #68d391 0%, #48bb78 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(72, 187, 120, 0.5);
    }
    .wave-control-btn:active {
      transform: translateY(0);
    }
    .wave-control-btn.paused {
      background: linear-gradient(135deg, #f6ad55 0%, #ed8936 100%);
      box-shadow: 0 4px 20px rgba(246, 173, 85, 0.4);
    }
    .wave-control-btn.paused:hover {
      background: linear-gradient(135deg, #fbd38d 0%, #f6ad55 100%);
      box-shadow: 0 6px 24px rgba(246, 173, 85, 0.5);
    }
    .wave-control-btn .hotkey-hint {
      font-size: 11px;
      opacity: 0.7;
      font-weight: 400;
    }
    
    /* Legacy stats bar - hidden */
    .game-stats-bar {
      display: none;
    }
  `;
}

module.exports = { getHudStyles };
