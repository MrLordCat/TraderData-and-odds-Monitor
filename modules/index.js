// Barrel file: unified export surface for module factories.
// Barrel (aggregate) file re-exports the public APIs from multiple modules.
// Instead of:
//   const { createLayoutManager } = require('./modules/layout');
//   const { createBrokerManager } = require('./modules/brokerManager');
// You can:
//   const { createLayoutManager, createBrokerManager } = require('./modules');
// Benefits:
// - Simplifies imports
// - Allows internal folder restructuring without global search/replace
// - Defines an explicit public surface

module.exports = {
  ...require('./layout'),
  ...require('./brokerManager'),
  ...require('./zoom'),
  ...require('./staleMonitor'),
  ...require('./stats'),
  ...require('./settingsOverlay'),
  constants: require('./utils/constants')
};
