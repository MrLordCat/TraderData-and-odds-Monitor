// worker-ml.js - runs in WebWorker (injected as blob). Phase 1 stub with placeholder for ONNX runtime.
// Real implementation should import onnxruntime-web; here we outline structure.

let session = null;
let scaleFactor = 2;
let useOrt = false;
let frameCounter = 0;
function log(){ try { console.log('[upscaler-worker]', ...arguments); } catch(_){} }

function b64ToUint8(b64){
  const binary = atob(b64); const len = binary.length; const bytes = new Uint8Array(len);
  for(let i=0;i<len;i++) bytes[i]=binary.charCodeAt(i); return bytes;
}

async function loadModel(url){
  try {
    log('loadModel start url', url||'(embedded)');
    if(typeof ort === 'undefined'){
      // Attempt inline global base64 model only without ort -> cannot run real inference
      postMessage({ type:'ready' });
      log('ort undefined, falling back (no real inference)');
      return;
    }
    let modelBytes;
    if(url){
      // Fetch not ideal due to CSP; prefer embedded
      const resp = await fetch(url); modelBytes = new Uint8Array(await resp.arrayBuffer());
    } else if(self.window && window.__UPS_ML_MODEL_B64){
      modelBytes = b64ToUint8(window.__UPS_ML_MODEL_B64);
    } else if(typeof self.__UPS_ML_MODEL_B64 !== 'undefined') { // worker global fallback
      modelBytes = b64ToUint8(self.__UPS_ML_MODEL_B64);
    }
    log('model bytes length', modelBytes && modelBytes.length);
    session = await ort.InferenceSession.create(modelBytes, { executionProviders: ['webgpu','webgl','wasm'] });
    useOrt = true;
    log('model session created, providers ->', session.executionProvider||'?');
    postMessage({ type:'ready' });
  } catch(e){
    log('model load failed', e);
    postMessage({ type:'error', error: 'model load failed: '+e });
    session = null; useOrt=false;
    postMessage({ type:'ready' }); // still signal ready (fallback)
  }
}

function nearestUpscale(imgData){
  const { width, height, data } = imgData;
  const w2 = Math.round(width * scaleFactor);
  const h2 = Math.round(height * scaleFactor);
  const out = new Uint8ClampedArray(w2 * h2 * 4);
  for(let y=0;y<h2;y++){
    const sy = Math.floor(y/scaleFactor);
    for(let x=0;x<w2;x++){
      const sx = Math.floor(x/scaleFactor);
      const si = (sy*width+sx)*4; const di = (y*w2+x)*4;
      out[di] = data[si]; out[di+1]=data[si+1]; out[di+2]=data[si+2]; out[di+3]=255;
    }
  }
  return { width:w2, height:h2, data:out.buffer };
}

function preprocess(imgData){
  const { width, height, data } = imgData;
  // NCHW Float32 normalized 0..1
  const chw = new Float32Array(3*height*width);
  let p=0; // channel offsets
  const cStride = height*width;
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const i=(y*width+x)*4;
  // BGR vs RGB? Real-ESRGAN is usually RGB (some implementations use BGR). Verify; keep RGB.
      chw[0*cStride + p] = data[i]   /255;
      chw[1*cStride + p] = data[i+1] /255;
      chw[2*cStride + p] = data[i+2] /255;
      p++;
    }
  }
  return new ort.Tensor('float32', chw, [1,3,height,width]);
}

function postprocess(tensor){
  // tensor shape [1,3,H,W]
  const [n,c,H,W] = tensor.dims;
  const data = tensor.data; // Float32Array
  const out = new Uint8ClampedArray(H*W*4);
  const cStride = H*W;
  for(let i=0;i<cStride;i++){
    const r = data[0*cStride + i];
    const g = data[1*cStride + i];
    const b = data[2*cStride + i];
    const o = i*4;
    out[o] = Math.max(0,Math.min(255, r*255));
    out[o+1] = Math.max(0,Math.min(255, g*255));
    out[o+2] = Math.max(0,Math.min(255, b*255));
    out[o+3] = 255;
  }
  return { width: W, height: H, data: out.buffer };
}

async function upscaleOrt(imgData){
  if(!session){ return nearestUpscale(imgData); }
  try {
    const t0 = performance.now();
    const input = preprocess(imgData);
    const outputs = await session.run({ input });
    const outTensor = outputs.output || Object.values(outputs)[0];
    const res = postprocess(outTensor);
    const dt = performance.now() - t0;
    if(frameCounter % 10 === 0){ postMessage({ type:'perf', kind:'inference', ms: dt }); }
    return res;
  } catch(e){
    log('inference fail, fallback nearest', e);
    return nearestUpscale(imgData);
  }
}

self.onmessage = async (e)=>{
  const msg = e.data||{};
  try {
    if(msg.type==='init'){
      scaleFactor = msg.scale||2;
      log('init message scale', scaleFactor, 'modelUrl', msg.modelUrl);
      if(msg.modelUrl){ await loadModel(msg.modelUrl); } else { await loadModel(''); }
    } else if(msg.type==='config'){
      if(msg.scale) scaleFactor = msg.scale;
      log('config update scaleFactor', scaleFactor);
    } else if(msg.type==='frame'){
      const { data, width, height } = msg.data;
      const imgData = { data: new Uint8ClampedArray(data), width, height };
      frameCounter++;
      const t0 = performance.now();
      const out = useOrt ? await upscaleOrt(imgData) : nearestUpscale(imgData);
      const total = performance.now() - t0;
      if(frameCounter % 30 === 0){ postMessage({ type:'perf', kind:'frameTotal', ms: total, useOrt }); }
      postMessage({ type:'frame', ts: msg.ts, width: out.width, height: out.height, data: out.data }, [out.data]);
    }
  } catch(err){
    postMessage({ type:'error', error: String(err) });
  }
};
