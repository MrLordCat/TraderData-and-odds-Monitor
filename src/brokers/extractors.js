// Broker extractors & odds collection
// BACKWARD COMPATIBILITY WRAPPER
// All logic has been moved to ./extractors/ directory
// This file re-exports the main API for existing consumers

const { getBrokerId, collectOdds, deepQuery } = require('./extractors/index');

module.exports = { getBrokerId, collectOdds, deepQuery };
