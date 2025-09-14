// ORIGINAL EXTENSION SOURCE (copied)
// ...existing code...
// inject-multikill.js (fixed backlog + mapping guard + NPC filter + detailed log)
(() => {
  const RX_GAME_START = /^game\s+(\d+)\s+started$/i;
  const RX_KILL       = /^(.+?)\s+killed\s+(.+?)$/i;
  const INTER_GAP     = 10_000;
  const PENTA_GAP     = 30_000;

  let playerToTeam = new Map();
  let mappingReady = false;
  const backlog    = [];

  function parseTs(ts) {
    if(!ts) return 0;
    const parts = ts.split(':').map(n=>Number(n)||0);
    if(parts.length === 3) { // h:m:s
      const [h,m,s] = parts; return (h*3600 + m*60 + s)*1000;
    }
    if(parts.length === 2){ const [m,s] = parts; return (m*60 + s)*1000; }
    // fallback: if single number (seconds)
    if(parts.length === 1) return parts[0]*1000;
    return 0;
  }

  const streaks = new Map(); // nick → {count, lastTs}
  let currentGame = null; // track current game number for proper association

  // когда придёт mapping-ready с непустым detail
  window.addEventListener('lol-mapping-ready', e => {
    const detail = e.detail;
    if (!detail || typeof detail !== 'object' || !Object.keys(detail).length) {
      // игнорируем пустой / предварительный mapping-ready
      return;
    }
    // синхронизируем карту
    playerToTeam = new Map(
      Object.entries(detail)
            .map(([nick, team]) => [nick.toLowerCase(), team])
    );
    mappingReady = true;
    

    // прогоняем backlog
    while (backlog.length) {
      parseLine(backlog.shift());
    }
  });

  // складываем всё в backlog до mappingReady
  window.addEventListener('lol-live-log-update', e => {
    if (!mappingReady) {
      backlog.push(e.detail);
    } else {
      parseLine(e.detail);
    }
  });

  // Race condition guard: if mapping-ready fired before this script loaded, reuse global map.
  // The mapping injector stores Map in window.__lolPlayerToTeam once it has both teams.
  try {
    if (!mappingReady && window.__lolPlayerToTeam instanceof Map && window.__lolPlayerToTeam.size >= 2) {
      playerToTeam = new Map();
      window.__lolPlayerToTeam.forEach((team, nick) => {
        if (nick && team) playerToTeam.set(String(nick).toLowerCase(), team);
      });
      if (playerToTeam.size >= 2) {
        mappingReady = true;
        // Process any backlog accumulated while waiting.
        while (backlog.length) parseLine(backlog.shift());
      }
    }
  } catch(_) { /* swallow */ }

  function parseLine({ text, ts }) {
    const low = text.trim().toLowerCase();

    // новый раунд
    if (RX_GAME_START.test(low)) {
      const gm = RX_GAME_START.exec(low);
      if(gm && gm[1]) currentGame = gm[1];
      streaks.clear();
      try { console.log('[lol-multi] game-start', currentGame, 'backlogRemaining='+backlog.length); } catch(_){ }
      return;
    }

  const m = text.trim().match(RX_KILL);
    if (!m) return;

    const killerRaw = m[1].trim();
    const victimRaw = m[2].trim();
    const killer    = killerRaw.toLowerCase();
    const victim    = victimRaw.toLowerCase();
    const nowMs     = parseTs(ts);

  // Фильтр NPC ослаблен: достаточно чтобы убийца был в мапе (жертва может быть не распознана – сохраним серию)
  if (!playerToTeam.has(killer)) return; // без валидного киллера не продолжаем

  const prev      = streaks.get(killer);
    const threshold = prev && prev.count >= 4 ? PENTA_GAP : INTER_GAP;
    const delta     = prev ? nowMs - prev.lastTs : Infinity;

    let cnt;
    if (!prev || delta > threshold) {
      cnt = 1;
    } else {
      cnt = prev.count + 1;
    }
  streaks.set(killer, { count: cnt, lastTs: nowMs });

    

    // получаем команду убийцы
    const team = playerToTeam.get(killer);
    if (!team) {
      return;
    }

  // (debug logging removed after validation)

    // quadra / penta
    if (cnt === 4) {
      try { console.log('[lol-multi] QUADRA detected', { game: currentGame, killer: killerRaw, team, ts, cnt }); } catch(_){ }
      window.postMessage({
        source: 'lol-multikill',
        game: currentGame || null,
        multiStats: { quadra: { team, time: ts } }
      }, '*');
    }
    else if (cnt === 5) {
      try { console.log('[lol-multi] PENTA detected', { game: currentGame, killer: killerRaw, team, ts, cnt }); } catch(_){ }
      window.postMessage({
        source: 'lol-multikill',
        game: currentGame || null,
        multiStats: { penta: { team, time: ts } }
      }, '*');
      // после пенты сбросим серию, чтобы не считать дальше «сны»
      streaks.set(killer, { count: 0, lastTs: nowMs });
    }
    else {
      // regular kill step logging (only for counts >=2 to reduce noise)
      if(cnt>=2){ try { console.log('[lol-multi] streak-progress', { game: currentGame, killer: killerRaw, team, cnt, delta }); } catch(_){ } }
    }
  }

  // Listen for restart data collection message
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === 'restart_data_collection') {
      // Не очищаем backlog – иначе теряем возможные kill линии пришедшие до mapping
      mappingReady = false;
      streaks.clear();
      // playerToTeam пусть обновит inject-map.js; backlog будет переобработан после нового mapping-ready
    }
  });
})();
