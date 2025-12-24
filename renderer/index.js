function computeStage(){
  const top=0;
  const h=window.innerHeight-top;
  const outline=document.getElementById('stageOutline');
  if(outline){ outline.style.top=top+'px'; outline.style.height=h+'px'; }
  window.desktopAPI.setStageBounds({x:0,y:Math.round(top),width:window.innerWidth,height:Math.round(h)});
}
// Debounced resize to avoid flooding IPC
let __stageRaf=null; let __lastStageReq=0; const __STAGE_INTERVAL=60; // ms
function queueStage(){
  const now=Date.now();
  if(now-__lastStageReq<__STAGE_INTERVAL){
    if(!__stageRaf){ __stageRaf=requestAnimationFrame(()=>{ __stageRaf=null; computeStage(); }); }
    return;
  }
  __lastStageReq=now; computeStage();
}
window.addEventListener('resize', queueStage);
window.addEventListener('load', computeStage);

// Dev live CSS reload: if watcher signals change, bust cache on matching <link href>.
try {
  window.desktopAPI.onDevCssChanged?.(files => {
    if(!Array.isArray(files) || !files.length) return;
    const ts = Date.now();
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    links.forEach(l => {
      const href = l.getAttribute('href'); if(!href) return;
      const base = href.split('?')[0];
      const basename = base.split('/').pop();
      // Watcher currently sends just filename (not path). Compare to basename.
      if(files.some(f => f === basename || f.endsWith('/'+basename))){
        l.setAttribute('href', base + '?v=' + ts);
      }
    });
  });
} catch(_){ }

// Unified side panel: splitter for width adjustments
// Panel is now always docked (stats panel replaces separate board)
const splitter=document.getElementById('boardSplitter');
let panelState=null; let resizing=false; let startX=0; let startWidth=0;

function applyPanelState(st){
  panelState=st; if(!st) return;
  document.body.classList.toggle('board-docked-left', st.side==='left');
  document.body.classList.toggle('board-docked-right', st.side!=='left');
  splitter.style.display='block';
  computeStage();
}

// Listen for panel state updates (board-updated channel used for backward compatibility)
window.desktopAPI.onBoardUpdated(applyPanelState);
window.desktopAPI.getBoardState().then(applyPanelState);

// Splitter drag handling
splitter.addEventListener('mousedown', e=>{ 
  if(!panelState) return; 
  resizing=true; 
  startX=e.clientX; 
  startWidth=panelState.width; 
  splitter.classList.add('dragging'); 
  document.body.style.userSelect='none'; 
});

window.addEventListener('mousemove', e=>{ 
  if(!resizing) return; 
  const dx=e.clientX-startX; 
  let newW=startWidth; 
  if(panelState.side==='left'){ 
    newW = startWidth + dx; 
  } else { 
    newW = startWidth - dx; 
  } 
  newW=Math.max(280, Math.min(600, newW)); 
  window.desktopAPI.boardSetWidth(newW); 
});

window.addEventListener('mouseup', ()=>{ 
  if(resizing){ 
    resizing=false; 
    splitter.classList.remove('dragging'); 
    document.body.style.userSelect=''; 
  } 
});

window.desktopAPI.onUIBlurOn?.(()=> document.body.classList.add('overlay-blur'));
window.desktopAPI.onUIBlurOff?.(()=> document.body.classList.remove('overlay-blur'));

// (Excel URL modal logic moved to dedicated BrowserView overlay)

