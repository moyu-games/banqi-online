// Local-mode scenarios that trigger each effect; screenshots mid-effect and checks the fx layer cleans up.
const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const base=process.argv[2], out=process.argv[3], W=+(process.argv[4]||1100), H=+(process.argv[5]||900);
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
  await S('Runtime.enable');await S('Page.enable');await S('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await S('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:W<600});
  const ev=async e=>{const r=await S('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description);return r.result.result.value};
  const shot=async f=>{const r=await S('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,f),Buffer.from(r.result.data,'base64'))};
  const click=i=>ev(`cells[${i}].click()`);
  const load=async state=>{await S('Page.navigate',{url:base+'/index.html?local=1'});await sleep(1200);
    await ev(`localStorage.setItem('bq-local',${JSON.stringify(JSON.stringify(state))});return 1`);await S('Page.navigate',{url:base+'/index.html?local=1'});await sleep(1500)};
  const fxCount=()=>ev("return document.getElementById('fx').children.length");
  const text=()=>ev("return [...document.querySelectorAll('#fxTop .banner .bt, #fxTop .pop')].map(e=>e.textContent).join(' | ')");

  const nav=async u=>{await S('Page.navigate',{url:u});await sleep(1800)};
  await nav(base+'/index.html'); await ev("document.getElementById('createBtn').click();return 1"); await sleep(1500);
  await ev("document.getElementById('prof').classList.add('hidden');return 1");
  const hostUrl=await ev('return location.href'), rm=await ev('return room');
  await ev("cells[0].click();return 1"); await sleep(800);
  console.log('home button visible:', await ev("return !document.getElementById('homeBtn').classList.contains('hidden')"));
  await ev("document.getElementById('homeBtn').click();return 1"); await sleep(500);
  console.log('asks before leaving a live game:', await ev("return !document.getElementById('ask').classList.contains('hidden')"));
  await ev("document.getElementById('askYes').click();return 1"); await sleep(2000);
  console.log('back on the lobby:', await ev("return mode===null&&!document.getElementById('lobby').classList.contains('hidden')"));
  console.log('recent game listed:', await ev(`return !document.getElementById('recent').classList.contains('hidden')&&document.getElementById('recentList').textContent.includes('${'${rm}'}')`.replace('${rm}',rm)));
  await shot('lobby-recent.png');
  await ev("document.querySelector('#recentList [data-q]').click();return 1"); await sleep(2500);
  console.log('continue returns as host with the game kept:', await ev(`return mode==='host'&&room==='${'${rm}'}'&&state.moveNo===1`.replace('${rm}',rm)), '| same url:', (await ev('return location.href'))===hostUrl);
  console.log('page errors:', errs.length?errs:'none');
  ch.kill();process.exit(0);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
