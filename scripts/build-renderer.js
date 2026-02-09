#!/usr/bin/env node
// Build script for renderer modules using esbuild
// Bundles ES modules into browser-compatible scripts

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isDev = process.argv.includes('--dev');
const isWatch = process.argv.includes('--watch');

// Entry points for bundling
// Main entry points (one per HTML page that uses bundled scripts)
const pageEntries = {
  'stats-panel': 'src/renderer/entries/stats-panel.entry.js',
  'index': 'src/renderer/entries/index.entry.js',
  'settings': 'src/renderer/entries/settings.entry.js',
  'error': 'src/renderer/entries/error.entry.js',
};

// Standalone modules (can be loaded individually or bundled)
const moduleEntries = {
  'odds-core': 'src/renderer/core/odds_core.js',
  'odds-board-shared': 'src/renderer/ui/odds_board_shared.js',
  'toast': 'src/renderer/ui/toast.js',
  'excel-status': 'src/renderer/ui/excel_status.js',
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
  
  // External modules that shouldn't be bundled (Node.js built-ins + Electron)
  external: [
    'electron',
    'fs',
    'path',
    'os',
    'child_process',
    'crypto',
    'stream',
    'util',
    'events',
    'buffer',
  ],
  
  // Define globals for conditional code
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
  },
  
  // Banner to preserve window.* exports for backward compatibility
  banner: {
    js: '// Auto-generated bundle - do not edit directly\n// Source: src/renderer/\n',
  },
};

async function buildEntry(name, entry, isPage = false) {
  const entryPath = path.join(__dirname, '..', entry);
  
  // Skip if entry doesn't exist yet
  if (!fs.existsSync(entryPath)) {
    console.log(`⚠️  Skipping ${name}: ${entry} not found`);
    return false;
  }
  
  const outfile = path.join(outdir, `${name}.bundle.js`);
  
  if (isWatch) {
    const ctx = await esbuild.context({
      ...commonOptions,
      entryPoints: [entryPath],
      outfile,
    });
    await ctx.watch();
    console.log(`👀 Watching: ${name}${isPage ? ' (page bundle)' : ''}`);
  } else {
    await esbuild.build({
      ...commonOptions,
      entryPoints: [entryPath],
      outfile,
    });
    console.log(`✅ Built: ${name}.bundle.js${isPage ? ' (page bundle)' : ''}`);
  }
  return true;
}

async function build() {
  console.log(`\n🔨 Building renderer modules (${isDev ? 'dev' : 'prod'})...\n`);
  
  const startTime = Date.now();
  
  try {
    // Build page entry points (full bundles with all dependencies)
    console.log('📦 Page bundles:');
    for (const [name, entry] of Object.entries(pageEntries)) {
      await buildEntry(name, entry, true);
    }
    
    // Build standalone modules (for pages that load scripts individually)
    console.log('\n📚 Standalone modules:');
    for (const [name, entry] of Object.entries(moduleEntries)) {
      await buildEntry(name, entry, false);
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
