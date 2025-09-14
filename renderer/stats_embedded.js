// Embedded odds board + section reorder extracted
let currentMap = undefined; // shared map number propagated from main / board
function updateEmbeddedMapTag(){
  try {
    const el=document.getElementById('embeddedMapTag');
    if(!el) return;
    if(currentMap==null || currentMap===0 || currentMap==='') el.textContent='Map -';
    else el.textContent='Map '+currentMap;
  } catch(_){ }
}
function initEmbeddedMapSync(){
  try {
    if(window.desktopAPI && window.desktopAPI.onMap){
      window.desktopAPI.onMap(mapVal=>{ try { currentMap = mapVal; window.__embeddedCurrentMap = currentMap; updateEmbeddedMapTag(); syncEmbeddedMapSelect(); } catch(_){} });
    } else {
      const { ipcRenderer } = require('electron');
      ipcRenderer.on('set-map', (_e, mapVal)=>{ try { currentMap = mapVal; window.__embeddedCurrentMap = currentMap; updateEmbeddedMapTag(); syncEmbeddedMapSelect(); } catch(_){} });
    }
    // Initial fetch
    if(window.desktopAPI && window.desktopAPI.getLastMap){
      window.desktopAPI.getLastMap().then(v=>{ if(typeof v!=='undefined'){ currentMap=v; window.__embeddedCurrentMap=currentMap; updateEmbeddedMapTag(); syncEmbeddedMapSelect(); } }).catch(()=>{});
    }
    bindEmbeddedMapSelect();
  } catch(_){ }
}
function syncEmbeddedMapSelect(){
  try {
    const sel=document.getElementById('embeddedMapSelect');
    if(!sel) return; const v = (currentMap==null?'' : String(currentMap));
    if(v !== '' && sel.value!==v){ sel.value=v; }
  } catch(_){ }
}
function forceMapSelectValue(){
  // Multi-attempt retry if race with late DOM or late persisted load
  const attempts = [0,60,150,320,650];
  const desired = (currentMap==null?'' : String(currentMap));
  if(desired==='') return; // nothing to force
  attempts.forEach(ms=> setTimeout(()=>{
    try {
      const sel=document.getElementById('embeddedMapSelect');
      if(!sel) return; if(sel.value!==desired){ sel.value=desired; /* console.debug('[embeddedOdds] force map select', desired, 'at', ms);*/ }
    } catch(_){ }
  }, ms));
}
function bindEmbeddedMapSelect(){
  try {
    const sel=document.getElementById('embeddedMapSelect');
    if(!sel || sel.dataset.bound) return; sel.dataset.bound='1';
    sel.addEventListener('change', e=>{
      try {
        const v=e.target.value;
        try { console.debug('[embeddedOdds] map change via stats select ->', v); } catch(_){ }
        if(window.desktopAPI && window.desktopAPI.setMap){ window.desktopAPI.setMap('*', v); }
        else {
          try { const { ipcRenderer } = require('electron'); ipcRenderer.send('set-map', { id:'*', map:v }); } catch(_){ }
        }
  // update locally immediately
        currentMap = v; window.__embeddedCurrentMap=currentMap; updateEmbeddedMapTag();
      } catch(_){ }
    });
  } catch(_){ }
}
const { ipcRenderer: ipcRendererEmbedded } = require('electron');
const embeddedOddsData = {}; let embeddedBest1=NaN, embeddedBest2=NaN;
function renderEmbeddedOdds(){
  const rowsEl=document.getElementById('embeddedOddsRows'); if(!rowsEl) return;
  const vals=Object.values(embeddedOddsData);
  const p1=vals.map(r=>parseFloat(r.odds[0])).filter(n=>!isNaN(n));
  const p2=vals.map(r=>parseFloat(r.odds[1])).filter(n=>!isNaN(n));
  embeddedBest1=p1.length?Math.max(...p1):NaN; embeddedBest2=p2.length?Math.max(...p2):NaN;
  rowsEl.innerHTML = vals.map(r=>{
    const o1=parseFloat(r.odds[0]); const o2=parseFloat(r.odds[1]);
    const frozenCls = r.frozen ? 'frozen' : '';
    const suspTag = r.frozen ? ' eo-broker-label' : ' eo-broker-label';
    return `<tr class="${frozenCls}">`+
      `<td class="eo-broker"><span class="${suspTag}" title="${r.frozen?'Suspended / stale':''}">${r.broker}</span></td>`+
      `<td class="${o1===embeddedBest1?'best':''} ${frozenCls}">${r.odds[0]}</td>`+
      `<td class="${o2===embeddedBest2?'best':''} ${frozenCls}">${r.odds[1]}</td>`+
      `</tr>`;
  }).join('');
  const midCell=document.getElementById('embeddedMidCell');
  if(midCell){
    if(!p1.length||!p2.length){ midCell.textContent='-'; }
    else {
      const mid1=(Math.min(...p1)+Math.max(...p1))/2; const mid2=(Math.min(...p2)+Math.max(...p2))/2;
      midCell.textContent=`${mid1.toFixed(2)} / ${mid2.toFixed(2)}`;
      try { const meta=document.getElementById('embeddedOddsMeta'); if(meta) meta.textContent='Mid: '+mid1.toFixed(2)+' / '+mid2.toFixed(2); } catch(_){ }
    }
  }
  try {
    const h1=document.querySelector('#lt-team1 .teamNameWrap')?.textContent || 'Side 1';
    const h2=document.querySelector('#lt-team2 .teamNameWrap')?.textContent || 'Side 2';
    const eo1=document.getElementById('eo-side1'); const eo2=document.getElementById('eo-side2');
    if(eo1) eo1.textContent=h1; if(eo2) eo2.textContent=h2;
  } catch(_){ }
}
function handleEmbeddedOdds(p){ try {
  if(!p||!p.broker) return;
  // If map not initialized yet and payload carries map, adopt it
  if((currentMap===undefined || currentMap===null) && (p.map!==undefined && p.map!==null)){
    currentMap = p.map; window.__embeddedCurrentMap=currentMap; updateEmbeddedMapTag();
  }
  embeddedOddsData[p.broker]=p; renderEmbeddedOdds(); } catch(_){ } }
