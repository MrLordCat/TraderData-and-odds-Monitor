// Generic dev CSS live-reload listener.
// Listens for 'dev-css-changed' via preload bridge (window.desktopAPI.onDevCssChanged)
// and cache-busts any matching <link rel="stylesheet"> elements across all windows.
(function(){
  if(!window.desktopAPI || typeof window.desktopAPI.onDevCssChanged !== 'function') return;
  try {
    window.desktopAPI.onDevCssChanged(function(files){
      if(!Array.isArray(files) || !files.length) return;
      const ts = Date.now();
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      files.forEach(changed => {
        links.forEach(link => {
          const href = link.getAttribute('href'); if(!href) return;
          const base = href.split('?')[0];
            // Support relative paths inside subfolders; compare by basename
          const basename = base.split('/').pop();
          if(changed === basename || changed.endsWith('/'+basename)){
            link.setAttribute('href', base + '?v=' + ts);
          }
        });
      });
    });
  } catch(e){ /* swallow */ }
})();
