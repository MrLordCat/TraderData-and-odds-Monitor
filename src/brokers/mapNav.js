// Map navigation helpers for broker pages
// Exports: triggerMapChange(host, map)
// Universal logic: always click target tab to ensure correct selection
const { deepQuery } = require('./extractors/index');

function triggerMapChange(host, map, opts={}){
  const isLast = opts.isLast === true;
  try {
    if(/rivalry\.com$/.test(host)) {
      // Rivalry: авто-клик по карте отключён. Экстрактор сам выбирает нужный рынок по mapNum.
      return; // no-op
    } else if(/gg199\.bet$/.test(host)||/gg\.bet$/.test(host)) {
      // no-op (dynamic markets)
    } else if(/thunderpick\.io$/.test(host)) {
      // Bo1 special case: if map 1 + isLast, click "Main" tab to show Match Winner
      if(map === 1 && isLast){
        const mainTab = document.querySelector('[data-testid="MainTab"]');
        if(mainTab) mainTab.click(); // Always click
      } else {
        // Try both "Map NTab" and "Game NTab" data-testid formats (LoL uses "Game", CS uses "Map")
        const tab = document.querySelector(`[data-testid="Map ${map}Tab"]`)
                 || document.querySelector(`[data-testid="Game ${map}Tab"]`);
        if(tab){
          tab.click(); // Always click
        }
        else {
          // Broader fallback: any tab with "Map N" or "Game N" text
          const mapN = new RegExp(`^(?:Map|Game)\\s*${map}$`, 'i');
          const fallback=[...document.querySelectorAll('[role="tab"]')].find(t=>mapN.test(t.textContent.trim()));
          if(fallback) fallback.click();
        }
      }
    } else if(/betboom\.ru$/.test(host)) {
      const buttons=[...document.querySelectorAll('button[role="radio"]')];
      let target;
      // NOTE: Russian textContent comparisons ("Матч", "Карта") intentionally kept for site UI.
      // Only click if real map tabs exist (not filter radios like "Все"/"Исход"/"Тотал")
      const hasMapTabs = buttons.some(b => /^(Матч|Карта\s*\d+)$/i.test(b.textContent.trim()));
      if (!hasMapTabs) return; // No-tabs mode (Bo2) — extractor handles sections directly
      // Bo1 special case: if map 1 + isLast, stay on "Матч" tab (match-level odds)
      if(map===0 || (map===1 && isLast)) target=buttons.find(b=>b.textContent.trim()==='Матч');
      else target=buttons.find(b=>b.textContent.trim()==='Карта '+map);
      if(target) target.click();
    } else if(/pari\.ru$/.test(host)) {
      const wrapper=document.querySelector('.keyboard-navigator--Zb6nL');
      if(wrapper){
        let target;
        // NOTE: Russian literals ("Матч", "-я карта") required for matching current bookmaker tab labels.
        // Bo1 special case: if map 1 + isLast, stay on "Матч" tab (match-level odds)
        if(map===0 || (map===1 && isLast)) target=[...wrapper.querySelectorAll('.tab--HvZxB')].find(t=>t.textContent.trim()==='Матч');
        else target=[...wrapper.querySelectorAll('.tab--HvZxB')].find(t=>t.textContent.trim()===map+'-я карта');
        if(!target && map!==0) target=[...wrapper.querySelectorAll('.tab--HvZxB')].find(t=>t.textContent.trim()==='Матч');
        if(target) target.click(); // Always click
      }
    } else if(/pm-bet\./i.test(host)) {
      // PariMatch (pm-bet.kz): tab buttons with modulor_tabs framework
      // All map Winner markets are visible on Main tab, but clicking specific tabs
      // helps filter the view for the user.
      const tabs=[...document.querySelectorAll('[data-testid="marketTabs-button"]')];
      let target;
      if(map===0 || (map===1 && isLast)){
        target=tabs.find(t=>/^Main$/i.test(t.textContent.trim()));
      } else {
        const mapRe=new RegExp(`^Map\\s*${map}$`,'i');
        target=tabs.find(t=>mapRe.test(t.textContent.trim()));
        if(!target) target=tabs.find(t=>/^Main$/i.test(t.textContent.trim()));
      }
      if(target) target.click();
    }
  } catch(_){}
}

module.exports = { triggerMapChange };
