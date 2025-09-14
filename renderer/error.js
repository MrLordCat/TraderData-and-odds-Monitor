// Parse query params injected by main.js when loading error.html
(function(){
  const u = new URL(window.location.href);
  const bid = u.searchParams.get('bid') || 'broker';
  const code = u.searchParams.get('code') || '';
  const msg = u.searchParams.get('msg') || '';
  const target = u.searchParams.get('target') || '';
  document.getElementById('title').textContent = `${bid} failed to load`;
  document.getElementById('msg').innerHTML = `Could not load broker page.<br/>Error: <strong>${msg}</strong>`;
  document.getElementById('url').textContent = target;
  document.getElementById('code').textContent = 'Error code: ' + code;
  document.getElementById('reload').addEventListener('click', ()=>{
    // Just trigger a location reload (main process is still the same BrowserView)
    window.location.reload();
  });
})();
