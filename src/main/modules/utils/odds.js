// Odds helper utilities
function makePlaceholderOdds(id){ return { broker:id, odds:['-','-'], ts:Date.now(), placeholder:true }; }

module.exports = { makePlaceholderOdds };