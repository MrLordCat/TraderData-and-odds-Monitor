// Core uptime tracking engine (compact)
const PHASES = new Set(['Pre-Game', 'In-Play', 'Post-Game', 'Break In Play', 'Game Abandoned']);

/**
 * Extract odds for specific map from DS page
 * Supports both full trading view (.multisport-market) and simplified view (.market-grouping)
 * @param {number} mapNum - Map number (1, 2, 3, etc.)
 * @param {boolean} isLast - If true and mapNum=1, search for "Match Up Winner" (Bo1 mode)
 * @returns {Object|null} - { map, odds: [side1, side2], frozen, teams: [name1, name2] } or null
 */
function extractMapOdds(mapNum, isLast = false) {
  try {
    // For Bo1: map 1 + isLast = use "Match Up Winner" instead of "Map 1 Winner"
    const useMatchWinner = isLast && mapNum === 1;
    const targetMarketName = useMatchWinner ? null : `Map ${mapNum} Winner`;
    
    // Try full trading view first (.multisport-market)
    let result = extractFromMultisportMarket(targetMarketName, useMatchWinner, mapNum);
    if (result) return result;
    
    // Try simplified view (.market-grouping or direct rows)
    result = extractFromSimplifiedView(targetMarketName, useMatchWinner, mapNum);
    if (result) return result;
    
    return null;
  } catch (err) {
    console.warn('[upTime] extractMapOdds error:', err);
    return null;
  }
}

// Extract from trading view (.market or .multisport-market container)
function extractFromMultisportMarket(targetMarketName, useMatchWinner, mapNum) {
  const markets = document.querySelectorAll('.multisport-market, .market.ng-isolate-scope');
  
  for (const market of markets) {
    const nameEl = market.querySelector('.market-name');
    const marketName = nameEl?.textContent?.trim() || '';
    
    if (useMatchWinner) {
      if (marketName !== 'Match Up Winner' && marketName !== 'Match Winner') continue;
    } else {
      if (marketName !== targetMarketName) continue;
    }
    
    const odds = [];
    const teams = [];
    
    // Structure 1: table.selections-container with .selection-row (multisport-market)
    const selectionTables = market.querySelectorAll('table.selections-container');
    if (selectionTables.length >= 2) {
      selectionTables.forEach(table => {
        const teamEl = table.querySelector('.selection-name .ng-binding');
        teams.push(teamEl?.textContent?.trim() || '');
        
        const oddsEl = table.querySelector('.current-odds .tooltip-anchor.ng-binding');
        const oddsText = oddsEl?.textContent?.trim() || '-';
        odds.push(oddsText.split(/\s/)[0] || '-');
      });
    } else {
      // Structure 2: ul.selections-container with li.selection-item (readonly view)
      const selectionItems = market.querySelectorAll('.selections-container .selection-item');
      selectionItems.forEach(item => {
        const teamEl = item.querySelector('.selection-name .ng-binding');
        teams.push(teamEl?.textContent?.trim() || '');
        
        const oddsEl = item.querySelector('.current-odds .tooltip-anchor.ng-binding');
        const oddsText = oddsEl?.textContent?.trim() || '-';
        odds.push(oddsText.split(/\s/)[0] || '-');
      });
    }
    
    const isFrozen = !market.classList.contains('flags-IsTradingActive-true') ||
                     market.classList.contains('flags-MarketTradingStatus-Suspended') ||
                     market.classList.contains('flags-GlobalTradingStatus-Suspended');
    
    if (odds.length >= 2) {
      return {
        map: mapNum,
        odds: [odds[0], odds[1]],
        frozen: isFrozen,
        teams: teams.length >= 2 ? [teams[0], teams[1]] : ['', '']
      };
    }
  }
  return null;
}

