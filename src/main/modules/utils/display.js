// Display / bounds helpers extracted from main.js
const { screen } = require('electron');

function rectIntersectsDisplay(r, d){
  const a = d.workArea;
  return !(r.x + r.width  < a.x || r.x > a.x + a.width || r.y + r.height < a.y || r.y > a.y + a.height);
}
function ensureVisibleBounds(b){
  if(!b) return null;
  const displays = screen.getAllDisplays();
  if (displays.some(d=>rectIntersectsDisplay(b,d))) return b;
  const primary = screen.getPrimaryDisplay().workArea;
  const width = Math.min(b.width || 1600, primary.width);
  const height = Math.min(b.height || 950, primary.height);
  const x = primary.x + Math.max(0, Math.floor((primary.width - width)/2));
  const y = primary.y + Math.max(0, Math.floor((primary.height - height)/2));
  return { x, y, width, height };
}

module.exports = { rectIntersectsDisplay, ensureVisibleBounds };