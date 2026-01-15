function toNum(v){
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : NaN;
}

function calcBestNonFrozen(records){
  const live = (records||[]).filter(r=> r && !r.frozen && Array.isArray(r.odds));
  const nums1 = live.map(r=>toNum(r.odds[0])).filter(n=>!Number.isNaN(n));
  const nums2 = live.map(r=>toNum(r.odds[1])).filter(n=>!Number.isNaN(n));
  const best1 = nums1.length ? Math.max(...nums1) : NaN;
  const best2 = nums2.length ? Math.max(...nums2) : NaN;
  return { best1, best2, nums1, nums2 };
}

function calcMidFromLiveNums(nums1, nums2){
  if(!nums1?.length || !nums2?.length) return null;
  const mid1 = (Math.min(...nums1) + Math.max(...nums1)) / 2;
  const mid2 = (Math.min(...nums2) + Math.max(...nums2)) / 2;
  return { mid1, mid2 };
}

function buildRowsHtml(records, opts){
  const variant = opts?.variant || 'board';
  const isSwapped = opts?.isSwapped || (()=>false);
  const liveNums1 = [];
  const liveNums2 = [];
  (records||[]).forEach(r=>{
    try {
      if(!r || r.frozen) return;
      if(!Array.isArray(r.odds) || r.odds.length!==2) return;
      const broker = r.broker;
      const swappedOn = !!isSwapped(broker);
      const v1 = swappedOn ? r.odds[1] : r.odds[0];
      const v2 = swappedOn ? r.odds[0] : r.odds[1];
      const n1 = toNum(v1);
      const n2 = toNum(v2);
      if(Number.isFinite(n1)) liveNums1.push(n1);
      if(Number.isFinite(n2)) liveNums2.push(n2);
    } catch(_){ }
  });
  const best1 = liveNums1.length ? Math.max(...liveNums1) : NaN;
  const best2 = liveNums2.length ? Math.max(...liveNums2) : NaN;

  const html = (records||[]).map(r=>{
    const broker = r.broker;
    const swappedOn = !!isSwapped(broker);
    const d1 = swappedOn ? r.odds?.[1] : r.odds?.[0];
    const d2 = swappedOn ? r.odds?.[0] : r.odds?.[1];
    const o1 = toNum(d1);
    const o2 = toNum(d2);
    const frozenCls = r.frozen ? 'frozen' : '';
    const bestCls1 = (!r.frozen && Number.isFinite(o1) && o1===best1) ? 'best' : '';
    const bestCls2 = (!r.frozen && Number.isFinite(o2) && o2===best2) ? 'best' : '';

    if(variant === 'embedded'){
      const swapBtn = `<button class=\"eo-swapBtn ${swappedOn?'on':''}\" data-broker=\"${broker}\" title=\"Swap sides\">⇄</button>`;
      const suspTag = r.frozen ? ' eo-broker-label' : ' eo-broker-label';
      return `<tr class=\"${frozenCls}\">`+
        `<td class=\"eo-broker\"><span class=\"${suspTag}\" title=\"${r.frozen?'Suspended / stale':''}\">${broker}</span></td>`+
        `<td class=\"${bestCls1} ${frozenCls}\">${d1}</td>`+
        `<td class=\"eo-swap-cell\">${swapBtn}</td>`+
        `<td class=\"${bestCls2} ${frozenCls}\">${d2}</td>`+
      `</tr>`;
    }

    // default: board
    return `<tr class=\"${frozenCls}\"><td><div class=\"brokerCell\"><span class=\"bName eo-broker-label\" title=\"${broker}\">${broker}</span><button class=\"swapBtn ${swappedOn?'on':''}\" data-broker=\"${broker}\" title=\"Swap sides\">⇄</button></div></td>`+
           `<td class=\"${bestCls1} ${frozenCls}\">${d1}</td>`+
           `<td class=\"${bestCls2} ${frozenCls}\">${d2}</td></tr>`;
  }).join('');

  return { html, best1, best2, liveNums1, liveNums2 };
}

const OddsBoardShared = {
  toNum,
  calcBestNonFrozen,
  calcMidFromLiveNums,
  buildRowsHtml,
};

// Export for both CommonJS (require) and browser (script tag)
if(typeof module !== 'undefined' && module.exports) module.exports = OddsBoardShared;
if(typeof window !== 'undefined') window.OddsBoardShared = OddsBoardShared;
