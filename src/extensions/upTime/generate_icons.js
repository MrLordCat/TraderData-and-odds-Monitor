// Simple icon generator for extension
const fs = require('fs');

// Create minimal PNG icons (1x1 blue pixel, valid PNG format)
// Base64 encoded 1x1 blue PNG
const bluePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Write placeholder icons
fs.writeFileSync('icon16.png', bluePng);
fs.writeFileSync('icon48.png', bluePng);
fs.writeFileSync('icon128.png', bluePng);

console.log('Placeholder icons generated');