// Extract from simplified view (market-grouping or direct table rows)
function extractFromSimplifiedView(targetMarketName, useMatchWinner, mapNum) {
  // Look for market headers/labels
  const marketLabels = document.querySelectorAll('.market-label, .market-name, .grouping-header, th, td');
  
  for (const label of marketLabels) {
    const text = label.textContent?.trim() || '';
    
    // Check if this is our target market
    let isTarget = false;
    if (useMatchWinner) {
      isTarget = text === 'Match Up Winner' || text === 'Match Winner';
    } else {
      isTarget = text === targetMarketName;
    }
    
    if (!isTarget) continue;
    
    // Found the market label, now find the odds rows nearby
    // Look for parent container with selection rows
    let container = label.closest('.market-grouping, .market-container, .market, table, .selections');
    if (!container) {
      container = label.parentElement?.parentElement || document.body;
    }
    
    // Try to find selection rows with odds
    const selectionRows = container.querySelectorAll('.selection-row, tr');
    const odds = [];
    const teams = [];
    
    selectionRows.forEach(row => {
      // Skip header rows
      if (row.querySelector('th') && !row.querySelector('td')) return;
      
      // Team name - look in various places
      const teamEl = row.querySelector('.selection-name, .team-name, td:first-child');
      const teamText = teamEl?.textContent?.trim() || '';
      if (teamText && !teamText.match(/^\d/) && teamText !== 'Match Up Winner') {
        teams.push(teamText);
      }
      
      // Odds - look for numeric value (typically last td or .odds element)
      const oddsEl = row.querySelector('.current-odds, .odds, td:last-child');
      const oddsText = oddsEl?.textContent?.trim() || '';
      const oddsMatch = oddsText.match(/(\d+\.?\d*)/);
      if (oddsMatch) {
        odds.push(oddsMatch[1]);
      }
    });
    
    if (odds.length >= 2 && teams.length >= 2) {
      return {
        map: mapNum,
        odds: [odds[0], odds[1]],
        frozen: false, // Can't determine frozen state in simplified view
        teams: [teams[0], teams[1]]
      };
    }
  }
  
  return null;
}

/**
 * Extract odds for all available maps
 * @returns {Object} - { maps: { 1: {...}, 2: {...} }, matchWinner: {...} }
 */
function extractAllOdds() {
  const result = { maps: {} };
  
  // Try maps 1-5
  for (let i = 1; i <= 5; i++) {
    const mapOdds = extractMapOdds(i);
    if (mapOdds) {
      result.maps[i] = mapOdds;
    }
  }
  
  // Also try to get Match Up Winner
  try {
    const markets = document.querySelectorAll('.multisport-market');
    for (const market of markets) {
      const nameEl = market.querySelector('.market-name');
      const marketName = nameEl?.textContent?.trim() || '';
      
      if (marketName === 'Match Up Winner' || marketName === 'Match Winner') {
        const selections = market.querySelectorAll('.selections-container');
        const odds = [];
        const teams = [];
        
        selections.forEach(sel => {
          const teamEl = sel.querySelector('.selection-name .ng-binding');
          teams.push(teamEl?.textContent?.trim() || '');
          
          const oddsEl = sel.querySelector('.current-odds .tooltip-anchor.ng-binding');
          const oddsText = oddsEl?.textContent?.trim() || '-';
          odds.push(oddsText.split(/\s/)[0] || '-');
        });
        
        result.matchWinner = {
          odds: odds.length >= 2 ? [odds[0], odds[1]] : ['-', '-'],
          teams: teams.length >= 2 ? [teams[0], teams[1]] : ['', ''],
          frozen: !market.classList.contains('flags-IsTradingActive-true')
        };
        break;
      }
    }
  } catch (err) {
    console.warn('[upTime] extractAllOdds matchWinner error:', err);
  }
  
  return result;
}

// Export for use in content.js
if (typeof window !== 'undefined') {
  window.extractMapOdds = extractMapOdds;
  window.extractAllOdds = extractAllOdds;
}

class UptimeEngine {
    constructor() {
        this.state = {};
        this.observers = [];
        this.reset();
    }

    init() {
        this.startMonitoring();
        setTimeout(() => this.scanAndApply(), 1500);
    }

    // Unified state setter + persistence
    setState(next) {
        this.state = { ...this.state, ...next };
        chrome.storage.local.set({ uptimeData: this.state });
    }

    // One scan to detect phase + trading status, then apply changes
    scanAndApply() {
        const phase = this.detectPhase();
        if (phase && phase !== this.state.currentPhase) {
            this.handlePhaseChange(this.state.currentPhase, phase);
            this.setState({ currentPhase: phase });
            this.onPhaseChange?.(phase);
        }
        const status = this.detectStatus();
        if (status && status !== this.state.currentTradingStatus) {
            this.handleTradingStatusChange(this.state.currentTradingStatus, status);
            this.setState({ currentTradingStatus: status });
            this.onTradingStatusChange?.(status);
        }
    }

