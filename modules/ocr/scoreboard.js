// Basic scoreboard OCR (Phase 1): extract team tags (placeholder) & kills digits from captured top bar PNG.
// Input: PNG base64 (already clipped to top scoreboard region) + metadata { width, height }.
// For now we only attempt kills. Coordinates are relative to provided image dimensions (assuming full top bar crop).
// Future: refine ROIs, add towers/dragons/barons, color normalization, team tag OCR.

const { createWorker } = require('tesseract.js');
let workerPromise = null;

function getWorker(){
  if(!workerPromise){
    workerPromise = (async ()=>{
      const w = await createWorker({
        logger: msg => { /* optional debug: console.log('[ocr][tess]', msg); */ }
      });
      await w.loadLanguage('eng');
      await w.initialize('eng');
      // Restrict to digits only for speed/accuracy
      await w.setParameters({ tessedit_char_whitelist: '0123456789' });
      return w;
    })();
  }
  return workerPromise;
}

// Heuristic ROI: kills usually centered horizontally; we approximate two boxes near center.
// We'll allow overriding later. For now compute from width/height of cropped bar:
// Left kills: centerX - 65 .. centerX - 10, Right kills: centerX + 10 .. centerX + 65
function defaultKillRois(w,h){
  const cx = w/2;
  const boxW = Math.round(Math.min(70, w*0.07));
  const gap = Math.round(Math.min(20, w*0.02));
  return {
    left: { x: Math.round(cx - gap - boxW), y: 0, w: boxW, h: Math.round(h) },
    right:{ x: Math.round(cx + gap), y: 0, w: boxW, h: Math.round(h) }
  };
}

function cropPngBuffer(pngBase64, roi){
  // For MVP we pass full image to tesseract with rectangle option (faster than manual decode & re-encode).
  // tesseract.js supports rectangle via recognize(image, { rectangle:{ left, top, width, height }})
  // We'll just return original base64; rectangle passed separately.
  return pngBase64;
}

async function extractKillsFromScoreboard({ pngBase64, width, height, killRois }){
  try {
    if(!pngBase64) return { ok:false, error:'no-image' };
    const rois = killRois || defaultKillRois(width, height);
    const worker = await getWorker();
    const img = Buffer.from(pngBase64, 'base64');
    const readOne = async (rect)=>{
      const { data } = await worker.recognize(img, { rectangle:{ left: rect.x, top: rect.y, width: rect.w, height: rect.h } });
      const raw = (data && data.text || '').trim();
      const m = raw.match(/\d{1,2}/); // kills rarely > 99
      return { raw, value: m? parseInt(m[0],10): null, confidence: (data.words && data.words[0] && data.words[0].confidence) || null };
    };
    const leftRes = await readOne(rois.left);
    const rightRes = await readOne(rois.right);
    return { ok:true, kills:{ left:leftRes, right:rightRes }, rois };
  } catch(err){ return { ok:false, error: err.message||String(err) }; }
}

module.exports = { extractKillsFromScoreboard };