// Local-mode scenarios that trigger each effect; screenshots mid-effect and checks the fx layer cleans up.
const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const base=process.argv[2], out=process.argv[3], W=390, H=844, RATE=+(process.argv[4]||1);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const [bin,extra]=require('./lib').chromeBin();
const P=(t,c,up=true)=>({t,c,up});
function st(cells,extraBlack){const b=Array(32).fill(null);for(const [i,p] of Object.entries(cells))b[i]=p;
  return {board:b,colors:{host:'r',guest:'b'},turn:'host',first:'host',noProgress:0,winner:null,reason:null,last:null,captured:{r:[],b:[]},moveNo:5}}
(async()=>{
  const port=9300+Math.floor(Math.random()*500),ud=fs.mkdtempSync(path.join(os.tmpdir(),'qa-chrome-'));
  const ch=spawn(bin,[...extra,`--remote-debugging-port=${port}`,`--user-data-dir=${ud}`,'--no-first-run','--disable-gpu','--autoplay-policy=no-user-gesture-required','about:blank'],{stdio:'ignore'});
  try{os.setPriority(ch.pid,os.constants.priority.PRIORITY_BELOW_NORMAL)}catch(_){}
  let ver;for(let i=0;i<50;i++){try{ver=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();break}catch(_){await sleep(200)}}
  const ws=new WebSocket(ver.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const pend={},errs=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id]}if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)};
  const send=(method,params={},sessionId)=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params,sessionId}))});
  const {result:{targetId}}=await send('Target.createTarget',{url:'about:blank'});
  const {result:{sessionId:s}}=await send('Target.attachToTarget',{targetId,flatten:true});const S=(m,p)=>send(m,p,s);
  await S('Runtime.enable');await S('Page.enable');await S('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await S('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:3,mobile:true});await S('Emulation.setCPUThrottlingRate',{rate:RATE});
  const ev=async e=>{const r=await S('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description);return r.result.result.value};
  const shot=async f=>{const r=await S('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,f),Buffer.from(r.result.data,'base64'))};
  const click=i=>ev(`cells[${i}].click()`);
  const load=async state=>{await S('Page.navigate',{url:base+'/index.html?local=1'});await sleep(1200);
    await ev(`localStorage.setItem('bq-local',${JSON.stringify(JSON.stringify(state))});return 1`);await S('Page.navigate',{url:base+'/index.html?local=1'});await sleep(1500)};
  const fxCount=()=>ev("return document.getElementById('fx').children.length");
  const text=()=>ev("return [...document.querySelectorAll('#fxTop .banner .bt, #fxTop .pop')].map(e=>e.textContent).join(' | ')");

  const START="window.__fr=[];window.__lt=[];window.__on=true;let last=performance.now();(function loop(t){__fr.push(t-last);last=t;if(__on)requestAnimationFrame(loop)})(performance.now());try{window.__po&&__po.disconnect();window.__po=new PerformanceObserver(l=>l.getEntries().forEach(e=>__lt.push(e.duration)));__po.observe({type:'longtask',buffered:false})}catch(e){};return 1";
  const STOP="__on=false;const f=__fr.slice(1).sort((a,b)=>a-b);const n=f.length,sum=f.reduce((a,b)=>a+b,0);return {frames:n,fps:Math.round(1000*n/sum),janky:Math.round(100*f.filter(x=>x>34).length/n),p95:Math.round(f[Math.floor(n*.95)]),max:Math.round(f[n-1]),long:__lt.length,longMax:Math.round(Math.max(0,...__lt))}";
  const results=[];
  const measure=async(name,fn,ms=1600)=>{await ev(START);await fn();await sleep(ms);const r=await ev(STOP);results.push([name,r]);console.log(name.padEnd(26),JSON.stringify(r));};
  // deal on a fresh local game
  await S('Page.navigate',{url:base+'/index.html'});await sleep(1500);await ev("localStorage.removeItem('bq-local');return 1");
  await S('Page.navigate',{url:base+'/index.html?local=1'});await sleep(120);
  await measure('deal (new game)',async()=>{},2000);
  await measure('flip x3',async()=>{for(const i of [0,9,18]){await click(i);await sleep(450)}},900);
  for(const [t,cells,from,to] of [['R',{9:P('R','r'),10:P('P','b')},9,10],['H',{9:P('H','r'),10:P('P','b')},9,10],['C',{8:P('C','r'),9:P('P','b',false),10:P('E','b')},8,10],['P',{9:P('P','r'),10:P('P','b')},9,10],['A',{9:P('A','r'),10:P('H','b')},9,10],['E',{9:P('E','r'),10:P('R','b')},9,10],['K',{9:P('K','r'),10:P('H','b')},9,10],['P->K',{9:P('P','r'),10:P('K','b')},9,10]]){
    await load(st({...cells,31:P('P','b',false)}));
    await measure('capture '+t,async()=>{await click(from);await sleep(60);await click(to)},1800);
  }
  await load(st({0:P('R','r'),1:P('H','b'),31:P('P','b',false)}));
  await measure('sticker pop (meme, wiggle)',async()=>{await ev("showSticker({sid:'n-8'},false);return 1")},2600);
  await measure('sticker pop (Tenor gif)',async()=>{await ev("showSticker({sid:STICKERS.find(s=>s.group==='nailong').id},false);return 1")},2600);
  await measure('emoji float',async()=>{await ev("floatEmoji('🔥',false);return 1")},2200);
  await measure('victory party',async()=>{await ev("document.getElementById('overlay').classList.remove('hidden');celebrate('win');confetti();return 1")},3500);
  await ev("hideOver();return 1");
  // phone bottom sheet in a host room
  await S('Page.navigate',{url:base+'/index.html?room=perf01&host=k1'});await sleep(2500);await ev("document.getElementById('prof').classList.add('hidden');return 1");
  await measure('sheet open+close (sticker)',async()=>{await ev("document.querySelector('#actbar [data-m=sticker]').click();return 1");await sleep(900);await ev("closeSheet();return 1")},800);
  require('fs').writeFileSync(require('path').join(out,'perf-'+RATE+'x.json'),JSON.stringify(results));
  const bad=results.filter(([,r])=>r.janky/Math.max(1,r.frames)>0.05||r.longMax>200);
  console.log(bad.length?'FAIL frame timing: '+bad.map(([n,r])=>n+' janky '+r.janky+'/'+r.frames+' longest task '+r.longMax+'ms').join('; '):'PASS frame timing: no effect drops more than 5% of frames or blocks over 200 ms');
  console.log('page errors:', errs.length?errs:'none');
  ch.kill();process.exit(bad.length?1:0);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