    // DOM monitoring
    startMonitoring() {
        this.cleanupObservers();
        const obs = new MutationObserver(() => this.scanAndApply());
        obs.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['class']
        });
        this.observers.push(obs);
    }
    cleanupObservers() { this.observers.forEach(o => o.disconnect()); this.observers = []; }

    // Phase detection - supports both .value.ng-binding and select.match-phase
    detectPhase() {
        // First check select dropdown (manual phase selection)
        const selectEl = document.querySelector('select.match-phase');
        if (selectEl && selectEl.value) {
            const selectedOption = selectEl.options[selectEl.selectedIndex];
            const phase = selectedOption?.textContent?.trim() || selectEl.value;
            if (PHASES.has(phase)) return phase;
        }
        
        // Fallback to .value.ng-binding elements
        const el = Array.from(document.querySelectorAll('.value.ng-binding, .ng-binding')).find(e => {
            const t = e.textContent.trim();
            if (!PHASES.has(t)) return false;
            const p = e.parentElement;
            return !p || p.textContent.toLowerCase().includes('phase') || p.querySelector('.description') || e.classList.contains('value');
        });
        return el ? el.textContent.trim() : '';
    }

    // Trading status detection - checks global status and Match Up Winner market
    detectStatus() {
        // 1. Check global trading status first (highest priority)
        const globalStatus = document.querySelector('.global-trading-status');
        if (globalStatus) {
            // Check for suspended state in global controls
            const suspendedBtn = globalStatus.querySelector('.trading-state.suspended, .trading-state.suspendedOn');
            const tradingBtn = globalStatus.querySelector('.trading-state.trading, .trading-state.tradingOn');
            
            // If suspended button is active (not suspendedOff), market is suspended
            if (suspendedBtn && !suspendedBtn.classList.contains('suspendedOff')) {
                return 'Suspended';
            }
            // If trading button is active
            if (tradingBtn && !tradingBtn.classList.contains('tradingOff')) {
                // Continue to check market-level status
            }
        }
        
        // 2. Check Match Up Winner market status
        const names = document.querySelectorAll('.market .market-name');
        for (const n of names) {
            const name = n.textContent?.trim() || '';
            const isMUW = name === 'Match Up Winner' || name.toLowerCase().includes('match up winner') || name === 'Match Winner' || (name.includes('Winner') && name.includes('Match'));
            if (!isMUW) continue;
            const market = n.closest('.market');
            if (!market) continue;
            if (market.classList.contains('flags-MarketTradingStatus-Trading')) return 'Trading';
            if (market.classList.contains('flags-MarketTradingStatus-Suspended')) return 'Suspended';
            break;
        }
        
        // 3. Fallback: check any market with trading status flags
        const anyMarket = document.querySelector('.market.flags-MarketTradingStatus-Trading, .market.flags-MarketTradingStatus-Suspended');
        if (anyMarket) {
            if (anyMarket.classList.contains('flags-MarketTradingStatus-Trading')) return 'Trading';
            if (anyMarket.classList.contains('flags-MarketTradingStatus-Suspended')) return 'Suspended';
        }
        
        // 4. If in In-Play phase but no status detected, assume Trading
        if (this.state.currentPhase === 'In-Play') {
            return 'Trading';
        }
        
        return '';
    }

    // Transitions
    handlePhaseChange(oldPhase, nextPhase) {
        if ((oldPhase === 'Pre-Game' || !oldPhase) && nextPhase === 'In-Play') this.startTracking();
        else if (nextPhase === 'Post-Game' && this.state.isTracking) this.stopTracking();
        else if (nextPhase === 'In-Play' && !this.state.isTracking) this.startTracking();
    }
    handleTradingStatusChange(oldStatus, nextStatus) {
        if (!this.state.isTracking) return;
        const now = Date.now();
        let { totalUptime, suspensionPeriods, currentSuspensionStart, lastTradingStartTime } = this.state;
        if (oldStatus === 'Suspended' && nextStatus === 'Trading') {
            if (currentSuspensionStart) suspensionPeriods.push({ start: currentSuspensionStart, end: now, duration: now - currentSuspensionStart });
            this.setState({ suspensionPeriods, currentSuspensionStart: null, lastTradingStartTime: now });
        } else if (oldStatus === 'Trading' && nextStatus === 'Suspended') {
            if (lastTradingStartTime) totalUptime += now - lastTradingStartTime;
            this.setState({ totalUptime, currentSuspensionStart: now });
        }
    }

    // Tracking lifecycle
    startTracking() {
        const now = Date.now();
        // Detect current status before starting
        const currentStatus = this.detectStatus() || 'Trading'; // Default to Trading if unknown
        this.setState({ currentTradingStatus: currentStatus });
        
        const base = { 
            isTracking: true, 
            gameStartTime: now, 
            totalUptime: 0, 
            suspensionPeriods: [], 
            currentSuspensionStart: null, 
            lastTradingStartTime: null 
        };
        
        if (currentStatus === 'Trading') {
            base.lastTradingStartTime = now;
        } else if (currentStatus === 'Suspended') {
            base.currentSuspensionStart = now;
        }
        
        this.setState(base);
        console.log('[UpTime] Tracking started with status:', currentStatus, 'lastTradingStartTime:', base.lastTradingStartTime);
    }
    stopTracking() {
        if (!this.state.isTracking) return;
        const now = Date.now();
        let { totalUptime, lastTradingStartTime, gameStartTime } = this.state;
        if (this.state.currentTradingStatus === 'Trading' && lastTradingStartTime) totalUptime += now - lastTradingStartTime;
        const final = { isTracking: false, gameEndTime: now, finalUptime: totalUptime, finalGameTime: now - gameStartTime, currentSuspensionStart: null };
        final.finalSuspendedTime = this.getTotalSuspendedTime({ ...this.state, ...final });
        this.setState(final);
    }

    // Metrics
    getCurrentUptime() {
        if (!this.state.isTracking) return this.state.finalUptime ?? this.state.totalUptime ?? 0;
        let u = this.state.totalUptime;
        if (this.state.currentTradingStatus === 'Trading' && this.state.lastTradingStartTime) u += Date.now() - this.state.lastTradingStartTime;
        return u;
    }
    getTotalGameTime() {
        if (!this.state.gameStartTime) return 0;
        return (this.state.gameEndTime || Date.now()) - this.state.gameStartTime;
    }
    getTotalSuspendedTime(st = this.state) {
        let t = st.suspensionPeriods.reduce((s, p) => s + p.duration, 0);
        if (st.isTracking && st.currentSuspensionStart) t += Date.now() - st.currentSuspensionStart;
        return t;
    }
    getCurrentSuspendedTime() { return this.state.finalSuspendedTime ?? this.getTotalSuspendedTime(); }
    getUptimePercentage() { const tt = this.getTotalGameTime(); return tt > 0 ? (this.getCurrentUptime() / tt) * 100 : 0; }
    formatTime(ms) {
        if (!Number.isFinite(ms) || ms < 0) return '00:00:00';
        const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
        return `${String(h).padStart(2,'0')}:${String(m%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
    }

    // State helpers
    reset() {
        this.setState({
            isTracking: false,
            currentPhase: '',
            currentTradingStatus: '',
            gameStartTime: null,
            gameEndTime: null,
            totalUptime: 0,
            lastTradingStartTime: null,
            suspensionPeriods: [],
            currentSuspensionStart: null,
            finalUptime: undefined,
            finalGameTime: undefined,
            finalSuspendedTime: undefined
        });
    }
    getDisplayStatus() {
        const { currentPhase, isTracking, currentTradingStatus } = this.state;
        const pct = this.getUptimePercentage().toFixed(1);
        if (currentPhase === 'Post-Game') return `Game Ended (Final: ${pct}%)`;
        if (currentPhase === 'In-Play') return isTracking ? (currentTradingStatus === 'Trading' ? 'Trading (Counting)' : currentTradingStatus === 'Suspended' ? 'Suspended (Paused)' : 'In-Play (Monitoring)') : 'In-Play (Not Tracking)';
        if (currentPhase === 'Pre-Game') return 'Pre-Game';
        return currentPhase ? `Phase: ${currentPhase}` : 'Waiting for In-Play';
    }
}
