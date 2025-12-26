// Extracted runtime from inline script in lolstats/index.html
(function(){
  let __lolAnimSuppressUntil = Date.now() + 5000;
  const metricsOrder = [
    'firstKill','killCount','race5','race10','race15','race20','firstTower','firstInhibitor','firstBaron','towerCount','inhibitorCount','baronCount','dragonCount','dragonTimes','netWorth','quadra','penta','atakhan'
  ];
  const metricLabels = {
    firstKill:'First Blood', killCount:'Kills', race5:'Race 5', race10:'Race 10', race15:'Race 15', race20:'Race 20',
    firstTower:'First Tower', firstInhibitor:'First Inhib', firstBaron:'First Baron', towerCount:'Towers', inhibitorCount:'Inhibitors', baronCount:'Barons',
    dragonCount:'Dragons', dragonTimes:'Dragon Times', netWorth:'Net Worth', quadra:'Quadra', penta:'Penta', atakhan:'Atakhan'
  };

  function ensureRows() {
    const body = document.getElementById('metricsBody');
    if (!body || body.children.length) return;
    metricsOrder.forEach(id => {
      const tr = document.createElement('tr');
      tr.dataset.metric = id;
      tr.innerHTML = `<td class="metric">${metricLabels[id]||id}</td><td id="${id}-team1"></td><td id="${id}-team2"></td>`;
      body.appendChild(tr);
    });
  }
  function setCell(id, side, html) {
    const el = document.getElementById(`${id}-${side}`);
    if (el && el.innerHTML !== html) el.innerHTML = html;
  }
  function applyWinLose(id, winnerIdx) {
    const c1 = document.getElementById(`${id}-team1`);
    const c2 = document.getElementById(`${id}-team2`);
    if(!c1 || !c2) return;
    const v1 = c1.textContent.trim();
    const v2 = c2.textContent.trim();
    const bothEmpty = !v1 && !v2;
    [c1,c2].forEach(el=> el.classList.remove('win','lose'));
    if(!winnerIdx || bothEmpty) return;
    if(winnerIdx===1) { c1.classList.add('win'); c2.classList.add('lose'); }
    else { c2.classList.add('win'); c1.classList.add('lose'); }
  }
  function render(payload) {
    ensureRows();
    const { team1Name, team2Name, gameStats } = payload;
    const gameNumbers = Object.keys(gameStats).map(Number).sort((a,b)=>a-b);
    const gameN = gameNumbers[gameNumbers.length-1];
    const stats = gameStats[gameN] || {};
    const t1Name = team1Name||'Team 1';
    const t2Name = team2Name||'Team 2';
    const t1El = document.getElementById('team1-name');
    const t2El = document.getElementById('team2-name');
    if(t1El) t1El.textContent = t1Name;
    if(t2El) t2El.textContent = t2Name;
    function setBinary(field, atField) {
      const v = stats[field];
      if (!v) return;
      const t = v === t1Name ? 1 : 2;
      const atVal = atField ? (stats[atField] ? `${stats[atField]}` : '') : '✓';
      setCell(field,'team'+t, atVal);
      const otherSide = t===1 ? 'team2':'team1';
      const otherEl = document.getElementById(`${field}-${otherSide}`);
      if(otherEl && !otherEl.textContent) otherEl.textContent = '';
      applyWinLose(field, t);
    }
    function setCount(field) {
      const bucket = stats[field] || {};
      let raw1 = bucket[t1Name];
      let raw2 = bucket[t2Name];
      const has1 = typeof raw1 === 'number';
      const has2 = typeof raw2 === 'number';
      if (has1 && !has2) raw2 = 0; else if (has2 && !has1) raw1 = 0;
      const v1 = (typeof raw1 === 'number') ? raw1 : '';
      const v2 = (typeof raw2 === 'number') ? raw2 : '';
      setCell(field,'team1', v1 === '' ? '' : v1);
      setCell(field,'team2', v2 === '' ? '' : v2);
      if (typeof raw1 === 'number' && typeof raw2 === 'number' && raw1 !== raw2) {
        applyWinLose(field, raw1 > raw2 ? 1 : 2);
      }
    }
    setBinary('firstKill','firstKillAt');
    setCount('killCount');
    ['race5','race10','race15','race20'].forEach(r=> setBinary(r,r+'At'));
    setBinary('firstTower','firstTowerAt');
    setBinary('firstInhibitor','firstInhibitorAt');
    setBinary('firstBaron','firstBaronAt');
    setCount('towerCount');
    setCount('inhibitorCount');
    setCount('baronCount');
    setCount('dragonCount');
    const times1 = (stats.dragonTimes?.[t1Name]||[]).join(' ');
    const times2 = (stats.dragonTimes?.[t2Name]||[]).join(' ');
    setCell('dragonTimes','team1', times1);
    setCell('dragonTimes','team2', times2);
    const nw = stats.netWorth||{}; const rawNw1 = nw[t1Name]; const rawNw2 = nw[t2Name];
    const hasNw1 = rawNw1 != null; const hasNw2 = rawNw2 != null;
    setCell('netWorth','team1', hasNw1? rawNw1 : '');
    setCell('netWorth','team2', hasNw2? rawNw2 : '');
    if((hasNw1 || hasNw2) && rawNw1 !== rawNw2) applyWinLose('netWorth', (rawNw1||0) > (rawNw2||0) ? 1 : 2);
    if (stats.quadra) setBinary('quadra','quadraAt');
    if (stats.penta) setBinary('penta','pentaAt');
    setBinary('atakhan','atakhanAt');
    const statusEl = document.getElementById('status');
    if(statusEl) statusEl.textContent = `Games: ${gameNumbers.join(', ')}`;
  }
  window.addEventListener('message', (e)=>{ if (e.data && e.data.__lolStatsPayload) render(e.data.__lolStatsPayload); });
  const resetBtn = document.getElementById('resetBtn');
  if(resetBtn){
    resetBtn.addEventListener('click', ()=> window.postMessage({ type:'restart_data_collection' }, '*'));
  }
})();
