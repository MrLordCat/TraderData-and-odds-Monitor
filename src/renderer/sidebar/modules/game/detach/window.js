/**
 * Game Detached Window - Renderer Script
 * 
 * This script runs in the detached BrowserWindow.
 * It's DISPLAY ONLY - no game logic here.
 * 
 * - Receives state/frame updates from GameCore via IPC
 * - Renders to canvas
 * - Forwards keyboard input back to GameCore
 */

(function() {
  'use strict';

  // ============================================
  // DOM ELEMENTS
  // ============================================

  const canvas = document.getElementById('game-canvas');
  const ctx = canvas?.getContext('2d');
  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('high-score');
  const overlay = document.getElementById('overlay');
  const overlayIcon = document.getElementById('overlay-icon');
  const overlayTitle = document.getElementById('overlay-title');
  const overlaySubtitle = document.getElementById('overlay-subtitle');
  
  const btnStart = document.getElementById('btn-start');
  const btnPause = document.getElementById('btn-pause');
  const btnReset = document.getElementById('btn-reset');
  const btnAttach = document.getElementById('btn-attach');

  // ============================================
  // STATE
  // ============================================

  let connected = false;
  let gameState = {
    running: false,
    paused: false,
    score: 0,
    highScore: 0,
    gameData: null
  };

  // ============================================
  // RENDERING
  // ============================================

  const renderConfig = {
    backgroundColor: '#1a1a2e',
    gridColor: '#25254033',
    gridSize: 20,
    showGrid: true
  };

  function resizeCanvas() {
    if (!canvas) return;
    
    const container = canvas.parentElement;
    const size = Math.min(container.clientWidth - 20, container.clientHeight - 20, 400);
    canvas.width = size;
    canvas.height = size;
    render();
  }

  function render() {
    if (!ctx || !canvas) return;
    
    const { width, height } = canvas;
    
    // Background
    ctx.fillStyle = renderConfig.backgroundColor;
    ctx.fillRect(0, 0, width, height);
    
    // Grid
    if (renderConfig.showGrid) {
      drawGrid(width, height);
    }
    
    // Game-specific rendering
    if (gameState.gameData) {
      renderGameData(gameState.gameData, width, height);
    } else if (gameState.running) {
      // Placeholder when no specific game data
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Game Running...', width / 2, height / 2);
    }
  }

  function drawGrid(width, height) {
    ctx.strokeStyle = renderConfig.gridColor;
    ctx.lineWidth = 1;
    
    for (let x = 0; x <= width; x += renderConfig.gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    for (let y = 0; y <= height; y += renderConfig.gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  function renderGameData(data, width, height) {
    // Override based on game type
    // For now, just show placeholder
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Type: ${data.type || 'unknown'}`, width / 2, height / 2);
  }

  // ============================================
  // UI UPDATES
  // ============================================

  function updateScores() {
    if (scoreEl) scoreEl.textContent = gameState.score;
    if (highScoreEl) highScoreEl.textContent = gameState.highScore;
  }

  function updateButtons() {
    if (btnStart) {
      btnStart.disabled = gameState.running && !gameState.paused;
    }
    if (btnPause) {
      btnPause.disabled = !gameState.running;
      const span = btnPause.querySelector('span');
      if (span) span.textContent = gameState.paused ? 'Resume' : 'Pause';
    }
  }

  function showOverlay(icon, title, subtitle) {
    if (overlayIcon) overlayIcon.textContent = icon;
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlaySubtitle) overlaySubtitle.textContent = subtitle;
    if (overlay) overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    if (overlay) overlay.classList.add('hidden');
  }

  // ============================================
  // IPC MESSAGE HANDLING
  // ============================================

  function handleMessage(message) {
    const { type, payload } = message;
    
    switch (type) {
      case 'sync':
      case 'init':
        gameState = { ...gameState, ...payload };
        if (payload.config) {
          Object.assign(renderConfig, payload.config);
        }
        updateScores();
        updateButtons();
        render();
        break;
        
      case 'tick':
        gameState.score = payload.score ?? gameState.score;
        gameState.gameData = payload.gameData;
        updateScores();
        render();
        break;
        
      case 'start':
        gameState.running = true;
        gameState.paused = false;
        hideOverlay();
        updateButtons();
        break;
        
      case 'resume':
        gameState.paused = false;
        hideOverlay();
        updateButtons();
        break;
        
      case 'pause':
        gameState.paused = true;
        showOverlay('⏸️', 'Paused', 'Press Pause or Space to continue');
        updateButtons();
        break;
        
      case 'stop':
      case 'reset':
        gameState.running = false;
        gameState.paused = false;
        gameState.score = payload?.score ?? 0;
        gameState.gameData = null;
        showOverlay('🎮', 'Ready', 'Press Start to play');
        updateScores();
        updateButtons();
        render();
        break;
        
      case 'gameover':
        gameState.running = false;
        if (payload.isNewHigh) {
          showOverlay('🏆', 'New High Score!', `Score: ${payload.score}`);
          gameState.highScore = payload.highScore;
        } else {
          showOverlay('💀', 'Game Over', `Score: ${payload.score}`);
        }
        updateScores();
        updateButtons();
        break;
        
      case 'score':
        gameState.score = payload.score;
        updateScores();
        break;
        
      case 'connected':
        connected = true;
        document.body.classList.remove('connecting');
        break;
        
      case 'disconnected':
        connected = false;
        showOverlay('🔌', 'Disconnected', 'Window will close...');
        break;
    }
  }

  // ============================================
  // INPUT FORWARDING
  // ============================================

  function sendInput(action) {
    if (window.gameAPI?.sendInput) {
      window.gameAPI.sendInput(action);
    }
  }

  function sendCommand(cmd) {
    if (window.gameAPI?.sendCommand) {
      window.gameAPI.sendCommand(cmd);
    }
  }

  // ============================================
  // EVENT BINDINGS
  // ============================================

  // Button clicks
  btnStart?.addEventListener('click', () => sendCommand('start'));
  btnPause?.addEventListener('click', () => sendCommand('togglePause'));
  btnReset?.addEventListener('click', () => sendCommand('reset'));
  btnAttach?.addEventListener('click', () => sendCommand('attach'));

  // Keyboard
  document.addEventListener('keydown', (e) => {
    // Prevent default for game keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Enter', 'Escape'].includes(e.key)) {
      e.preventDefault();
    }
    
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        sendInput('up');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        sendInput('down');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        sendInput('left');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        sendInput('right');
        break;
      case ' ':
        if (gameState.running) {
          sendCommand('togglePause');
        } else {
          sendInput('action');
        }
        break;
      case 'Enter':
        if (!gameState.running) {
          sendCommand('start');
        }
        break;
      case 'Escape':
        sendCommand('togglePause');
        break;
      case 'r':
      case 'R':
        sendCommand('reset');
        break;
    }
  });

  // Window resize
  window.addEventListener('resize', () => {
    resizeCanvas();
  });

  // Window close
  window.addEventListener('beforeunload', () => {
    if (window.gameAPI?.notifyClose) {
      window.gameAPI.notifyClose();
    }
  });

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    // Show connecting state
    document.body.classList.add('connecting');
    showOverlay('🔄', 'Connecting...', 'Waiting for game core');
    
    // Setup IPC listener
    if (window.gameAPI?.onMessage) {
      window.gameAPI.onMessage(handleMessage);
    } else {
      console.warn('[GameWindow] gameAPI not available');
      showOverlay('❌', 'Error', 'Game API not available');
    }
    
    // Initial resize
    resizeCanvas();
    
    // Notify ready
    if (window.gameAPI?.notifyReady) {
      window.gameAPI.notifyReady();
    }
  }

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
