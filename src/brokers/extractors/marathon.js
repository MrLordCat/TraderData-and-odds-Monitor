// Marathon extractor
// Uses ordinal suffixes (1st, 2nd, 3rd, etc.)

const { emptyResult, ordinalSuffix } = require('./base');

/**
 * Extract odds from Marathon
 * @param {number} mapNum - 0 for match winner, 1-5 for specific map
 * @param {string} game - Game type (ignored for now)
 * @param {object} opts - Additional options
 * @returns {{odds: [string, string], frozen: boolean}}
 */
function extractMarathon(mapNum = 1, game = 'lol', opts = {}) {
  try {
    const blocks = Array.from(document.querySelectorAll('div.market-inline-block-table-wrapper'));
    if (!blocks.length) return emptyResult();
    
    const wanted = mapNum > 0
      ? new RegExp('^' + ordinalSuffix(mapNum).replace(/([.*+?^${}()|\[\]\\])/g, '\\$1') + '\\s+Map\\s+Result$', 'i')
      : null;
    
    let target = null;
    for (const b of blocks) {
      const nameEl = b.querySelector('table.market-table-name .name-field');
      const name = (nameEl?.textContent || '').trim();
      if (wanted && wanted.test(name)) {
        target = b;
        break;
      }
    }
    
    // Strict: if specific map market not found, don't substitute another Map Result
    if (!target) return emptyResult();
    
    const dataTable = target.querySelector('table.td-border');
    if (!dataTable) return emptyResult();
    
    const rows = Array.from(dataTable.querySelectorAll('tr')).slice(0, 2);
    if (rows.length < 2) return emptyResult();
    
    const parsePrice = (row) => {
      const active = row.querySelector('.result-right .selection-link');
      const susp = row.querySelector('.result-right .suspended-selection');
      const el = active || susp;
      if (!el) return '-';
      return (el.textContent || '').trim().replace(',', '.');
    };
    
    const odds = rows.map(parsePrice);
    const frozen = rows.some(r => !!r.querySelector('.suspended-selection'));
    
    return { odds: odds.length === 2 ? odds : ['-', '-'], frozen };
  } catch (_) { return emptyResult(); }
}

module.exports = { extractMarathon };
