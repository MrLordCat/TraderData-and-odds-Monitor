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
        const targetTestId=`Map ${map}Tab`;
        const tab=document.querySelector(`[data-testid="${targetTestId}"]`);
        if(tab){
          tab.click(); // Always click
        }
        else {
          const fallback=[...document.querySelectorAll('[role="tab"]')].find(t=>t.textContent.trim()==='Map '+map);
          if(fallback) fallback.click();
        }
      }
    } else if(/betboom\.ru$/.test(host)) {
      const buttons=[...document.querySelectorAll('button[role="radio"]')];
      let target;
      // NOTE: Russian textContent comparisons ("Матч", "Карта") intentionally kept for site UI.
      // Bo1 special case: if map 1 + isLast, stay on "Матч" tab (match-level odds)
      if(map===0 || (map===1 && isLast)) target=buttons.find(b=>b.textContent.trim()==='Матч');
      else target=buttons.find(b=>b.textContent.trim()==='Карта '+map);
      if(target) target.click();
    } else if(/pari\.ru$/.test(host)) {
      const wrapper=document.querySelector('.keyboard-navigator--Zb6nL');
      if(wrapper){
        let target;
        // NOTE: Russian literals ("Матч", "-я карта") required for matching current bookmaker tab labels.
        if(map===0) target=[...wrapper.querySelectorAll('.tab--HvZxB')].find(t=>t.textContent.trim()==='Матч');
        else target=[...wrapper.querySelectorAll('.tab--HvZxB')].find(t=>t.textContent.trim()===map+'-я карта');
        if(!target && map!==0) target=[...wrapper.querySelectorAll('.tab--HvZxB')].find(t=>t.textContent.trim()==='Матч');
        if(target) target.click(); // Always click
      }
    }
  } catch(_){}
}

module.exports = { triggerMapChange };
