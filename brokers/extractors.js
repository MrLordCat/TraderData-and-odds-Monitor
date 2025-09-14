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
  const wrappers=deepQuery('[data-editor-id="tableMarketWrapper"]');
  if(!wrappers.length) return {odds:['-','-'],frozen:false};
  let target;
  if(mapNum>0){
    const ord=['First','Second','Third','Fourth','Fifth'];
    const word=ord[mapNum-1];
    if(!word) return {odds:['-','-'],frozen:false};
    const re=new RegExp(`^${word}\\s+map\\b`,'i');
    const candidates=wrappers.filter(w=>{
      const h=w.querySelector('div.bt323, div.bt341, div.bt1584, div.bt1547, div[class*="map"]');
      if(h && re.test(h.textContent.trim())) return true;
      const start=w.textContent.trim().slice(0,64);
      return re.test(start);
    });
    if(!candidates.length) return {odds:['-','-'],frozen:false};
    target=candidates.find(w=>/main\s+lines/i.test(w.textContent.split('\n')[0]||'')) || candidates[0];
    if(!/Winner/i.test(target.textContent)) return {odds:['-','-'],frozen:false};
  } else {
    target=wrappers.find(w=>/Winner/i.test(w.textContent));
    if(!target) return {odds:['-','-'],frozen:false};
  }
  const plates=[...target.querySelectorAll('[data-editor-id="tableOutcomePlate"]')].slice(0,2);
  const odds=plates.map(p=>{ const spans=p.querySelectorAll('span'); return spans[spans.length-1]?.textContent.trim()||'-'; });
  let frozen=false; plates.forEach(p=>{ const spans=p.querySelectorAll('span'); const el=spans[spans.length-1]; if(!el) return; const cs=getComputedStyle(el); if(cs.pointerEvents==='none'|| cs.cursor==='default'|| parseFloat(cs.opacity)<1) frozen=true; });
  return {odds:odds.length===2?odds:['-','-'],frozen};
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
    if(!target){
      target = blocks.find(b=>/Map\s+Result/i.test((b.querySelector('table.market-table-name .name-field')?.textContent||'').trim()));
    }
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

const EXTRACTOR_TABLE = [
  { test: /rivalry\.com$/i, fn: extractRivalry },
  { test: /gg199\.bet$/i, fn: extractGg },
  { test: /gg\.bet$/i, fn: extractGg },
  { test: /thunderpick\.io$/i, fn: extractThunder },
  { test: /betboom\.ru$/i, fn: extractBetboom },
  { test: /pari\.ru$/i, fn: extractPari },
  { test: /marathonbet\./i, fn: extractMarathon }
];

function collectOdds(host, desiredMap){
  let meta={odds:['-','-'],frozen:false};
  for(const row of EXTRACTOR_TABLE){ if(row.test.test(host)){ meta=row.fn(desiredMap)||meta; break; } }
  return { broker:getBrokerId(host), odds:meta.odds, frozen:meta.frozen, ts:Date.now(), map:desiredMap };
}

module.exports = { getBrokerId, collectOdds, deepQuery };
