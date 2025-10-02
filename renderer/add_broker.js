// Populate broker list from main process data passed via preload
(function(){
  const api = window.AddBrokerAPI; if(!api) return;
  const ul = document.getElementById('broker-list');
  let currentSlotIndex = 0;
  async function render(){
    const { brokers=[], slotIndex=0, activeIds=[] } = await api.getData();
    currentSlotIndex = slotIndex;
    ul.innerHTML = '';
    if(!brokers.length){
      const li = document.createElement('li');
      li.className='empty';
      li.textContent='No available brokers';
      ul.appendChild(li);
      return;
    }
    const active = new Set(activeIds || []);
    brokers.forEach(b=>{
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.dataset.id = b.id;
      const isActive = active.has(b.id);
      btn.textContent = b.inactive? `${b.id} (inactive)` : (isActive? `${b.id} (added)` : b.id);
      if(b.inactive){ btn.disabled = true; btn.title = 'Inactive'; }
      else if(isActive){ btn.disabled = true; btn.title = 'Already added'; }
      btn.addEventListener('click', ()=> api.selectBroker(b.id, currentSlotIndex));
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }
  render();
  // Live refresh when active list changes in main
  try { api.onSync?.(()=> render()); } catch(_){ }
  document.getElementById('cancel').onclick = ()=> window.close();
})();
