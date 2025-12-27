/**
 * Power Towers TD - Game Panel Sidebar Module
 * 
 * Simple test module that renders a canvas-based game demo
 * Exports factory function that receives { SidebarModule, registerModule }
 */

module.exports = function({ SidebarModule, registerModule }) {
  
  class GamePanelModule extends SidebarModule {
    static id = 'game-panel';
    static title = 'Power Towers TD';
    static icon = null;
    static order = 100;

    constructor(options = {}) {
      super(options);
      this.canvas = null;
      this.ctx = null;
      this.animationId = null;
      this.towers = [];
      this.enemies = [];
      this.projectiles = [];
      this.gold = 100;
      this.lives = 10;
      this.wave = 0;
      this.gameRunning = false;
      this.placingTower = false;
    }

    getTemplate() {
      return `
        <div class="game-panel-container">
          <div class="game-header">
            <span class="game-stat">Gold: <span id="game-gold">100</span></span>
            <span class="game-stat">HP: <span id="game-lives">10</span></span>
            <span class="game-stat">Wave: <span id="game-wave">0</span></span>
          </div>
          <canvas id="game-canvas" width="300" height="300"></canvas>
          <div class="game-controls">
            <button id="game-start-btn" class="game-btn">Start</button>
            <button id="game-tower-btn" class="game-btn" disabled>Tower (50g)</button>
          </div>
          <div class="game-info">
            <p>Click canvas to place towers</p>
            <p style="font-size: 10px; opacity: 0.7;">Test addon v0.0.1</p>
          </div>
        </div>
      `;
    }

    getStyles() {
      return `
        .game-panel-container {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .game-header {
          display: flex;
          justify-content: space-around;
          padding: 6px;
          background: rgba(0,0,0,0.3);
          border-radius: 4px;
          font-size: 12px;
        }
        .game-stat { font-weight: bold; }
        #game-canvas {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 8px;
          border: 2px solid #333;
          cursor: crosshair;
          width: 100%;
          aspect-ratio: 1;
        }
        .game-controls { display: flex; gap: 8px; }
        .game-btn {
          flex: 1;
          padding: 8px;
          border: none;
          border-radius: 4px;
          background: #4a5568;
          color: white;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }
        .game-btn:hover:not(:disabled) { background: #5a6578; }
        .game-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .game-btn.active { background: #48bb78; }
        .game-info { text-align: center; font-size: 11px; opacity: 0.8; }
      `;
    }

    onMount(container) {
      super.onMount(container);
      
      const styleEl = document.createElement('style');
      styleEl.textContent = this.getStyles();
      container.appendChild(styleEl);
      
      this.canvas = container.querySelector('#game-canvas');
      this.ctx = this.canvas.getContext('2d');
      
      this.goldEl = container.querySelector('#game-gold');
      this.livesEl = container.querySelector('#game-lives');
      this.waveEl = container.querySelector('#game-wave');
      this.startBtn = container.querySelector('#game-start-btn');
      this.towerBtn = container.querySelector('#game-tower-btn');
      
      this.startBtn.addEventListener('click', () => this.toggleGame());
      this.towerBtn.addEventListener('click', () => this.toggleTowerMode());
      this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
      
      this.render();
      console.log('[game-panel] Mounted');
    }

    onUnmount() {
      if (this.animationId) cancelAnimationFrame(this.animationId);
      super.onUnmount();
    }

    toggleGame() {
      this.gameRunning = !this.gameRunning;
      this.startBtn.textContent = this.gameRunning ? 'Pause' : 'Start';
      this.towerBtn.disabled = !this.gameRunning;
      
      if (this.gameRunning) {
        if (this.wave === 0) this.spawnWave();
        this.gameLoop();
      } else if (this.animationId) {
        cancelAnimationFrame(this.animationId);
      }
    }

    toggleTowerMode() {
      this.placingTower = !this.placingTower;
      this.towerBtn.classList.toggle('active', this.placingTower);
    }

    handleCanvasClick(e) {
      if (!this.gameRunning || !this.placingTower || this.gold < 50) return;
      
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      
      this.towers.push({ x, y, radius: 60, damage: 10, cooldown: 0, fireRate: 30 });
      this.gold -= 50;
      this.updateUI();
      this.placingTower = false;
      this.towerBtn.classList.remove('active');
    }

    spawnWave() {
      this.wave++;
      const count = 3 + this.wave * 2;
      
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          if (!this.gameRunning) return;
          this.enemies.push({
            x: -20,
            y: 150 + Math.random() * 20 - 10,
            hp: 20 + this.wave * 5,
            maxHp: 20 + this.wave * 5,
            speed: 0.8 + this.wave * 0.1,
            reward: 5 + this.wave
          });
        }, i * 500);
      }
      this.updateUI();
    }

    gameLoop() {
      if (!this.gameRunning) return;
      this.update();
      this.render();
      this.animationId = requestAnimationFrame(() => this.gameLoop());
    }

    update() {
      // Update enemies
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        e.x += e.speed;
        
        if (e.x > this.canvas.width + 20) {
          this.enemies.splice(i, 1);
          this.lives--;
          this.updateUI();
          if (this.lives <= 0) this.gameOver();
          continue;
        }
        
        if (e.hp <= 0) {
          this.gold += e.reward;
          this.enemies.splice(i, 1);
          this.updateUI();
        }
      }
      
      // Update towers
      for (const t of this.towers) {
        if (t.cooldown > 0) { t.cooldown--; continue; }
        
        for (const e of this.enemies) {
          const dx = e.x - t.x, dy = e.y - t.y;
          if (Math.sqrt(dx*dx + dy*dy) <= t.radius) {
            this.projectiles.push({ x: t.x, y: t.y, damage: t.damage, speed: 8, target: e });
            t.cooldown = t.fireRate;
            break;
          }
        }
      }
      
      // Update projectiles
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        const dx = p.target.x - p.x, dy = p.target.y - p.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < 10) {
          p.target.hp -= p.damage;
          this.projectiles.splice(i, 1);
        } else {
          p.x += (dx / dist) * p.speed;
          p.y += (dy / dist) * p.speed;
        }
      }
      
      // Check wave complete
      if (this.enemies.length === 0 && this.gameRunning && this.wave > 0) {
        setTimeout(() => { if (this.gameRunning) this.spawnWave(); }, 2000);
      }
    }

    render() {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, w, h);
      
      // Path
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 40;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      
      // Tower ranges
      if (this.placingTower) {
        ctx.fillStyle = 'rgba(72, 187, 120, 0.1)';
        ctx.strokeStyle = 'rgba(72, 187, 120, 0.3)';
        for (const t of this.towers) {
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      
      // Towers
      for (const t of this.towers) {
        ctx.fillStyle = '#2d3748';
        ctx.fillRect(t.x - 8, t.y - 8, 16, 16);
        ctx.fillStyle = '#48bb78';
        ctx.beginPath();
        ctx.arc(t.x, t.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Enemies
      for (const e of this.enemies) {
        ctx.fillStyle = '#e53e3e';
        ctx.beginPath();
        ctx.arc(e.x, e.y, 10, 0, Math.PI * 2);
        ctx.fill();
        
        const hpPct = e.hp / e.maxHp;
        ctx.fillStyle = '#333';
        ctx.fillRect(e.x - 12, e.y - 18, 24, 4);
        ctx.fillStyle = hpPct > 0.5 ? '#48bb78' : hpPct > 0.25 ? '#ecc94b' : '#e53e3e';
        ctx.fillRect(e.x - 12, e.y - 18, 24 * hpPct, 4);
      }
      
      // Projectiles
      ctx.fillStyle = '#ffd700';
      for (const p of this.projectiles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Start hint
      if (!this.gameRunning && this.wave === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Press Start!', w / 2, h / 2);
      }
    }

    updateUI() {
      if (this.goldEl) this.goldEl.textContent = this.gold;
      if (this.livesEl) this.livesEl.textContent = this.lives;
      if (this.waveEl) this.waveEl.textContent = this.wave;
    }

    gameOver() {
      this.gameRunning = false;
      this.startBtn.textContent = 'Restart';
      this.startBtn.onclick = () => this.restart();
      
      const ctx = this.ctx;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = '#e53e3e';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 10);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText('Wave ' + this.wave, this.canvas.width / 2, this.canvas.height / 2 + 15);
    }

    restart() {
      this.towers = [];
      this.enemies = [];
      this.projectiles = [];
      this.gold = 100;
      this.lives = 10;
      this.wave = 0;
      this.gameRunning = false;
      this.startBtn.textContent = 'Start';
      this.startBtn.onclick = () => this.toggleGame();
      this.towerBtn.disabled = true;
      this.updateUI();
      this.render();
    }
  }

  return GamePanelModule;
};
