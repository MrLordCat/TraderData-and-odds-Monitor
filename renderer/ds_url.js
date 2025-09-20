(function(){
  function qs(id){ return document.getElementById(id); }
  const input = qs('dsInput');
  const err = qs('err');
  const addBtn = qs('addBtn');
  const cancelBtn = qs('cancelBtn');
  // Prefill from query
  try {
    const params = new URLSearchParams(location.search);
    const last = params.get('last');
    if(last) input.value = last;
  } catch(_){ }
  function submit(){
    const url = (input.value||'').trim();
    if(!/^https?:\/\//i.test(url)) { err.style.display='block'; return; }
    err.style.display='none';
    try { window.desktopAPI?.setSetting?.('lastDataservicesUrl', url); } catch(_){ }
    try { window.desktopAPI?.dataservicesPromptSubmit?.(url); } catch(_){ }
  }
  addBtn.addEventListener('click', submit);
  cancelBtn.addEventListener('click', ()=>{ try { window.desktopAPI?.dataservicesPromptCancel?.(); } catch(_){ } });
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') submit(); if(e.key==='Escape'){ try { window.desktopAPI?.dataservicesPromptCancel?.(); } catch(_){ } }});
  setTimeout(()=> input.focus(), 70);
})();
