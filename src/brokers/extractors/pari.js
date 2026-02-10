// Pari.ru extractor
// Russian-language bookmaker (Cyrillic text markers)

const { emptyResult } = require('./base');

/**
 * Extract odds from Pari.ru
 * NOTE: Russian literals ("-я карта", "Исход") intentionally retained for DOM matching.
 * 
 * @param {number} mapNum - 0 for match winner, 1-5 for specific map
 * @param {string} game - Game type (ignored for now)
 * @param {object} opts - Additional options
 * @returns {{odds: [string, string], frozen: boolean}}
 */
function extractPari(mapNum = 0, game = 'lol', opts = {}) {
  try {
    // Bo1 handling: if mapNum === 1 && isLast, use match-level market ("Исход")
    const useMatchLevel = mapNum <= 0 || (mapNum === 1 && opts.isLast);
    
    if (!useMatchLevel && mapNum > 0) {
      const wrapper = document.querySelector('.keyboard-navigator--Zb6nL');
      const label = mapNum + '-я карта';
      const tabExists = [...wrapper?.querySelectorAll?.('.tab--HvZxB') || []].some(t => t.textContent.trim() === label);
      if (!tabExists) return emptyResult();
      
      const selected = [...wrapper.querySelectorAll('.tab--HvZxB._selected--YKWOS')][0];
      if (selected) {
        const selTxt = selected.textContent.trim();
        if (selTxt !== label) return emptyResult();
      }
    }
  } catch (_) { }
  
  const header = Array.from(document.querySelectorAll('div.text--NI31Y > div'))
    .find(el => /Исход/i.test(el.textContent.trim()));
  if (!header) return emptyResult();
  
  const headerBox = header.closest('.header--GKg3q');
  if (!headerBox) return emptyResult();
  
  const body = headerBox.nextElementSibling;
  if (!body) return emptyResult();
  
  const table = body.querySelector('.table--_LdRe');
  if (!table) return emptyResult();
  
  const cells = [...table.querySelectorAll('.factor--DmCVH')].slice(0, 2);
  const odds = cells.map(c => {
    const v = c.querySelector('.value--v77pD');
    return v ? v.textContent.trim() : '-';
  });
  
  const frozen = cells.some(c => c.classList.contains('_blocked--p09xk'));
  
  return { odds: odds.length === 2 ? odds : ['-', '-'], frozen };
}

module.exports = { extractPari };
