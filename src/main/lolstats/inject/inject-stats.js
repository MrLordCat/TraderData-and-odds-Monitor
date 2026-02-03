// inject-stats.js (per-game with team-level tower/inhib)
(() => {

  const RX_GAME_START = /^Game\s+(\d+)\s+started$/i;
  const RX_SERIES_START = /^Series\s+started$/i;
  const RX_SERIES_END = /^Series\s+ended$/i;
  const RX_KILL       = /\bkilled\b/i;
  const RX_TOWER      = /destroyed\s+tower/i;
  const RX_INHIB      = /destroyed\s+(?:inhibitor|fortifier)/i;
  const RX_BARON      = /slaybaron/i;
  const RX_DRAGON     = /slaydragon/i;
  const RX_DRAKE      = /slay\w*drake/i;
  const RX_ATAKHAN    = /slaythornboundatakhan/i; // Atakhan objective
  const RX_BANNED     = /\bbanned\b/i; // Ban detection
  const RX_GAME_END   = /^Game\s+(\d+)\s+ended$/i; // Game end detection for ban phase logic
  // Strict single-line winner detection: "<Team Name> won Game <N>"
  const RX_GAME_WIN_SINGLE = /^\s*(.*?)\s+won\s+Game\s+(\d+)\s*$/i;
  // Multi-kill timing thresholds
  const MULTI_INTER_GAP = 10_000; // ms between kills for double/triple/quadra
  const MULTI_PENTA_GAP = 30_000; // ms allowed between 4th and 5th

  let playerToTeam = new Map();
  let mappingReady = false;
  let backlog = [];
  let processedEntries = new Set(); // Track processed entries to prevent duplicates
  let dragonTimestamps = new Map(); // Track dragon events by timestamp to prevent double counting
  const multiStreaks = new Map(); // killer(lower) -> { count, lastMs }
  
  // Ban phase detection for game start sounds
  let lastCompletedGame = 0; // Last game that ended (0 = none, 1-5 = completed games)
  let banPhaseTriggered = false; // Flag to prevent multiple gameStart sounds per ban phase
  let seriesActive = false; // Flag to track if a series is in progress (for first game detection)
  // Debounce publish to avoid sequential flood during backlog replay
  let __publishTimer = null; const PUBLISH_DEBOUNCE_MS = 120;
  function schedulePublish(){ if(__publishTimer) return; __publishTimer = setTimeout(()=>{ __publishTimer=null; try { publish(); } catch(_){ } }, PUBLISH_DEBOUNCE_MS); }
  // Note: multi-line/block-based winner inference removed to prevent false positives.

  // Sound suppression: don't play sounds during initial backlog processing (historical data)
  let soundsEnabled = false; // Will be enabled after backlog processing completes
  const SOUND_ENABLE_DELAY_MS = 2000; // Wait 2 seconds after backlog before enabling sounds

  // Sound notification helper - sends message to be picked up by preload/main
  // Always use Date.now() for timestamp - game timestamps are relative and unusable for freshness checks
  function playSound(soundType) {
    if (!soundsEnabled) {
      console.log(`[inject-stats] 🔇 Sound suppressed (backlog): ${soundType}`);
      return;
    }
    try {
      const eventTs = Date.now();
      console.log(`[inject-stats] 🔊 playSound: ${soundType} (ts=${eventTs})`);
      
      // Send via postMessage - will be picked up by preload script
      window.postMessage({
        source: 'lol-sound-event',
        type: soundType,
        timestamp: eventTs
      }, '*');
    } catch(e) {
      console.warn('[inject-stats] Sound trigger failed:', e);
    }
  }

  const gameStats = {};
  let currentGame = null;
  let team1Name = null, team2Name = null;

  function makeStats() {
    return {
      firstKill: null, firstKillAt: '',
      killCount: {},

      race5: null, race5At: '',
      race10: null, race10At: '',
      race15: null, race15At: '',
      race20: null, race20At: '',

      firstTower: null, firstTowerAt: '',
      towerCount: {},

      firstInhibitor: null, firstInhibitorAt: '',
      inhibitorCount: {},

      firstBaron: null, firstBaronAt: '',
      baronCount: {},

  dragonCount: {}, dragonTimes: {},

  // Atakhan (single objective kill; binary which team secured)
  atakhan: null, atakhanAt: ''
,
  // Multi-kills (injected via separate multikill parser then merged in main process)
  quadra: null, quadraAt: '',
  penta: null, pentaAt: '',
  // game result
  winner: null, winAt: ''
    };
  }
  function parseTsToMs(ts){
    if(!ts) return 0;
    const parts = ts.split(':').map(n=>Number(n)||0);
    if(parts.length===3){ const [h,m,s]=parts; return (h*3600 + m*60 + s)*1000; }
    if(parts.length===2){ const [m,s]=parts; return (m*60 + s)*1000; }
    if(parts.length===1){ return parts[0]*1000; }
    return 0;
  }

  // 1) mapping-ready → билдим Map и узнаём team1/team2
  window.addEventListener('lol-mapping-ready', e => {
    const mapObj = e.detail; // plain {nick: teamName}
    const newPlayerToTeam = new Map(
      Object.entries(mapObj).map(([nick,team]) => [nick.toLowerCase(), team])
    );
    
    // получаем уникальные имена команд
    const uniq = Array.from(new Set(Object.values(mapObj)));
    const [newTeam1Name, newTeam2Name] = uniq;
    
    // Check if we have meaningful mapping data
    const hasValidMapping = newPlayerToTeam.size > 0 && newTeam1Name && newTeam2Name;
    
    if (!hasValidMapping) {
      return;
    }
    
    // Check if mapping actually changed (avoid reprocessing same data)
    const mappingChanged = !mappingReady ||
      playerToTeam.size !== newPlayerToTeam.size ||
      team1Name !== newTeam1Name ||
      team2Name !== newTeam2Name;
    
    if (!mappingChanged) {
      return;
    }
    
    if(!mappingReady){
      playerToTeam = newPlayerToTeam;
      [team1Name, team2Name] = [newTeam1Name, newTeam2Name];
      mappingReady = true;
      // Mark series as active when we get first valid mapping
      // This handles cases where user opens a match in progress (no "Series started" event)
      seriesActive = true;
      processAllBacklogEntries();
    } else {
      // Subsequent mapping change (e.g. late roster fill) – only process new backlog entries
      playerToTeam = newPlayerToTeam; [team1Name, team2Name] = [newTeam1Name, newTeam2Name];
      let added=0; backlog.forEach(entry=>{ const k=`${entry.text}-${entry.ts}`; if(!processedEntries.has(k)){ handleEntry(entry); processedEntries.add(k); added++; } }); if(added) schedulePublish();
    }
  });
  
  function processAllBacklogEntries() {
    
    // Clear all game stats and start fresh with current mapping
    Object.keys(gameStats).forEach(key => delete gameStats[key]);
    processedEntries.clear();
    dragonTimestamps.clear();
    currentGame = null;
    
    // Ensure sounds are disabled during backlog processing
    soundsEnabled = false;
    
    let processedCount = 0;
  backlog.forEach(entry => {
      const entryKey = `${entry.text}-${entry.ts}`;
      if (!processedEntries.has(entryKey)) {
        handleEntry(entry);
        processedEntries.add(entryKey);
        processedCount++;
      }
    });
    
    publish();
    
    // Enable sounds after a delay (to skip any remaining queued events)
    setTimeout(() => {
      soundsEnabled = true;
      console.log('[inject-stats] 🔊 Sounds enabled (backlog processing complete)');
    }, SOUND_ENABLE_DELAY_MS);
  }

  // 2) live-log entry
  window.addEventListener('lol-live-log-update', e => {
    const entryKey = `${e.detail.text}-${e.detail.ts}`;
    
    // Always add to backlog first
    backlog.push(e.detail);
    
    // Skip if already processed
    if (processedEntries.has(entryKey)) {
      return;
    }
    
    // If mapping is ready, process immediately
    if (mappingReady && playerToTeam.size > 0 && team1Name && team2Name) {
  handleEntry(e.detail);
  processedEntries.add(entryKey);
  schedulePublish();
    } else {
      // queued until mapping ready
    }
  });

  function handleEntry({ text, ts, raw }) {
    // Ensure we have proper team mapping before processing any entries
    if (!mappingReady || !team1Name || !team2Name || playerToTeam.size === 0) {
      return;
    }
    
  // 2.1) Game N started? + detect win pattern + Series events
  const chunks0 = raw.body?.entryToAdd?.sentenceChunks || [];
    const head = chunks0.map(c=>c.text).join(' ').trim();
    
    // Series started - reset sound state for new series
    if (RX_SERIES_START.test(head)) {
      console.log('[inject-stats] Series started - resetting sound state');
      lastCompletedGame = 0;
      banPhaseTriggered = false;
      seriesActive = true; // Mark series as active for first game ban detection
      playSound('seriesStart');
      return;
    }
    
    // Series ended - notify parent
    if (RX_SERIES_END.test(head)) {
      console.log('[inject-stats] Series ended');
      seriesActive = false;
      playSound('seriesEnd');
      return;
    }
    
    // Game ended - mark for ban phase detection
    const mEnd = RX_GAME_END.exec(head);
    if (mEnd) {
      const endedGameNum = parseInt(mEnd[1], 10);
      console.log(`[inject-stats] Game ${endedGameNum} ended - waiting for ban phase`);
      lastCompletedGame = endedGameNum;
      banPhaseTriggered = false; // Reset for next ban phase
      return;
    }
    
    // Ban detection - trigger game start sound when ban phase begins
    // Works for: 1) First game of series (seriesActive && lastCompletedGame===0)
    //            2) Subsequent games (lastCompletedGame > 0)
    if (RX_BANNED.test(text)) {
      if (!banPhaseTriggered) {
        // First game: series is active but no games completed yet
        // Next games: a game has ended
        if ((seriesActive && lastCompletedGame === 0) || lastCompletedGame > 0) {
          const nextGame = lastCompletedGame + 1;
          console.log(`[inject-stats] 🎮 Ban phase detected - Game ${nextGame} starting!`);
          banPhaseTriggered = true;
          playSound('gameStart');
        }
      }
      return; // Ban events don't need further processing
    }
    
    const mStart = RX_GAME_START.exec(head);
    if (mStart) {
      currentGame = mStart[1];
      const gameNum = parseInt(currentGame, 10);
      gameStats[currentGame] = makeStats();
      // Clear processed entries for new game to allow fresh processing
      processedEntries.clear();
      // Clear dragon timestamps for new game
      dragonTimestamps.clear();
  // Reset multi streaks for new map
  multiStreaks.clear();
      // Play game start sound ONLY if not already triggered via ban phase
      // Also handles first game of series (lastCompletedGame=0) 
      if (!banPhaseTriggered) {
        console.log(`[inject-stats] 🎮 Game ${gameNum} started (via Grid event, no prior ban phase)`);
        playSound('gameStart');
      } else {
        console.log(`[inject-stats] Game ${gameNum} started (sound already played via ban phase)`);
      }
      // Update state: this game is now "in progress", so next bans will be for game N+1
      lastCompletedGame = gameNum - 1; // Set to current-1 so ban detection works correctly for NEXT game
      banPhaseTriggered = true; // Mark as triggered since this game has started
  // Immediately publish new empty game so popup can react (overlay animation)
  publish();
      return;
    }
  if (!currentGame) return;
    const stats = gameStats[currentGame];

    // Winner detection: strict single-line only to avoid mid-game false positives
    if (!stats.winner) {
      const teamNames = [team1Name, team2Name].filter(Boolean);
      // Direct single-line pattern: "<Team Name> won Game <N>"
      const mSingleLine = RX_GAME_WIN_SINGLE.exec(head);
      if (mSingleLine) {
        const candTeam = mSingleLine[1].trim();
        const gNum = String(mSingleLine[2]);
        if (teamNames.includes(candTeam)) {
          // Assign winner to the exact game mentioned in the log, not to currentGame
          const target = gameStats[gNum] || (gameStats[gNum] = makeStats());
          if (!target.winner) {
            target.winner = candTeam;
            target.winAt = ts;
            try { target.winnerSource = 'live-log-single-line'; } catch(_){ }
            try { console.log('[lol][winner][inject]', candTeam, 'won Game', gNum, 'at', ts); } catch(_){ }
          }
        }
      }
    }

    // достаём entity — либо ник, либо команда
    if (!chunks0.length) return;
    const actorRaw = chunks0[0].text.trim();
    const key      = actorRaw.toLowerCase();

    // сначала пробуем найти чемпиона
    let team = playerToTeam.get(key);
    // если не нашли, и текст равен одному из teamNames — засчитываем team-level
    if (!team) {
      if (actorRaw === team1Name) team = team1Name;
      else if (actorRaw === team2Name) team = team2Name;
    }
    if (!team) return;  // не нашло ни игрока, ни команду — пропускаем

    const t = text.toLowerCase();

    // Kill
    if (RX_KILL.test(t)) {
    const m = t.match(/^(.+?)\s+killed\s+(.+)$/i);
      if (m) {
        const killer = m[1].trim().toLowerCase();
        const victim = m[2].trim().toLowerCase();
        if (!playerToTeam.has(killer) || !playerToTeam.has(victim)) return;

        // первый килл
        if (!stats.firstKill) {
          stats.firstKill   = team;
          stats.firstKillAt = ts;
          // Play first blood sound
          playSound('firstBlood');
        }
        // общий счёт
        stats.killCount[team] = (stats.killCount[team]||0) + 1;
        // гонки
        const kc = stats.killCount[team];
        [[5,'race5','race5At'],[10,'race10','race10At'],
         [15,'race15','race15At'],[20,'race20','race20At']]
        .forEach(([n,k,at]) => {
          if (kc === n && !stats[k]) {
            stats[k]   = team;
            stats[at]  = ts;
          }
        });

  // --- Multi-kill detection (integrated) ---
  const nowMs = parseTsToMs(ts);
  const prev = multiStreaks.get(killer);
  const threshold = prev && prev.count >= 4 ? MULTI_PENTA_GAP : MULTI_INTER_GAP;
  const delta = prev ? nowMs - prev.lastMs : Infinity;
  let cnt;
  if(!prev || delta > threshold){ cnt=1; } else { cnt = prev.count + 1; }
  multiStreaks.set(killer, { count: cnt, lastMs: nowMs });
  if(cnt === 4 && !stats.quadra){ 
    stats.quadra = playerToTeam.get(killer) || team; 
    stats.quadraAt = ts;
    playSound('quadraKill');
  }
  else if(cnt === 5 && !stats.penta){ 
    stats.penta = playerToTeam.get(killer) || team; 
    stats.pentaAt = ts; 
    playSound('pentaKill');
    multiStreaks.set(killer, { count: 0, lastMs: nowMs }); 
  }
      }
    }

    // Tower
  if (RX_TOWER.test(t)) {
      if (!stats.firstTower) {
        stats.firstTower   = team;
        stats.firstTowerAt = ts;
        playSound('firstTower');
      }
      stats.towerCount[team] = (stats.towerCount[team]||0) + 1;
    }

    // Inhibitor
  if (RX_INHIB.test(t)) {
      if (!stats.firstInhibitor) {
        stats.firstInhibitor   = team;
        stats.firstInhibitorAt = ts;
        playSound('firstInhibitor');
      }
      stats.inhibitorCount[team] = (stats.inhibitorCount[team]||0) + 1;
    }

    // Baron
    if (RX_BARON.test(t)) {
      if (!stats.firstBaron) { 
        stats.firstBaron   = team; 
        stats.firstBaronAt = ts; 
        playSound('firstBaron');
      }
      stats.baronCount[team] = (stats.baronCount[team]||0) + 1;
    }

    // Atakhan
    if (RX_ATAKHAN.test(t)) {
      if (!stats.atakhan) {
        stats.atakhan = team;
        stats.atakhanAt = ts;
      }
    }

    // Dragon - check for both slaydragon and slay[Name]drake events
    if (RX_DRAGON.test(t) || RX_DRAKE.test(t)) {
      // Create a key to track dragon events at the same timestamp for the same team
      const dragonKey = `${team}-${ts}`;
      
      // Only count if we haven't already processed a dragon event for this team at this timestamp
      if (!dragonTimestamps.has(dragonKey)) {
        stats.dragonCount[team] = (stats.dragonCount[team]||0) + 1;
        const arr = stats.dragonTimes[team] ||= [];
        arr.push(ts);
        dragonTimestamps.set(dragonKey, true);
      }
    }
  }

  // Публикация в content.js
  function publish() {
    // восстановим имена команд из playerToTeam
    const uniq = Array.from(new Set(playerToTeam.values()));
    const [team1, team2] = uniq;

    window.postMessage({
      source: 'lol-live-stats',
      team1Name:   team1,
      team2Name:   team2,
      playerTeams: Object.fromEntries(playerToTeam),
      gameStats    // здесь прямо весь объект с gameStats
    }, '*');
  }

  // Listen for restart data collection message
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === 'restart_data_collection') {
      // Store current game stats before clearing (in case we want to preserve some data)
      const existingGames = Object.keys(gameStats);
      
      // Reset collection state but preserve game stats temporarily
      const preservedStats = { ...gameStats };
      mappingReady = false;
      backlog = [];
      // Don't clear processedEntries immediately - clear after a delay to prevent duplicate processing
      // processedEntries.clear(); 
      dragonTimestamps.clear();
      
      // Reset ban phase state
      lastCompletedGame = 0;
      banPhaseTriggered = false;
      seriesActive = false;
      
      Object.keys(gameStats).forEach(key => delete gameStats[key]);
      currentGame = null;
      team1Name = null;
      team2Name = null;
      
      // Clear processedEntries after a short delay to allow for proper restart
  setTimeout(() => { processedEntries.clear(); }, 1000);
    }
  });
})();
