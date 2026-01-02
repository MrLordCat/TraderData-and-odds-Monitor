/**
 * Power Towers TD - Controls & Buttons Styles
 * Game buttons, controls
 */

function getControlsStyles() {
  return `
    @keyframes pulse-build {
      0%, 100% { box-shadow: 0 0 5px rgba(236,201,75,0.4); }
      50% { box-shadow: 0 0 15px rgba(236,201,75,0.7); }
    }
    
    .game-controls { 
      position: absolute;
      bottom: 148px;
      left: 50%;
      transform: translateX(-50%);
      display: flex; 
      gap: 10px; 
      z-index: 65;
    }
    .game-btn {
      padding: 8px 20px; border: none; border-radius: 20px;
      font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s;
      white-space: nowrap;
    }
    .game-btn.primary { background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; }
    .game-btn.primary:hover { box-shadow: 0 4px 12px rgba(72, 187, 120, 0.3); transform: translateY(-1px); }
    .game-btn:not(.primary) { background: rgba(255,255,255,0.1); color: #e2e8f0; }
    .game-btn:not(.primary):hover { background: rgba(255,255,255,0.15); }
    .game-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .game-btn.small { flex: none; padding: 10px 16px; font-size: 13px; }
    .game-btn.danger { background: rgba(252,129,129,0.2); color: #fc8181; }
    .game-btn.active { background: #ecc94b; color: #1a202c; }
    
    .hotkey-hint { 
      font-size: 11px; 
      opacity: 0.7; 
      margin-left: 8px;
      font-weight: 400;
    }
    
    .game-footer { display: none; /* Hidden - hints shown in button */ }
  `;
}

module.exports = { getControlsStyles };
