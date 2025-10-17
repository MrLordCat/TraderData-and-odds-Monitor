// Broker extractors & odds collection
// Provides: getBrokerId(host), collectOdds(host, desiredMap), and deepQuery (internal export for advanced extractors)

function getBrokerId(host){
  try { host = (host||'').replace(/^https?:\/\//,'').replace(/\/.*$/,'').replace(/^www\./,''); } catch(_){}
  if(/rivalry/i.test(host)) return 'rivalry';
  if(/gg199|gg\.bet/i.test(host)) return 'gg';
  if(/thunderpick/i.test(host)) return 'thunder';
  if(/betboom/i.test(host)) return 'betboom';
  if(/pari\.ru/i.test(host)) return 'pari';
  if(/marathonbet\./i.test(host)) return 'marathon';
  if(/bet365\./i.test(host)) return 'bet365';
  if(/betgenius\.com$/i.test(host)) return 'dataservices';
  return host.split('.')[0] || 'generic';
}

function deepQuery(selector, root=document){
  const res=[];
  function walk(r){
    try { r.querySelectorAll(selector).forEach(e=>res.push(e)); } catch(_){ }
    try { r.querySelectorAll('*').forEach(n=>{ if(n.shadowRoot) walk(n.shadowRoot); }); } catch(_){ }
  }
  walk(root);
  return res;
}

// ---- Individual site extractors (all return {odds:[..], frozen:boolean}) ----
function extractRivalry(mapNum=0){
  // Classless variant (uses only data-editor-id wrappers + text heuristics)
  try {
    const debug = !!window.__RIVALRY_DEBUG;
    const wrappers = deepQuery('[data-editor-id="tableMarketWrapper"]');
    if(!wrappers.length) return { odds:['-','-'], frozen:false };
    const ORD=['First','Second','Third','Fourth','Fifth'];
    const norm = (s)=> (s||'').replace(/\s+/g,' ').trim().toLowerCase();
    let target=null;
    if(mapNum===0){
      // Match overall market. Rivalry sometimes labels it just "Winner"; map markets include a preceding map ordinal.
      for(const w of wrappers){
        try {
          // Collect first few non-empty lines of this wrapper
          const lines=(w.textContent||'').split('\n').map(l=>norm(l)).filter(l=>l.length).slice(0,6);
          if(!lines.length) continue;
          const header = lines[0];
          if(/winner/.test(header) && !/map\s*\d/.test(header)) { target = w; break; }
          // Fallback: header may be a single 'winner' but team names appear earlier due to DOM reorder.
          if(!target && lines.some(l=>l==='winner')){ target=w; break; }
        } catch(_){ }
      }
      // Last resort: pick first wrapper having exactly two outcome plates and a plain 'Winner' token
      if(!target){
        for(const w of wrappers){
          const hasWinner=/\bWinner\b/i.test(w.textContent||'');
          const plates=[...w.querySelectorAll('[data-editor-id="tableOutcomePlate"]')].slice(0,3);
          if(hasWinner && plates.length>=2 && !/Map\s*\d/i.test(w.textContent||'')){ target=w; break; }
        }
      }
    } else {
      const idx = mapNum-1; if(idx<0||idx>=ORD.length) return { odds:['-','-'], frozen:false };
      const ordWord = ORD[idx].toLowerCase();
      const num = idx+1;
      const mapPhraseRe = new RegExp('^('+
        ordWord.replace(/([.*+?^${}()|\[\]\\])/g,'\\$1')+'\\s+map|map\\s+'+num+'(?:st|nd|rd|th)?'+')');
      const badRe = /both\s+teams|first\s+(?:blood|tower|dragon)|to\s+slay|handicap|total|baron|dragon/i;
      function looksWinner(line){
        if(!line) return false;
        const n=norm(line);
        if(!/winner/.test(n)) return false;
        if(badRe.test(n)) return false;
        if(!mapPhraseRe.test(n)) return false;
        // must contain winner token after phrase
        return /winner/.test(n);
      }
      outer: for(const w of wrappers){
        const lines=(w.textContent||'').split('\n').map(l=>l.trim()).filter(l=>l.length).slice(0,12);
        for(const line of lines){ if(looksWinner(line)){ target=w; break outer; } }
      }
    }
    if(!target) return { odds:['-','-'], frozen:false };
    const plates = Array.from(target.querySelectorAll('[data-editor-id="tableOutcomePlate"]')).slice(0,2);
    if(plates.length<2) return { odds:['-','-'], frozen:false };
    const extractPrice=(plate)=>{
      const spans=[...plate.querySelectorAll('span')];
      const numeric = spans.map(s=>s.textContent.trim()).filter(t=>/^\d+(?:[.,]\d+)?$/.test(t));
      const raw = numeric[numeric.length-1] || (spans.length? spans[spans.length-1].textContent.trim(): '-');
      return raw.replace(',','.');
    };
    const odds = plates.map(extractPrice);
    // Enhanced suspension detection:
    // A plate is ACTIVE if:
    //  - Has a numeric odds value AND
    //  - Not explicitly disabled (aria-disabled/disabled) AND
    //  - Not visually fully dimmed (opacity <0.35) AND
    //  - Pointer events not removed AND
    //  - No lock icon inside AND
    //  - Computed color not overly greyed (#777+ range) unless high opacity + pointer-events
    // Market frozen if ALL plates inactive OR wrapper contains textual suspension cues.
    function isActivePlate(plate){
      try {
        // Lock / disabled attributes
        if(plate.matches('[disabled],[aria-disabled="true"],[data-disabled="true"]')) return false;
        if(plate.querySelector('[data-editor-id="LockIcon"],svg[data-editor-id*="Lock" i]')) return false;
        const spans=[...plate.querySelectorAll('span')];
        const numeric = spans.map(s=>s.textContent.trim()).filter(t=>/^\d+(?:[.,]\d+)?$/.test(t));
        if(!numeric.length) return false; // no price visible
        const lastSpan = spans.find(s=>s.textContent && s.textContent.trim()===numeric[numeric.length-1]) || spans[spans.length-1];
        const cs = lastSpan? getComputedStyle(lastSpan): null;
        if(!cs) return false;
        if(cs.pointerEvents==='none') return false;
        const op = parseFloat(cs.opacity||'1'); if(!isNaN(op) && op < 0.35) return false;
        const color = cs.color || '';
        // crude grey detection (#777-#aaa or rgb with similar channels) – indicates disabled style sometimes
        if(/#7[0-9a-f]{1}|#8[0-9a-f]{1}|#9[0-9a-f]{1}|#aaa/i.test(color)){ if(op < 0.9) return false; }
        if(/^rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/i.test(color)){
          const m=color.match(/(\d+)/g)||[]; if(m.length>=3){ const [r,g,b]=m.slice(0,3).map(Number); const delta=Math.max(r,g,b)-Math.min(r,g,b); if(delta<8 && r<150){ if(op<0.9) return false; } }
        }
        return true;
      } catch(_){ return false; }
    }
    const plateStates = plates.map(p=>({ active:isActivePlate(p) }));
    let heuristicAllInactive = plateStates.every(s=>!s.active);

    // Old extension heuristic: mark frozen if ANY plate's last span has pointerEvents none OR cursor default/not-allowed OR opacity <1
    let legacyFrozen = false;
    try {
      plates.forEach(plate=>{
        if(legacyFrozen) return;
        const spans=plate.querySelectorAll('span');
        const last=spans[spans.length-1];
        if(!last) return;
        const cs=getComputedStyle(last);
        const op=parseFloat(cs.opacity||'1');
        if(cs.pointerEvents==='none' || cs.cursor==='default' || cs.cursor==='not-allowed' || (!isNaN(op) && op<1)) legacyFrozen=true;
      });
    } catch(_){ }

    // Wrapper text cues
    let textCueFrozen=false;
    try { const txt=norm(target.textContent||''); if(/suspend|suspens|closed|settled|unavailable/.test(txt)) textCueFrozen=true; } catch(_){ }

    const frozen = heuristicAllInactive || legacyFrozen || textCueFrozen;
    if(debug){ try { console.log('[RIVALRY][debug]', { mapNum, odds, plateStates, heuristicAllInactive, legacyFrozen, textCueFrozen, frozen }); } catch(_){ } }
    return { odds: odds.length===2?odds:['-','-'], frozen };
  } catch(_){ return { odds:['-','-'], frozen:false }; }
}

function extractGg(mapNum=1){
  // STRICT policy for map markets (>=1): if specific "Map N - Winner" is missing, DO NOT fallback to other markets.
  // GG UI uses [data-test="market-name"] with values like "Map 3 - Winner (incl. overtime)".
  let blocks=[...document.querySelectorAll('div.bg-surface-middle.mb-2')];
  if(!blocks.length) blocks=[...document.querySelectorAll('div.mb-2.w-full.bg-surface-middle')];
  if(!blocks.length) blocks=[...document.querySelectorAll("div[class*='bg-surface-middle']")].filter(d=>d.querySelector('[data-test="market-name"]'));
  if(!blocks.length) return {odds:['-','-'],frozen:false};
  let target=null;
  if(mapNum<=0){
    // Match-level winner (leave as permissive)
    target=blocks.find(b=>/\bWinner\b/i.test(b.querySelector('[data-test="market-name"]')?.textContent||''));
  } else {
    const nameOf = (b)=> (b.querySelector('[data-test="market-name"]')?.textContent||'').trim();
    const reStrict = new RegExp('^' + 'Map\\s*'+mapNum+'\\s*-?\\s*Winner' + '(?:\\s*\\(incl\\\.?\\s*overtime\\))?' + '$','i');
    target = blocks.find(b=> reStrict.test(nameOf(b)) );
    // No fallback to generic "Winner" if strict market not present
  }
  if(!target) return {odds:['-','-'],frozen:false};
  const resultEls = Array.from(target.querySelectorAll('div[data-test="odd-button__result"]')).slice(0,2);
  const odds = resultEls.map(el=> (el.textContent||'').trim().replace(',','.'));
  // Basic frozen detection: if all corresponding buttons appear non-interactive (cursor-not-allowed/disabled)
  const frozen = (resultEls.length===2) && resultEls.every(el=>{
    const btn = el.closest('[data-test*="odd-button"]') || el.closest('div');
    if(!btn) return false; const cls = (btn.className||'');
    if(/cursor-not-allowed/.test(cls)) return true;
    try { const cs = getComputedStyle(btn); if(cs.pointerEvents==='none' || parseFloat(cs.opacity||'1') < 0.5) return true; } catch(_){ }
    return false;
  });
  return {odds:odds.length===2?odds:['-','-'],frozen};
}

function extractThunder(mapNum=1){
  const mapRe=new RegExp(`Map\\s*${mapNum}\\s+Winner`,'i'); const matchRe=/Match\\s+Winner/i; const markets=[...document.querySelectorAll("div[data-testid^='market-']")];
  let t=markets.find(m=>mapRe.test(m.textContent)); if(!t) t=markets.find(m=>matchRe.test(m.textContent)); if(!t) return {odds:['-','-'],frozen:false};
  const odds=[...t.querySelectorAll('span.odds-button__odds')].map(e=>e.textContent.trim()).slice(0,2); return {odds:odds.length===2?odds:['-','-'],frozen:false};
}

function extractBetboom(mapNum=1){
  // NOTE: Russian words ("Карта", "Исход", "Исход матча", "П") intentionally retained.
  // They match the bookmaker's live DOM and must NOT be translated.
  const sections=[...document.querySelectorAll('section')];
  let target=null;
  if(mapNum<=0){
    // Explicit match-level (do NOT coerce to map1)
    target=sections.find(s=>/Исход\s+матча/i.test(s.textContent));
  } else {
    const num=parseInt(mapNum,10)||1; const mapRe=new RegExp(`Карта\\s*${num}`,'i');
    target=sections.find(s=>/Исход/i.test(s.textContent) && mapRe.test(s.textContent));
    if(!target){
      // Fallback to match-level if specific map collapsed or missing
      target=sections.find(s=>/Исход\s+матча/i.test(s.textContent));
    }
  }
  if(!target) return {odds:['-','-'],frozen:false};
  const buttons=[...target.querySelectorAll('button')].filter(btn=>/^П\d+$/.test(btn.querySelector('div:first-child')?.textContent.trim())).slice(0,2);
  const odds=buttons.map(btn=>{ if(btn.disabled|| btn.querySelector('use[xlink\\:href="#lock-outline"]')) return '-'; const val=btn.querySelector('div:nth-child(2)'); return val? val.textContent.trim().replace(',','.'):'-'; });
  return {odds:odds.length===2?odds:['-','-'],frozen:false};
}

function extractPari(mapNum=0){
  // NOTE: Russian literals ("-я карта", "Исход") intentionally retained for DOM matching.
  try {
    const wrapper=document.querySelector('.keyboard-navigator--Zb6nL');
    if(mapNum>0){
      const label=mapNum+'-я карта';
      const tabExists=[...wrapper?.querySelectorAll?.('.tab--HvZxB')||[]].some(t=>t.textContent.trim()===label);
      if(!tabExists) return {odds:['-','-'],frozen:false};
      const selected=[...wrapper.querySelectorAll('.tab--HvZxB._selected--YKWOS')][0];
      if(selected){
        const selTxt=selected.textContent.trim();
        if(selTxt!==label) return {odds:['-','-'],frozen:false};
      }
    }
  } catch(_){}
  const header=Array.from(document.querySelectorAll('div.text--NI31Y > div')).find(el=>/Исход/i.test(el.textContent.trim())); if(!header) return {odds:['-','-'],frozen:false};
  const headerBox=header.closest('.header--GKg3q'); if(!headerBox) return {odds:['-','-'],frozen:false}; const body=headerBox.nextElementSibling; if(!body) return {odds:['-','-'],frozen:false}; const table=body.querySelector('.table--_LdRe'); if(!table) return {odds:['-','-'],frozen:false};
  const cells=[...table.querySelectorAll('.factor--DmCVH')].slice(0,2); const odds=cells.map(c=>{ const v=c.querySelector('.value--v77pD'); return v? v.textContent.trim():'-'; }); const frozen=cells.some(c=>c.classList.contains('_blocked--p09xk'));
  return {odds:odds.length===2?odds:['-','-'],frozen};
}

function extractMarathon(mapNum=1){
  try {
    const blocks = Array.from(document.querySelectorAll('div.market-inline-block-table-wrapper'));
    if(!blocks.length) return { odds:['-','-'], frozen:false };
    function suffix(n){
      const v = parseInt(n,10)||1; const j=v%10, k=v%100;
      if(j===1 && k!==11) return v+'st'; if(j===2 && k!==12) return v+'nd'; if(j===3 && k!==13) return v+'rd'; return v+'th';
    }
    const wanted = mapNum>0 ? new RegExp('^'+suffix(mapNum).replace(/([.*+?^${}()|\[\]\\])/g,'\\$1')+'\\s+Map\\s+Result$', 'i') : null;
    let target=null;
    for(const b of blocks){
      const nameEl = b.querySelector('table.market-table-name .name-field');
      const name = (nameEl?.textContent||'').trim();
      if(wanted && wanted.test(name)) { target=b; break; }
    }
    // Strict: если конкретный рынок для выбранной карты не найден – НЕ подставляем другой Map Result
    if(!target) return { odds:['-','-'], frozen:false };
    const dataTable = target.querySelector('table.td-border');
    if(!dataTable) return { odds:['-','-'], frozen:false };
    const rows = Array.from(dataTable.querySelectorAll('tr')).slice(0,2);
    if(rows.length<2) return { odds:['-','-'], frozen:false };
    const parsePrice = (row)=>{
      const active = row.querySelector('.result-right .selection-link');
      const susp = row.querySelector('.result-right .suspended-selection');
      const el = active || susp;
      if(!el) return '-';
      return (el.textContent||'').trim().replace(',','.');
    };
    const odds = rows.map(parsePrice);
    const frozen = rows.some(r=> !!r.querySelector('.suspended-selection'));
    return { odds: odds.length===2?odds:['-','-'], frozen };
  } catch(_) { return { odds:['-','-'], frozen:false }; }
}

function extractBet365(mapNum=0){
  // bet365 structure policy (adjusted):
  //  mapNum === 0      => Match Lines (overall match winner)
  //  mapNum >= 1 (1,2,3...) => "Map {n} - Winner" (STRICT). Если конкретный Map рынок отсутствует -> возвращаем ['-','-'] (не подставляем матчевые).
  try {
    const pods = Array.from(document.querySelectorAll('div.gl-MarketGroupPod'));
    if(!pods.length) return { odds:['-','-'], frozen:false };
    let target=null;
    if(mapNum>=1){
      // Map market variants: "Map N - Winner", "Map N Winner", "Map N Winner 2-Way"
      const re = new RegExp('^Map\\s*'+mapNum+'(?:\\s*[-–]?\\s*)?Winner(?:\\s*2-Way)?$','i');
      const btnText = (p)=> (p.querySelector('.sip-MarketGroupButton_Text')?.textContent||'').trim();
      target = pods.find(p=> re.test(btnText(p)));
      if(!target){
        // Fallback loose search
        const loose = new RegExp('Map\\s*'+mapNum+'[^\n]*Winner','i');
        target = pods.find(p=> loose.test(p.textContent||''));
      }
      if(!target) return { odds:['-','-'], frozen:false };
      // Extract participants with multiple layout fallbacks
      let parts = Array.from(target.querySelectorAll('.srb-ParticipantStackedBorderless'));
      if(parts.length<2) parts = Array.from(target.querySelectorAll('.sip-MergedHandicapParticipant'));
      if(parts.length<2){
        // New layout: simple gl-Participant rows (two entries) inside a single gl-Market
        const gp = Array.from(target.querySelectorAll('.gl-Participant')); // filter to those with odds span
        const gpOdds = gp.filter(n=> n.querySelector('.gl-Participant_Odds'));
        if(gpOdds.length>=2) parts = gpOdds.slice(0,2);
      }
      if(parts.length<2){
        // Centered stacked rows variant (two columns each with first row = To Win)
        const centered = Array.from(target.querySelectorAll('.srb-ParticipantCenteredStackedMarketRow:not(.srb-ParticipantCenteredStackedMarketRow-hashandicap)'));
        if(centered.length>=2) parts = centered.slice(0,2);
      }
      const odds = parts.slice(0,2).map(p=>{
        const o = p.querySelector('.srb-ParticipantStackedBorderless_Odds, .sip-MergedHandicapParticipant_Odds, .gl-Participant_Odds, .srb-ParticipantCenteredStackedMarketRow_Odds');
        return o? o.textContent.trim(): '-';
      });
      const disabledFrozen = parts.slice(0,2).some(p=>{
        const o = p.querySelector('.srb-ParticipantStackedBorderless_Odds, .sip-MergedHandicapParticipant_Odds, .gl-Participant_Odds, .srb-ParticipantCenteredStackedMarketRow_Odds');
        if(!o) return false; const cs = getComputedStyle(o); return cs.pointerEvents==='none' || parseFloat(cs.opacity||'1')<1; });
      let groupSuspended=false; let partSusp=false;
      try {
        const topRow = target.querySelector('.sip-MarketGroupButton_TopRowContainer');
        if(topRow && /suspended/i.test(topRow.className)) groupSuspended=true;
        if(target.querySelector('.sip-MarketGroupButton_SuspendedText')) groupSuspended=true;
      } catch(_){ }
      try { partSusp = parts.slice(0,2).some(p=> /gl-Participant_Suspended/.test(p.className||'')); } catch(_){ }
      const frozen = groupSuspended || partSusp || disabledFrozen;
      return { odds: odds.length===2?odds:['-','-'], frozen };
    } else {
      // Match level market: previously "Match Lines"; need to capture To Win variant where odds appear in centered stacked rows
      const btnText = (p)=> (p.querySelector('.sip-MarketGroupButton_Text')?.textContent||'').trim();
      target = pods.find(p=> /Match\s+Lines/i.test(btnText(p)));
      if(!target) return { odds:['-','-'], frozen:false };
      // Collect odds from multiple possible structures
      let parts = Array.from(target.querySelectorAll('.sip-MergedHandicapParticipant'));
      if(parts.length<2) parts = Array.from(target.querySelectorAll('.srb-ParticipantStackedBorderless'));
      if(parts.length<2){
        // Centered stacked variant: pick first row (To Win) from each team column
        const candidates = Array.from(target.querySelectorAll('.srb-ParticipantCenteredStackedMarketRow'))
          .filter(r=> !r.classList.contains('srb-ParticipantCenteredStackedMarketRow-hashandicap'));
        if(candidates.length>=2) parts = candidates.slice(0,2);
      }
      if(parts.length<2){
        // Gl participant fallback inside grouped columns (each column has one To Win row as first odds)
        const gp = Array.from(target.querySelectorAll('.gl-Participant')).filter(n=> n.querySelector('.gl-Participant_Odds'));
        if(gp.length>=2) parts = gp.slice(0,2);
      }
      if(parts.length<2){
        // NEW FALLBACK (2025-09): Column header layout (three adjacent gl-Market columns: blank label + team1 + team2)
        try {
          const cols = Array.from(target.querySelectorAll('.gl-MarketGroupContainer > .gl-Market.gl-Market_General-columnheader'));
          if(cols.length>=3){
            const teamCols = cols.slice(-2);
            const oddsSpans = teamCols.map(c=> c.querySelector('.srb-ParticipantCenteredStackedMarketRow_Odds'));
            if(oddsSpans.every(Boolean)){
              parts = oddsSpans; // treat odds spans as parts for uniform mapping below
            }
          }
        } catch(_){ }
      }
      const odds = parts.slice(0,2).map(p=> p.querySelector('.sip-MergedHandicapParticipant_Odds, .srb-ParticipantStackedBorderless_Odds, .srb-ParticipantCenteredStackedMarketRow_Odds, .gl-Participant_Odds')?.textContent.trim() || '-');
      const disabledFrozen = parts.slice(0,2).some(p=>{ const o=p.querySelector('.sip-MergedHandicapParticipant_Odds, .srb-ParticipantStackedBorderless_Odds, .srb-ParticipantCenteredStackedMarketRow_Odds, .gl-Participant_Odds'); if(!o) return false; const cs=getComputedStyle(o); return cs.pointerEvents==='none'|| parseFloat(cs.opacity||'1')<1; });
      let groupSuspended=false; let partSusp=false;
      try {
        const topRow = target.querySelector('.sip-MarketGroupButton_TopRowContainer');
        if(topRow && /suspended/i.test(topRow.className)) groupSuspended=true;
        if(target.querySelector('.sip-MarketGroupButton_SuspendedText')) groupSuspended=true;
      } catch(_){ }
      try { partSusp = parts.slice(0,2).some(p=> /gl-Participant_Suspended/.test(p.className||'')); } catch(_){ }
      const frozen = groupSuspended || partSusp || disabledFrozen;
      return { odds: odds.length===2?odds:['-','-'], frozen };
    }
  } catch(_){ return { odds:['-','-'], frozen:false }; }
}

// DataServices (BetGenius) dynamic page extractor
// Markets of interest:
//  Match Up Winner  (mapNum=0)
//  Map N Winner     (mapNum>=1)
// Strict: if a specific map market absent -> ['-','-']
function extractDataServices(mapNum=0){
  try {
    const markets = Array.from(document.querySelectorAll('div.market'));
    if(!markets.length) return { odds:['-','-'], frozen:false };
    let target=null;
    if(mapNum>=1){
      const re = new RegExp('^Map\\s*'+mapNum+'\\s*Winner$','i');
      target = markets.find(m=> re.test(getMarketName(m)) );
      if(!target) return { odds:['-','-'], frozen:false };
    } else {
      target = markets.find(m=> /Match\s*Up\s*Winner/i.test(getMarketName(m)) );
      if(!target) return { odds:['-','-'], frozen:false };
    }
    const items = Array.from(target.querySelectorAll('ul.selections-container li.selection-item')).slice(0,2);
    if(items.length<2) return { odds:['-','-'], frozen:false };
    const odds = items.map(li=>{
      const val = li.querySelector('.current-odds .ng-binding, .current-odds');
      if(!val) return '-';
      let t = (val.textContent||'').trim().replace(/[\r\n]+/g,' ').replace(',', '.');
      // If combined like "2.50 36.7%" or "2.50 (36.7%)" keep only the first decimal number
      const m = t.match(/\d+(?:\.\d+)?/);
      if(m) t = m[0];
      if(/^[-–]$/.test(t)) return '-';
      return t;
    });
    // Frozen detection (GLOBAL across all markets): if ANY market on page appears suspended (not just closed), we mark current odds as frozen.
    // Rationale: need to reflect DS suspension even if it occurs in a different map market.
    // Only consider truly suspended markets, not just closed ones.
    let globalSuspended=false;
    try {
      for(const m of markets){
        const c = m.className || '';
        // Check specifically for suspended status (both MarketTradingStatus-Suspended AND UserSuspensionStatus-Suspended)
        if(/flags-MarketTradingStatus-Suspended/.test(c) && /flags-UserSuspensionStatus-Suspended/.test(c)) { 
          globalSuspended=true; 
          break; 
        }
      }
    } catch(_){ }
    return { odds: odds.length===2?odds:['-','-'], frozen: globalSuspended };
  } catch(_){ return { odds:['-','-'], frozen:false }; }

  function getMarketName(m){
    try {
      return (m.querySelector('table.market-header td.market-name')?.textContent||'').trim();
    } catch(_){ return ''; }
  }
}

const EXTRACTOR_TABLE = [
  { test: /rivalry\.com$/i, fn: extractRivalry },
  { test: /gg199\.bet$/i, fn: extractGg },
  { test: /gg\.bet$/i, fn: extractGg },
  { test: /thunderpick\.io$/i, fn: extractThunder },
  { test: /betboom\.ru$/i, fn: extractBetboom },
  { test: /pari\.ru$/i, fn: extractPari },
  { test: /marathonbet\./i, fn: extractMarathon }
  ,{ test: /bet365\./i, fn: extractBet365 }
  ,{ test: /betgenius\.com$/i, fn: extractDataServices }
];

function collectOdds(host, desiredMap){
  let meta={odds:['-','-'],frozen:false};
  for(const row of EXTRACTOR_TABLE){ if(row.test.test(host)){ meta=row.fn(desiredMap)||meta; break; } }
  return { broker:getBrokerId(host), odds:meta.odds, frozen:meta.frozen, ts:Date.now(), map:desiredMap };
}

module.exports = { getBrokerId, collectOdds, deepQuery };
