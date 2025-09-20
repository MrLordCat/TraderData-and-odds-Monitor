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
    try { r.querySelectorAll(selector).forEach(e=>res.push(e)); } catch(_){}
    try { r.querySelectorAll('*').forEach(n=>{ if(n.shadowRoot) walk(n.shadowRoot); }); } catch(_){}
  }
  walk(root);
  return res;
}

// ---- Individual site extractors (all return {odds:[..], frozen:boolean}) ----
function extractRivalry(mapNum=0){
  // Completely class-agnostic Rivalry extractor.
  // Relies ONLY on:
  //   - wrapper: [data-editor-id="tableMarketWrapper"]
  //   - outcome plates: [data-editor-id="tableOutcomePlate"]
  //   - header text content (normalized): "Winner" or "First map - winner" etc.
  // Semantics:
  //   mapNum=0 -> match winner (exact header 'Winner')
  //   mapNum>=1 -> strict "{Ordinal} map - winner" (ordinal English words)
  try {
  const debug = !!window.__RIVALRY_DEBUG;
  const wrappers = deepQuery('[data-editor-id="tableMarketWrapper"]');
    if(!wrappers.length) return { odds:['-','-'], frozen:false };
    const ORD=['First','Second','Third','Fourth','Fifth'];
    const norm = (s)=> (s||'').replace(/\s+/g,' ').trim().toLowerCase();
    let target=null;
    if(mapNum===0){
      // Scan each wrapper: take first non-empty line (or first heading-like element text)
      for(const w of wrappers){
        let headerCandidates=[];
        // first line of text
        const firstLine = (w.textContent||'').split('\n').map(l=>norm(l)).find(l=>l.length>0) || '';
        if(firstLine) headerCandidates.push(firstLine);
        // direct child div/ span short texts
        headerCandidates.push(...Array.from(w.children).slice(0,3).map(c=>norm(c.textContent||'')));
        if(headerCandidates.some(t=>/^winner$/.test(t))){ target=w; break; }
      }
    } else {
      const idx=mapNum-1; if(idx<0||idx>=ORD.length) return { odds:['-','-'], frozen:false };
      const pattern = new RegExp('^'+ORD[idx].toLowerCase().replace(/([.*+?^${}()|\[\]\\])/g,'\\$1')+'\\s+map\\s*-?\\s*winner$');
      outer: for(const w of wrappers){
        const lines = (w.textContent||'').split('\n').map(l=>norm(l)).filter(l=>l.length);
        for(const line of lines){ if(pattern.test(line)){ target=w; break outer; } }
        if(!target){
          // Consider short child nodes text
          const childTexts = Array.from(w.children).slice(0,5).map(c=>norm(c.textContent||''));
          if(childTexts.some(t=>pattern.test(t))){ target=w; break; }
        }
      }
    }
    if(!target) return { odds:['-','-'], frozen:false };
    const plates = Array.from(target.querySelectorAll('[data-editor-id="tableOutcomePlate"]')).slice(0,2);
    if(plates.length<2) return { odds:['-','-'], frozen:false };
    const extractPrice=(plate)=>{
      // Price usually last <span>; safeguard: choose span whose text is numeric-like.
      const spans=[...plate.querySelectorAll('span')];
      const numeric = spans.map(s=>s.textContent.trim()).filter(t=>/^\d+(?:[.,]\d+)?$/.test(t));
      const raw = numeric[numeric.length-1] || (spans.length? spans[spans.length-1].textContent.trim(): '-');
      return raw.replace(',','.');
    };
    const odds = plates.map(extractPrice);
    const frozen = plates.some(p=>{
      const spans=p.querySelectorAll('span');
      const last=spans[spans.length-1]; if(!last) return false;
      const cs=getComputedStyle(last); return cs.pointerEvents==='none'|| parseFloat(cs.opacity||'1')<1;
    });
    if(debug){
      try { console.log('[RIVALRY][debug]', { mapNum, odds, frozen, wrapperCount: wrappers.length }); } catch(_){ }
    }
    return { odds: odds.length===2?odds:['-','-'], frozen };
  } catch(_){ return { odds:['-','-'], frozen:false }; }
}

