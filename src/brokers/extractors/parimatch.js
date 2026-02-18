// PariMatch (pm-bet.kz) extractor
// English-language bookmaker using modulor UI framework
// Markets on Main tab contain per-map "Winner. Map N" blocks

const { emptyResult, parsePrice } = require('./base');

/**
 * Extract odds from PariMatch (pm-bet.kz)
 *
 * Strategy: All map-level "Winner. Map N" markets appear on the Main tab,
 * so no tab navigation is strictly required — we parse them directly from
 * the DOM.  For match-level (mapNum 0 or Bo1) we look for a "Winner" block
 * without a "Map" qualifier, falling back to "Correct score" or first available.
 *
 * @param {number} mapNum - 0 for match winner, 1-5 for specific map
 * @param {string} game  - Game type (lol, cs2, dota2)
 * @param {object} opts   - Additional options (isLast for Bo1)
 * @returns {{odds: [string,string], frozen: boolean}}
 */
function extractParimatch(mapNum = 1, game = 'lol', opts = {}) {
  try {
    const useMatchLevel = mapNum <= 0 || (mapNum === 1 && opts.isLast);

    // Collect all market-item blocks
    const marketItems = [...document.querySelectorAll('[data-id="market-item"]')];
    if (!marketItems.length) return emptyResult();

    /** Get the market title text from the body-semibold span */
    const getTitle = (item) => {
      const span = item.querySelector('.body-semibold');
      return span ? span.textContent.trim() : '';
    };

    /** Extract a 2-outcome Winner result from a market-item block */
    const extractWinner = (item) => {
      // All outcome buttons with data-anchor attribute
      const outcomes = [...item.querySelectorAll('[data-anchor][role="button"]')];
      if (outcomes.length < 2) return null;

      // Look for the pair labelled "1" and "2"
      let side1 = null, side2 = null;
      for (const el of outcomes) {
        const label = el.querySelector('.caption-2-medium-caps');
        // Odds value: prefer [data-id="odds-value"], fallback to [data-id="animated-odds-value"] inner span
        let oddsEl = el.querySelector('[data-id="odds-value"]');
        if (!oddsEl || !oddsEl.textContent.trim()) {
          const animated = el.querySelector('[data-id="animated-odds-value"]');
          if (animated) oddsEl = animated.querySelector('span') || animated;
        }
        if (!label || !oddsEl) continue;
        const lbl = label.textContent.trim();
        const val = parsePrice(oddsEl.textContent.trim());
        if (lbl === '1') side1 = { el, val };
        else if (lbl === '2') side2 = { el, val };
      }
      if (!side1 || !side2) return null;

      // Frozen detection: "outcome-unavailable" means market is suspended
      const frozen = outcomes.some(o =>
        o.getAttribute('data-onboarding') === 'outcome-unavailable'
      );

      return { odds: [side1.val, side2.val], frozen };
    };

    // --- Match-level (mapNum === 0 or Bo1) ---
    if (useMatchLevel) {
      // Try pure "Winner" without map qualifier
      // Some sites show "Winner" at match level
      for (const item of marketItems) {
        const t = getTitle(item);
        if (/^Winner$/i.test(t)) {
          const r = extractWinner(item);
          if (r) return r;
        }
      }
      // Fallback: "Match Winner" pattern
      for (const item of marketItems) {
        const t = getTitle(item);
        if (/Match\s*Winner/i.test(t)) {
          const r = extractWinner(item);
          if (r) return r;
        }
      }
      // Bo1 fallback: if isLast & mapNum=1, try "Winner. Map 1"
      if (useMatchLevel) {
        for (const item of marketItems) {
          const t = getTitle(item);
          if (/Winner\.\s*Map\s*1$/i.test(t)) {
            const r = extractWinner(item);
            if (r) return r;
          }
        }
      }
      return emptyResult();
    }

    // --- Specific map ---
    // Primary: "Winner. Map N"
    const mapRe = new RegExp(`Winner\\.\\s*Map\\s*${mapNum}$`, 'i');
    for (const item of marketItems) {
      const t = getTitle(item);
      if (mapRe.test(t)) {
        const r = extractWinner(item);
        if (r) return r;
      }
    }

    // Fallback: try via data-anchor JSON (period field matches mapNum, marketType 1 = Winner)
    try {
      const anchors = [...document.querySelectorAll(`[data-anchor][role="button"]`)];
      const candidates = [];
      for (const el of anchors) {
        try {
          const raw = el.getAttribute('data-anchor');
          if (!raw) continue;
          // data-anchor format: "outcome_{JSON}"
          const jsonStr = raw.replace(/^outcome_/, '');
          const obj = JSON.parse(jsonStr);
          if (obj.marketType === 1 && obj.period === mapNum) {
            let oddsEl = el.querySelector('[data-id="odds-value"]');
            if (!oddsEl || !oddsEl.textContent.trim()) {
              const animated = el.querySelector('[data-id="animated-odds-value"]');
              if (animated) oddsEl = animated.querySelector('span') || animated;
            }
            const labelEl = el.querySelector('.caption-2-medium-caps');
            if (oddsEl && labelEl) {
              candidates.push({
                label: labelEl.textContent.trim(),
                val: parsePrice(oddsEl.textContent.trim()),
                el
              });
            }
          }
        } catch (_) { }
      }
      if (candidates.length >= 2) {
        const s1 = candidates.find(c => c.label === '1');
        const s2 = candidates.find(c => c.label === '2');
        if (s1 && s2) {
          const frozen = [s1.el, s2.el].some(o =>
            o.getAttribute('data-onboarding') === 'outcome-unavailable'
          );
          return { odds: [s1.val, s2.val], frozen };
        }
      }
    } catch (_) { }

    return emptyResult();
  } catch (_) {
    return emptyResult();
  }
}

module.exports = { extractParimatch };
