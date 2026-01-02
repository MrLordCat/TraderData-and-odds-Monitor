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
    
    /* Legacy stats bar - hidden */
    .game-stats-bar {
      display: none;
    }
  `;
}

module.exports = { getHudStyles };
