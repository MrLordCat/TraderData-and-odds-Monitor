// Minimal aggregated injection of existing extension parsers (subset)
// We embed simplified versions of inject-stats.js & inject-multikill.js logic
// and forward consolidated payload via postMessage { __lolStatsPayload } to the embedded index.html.

(function(){
  const gameStats = {}; // gameN -> stats object (subset fields)
  const multiStats = {}; // multi kills
  let team1Name=null, team2Name=null;
  let currentGame=null;

  function ensureGame(n){ if(!gameStats[n]) gameStats[n]=makeStats(); return gameStats[n]; }
  function makeStats(){ return { firstKill:null, firstKillAt:'', killCount:{}, race5:null,race5At:'',race10:null,race10At:'',race15:null,race15At:'',race20:null,race20At:'', firstTower:null, firstTowerAt:'', firstInhibitor:null, firstInhibitorAt:'', firstBaron:null, firstBaronAt:'', towerCount:{}, inhibitorCount:{}, baronCount:{}, dragonCount:{}, dragonTimes:{}, netWorth:{}, atakhan:null, atakhanAt:'', winner:null, winAt:'', quadra:null, penta:null } }

  // TEMP random demo generator until real portal injection implemented
  let demoInterval;
  function startDemo(){
    if(demoInterval) return;
    team1Name='Blue'; team2Name='Red'; currentGame=1; ensureGame(1);
    let kill=0;
    demoInterval=setInterval(()=>{
      const gs=ensureGame(1);
      const side = Math.random()<0.5?team1Name:team2Name;
      gs.killCount[side]=(gs.killCount[side]||0)+1; kill++;
      if(!gs.firstKill){ gs.firstKill=side; gs.firstKillAt=fmtTs(); }
      if(gs.killCount[side]===5 && !gs.race5){ gs.race5=side; gs.race5At=fmtTs(); }
      if(gs.killCount[side]===10 && !gs.race10){ gs.race10=side; gs.race10At=fmtTs(); }
      push();
      if(kill>25){ clearInterval(demoInterval); }
    }, 2500);
  }
  function fmtTs(){ const d=new Date(); return d.getMinutes()+':'+String(d.getSeconds()).padStart(2,'0'); }

  function push(){
    window.postMessage({ __lolStatsPayload: { team1Name, team2Name, gameStats, multiStats } }, '*');
  }

  startDemo();
})();
