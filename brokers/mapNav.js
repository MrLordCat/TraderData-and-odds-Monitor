// Map navigation helpers for broker pages
// Exports: triggerMapChange(host, map)
const { deepQuery } = require('./extractors');

function triggerMapChange(host, map){
  try {
    if(/rivalry\.com$/.test(host)) {
      if(map>0){
        const tryClick=()=>{
          let span = deepQuery('span').find(s=>s.textContent.trim()==='Map '+map);
            if(!span){
              const ord=['First','Second','Third','Fourth','Fifth'];
              const label=ord[map-1]+' map';
              span = deepQuery('span').find(s=>s.textContent.trim()===label);
            }
            if(span){ ['mousedown','mouseup','click'].forEach(t=>span.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true}))); return true; }
            return false;
        };
        if(!tryClick()){ setTimeout(tryClick,800); }
      }
    } else if(/gg199\.bet$/.test(host)||/gg\.bet$/.test(host)) {
      // no-op (dynamic markets)
    } else if(/thunderpick\.io$/.test(host)) {
      const targetTestId=`Map ${map}Tab`;
      const tab=document.querySelector(`[data-testid="${targetTestId}"]`);
      if(tab) tab.click();
      else {
        const fallback=[...document.querySelectorAll('[role="tab"]')].find(t=>t.textContent.trim()==='Map '+map);
        if(fallback) fallback.click();
      }
    } else if(/betboom\.ru$/.test(host)) {
      const buttons=[...document.querySelectorAll('button[role="radio"]')];
      let target;
      // NOTE: Russian textContent comparisons ("Матч", "Карта") intentionally kept for site UI.
      if(map===0) target=buttons.find(b=>b.textContent.trim()==='Матч');
      else target=buttons.find(b=>b.textContent.trim()==='Карта '+map);
      if(target && target.getAttribute('data-state')!=='on') target.click();
    } else if(/pari\.ru$/.test(host)) {
      const wrapper=document.querySelector('.keyboard-navigator--Zb6nL');
      if(wrapper){
        let target;
        // NOTE: Russian literals ("Матч", "-я карта") required for matching current bookmaker tab labels.
        if(map===0) target=[...wrapper.querySelectorAll('.tab--HvZxB')].find(t=>t.textContent.trim()==='Матч');
        else target=[...wrapper.querySelectorAll('.tab--HvZxB')].find(t=>t.textContent.trim()===map+'-я карта');
        if(!target && map!==0) target=[...wrapper.querySelectorAll('.tab--HvZxB')].find(t=>t.textContent.trim()==='Матч');
        if(target && !target.classList.contains('_selected--YKWOS')) target.click();
      }
    }
  } catch(_){}
}

module.exports = { triggerMapChange };
