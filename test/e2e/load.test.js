// Load speed on a mid-range phone over slow 4G: first paint, LCP, bytes, requests; and how long an invited friend waits for the board.
const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const base=process.argv[2];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const [bin,binExtra]=require('./lib').chromeBin();
(async()=>{
  const port=9500+Math.floor(Math.random()*400),ud=fs.mkdtempSync(path.join(os.tmpdir(),'ld-'));
  const ch=spawn(bin,[...binExtra,`--remote-debugging-port=${port}`,`--user-data-dir=${ud}`,'--no-first-run','--disable-gpu','about:blank'],{stdio:'ignore'});
  try{os.setPriority(ch.pid,os.constants.priority.PRIORITY_BELOW_NORMAL)}catch(_){}
  let ver;for(let i=0;i<50;i++){try{ver=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();break}catch(_){await sleep(200)}}
  const ws=new WebSocket(ver.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const pend={},net={};
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id]}
    if(m.method==='Network.loadingFinished'&&m.sessionId){(net[m.sessionId]=net[m.sessionId]||{n:0,b:0});net[m.sessionId].n++;net[m.sessionId].b+=m.params.encodedDataLength}};
  const send=(method,params={},sessionId)=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params,sessionId}))});
  async function tab(slow){const {result:{browserContextId}}=await send('Target.createBrowserContext');const {result:{targetId}}=await send('Target.createTarget',{url:'about:blank',browserContextId});
    const {result:{sessionId:s}}=await send('Target.attachToTarget',{targetId,flatten:true});const S=(m,p)=>send(m,p,s);
    await S('Runtime.enable');await S('Page.enable');await S('Network.enable');
    await S('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true});
    if(slow){await S('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8});await S('Emulation.setCPUThrottlingRate',{rate:4});}
    const ev=async e=>{const r=await S('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true});return r.result.result&&r.result.result.value};
    return {s,S,ev}}
  const until=async(t,expr,ms)=>{const end=Date.now()+ms;while(Date.now()<end){try{if(await t.ev('return !!('+expr+')'))return true}catch(_){}await sleep(150)}return false};
  // 1. first visit to the home page on a slow phone (empty cache)
  const P=await tab(true);
  await P.ev("window.__t0=performance.now();return 1");
  await P.S('Page.navigate',{url:base+'/index.html'});
  await until(P,"document.readyState==='complete'",60000); await sleep(2500);
  const m=await P.ev(`const fcp=performance.getEntriesByName('first-contentful-paint')[0];const nav=performance.getEntriesByType('navigation')[0];
    let lcp=0;try{const o=new PerformanceObserver(()=>{});}catch(_){}
    const l=performance.getEntriesByType('largest-contentful-paint');return {fcp:Math.round(fcp?fcp.startTime:-1),dcl:Math.round(nav.domContentLoadedEventEnd),load:Math.round(nav.loadEventEnd),
    res:performance.getEntriesByType('resource').map(r=>[r.name.replace(/\\?.*/,'').split('/').slice(-1)[0],Math.round(r.transferSize/1024),Math.round(r.duration)]).sort((a,b)=>b[1]-a[1]).slice(0,8)}`);
  const n1=net[P.s]||{n:0,b:0};
  console.log('HOME (slow 4G + 4x CPU, empty cache):', JSON.stringify({fcp_ms:m.fcp,domReady_ms:m.dcl,load_ms:m.load,requests:n1.n,KB:Math.round(n1.b/1024)}));
  console.log('  biggest downloads [file, KB, ms]:', JSON.stringify(m.res));
  // 2. second visit (warm cache)
  net[P.s]={n:0,b:0};
  await P.S('Page.navigate',{url:base+'/index.html'}); await until(P,"document.readyState==='complete'",60000); await sleep(1500);
  const m2=await P.ev("const f=performance.getEntriesByName('first-contentful-paint')[0];return Math.round(f?f.startTime:-1)");
  console.log('HOME repeat visit:', JSON.stringify({fcp_ms:m2,requests:net[P.s].n,KB:Math.round(net[P.s].b/1024)}));
  // 3. an invited friend on a slow phone: time from opening the link to seeing a playable board
  const H=await tab(false);
  await H.S('Page.navigate',{url:base+'/index.html'}); await until(H,"document.readyState==='complete'",20000); await sleep(800);
  await H.ev("document.getElementById('createBtn').click();return 1"); await sleep(2500); await until(H,"/[?]room=[a-z0-9]{6}/.test((document.getElementById('shareLink')||{}).value||'')&&/host=/.test(location.search)",15000);
  await H.ev("document.getElementById('prof').classList.add('hidden');return 1");
  const link=await H.ev("return document.getElementById('shareLink').value");
  const G=await tab(true); const t0=Date.now();
  await G.S('Page.navigate',{url:link});
  const ok=await until(G,"typeof state!=='undefined'&&state&&state.board&&document.querySelectorAll('#board .cell').length===32",60000);
  console.log('FRIEND opens invite (slow 4G + 4x CPU): board ready after', ok?((Date.now()-t0)+' ms'):'TIMEOUT', '| channel:', await G.ev("return document.getElementById('conn').textContent"));
  ch.kill();process.exit(0);
})().catch(e=>{console.error('CRASH',e.message);process.exit(1)});
