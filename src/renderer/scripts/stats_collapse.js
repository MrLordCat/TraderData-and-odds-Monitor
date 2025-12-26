// Unified collapse/expand controller for stats panel sections
// Applies to any element with class 'collapsible' that contains a button with class 'collapseBtn'
// Persists state per-section using localStorage key 'statsCollapses'
(function(){
  const LS_KEY='statsCollapses';
  let state={};
  try { state=JSON.parse(localStorage.getItem(LS_KEY)||'{}')||{}; } catch(_){ state={}; }

  function persist(){ try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch(_){ } }

  function measure(body){ if(!body) return 0; const prev=body.style.maxHeight; body.style.maxHeight='none'; const h=body.scrollHeight; body.style.maxHeight=prev; return h; }
  function setMax(body, h){ if(!body) return; body.style.maxHeight = (h==null? '0' : h+'px'); }

  function dispatchLayoutEvent(){ setTimeout(()=>{ try { window.dispatchEvent(new Event('lol-table-layout-changed')); } catch(_){ } }, 180); }

  function apply(root, id, animate){
    const btn=root.querySelector('.collapseBtn');
    const body = root.querySelector('.sectionBody') || root.querySelector('.statsBody');
    if(!body) return;
    const collapsed = !!state[id];
    if(collapsed){
      root.classList.add('collapsed');
      if(btn){
		btn.textContent='▸';
		btn.setAttribute('aria-expanded','false');
	  }
      const wasAuto = body.style.maxHeight==='none' || body.style.maxHeight==='';
      if(animate){
        const h = wasAuto ? measure(body) : body.scrollHeight;
        setMax(body,h);
        body.style.opacity='1';
        body.getBoundingClientRect(); // reflow
        requestAnimationFrame(()=>{
          setMax(body,0);
          body.style.opacity='0';
        });
        const onEnd=(ev)=>{ if(ev.target!==body) return; body.removeEventListener('transitionend', onEnd); };
        body.addEventListener('transitionend', onEnd);
      } else {
        setMax(body,0); body.style.opacity='0';
      }
    } else {
      root.classList.remove('collapsed');
      if(btn){
		btn.textContent='▾';
		btn.setAttribute('aria-expanded','true');
	  }
      const targetH = measure(body);
      if(animate){
        setMax(body,0);
        body.style.opacity='0';
        body.getBoundingClientRect(); // reflow start collapsed
        setMax(body,targetH);
        requestAnimationFrame(()=> body.style.opacity='1');
        const onEnd = (ev)=>{
          if(ev.target!==body) return;
          body.removeEventListener('transitionend', onEnd);
          // set to auto for dynamic content while staying expanded
          body.style.maxHeight='none';
          dispatchLayoutEvent();
        };
        body.addEventListener('transitionend', onEnd);
      } else {
        setMax(body,targetH);
        body.style.opacity='1';
        // allow a tick then set to auto to adapt to future size change
        setTimeout(()=>{ if(!state[id]) body.style.maxHeight='none'; dispatchLayoutEvent(); }, 180);
      }
    }
  }

  function bind(root){
    if(root.dataset.collapseBound) return; root.dataset.collapseBound='1';
    const id = root.id || ('sec-'+Math.random().toString(36).slice(2));
    if(!root.id) root.id=id;
    const btn=root.querySelector('.collapseBtn');
    const body = root.querySelector('.sectionBody') || root.querySelector('.statsBody');
    if(!body) return;
    if(!(id in state)) state[id] = root.classList.contains('collapsed');
    // initial apply without animation
    apply(root,id,false);
    if(btn){
    btn.addEventListener('click', ()=>{ state[id]=!state[id]; apply(root,id,true); persist(); });
  }
  // Optional: toggle by clicking the section title (saves width in narrow panels)
  try {
    if(root.dataset.collapseOnHeader === '1'){
      const header = root.querySelector('.sectionHeader');
      const title = header && header.querySelector('.accent');
      if(title){
        title.style.cursor = 'pointer';
        title.style.userSelect = 'none';
        title.addEventListener('click', (ev)=>{
          // Only title click toggles; avoid interfering with header controls
          ev.preventDefault();
          state[id]=!state[id];
          apply(root,id,true);
          persist();
        });
      }
    }
  } catch(_){ }
    window.addEventListener('resize', ()=>{ if(!state[id]){ const wasAuto = body.style.maxHeight==='none'; if(!wasAuto){ const h=measure(body); setMax(body,h); } } });
  }

  function init(){ document.querySelectorAll('.collapsible').forEach(bind); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
