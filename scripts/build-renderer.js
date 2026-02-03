#!/usr/bin/env node
// Build script for renderer modules using esbuild
// Bundles ES modules into browser-compatible scripts

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isDev = process.argv.includes('--dev');
const isWatch = process.argv.includes('--watch');

// Entry points for bundling
// Each entry creates a separate bundle loaded by its HTML page
const entries = {
  // Core shared modules (loaded by multiple pages)
  'odds-core': 'src/renderer/core/odds_core.js',
  'odds-board-shared': 'src/renderer/ui/odds_board_shared.js',
  
  // Page-specific bundles
  'board': 'src/renderer/scripts/board.js',
  'odds-board': 'src/renderer/scripts/odds_board.js',
  'stats-panel': 'src/renderer/scripts/stats_panel.js',
  'index': 'src/renderer/scripts/index.js',
  
  // UI utilities
  'toast': 'src/renderer/ui/toast.js',
  'excel-status': 'src/renderer/ui/excel_status.js',
  'api-helpers': 'src/renderer/ui/api_helpers.js',
};

const outdir = path.join(__dirname, '..', 'src', 'renderer', 'dist');

// Ensure output directory exists
if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir, { recursive: true });
}

// Common build options
const commonOptions = {
  bundle: true,
  platform: 'browser',
  target: ['chrome120'], // Electron 38 uses Chrome 130+
  format: 'iife', // Immediately Invoked Function Expression for browser
  sourcemap: isDev ? 'inline' : false,
  minify: !isDev,
  logLevel: 'info',
  
  // External modules that shouldn't be bundled
  external: ['electron'],
  
  // Define globals for conditional code
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
  },
  
  // Banner to preserve window.* exports for backward compatibility
  banner: {
    js: '// Auto-generated bundle - do not edit directly\n// Source: src/renderer/\n',
  },
};

async function build() {
  console.log(`\n🔨 Building renderer modules (${isDev ? 'dev' : 'prod'})...\n`);
  
  const startTime = Date.now();
  
  try {
    // Build each entry point
    for (const [name, entry] of Object.entries(entries)) {
      const entryPath = path.join(__dirname, '..', entry);
      
      // Skip if entry doesn't exist yet
      if (!fs.existsSync(entryPath)) {
        console.log(`⚠️  Skipping ${name}: ${entry} not found`);
        continue;
      }
      
      if (isWatch) {
        // Watch mode - rebuild on changes
        const ctx = await esbuild.context({
          ...commonOptions,
          entryPoints: [entryPath],
          outfile: path.join(outdir, `${name}.bundle.js`),
        });
        await ctx.watch();
        console.log(`👀 Watching: ${name}`);
      } else {
        // Single build
        await esbuild.build({
          ...commonOptions,
          entryPoints: [entryPath],
          outfile: path.join(outdir, `${name}.bundle.js`),
        });
        console.log(`✅ Built: ${name}.bundle.js`);
      }
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`\n✨ Build complete in ${elapsed}ms\n`);
    
    if (isWatch) {
      console.log('Watching for changes... (Ctrl+C to stop)\n');
    }
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
