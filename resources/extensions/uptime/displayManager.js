// Display manager for uptime tracker UI
class UptimeDisplayManager {
    constructor(engine) {
        this.engine = engine;
        this.uptimeDisplay = null;
        this.updateInterval = null;
        this.engine.onPhaseChange = () => this.updateDisplay();
        this.engine.onTradingStatusChange = () => this.updateDisplay();
    }

    init() {
        const tryCreate = () => {
            if (!document.querySelector('.uptime-tracker-container')) this.createUptimeDisplay();
        };
        setTimeout(tryCreate, 1500);
        setTimeout(tryCreate, 4000);
        setTimeout(tryCreate, 8000);
        this.updateInterval = setInterval(() => this.updateDisplay(), 1000);
    }

    createUptimeDisplay() {
        document.querySelectorAll('.uptime-tracker-container').forEach(el => el.remove());
        const target = this.findDisplayTarget();
        if (!target) return setTimeout(() => this.createUptimeDisplay(), 1500);
        const container = document.createElement('div');
        container.className = 'uptime-tracker-container';
        if (target.style && target.style.position === 'fixed') container.classList.add('fixed-overlay');
        container.innerHTML = this.getDisplayHTML();
        target.appendChild(container);
        this.uptimeDisplay = {
            percentage: document.getElementById('uptimePercentage'),
            time: document.getElementById('uptimeTime'),
            suspendedTime: document.getElementById('suspendedTime'),
            status: document.getElementById('uptimeStatus')
        };
        this.attachEventListeners();
        this.updateDisplay();
    }

    findDisplayTarget() {
        return document.querySelector('.trading-state .body') ||
               document.querySelector('.trading-state .body, .trading-state .content .body') ||
               document.querySelector('.trading-state')?.querySelector('.body') ||
               document.querySelector('.trading-state-container .body') ||
               document.querySelector('.trading-state-container') ||
               document.querySelector('.summary-match-trading-container') ||
               this.createFixedOverlay();
    }

    createFixedOverlay() {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, { position:'fixed', top:'10px', right:'10px', zIndex:'10000', backgroundColor:'white', border:'2px solid #007cba', borderRadius:'5px', padding:'10px', boxShadow:'0 4px 8px rgba(0,0,0,0.2)' });
        document.body.appendChild(overlay);
        return overlay;
    }

    getDisplayHTML() {
        return `
            <div class="uptime-tracker">
                <div class="uptime-header">
                    <label class="uptime-label">Uptime:</label>
                    <div class="uptime-percentage" id="uptimePercentage">0.0%</div>
                </div>
                <div class="uptime-details">
                    <div class="uptime-row"><span class="uptime-label-small">Available:</span><div class="uptime-time" id="uptimeTime">00:00:00</div></div>
                    <div class="uptime-row"><span class="uptime-label-small">Suspended:</span><div class="suspended-time" id="suspendedTime">00:00:00</div></div>
                    <div class="uptime-status" id="uptimeStatus">Waiting for In-Play</div>
                </div>
                <div class="uptime-controls">
                    <button id="forceStartTracking" class="uptime-btn" title="Force start">▶</button>
                    <button id="forceStopTracking" class="uptime-btn" title="Force stop">⏹</button>
                </div>
                <div class="hotkeys-info">
                    <div class="hotkeys-title">Hotkeys:</div>
                    <div class="hotkey-item"><kbd>Num -</kbd> Decrease odd team 1</div>
                    <div class="hotkey-item"><kbd>Num +</kbd> Decrease odd team 2</div>
                    <div class="hotkey-item"><kbd>Enter</kbd> Commit prices</div>
                </div>
            </div>`;
    }

    attachEventListeners() {
        document.getElementById('forceStartTracking')?.addEventListener('click', () => {
            console.log('[UpTime] Manual start triggered');
            console.log('[UpTime] Current state:', JSON.stringify(this.engine.state, null, 2));
            console.log('[UpTime] Detected phase:', this.engine.detectPhase());
            console.log('[UpTime] Detected trading status:', this.engine.detectStatus());
            console.log('[UpTime] Select element:', document.querySelector('select.match-phase'));
            console.log('[UpTime] Market elements:', document.querySelectorAll('.market'));
            this.engine.startTracking();
            console.log('[UpTime] State after start:', JSON.stringify(this.engine.state, null, 2));
            this.updateDisplay();
        });
        document.getElementById('forceStopTracking')?.addEventListener('click', () => { this.engine.stopTracking(); this.updateDisplay(); });
    }

    updateDisplay() {
        if (!this.uptimeDisplay) return;
        const pct = this.engine.getUptimePercentage();
        this.uptimeDisplay.percentage.textContent = `${pct.toFixed(1)}%`;
        this.uptimeDisplay.time.textContent = this.engine.formatTime(this.engine.getCurrentUptime());
        this.uptimeDisplay.suspendedTime.textContent = this.engine.formatTime(this.engine.getCurrentSuspendedTime());
        this.uptimeDisplay.status.textContent = this.engine.getDisplayStatus();
        this.updateContainerStyle();
    }

    updateContainerStyle() {
        const c = document.querySelector('.uptime-tracker');
        if (!c) return;
        c.className = 'uptime-tracker';
        const s = this.engine.state;
        if (s.currentPhase === 'Post-Game') c.classList.add('post-game');
        else if (s.currentTradingStatus === 'Trading') c.classList.add('trading');
        else if (s.currentTradingStatus === 'Suspended') c.classList.add('suspended');
    // Uptime percentage levels
    const pct = this.engine.getUptimePercentage();
    if (pct < 80) c.classList.add('level-low');
    else if (pct < 88) c.classList.add('level-mid');
    else c.classList.add('level-high');
    }

    updateDisplayText(status, percentage, time, suspendedTime) {
        if (!this.uptimeDisplay) return;
        this.uptimeDisplay.status.textContent = status;
        this.uptimeDisplay.percentage.textContent = percentage;
        this.uptimeDisplay.time.textContent = time;
        this.uptimeDisplay.suspendedTime.textContent = suspendedTime;
    }

    flashReset() {
        const c = document.querySelector('.uptime-tracker');
        if (c) { c.classList.add('reset-flash'); setTimeout(() => c.classList.remove('reset-flash'), 2000); }
    }

    reset() {
        this.engine.reset();
        if (this.uptimeDisplay) { this.updateDisplayText('Reset - Waiting for In-Play', '0.0%', '00:00:00', '00:00:00'); this.flashReset(); }
    }

    destroy() {
        if (this.updateInterval) { clearInterval(this.updateInterval); this.updateInterval = null; }
        document.querySelectorAll('.uptime-tracker-container').forEach(el => el.remove());
    }
}
