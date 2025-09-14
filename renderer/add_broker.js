// Populate broker list from main process data passed via preload
(async function(){
  const api = window.AddBrokerAPI;
  if(!api) return;
  const { brokers, inactive, slotIndex } = await api.getData();
  const ul = document.getElementById('broker-list');
  if(!brokers.length){
    const li = document.createElement('li');
    li.className='empty';
    li.textContent='No available brokers';
    ul.appendChild(li);
  } else {
    brokers.forEach(b=>{
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.dataset.id = b.id;
      btn.textContent = b.inactive? `${b.id} (inactive)` : b.id;
      if(b.inactive){ btn.disabled = true; btn.title='Inactive'; }
      btn.addEventListener('click', ()=> api.selectBroker(b.id, slotIndex));
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }
  document.getElementById('cancel').onclick = ()=> window.close();
})();
