// Download and extract update zip
// Uses native Node.js modules (no external dependencies)

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { createWriteStream, createReadStream } = require('fs');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const PROGRESS_THROTTLE_MS = 500; // Max 2 progress broadcasts per second
const DOWNLOAD_TIMEOUT_MS = 300000; // 5 min inactivity timeout

// Download file with progress callback (throttled + retry)
function downloadUpdate(url, destPath, onProgress, retryCount = 0) {
  return new Promise((resolve, reject) => {
    let lastProgressTime = 0;
    let lastReportedPercent = -1;

    const makeRequest = (reqUrl, redirectCount = 0) => {
      if (redirectCount > 5) { reject(new Error('Too many redirects')); return; }

      const urlObj = new URL(reqUrl);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const opts = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'OddsMoni-Updater/1.0',
          'Accept': '*/*'
        }
      };

      const req = protocol.request(opts, (res) => {
        // Handle redirects (GitHub uses them for release assets)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log(`[downloader] Redirect ${res.statusCode} -> ${res.headers.location.substring(0, 80)}...`);
          makeRequest(res.headers.location, redirectCount + 1);
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
            const now = Date.now();
            // Throttle: report only every PROGRESS_THROTTLE_MS or on 100%
            if (progress !== lastReportedPercent && (progress === 100 || now - lastProgressTime >= PROGRESS_THROTTLE_MS)) {
              lastProgressTime = now;
              lastReportedPercent = progress;
              onProgress(progress);
            }
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          // Final 100% report
          if (onProgress && lastReportedPercent !== 100) onProgress(100);
          console.log(`[downloader] Download complete: ${(totalSize / 1048576).toFixed(1)} MB -> ${destPath}`);
          resolve(destPath);
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });

        res.on('error', (err) => {
          fileStream.destroy();
          fs.unlink(destPath, () => {});
          reject(err);
        });
      });

      req.on('error', reject);
      req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
        req.destroy();
        reject(new Error('Download timeout (no data for 5 min)'));
      });
      req.end();
    };

    makeRequest(url);
  }).catch((err) => {
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      const attempt = retryCount + 1;
      console.warn(`[downloader] Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}. Retrying in ${RETRY_DELAY_MS}ms...`);
      return new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt))
        .then(() => downloadUpdate(url, destPath, onProgress, attempt));
    }
    throw err;
  });
}

// Extract zip using adm-zip (pure JavaScript, no PowerShell)
async function extractUpdate(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    try {
      // Ensure dest dir exists
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      console.log(`[downloader] Starting extraction: ${zipPath} -> ${destDir}`);
      
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipPath);
      
      // Extract all entries
      zip.extractAllTo(destDir, true); // true = overwrite
      
      console.log(`[downloader] Extracted to: ${destDir}`);
      resolve(destDir);
    } catch (err) {
      console.error(`[downloader] Extraction error: ${err.message}`);
      reject(new Error(`Extraction failed: ${err.message}`));
    }
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
