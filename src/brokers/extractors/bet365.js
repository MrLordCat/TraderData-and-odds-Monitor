// Bet365 extractor
// Complex extraction with multiple layout fallbacks

const { emptyResult } = require('./base');

/**
 * Extract odds from Bet365
 * @param {number} mapNum - 0 for match lines, 1-5 for specific map
 * @param {string} game - Game type (ignored for now)
 * @param {object} opts - Additional options
 * @returns {{odds: [string, string], frozen: boolean}}
 */
function extractBet365(mapNum = 0, game = 'lol', opts = {}) {
  try {
    const pods = Array.from(document.querySelectorAll('div.gl-MarketGroupPod'));
    if (!pods.length) return emptyResult();
    
    const btnText = (p) => (p.querySelector('.sip-MarketGroupButton_Text')?.textContent || '').trim();
    let target = null;
    
    if (mapNum >= 1) {
      // Map market variants: "Map N - Winner", "Map N Winner", "Map N Winner 2-Way"
      const re = new RegExp('^Map\\s*' + mapNum + '(?:\\s*[-–]?\\s*)?Winner(?:\\s*2-Way)?$', 'i');
      target = pods.find(p => re.test(btnText(p)));
      
      if (!target) {
        // Fallback loose search
        const loose = new RegExp('Map\\s*' + mapNum + '[^\n]*Winner', 'i');
        target = pods.find(p => loose.test(p.textContent || ''));
      }
      if (!target) return emptyResult();
      
      // Extract participants with multiple layout fallbacks
      let parts = Array.from(target.querySelectorAll('.srb-ParticipantStackedBorderless'));
      if (parts.length < 2) parts = Array.from(target.querySelectorAll('.sip-MergedHandicapParticipant'));
      if (parts.length < 2) {
        // New layout: simple gl-Participant rows
        const gp = Array.from(target.querySelectorAll('.gl-Participant'));
        const gpOdds = gp.filter(n => n.querySelector('.gl-Participant_Odds'));
        if (gpOdds.length >= 2) parts = gpOdds.slice(0, 2);
      }
      if (parts.length < 2) {
        // Centered stacked rows variant
        const centered = Array.from(target.querySelectorAll('.srb-ParticipantCenteredStackedMarketRow:not(.srb-ParticipantCenteredStackedMarketRow-hashandicap)'));
        if (centered.length >= 2) parts = centered.slice(0, 2);
      }
      
      const odds = parts.slice(0, 2).map(p => {
        const o = p.querySelector('.srb-ParticipantStackedBorderless_Odds, .sip-MergedHandicapParticipant_Odds, .gl-Participant_Odds, .srb-ParticipantCenteredStackedMarketRow_Odds');
        return o ? o.textContent.trim() : '-';
      });
      
      const disabledFrozen = parts.slice(0, 2).some(p => {
        const o = p.querySelector('.srb-ParticipantStackedBorderless_Odds, .sip-MergedHandicapParticipant_Odds, .gl-Participant_Odds, .srb-ParticipantCenteredStackedMarketRow_Odds');
        if (!o) return false;
        const cs = getComputedStyle(o);
        return cs.pointerEvents === 'none' || parseFloat(cs.opacity || '1') < 1;
      });
      
      let groupSuspended = false;
      let partSusp = false;
      try {
        const topRow = target.querySelector('.sip-MarketGroupButton_TopRowContainer');
        if (topRow && /suspended/i.test(topRow.className)) groupSuspended = true;
        if (target.querySelector('.sip-MarketGroupButton_SuspendedText')) groupSuspended = true;
      } catch (_) { }
      try {
        partSusp = parts.slice(0, 2).some(p => /gl-Participant_Suspended/.test(p.className || ''));
      } catch (_) { }
      
      const frozen = groupSuspended || partSusp || disabledFrozen;
      return { odds: odds.length === 2 ? odds : ['-', '-'], frozen };
      
    } else {
      // Match level market: "Match Lines"
      target = pods.find(p => /Match\s+Lines/i.test(btnText(p)));
      if (!target) return emptyResult();
      
      // Collect odds from multiple possible structures
      let parts = Array.from(target.querySelectorAll('.sip-MergedHandicapParticipant'));
      if (parts.length < 2) parts = Array.from(target.querySelectorAll('.srb-ParticipantStackedBorderless'));
      if (parts.length < 2) {
        // Centered stacked variant: pick first row (To Win) from each team column
        const candidates = Array.from(target.querySelectorAll('.srb-ParticipantCenteredStackedMarketRow'))
          .filter(r => !r.classList.contains('srb-ParticipantCenteredStackedMarketRow-hashandicap'));
        if (candidates.length >= 2) parts = candidates.slice(0, 2);
      }
      if (parts.length < 2) {
        // Gl participant fallback
        const gp = Array.from(target.querySelectorAll('.gl-Participant')).filter(n => n.querySelector('.gl-Participant_Odds'));
        if (gp.length >= 2) parts = gp.slice(0, 2);
      }
      if (parts.length < 2) {
        // Column header layout (three adjacent gl-Market columns)
        try {
          const cols = Array.from(target.querySelectorAll('.gl-MarketGroupContainer > .gl-Market.gl-Market_General-columnheader'));
          if (cols.length >= 3) {
            const teamCols = cols.slice(-2);
            const oddsSpans = teamCols.map(c => c.querySelector('.srb-ParticipantCenteredStackedMarketRow_Odds'));
            if (oddsSpans.every(Boolean)) {
              parts = oddsSpans;
            }
          }
        } catch (_) { }
      }
      
      const odds = parts.slice(0, 2).map(p =>
        p.querySelector('.sip-MergedHandicapParticipant_Odds, .srb-ParticipantStackedBorderless_Odds, .srb-ParticipantCenteredStackedMarketRow_Odds, .gl-Participant_Odds')?.textContent.trim() || '-'
      );
      
      const disabledFrozen = parts.slice(0, 2).some(p => {
        const o = p.querySelector('.sip-MergedHandicapParticipant_Odds, .srb-ParticipantStackedBorderless_Odds, .srb-ParticipantCenteredStackedMarketRow_Odds, .gl-Participant_Odds');
        if (!o) return false;
        const cs = getComputedStyle(o);
        return cs.pointerEvents === 'none' || parseFloat(cs.opacity || '1') < 1;
      });
      
      let groupSuspended = false;
      let partSusp = false;
      try {
        const topRow = target.querySelector('.sip-MarketGroupButton_TopRowContainer');
        if (topRow && /suspended/i.test(topRow.className)) groupSuspended = true;
        if (target.querySelector('.sip-MarketGroupButton_SuspendedText')) groupSuspended = true;
      } catch (_) { }
      try {
        partSusp = parts.slice(0, 2).some(p => /gl-Participant_Suspended/.test(p.className || ''));
      } catch (_) { }
      
      const frozen = groupSuspended || partSusp || disabledFrozen;
      return { odds: odds.length === 2 ? odds : ['-', '-'], frozen };
    }
  } catch (_) { return emptyResult(); }
}

module.exports = { extractBet365 };