function initEmbeddedOdds(){ const root=document.getElementById('embeddedOddsSection'); if(!root) return; // collapse handled globally
  try { if(window.desktopAPI && window.desktopAPI.onOdds){ window.desktopAPI.onOdds(p=>{ try { console.debug('[embeddedOdds] odds-update via desktopAPI', p && p.broker); } catch(_){ } handleEmbeddedOdds(p); }); } else { ipcRendererEmbedded.on('odds-update', (_e,p)=>{ try { console.debug('[embeddedOdds] odds-update via ipcRenderer', p && p.broker); } catch(_){ } handleEmbeddedOdds(p); }); } } catch(_){ }
  try { if(window.desktopAPI && window.desktopAPI.onTeamNames){ window.desktopAPI.onTeamNames(()=> renderEmbeddedOdds()); } else { ipcRendererEmbedded.on('lol-team-names-update', ()=> renderEmbeddedOdds()); } } catch(_){ }
  try { if(window.desktopAPI && window.desktopAPI.getTeamNames){ window.desktopAPI.getTeamNames().then(()=>renderEmbeddedOdds()).catch(()=>{}); } } catch(_){ }
}
function initSectionReorder(){ const ORDER_KEY='statsPanelSectionOrder'; const container=document.body; if(!container) return; const blocks=collectBlocks(); restoreOrder(blocks, ORDER_KEY); blocks.forEach(b=> ensureHandle(b)); let dragging=null; let placeholder=null; let startY=0; function ensureHandle(block){ if(block.dataset.handleReady) return; block.dataset.handleReady='1'; let handle=block.querySelector('.dragHandleSec'); if(!handle){ handle=document.createElement('button'); handle.className='dragHandleSec'; handle.type='button'; handle.textContent='≡'; handle.title='Move section'; if(block.id==='stats'){ const hdr=block.querySelector('.sectionHeader'); if(hdr) hdr.prepend(handle); else block.prepend(handle); } else if(block.matches('fieldset')){ const lg=block.querySelector('legend'); if(lg) lg.prepend(handle); else block.prepend(handle); } else { block.prepend(handle); } } handle.addEventListener('pointerdown', e=>{ e.preventDefault(); dragging=block; startY=e.clientY; block.classList.add('reorderGhost'); placeholder=document.createElement('div'); placeholder.style.height=block.getBoundingClientRect().height+'px'; placeholder.className='dropIndicator'; block.parentNode.insertBefore(placeholder, block.nextSibling); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp, { once:true }); }); }
  function collectBlocks(){ const arr=[]; const sources=document.getElementById('sourcesSection'); if(sources) arr.push(sources); const stats=document.getElementById('stats'); if(stats) arr.push(stats); const map=document.getElementById('mapSection'); if(map) arr.push(map); const odds=document.getElementById('embeddedOddsSection'); if(odds) arr.push(odds); return arr; }
  function onMove(e){ if(!dragging || !placeholder) return; const dy=e.clientY-startY; dragging.style.transform=`translateY(${dy}px)`; const blocksNow=collectBlocks().filter(b=>b!==dragging); const mid=e.clientY; let inserted=false; for(const blk of blocksNow){ const r=blk.getBoundingClientRect(); const midLine=r.top + r.height/2; if(mid < midLine){ blk.parentNode.insertBefore(placeholder, blk); inserted=true; break; } } if(!inserted){ const last=blocksNow[blocksNow.length-1]; if(last) last.parentNode.appendChild(placeholder); } }
  function onUp(){ if(!dragging) return; dragging.style.transform=''; dragging.classList.remove('reorderGhost'); if(placeholder){ placeholder.parentNode.insertBefore(dragging, placeholder); placeholder.remove(); placeholder=null; } saveOrder(ORDER_KEY); dragging=null; }
  function saveOrder(key){ try { const order=collectBlocks().map(b=>b.id); localStorage.setItem(key, JSON.stringify(order)); } catch(_){ } }
  function restoreOrder(blocks,key){ try { const raw=localStorage.getItem(key); if(!raw) return; const order=JSON.parse(raw); if(!Array.isArray(order)) return; const parent=document.body; const idToEl={}; blocks.forEach(b=> idToEl[b.id]=b); order.forEach(id=>{ const el=idToEl[id]; if(el && el.parentNode){ parent.appendChild(el); } }); } catch(_){ } }
}
window.initEmbeddedOdds = initEmbeddedOdds;
window.initSectionReorder = initSectionReorder;
initEmbeddedMapSync();
updateEmbeddedMapTag();
// Fallback: after full DOM ready, re-sync in case elements mounted after initial code ran
window.addEventListener('DOMContentLoaded', ()=>{ try { syncEmbeddedMapSelect(); updateEmbeddedMapTag(); forceMapSelectValue(); } catch(_){ } });
