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

// ===== Update Overlay (startup notification) =====
(function(){
  const overlay = document.getElementById('updateOverlay');
  const versionNum = document.getElementById('updateOverlay__versionNum');
  const progressDiv = document.getElementById('updateOverlay__progress');
  const progressBar = progressDiv ? progressDiv.querySelector('.updateOverlay__progressBar') : null;
  const statusEl = document.getElementById('updateOverlay__status');
  const laterBtn = document.getElementById('updateOverlay__later');
  const actionBtn = document.getElementById('updateOverlay__action');

  if(!overlay || !laterBtn || !actionBtn) return;

  let pendingUpdate = null;
  let updateReady = false;
  let downloading = false;

  function show(update){
    pendingUpdate = update;
    updateReady = false;
    downloading = false;
    if(versionNum) versionNum.textContent = update.version || '—';
    if(statusEl) statusEl.textContent = '';
    if(progressDiv) progressDiv.hidden = true;
    actionBtn.textContent = 'Download & Install';
    actionBtn.disabled = false;
    laterBtn.disabled = false;
    overlay.hidden = false;
  }

  function hide(){
    overlay.hidden = true;
  }

  function setStatus(text){
    if(statusEl) statusEl.textContent = text || '';
  }

  function showProgress(pct){
    if(progressDiv) progressDiv.hidden = false;
    if(progressBar) progressBar.style.width = Math.max(0, Math.min(100, pct)).toFixed(1) + '%';
  }

  function hideProgress(){
    if(progressDiv) progressDiv.hidden = true;
    if(progressBar) progressBar.style.width = '0%';
  }

  function updateButtonState(){
    if(updateReady){
      actionBtn.textContent = 'Restart';
      actionBtn.disabled = false;
      laterBtn.disabled = false;
    } else if(downloading){
      actionBtn.textContent = 'Downloading...';
      actionBtn.disabled = true;
      laterBtn.disabled = true;
    } else {
      actionBtn.textContent = 'Download & Install';
      actionBtn.disabled = false;
      laterBtn.disabled = false;
    }
  }

  // Listen for startup update notification
  window.desktopAPI.onUpdaterStartupAvailable?.((update) => {
    show(update);
  });

  // Listen for updater events while overlay is open
  window.desktopAPI.onUpdaterDownloading?.((data) => {
    if(overlay.hidden) return;
    downloading = true;
    updateButtonState();
    const pct = data && typeof data.percent === 'number' ? data.percent : 0;
    showProgress(pct);
    setStatus(`Downloading... ${pct.toFixed(0)}%`);
  });

  window.desktopAPI.onUpdaterExtracting?.(() => {
    if(overlay.hidden) return;
    showProgress(100);
    setStatus('Extracting...');
  });

  window.desktopAPI.onUpdaterReady?.(() => {
    if(overlay.hidden) return;
    downloading = false;
    updateReady = true;
    updateButtonState();
    showProgress(100);
    setStatus('Update ready - click Restart to apply');
  });

  window.desktopAPI.onUpdaterError?.((err) => {
    if(overlay.hidden) return;
    downloading = false;
    updateButtonState();
    hideProgress();
    setStatus('Error: ' + (err.message || err));
  });

  // Later button - close overlay
  laterBtn.addEventListener('click', () => {
    hide();
  });

  // Action button - Download or Restart
  actionBtn.addEventListener('click', async () => {
    if(updateReady){
      setStatus('Restarting...');
      actionBtn.disabled = true;
      laterBtn.disabled = true;
      try {
        await window.desktopAPI.updaterRestart();
      } catch(e){
        setStatus('Restart failed: ' + (e.message || e));
        actionBtn.disabled = false;
        laterBtn.disabled = false;
      }
      return;
    }

    if(!pendingUpdate) return;
    downloading = true;
    updateButtonState();
    setStatus('Starting download...');
    showProgress(0);

    try {
      const result = await window.desktopAPI.updaterDownload();
      if(!result || !result.success){
        downloading = false;
        updateButtonState();
        hideProgress();
        setStatus('Download failed: ' + (result?.error || 'unknown'));
      }
      // Success will trigger updater-ready event
    } catch(e){
      downloading = false;
      updateButtonState();
      hideProgress();
      setStatus('Download failed: ' + (e.message || e));
    }
  });

  // ESC to close
  window.addEventListener('keydown', (e) => {
    if(e.key === 'Escape' && !overlay.hidden && !downloading){
      hide();
    }
  });
})();

