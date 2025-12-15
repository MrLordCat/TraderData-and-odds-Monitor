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
  const best = calcBestNonFrozen(records);

  const html = (records||[]).map(r=>{
    const broker = r.broker;
    const o1 = toNum(r.odds?.[0]);
    const o2 = toNum(r.odds?.[1]);
    const frozenCls = r.frozen ? 'frozen' : '';
    const bestCls1 = (!r.frozen && o1===best.best1) ? 'best' : '';
    const bestCls2 = (!r.frozen && o2===best.best2) ? 'best' : '';

    if(variant === 'embedded'){
      const swappedOn = !!isSwapped(broker);
      const swapBtn = `<button class=\"eo-swapBtn ${swappedOn?'on':''}\" data-broker=\"${broker}\" title=\"Swap sides\">⇄</button>`;
      const suspTag = r.frozen ? ' eo-broker-label' : ' eo-broker-label';
      return `<tr class=\"${frozenCls}\">`+
        `<td class=\"eo-broker\"><span class=\"${suspTag}\" title=\"${r.frozen?'Suspended / stale':''}\">${broker}</span></td>`+
        `<td class=\"${bestCls1} ${frozenCls}\">${r.odds[0]}</td>`+
        `<td class=\"eo-swap-cell\">${swapBtn}</td>`+
        `<td class=\"${bestCls2} ${frozenCls}\">${r.odds[1]}</td>`+
      `</tr>`;
    }

    // default: board
    const swappedOn = !!isSwapped(broker);
    return `<tr><td><div class=\"brokerCell\"><span class=\"bName\" title=\"${broker}\">${broker}</span><button class=\"swapBtn ${swappedOn?'on':''}\" data-broker=\"${broker}\" title=\"Swap sides\">⇄</button></div></td>`+
           `<td class=\"${bestCls1} ${frozenCls}\">${r.odds[0]}</td>`+
           `<td class=\"${bestCls2} ${frozenCls}\">${r.odds[1]}</td></tr>`;
  }).join('');

  return { html, best1: best.best1, best2: best.best2, liveNums1: best.nums1, liveNums2: best.nums2 };
}

module.exports = {
  toNum,
  calcBestNonFrozen,
  calcMidFromLiveNums,
  buildRowsHtml,
};
