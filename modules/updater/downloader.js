// Download and extract update zip
// Uses native Node.js modules (no external dependencies)

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { createWriteStream, createReadStream } = require('fs');

// Download file with progress callback
function downloadUpdate(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const makeRequest = (reqUrl) => {
      const urlObj = new URL(reqUrl);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const opts = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'OddsMoni-Updater/1.0'
        }
      };

      const req = protocol.request(opts, (res) => {
        // Handle redirects (GitHub uses them for release assets)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log(`[downloader] Redirect to: ${res.headers.location}`);
          makeRequest(res.headers.location);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        const totalSize = parseInt(res.headers['content-length'], 10) || 0;
        let downloadedSize = 0;

        const fileStream = createWriteStream(destPath);

        res.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize > 0 && onProgress) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            onProgress(progress);
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`[downloader] Download complete: ${destPath}`);
          resolve(destPath);
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      });

      req.on('error', reject);
      req.setTimeout(300000, () => { // 5 min timeout for large files
        req.destroy();
        reject(new Error('Download timeout'));
      });
      req.end();
    };

    makeRequest(url);
  });
}

// Extract zip using built-in zlib + manual zip parsing
// For simplicity, we'll use PowerShell on Windows
async function extractUpdate(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    // Ensure dest dir exists
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Use PowerShell Expand-Archive on Windows
    const { spawn } = require('child_process');
    
    const ps = spawn('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Expand-Archive -Path "${zipPath}" -DestinationPath "${destDir}" -Force`
    ], {
      windowsHide: true
    });

    let stderr = '';
    ps.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ps.on('close', (code) => {
      if (code === 0) {
        console.log(`[downloader] Extracted to: ${destDir}`);
        resolve(destDir);
      } else {
        reject(new Error(`Extraction failed (code ${code}): ${stderr}`));
      }
    });

    ps.on('error', (err) => {
      reject(new Error(`Failed to start PowerShell: ${err.message}`));
    });
  });
}

// Verify zip file exists and has content
function verifyZip(zipPath) {
  try {
    const stats = fs.statSync(zipPath);
    return stats.size > 1000; // At least 1KB
  } catch (e) {
    return false;
  }
}

// Clean up old update files
function cleanupTempFiles(tempDir, prefix = 'oddsmoni-update') {
  try {
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    files.forEach(file => {
      if (file.startsWith(prefix)) {
        const filePath = path.join(tempDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > maxAge) {
            if (stats.isDirectory()) {
              fs.rmSync(filePath, { recursive: true, force: true });
            } else {
              fs.unlinkSync(filePath);
            }
            console.log(`[downloader] Cleaned up old temp: ${file}`);
          }
        } catch (_) {}
      }
    });
  } catch (_) {}
}

module.exports = {
  downloadUpdate,
  extractUpdate,
  verifyZip,
  cleanupTempFiles
};