function extractGg(mapNum=1){
  let blocks=[...document.querySelectorAll('div.bg-surface-middle.mb-2')];
  if(!blocks.length) blocks=[...document.querySelectorAll('div.mb-2.w-full.bg-surface-middle')];
  if(!blocks.length) blocks=[...document.querySelectorAll("div[class*='bg-surface-middle']")].filter(d=>d.querySelector('[data-test="market-name"]'));
  if(!blocks.length) return {odds:['-','-'],frozen:false};
  let target=null;
  if(mapNum<=0){
    target=blocks.find(b=>/Winner/i.test(b.querySelector('[data-test="market-name"]')?.textContent||''));
  } else {
    const re=new RegExp(`Map\\s*${mapNum}\\s*-\\s*Winner`,'i');
    target=blocks.find(b=>re.test(b.textContent));
    if(!target) target=blocks.find(b=>/Winner/i.test(b.querySelector('[data-test="market-name"]')?.textContent||''));
  }
  if(!target) return {odds:['-','-'],frozen:false};
  const odds=[...target.querySelectorAll('div[data-test="odd-button__result"]')].map(el=>el.textContent.trim()).slice(0,2);
  return {odds:odds.length===2?odds:['-','-'],frozen:false};
}

function extractThunder(mapNum=1){
  const mapRe=new RegExp(`Map\\s*${mapNum}\\s+Winner`,'i'); const matchRe=/Match\\s+Winner/i; const markets=[...document.querySelectorAll("div[data-testid^='market-']")];
  let t=markets.find(m=>mapRe.test(m.textContent)); if(!t) t=markets.find(m=>matchRe.test(m.textContent)); if(!t) return {odds:['-','-'],frozen:false};
  const odds=[...t.querySelectorAll('span.odds-button__odds')].map(e=>e.textContent.trim()).slice(0,2); return {odds:odds.length===2?odds:['-','-'],frozen:false};
}

function extractBetboom(mapNum=1){
  // NOTE: Russian words ("Карта", "Исход", "Исход матча", "П") intentionally retained.
  // They match the bookmaker's live DOM and must NOT be translated.
  const num=parseInt(mapNum,10)||1; const sections=[...document.querySelectorAll('section')]; const mapRe=new RegExp(`Карта\\s*${num}`,'i');
  let target=sections.find(s=>/Исход/i.test(s.textContent)&& mapRe.test(s.textContent)); if(!target) target=sections.find(s=>/Исход\\s+матча/i.test(s.textContent)); if(!target) return {odds:['-','-'],frozen:false};
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
      const frozen = parts.slice(0,2).some(p=>{
        const o = p.querySelector('.srb-ParticipantStackedBorderless_Odds, .sip-MergedHandicapParticipant_Odds, .gl-Participant_Odds, .srb-ParticipantCenteredStackedMarketRow_Odds');
        if(!o) return false; const cs = getComputedStyle(o); return cs.pointerEvents==='none' || parseFloat(cs.opacity||'1')<1; });
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
      const odds = parts.slice(0,2).map(p=> p.querySelector('.sip-MergedHandicapParticipant_Odds, .srb-ParticipantStackedBorderless_Odds, .srb-ParticipantCenteredStackedMarketRow_Odds, .gl-Participant_Odds')?.textContent.trim() || '-');
      const frozen = parts.slice(0,2).some(p=>{ const o=p.querySelector('.sip-MergedHandicapParticipant_Odds, .srb-ParticipantStackedBorderless_Odds, .srb-ParticipantCenteredStackedMarketRow_Odds, .gl-Participant_Odds'); if(!o) return false; const cs=getComputedStyle(o); return cs.pointerEvents==='none'|| parseFloat(cs.opacity||'1')<1; });
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
    // Frozen detection: absence of Trading flag in class list
    const cls = target.className || '';
    const frozen = !/flags-MarketTradingStatus-Trading/.test(cls) || /flags-UserSuspensionStatus-Suspended|Suspended/i.test(cls);
    return { odds: odds.length===2?odds:['-','-'], frozen };
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
