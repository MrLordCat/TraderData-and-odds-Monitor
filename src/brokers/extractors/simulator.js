// Simulator extractor — reads odds from #sim-data element
// Used for auto-mode calibration with adjustable slider odds

const { emptyResult, parsePrice, isValidOdds } = require('./base');

/**
 * Extract odds from the simulator page
 * Reads data-odds1, data-odds2, data-frozen from #sim-data hidden div
 * @param {number} mapNum - Ignored (simulator has no maps)
 * @param {string} game - Ignored
 * @param {object} opts - Ignored
 * @returns {{odds: [string, string], frozen: boolean}}
 */
function extractSimulator(mapNum = 0, game = 'lol', opts = {}) {
  try {
    const el = document.getElementById('sim-data');
    if (!el) return emptyResult();

    const raw1 = el.dataset.odds1;
    const raw2 = el.dataset.odds2;
    const frozen = el.dataset.frozen === 'true';

    const o1 = parsePrice(raw1);
    const o2 = parsePrice(raw2);

    if (!isValidOdds(o1) || !isValidOdds(o2)) return emptyResult();

    return { odds: [o1, o2], frozen };
  } catch (_) {
    return emptyResult();
  }
}

module.exports = { extractSimulator };
