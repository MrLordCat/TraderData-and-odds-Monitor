/**
 * Power Towers TD - CSS Styles
 * 
 * This file re-exports from the modular styles system.
 * See ./styles/ folder for individual modules.
 */

const { getLauncherStyles, getGameStyles } = require('./styles/index');

module.exports = {
  getLauncherStyles,
  getGameStyles
};
