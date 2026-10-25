// Guest move latency (reports numbers; pass "&relay" as the third argument to force the relay).
require('./lib').run(async ({ tab, until, check, setProfile, sleep, send, base, out }) => {
  const suffix=process.argv[4]||'';
  const H=await tab(1366,768), G=await tab(390,844,true);
  await H.nav(base+'/index.html'+(suffix?'?'+suffix.slice(1):'')); await H.ev("document.getElementById('createBtn').click();return 1");
  await until(H,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(H,'房主');
  let link=await H.ev("return document.getElementById('shareLink').value"); if(suffix) link+=suffix;
  await G.nav(link); await until(G,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(G,'朋友');
  check('connected', await until(H,"oppName()==='朋友'",20000)); await sleep(3000);
  const ms=[];
  for(let k=0;k<8;k++){
    if(await H.ev('return state.turn')==='host'){ await H.ev("const a=Banqi.legalActions(state,'host').find(x=>x.type==='flip');cells[a.i].click();return 1"); await until(G,"state.turn==='guest'",8000); await sleep(300); }
    const t=await G.ev(`const n=state.moveNo,i=state.board.findIndex(p=>p&&!p.up);if(i<0)return -1;const t0=performance.now();cells[i].click();
      return await new Promise(r=>{const f=()=>{if(state.moveNo!==n)r(Math.round(performance.now()-t0));else if(performance.now()-t0>8000)r(9999);else requestAnimationFrame(f)};f()})`);
    if(t<0)break; ms.push(t); await sleep(400);
  }
  ms.sort((a,b)=>a-b); console.log('LAT'+(suffix||' default'), JSON.stringify(ms), 'median', ms[ms.length>>1]);
});
