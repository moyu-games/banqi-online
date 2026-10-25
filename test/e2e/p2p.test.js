// Two headless tabs (separate browser contexts): host creates game, guest joins via link, they play moves.
const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const base=process.argv[2], shotDir=process.argv[3], SUF=process.argv[4]||'', TAG=process.argv[5]||'both';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const [bin,extra]=require('./lib').chromeBin();
(async()=>{
  const port=9300+Math.floor(Math.random()*500),ud=fs.mkdtempSync(path.join(os.tmpdir(),'qa-chrome-'));
  const ch=spawn(bin,[...extra,`--remote-debugging-port=${port}`,`--user-data-dir=${ud}`,'--no-first-run','--disable-gpu','about:blank'],{stdio:'ignore'});
  try{os.setPriority(ch.pid,os.constants.priority.PRIORITY_BELOW_NORMAL)}catch(_){}
  let ver;for(let i=0;i<50;i++){try{ver=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();break}catch(_){await sleep(200)}}
  const ws=new WebSocket(ver.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const pend={},errs=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id]}if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)};
  const send=(method,params={},sessionId)=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params,sessionId}))});
  let ctx0=null;async function tab(w,h){let browserContextId;if(process.env.SAMECTX&&ctx0)browserContextId=ctx0;else{browserContextId=(await send('Target.createBrowserContext')).result.browserContextId;ctx0=ctx0||browserContextId}const {result:{targetId}}=await send('Target.createTarget',{url:'about:blank',browserContextId});
    const {result:{sessionId:s}}=await send('Target.attachToTarget',{targetId,flatten:true});const S=(m,p)=>send(m,p,s);await S('Runtime.enable');await S('Page.enable');await S('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await S('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<600});
    const ev=async e=>{const r=await S('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description);return r.result.result.value};
    const shot=async f=>{const r=await S('Page.captureScreenshot',{format:'png'});fs.writeFileSync(f,Buffer.from(r.result.data,'base64'))};
    return {S,ev,shot,nav:u=>S('Page.navigate',{url:u})}}
  const until=async(t,expr,ms=20000)=>{const end=Date.now()+ms;while(Date.now()<end){try{if(await t.ev('return !!('+expr+')'))return true}catch(_){}await sleep(300)}let d;try{d=await t.ev("return location.href+' / conn='+document.getElementById('conn').textContent+' / status='+document.getElementById('status').textContent+' / peer='+(typeof peer!=='undefined'&&peer?peer.id+' open='+peer.open:'none')")}catch(e){d=e.message}throw new Error('timeout: '+expr+' :: '+d+' :: errs='+errs.join('|'))};
  const H=await tab(1100,1000), G=await tab(390,844);
  await H.nav(base+'/index.html'); await sleep(1500);
  await H.ev("document.getElementById('createBtn').click()");
  const link=await H.ev("return document.getElementById('shareLink').value"); const hostUrl=await H.ev('return location.href'); console.log('link', link, 'host', hostUrl);
  if(SUF){await H.nav(hostUrl+SUF);} await sleep(2500);
  await G.nav(link+SUF); await until(G,"state && document.querySelector('#conn .dot.on')");
  await until(H,"document.querySelector('#conn .dot.on')");
  console.log('conn labels:', await H.ev("return document.getElementById('conn').textContent"), '/', await G.ev("return document.getElementById('conn').textContent"));
  console.log('connected. host status:', await H.ev("return document.getElementById('status').textContent"));
  console.log('guest status:', await G.ev("return document.getElementById('status').textContent"));
  // boards identical?
  const same=await H.ev("return JSON.stringify(forGuest(state).board)")===await G.ev("return JSON.stringify(state.board)"); console.log('boards identical:', same);
  // guest clicking out of turn does nothing
  await G.ev("document.querySelector('.cell[data-i=\"3\"]').click()"); await sleep(800);
  console.log('guest out-of-turn flip ignored:', !(await H.ev("return state.board[3].up")));
  const click=(t,i)=>t.ev(`document.querySelector('.cell[data-i="${i}"]').click()`);
  // play 30 plies by picking legal actions and clicking them
  const obs="window.__mut=0;new MutationObserver(ms=>ms.forEach(m=>window.__mut+=m.addedNodes.length+m.removedNodes.length)).observe(document.getElementById('board'),{childList:true,subtree:true});return 1";
  await H.ev(obs); await G.ev(obs);
  const sizes=new Set();
  for(let k=0;k<30;k++){
    sizes.add(await G.ev("return document.getElementById('board').style.getPropertyValue('--cell')"));
    const turn=await H.ev("return state.winner?'over':state.turn"); if(turn==='over')break;
    const T=turn==='host'?H:G;
    const a=await T.ev("const as=Banqi.legalActions(state,state.turn);const mv=as.filter(x=>x.type==='move');const pool=(mv.length&&Math.random()<.6)?mv:as;return pool[Math.floor(Math.random()*pool.length)]");
    const n0=await H.ev("return state.moveNo");
    if(a.type==='flip')await click(T,a.i); else {await click(T,a.from);await sleep(150);await click(T,a.to)}
    await until(H,`state.moveNo>${n0}`,8000); await until(G,`state && state.moveNo>${n0}`,8000);
  }
  console.log('board nodes added/removed per move (host/guest):', ((await H.ev('return __mut'))/30).toFixed(1), '/', ((await G.ev('return __mut'))/30).toFixed(1));
  console.log('guest board cell sizes seen during game:', [...sizes].join(','));
  console.log('after plies: host moveNo', await H.ev("return state.moveNo"), 'guest moveNo', await G.ev("return state.moveNo"));
  console.log('still in sync:', await H.ev("return JSON.stringify(forGuest(state))")===await G.ev("return JSON.stringify(state)"));
  // chat
  await G.ev("document.getElementById('chatInput').value='hello from abroad';document.getElementById('chatForm').requestSubmit()");
  await until(H,"document.getElementById('chatLog').textContent.includes('hello from abroad')"); console.log('chat ok');
  await G.ev("document.querySelector('#reacts button[data-e=\"🔥\"]').click();return 1"); await until(H,"[...document.querySelectorAll('.sticker-show.emoji .emo-big')].some(e=>e.textContent==='🔥')",8000); console.log('emoji reaction reached host');
  // stickers: built-in from guest, custom upload from host (also auto-saved on the guest side)
  await G.ev("document.getElementById('trayBtn').click();document.querySelector('#trayTabs [data-g=meme]').click();return 1"); await sleep(300);
  console.log('tray tiles:', await G.ev("return document.querySelectorAll('#trayGrid .stk').length"));
  await G.shot(shotDir+'/tray-'+TAG+'.png');
  await G.ev("window.__sent=[];const o=send;send=m=>{__sent.push(m.type);o(m)};return 1");
  await H.ev("window.__got=[];const o=receive;receive=(m,c)=>{__got.push(m&&m.type);o(m,c)};return 1");
  await G.ev("document.querySelector('#trayGrid [data-id=\"n-13\"]').click();return 1");
  await sleep(400); await G.shot(shotDir+'/sticker-sent-'+TAG+'.png'); console.log('DEBUG guest sent:', await G.ev('return __sent.join()'), '| guest own sticker:', await G.ev("return document.querySelectorAll('.sticker-show').length"), '| host got:', await H.ev('return __got.join()'), '| host shows:', await H.ev("return document.querySelectorAll('.sticker-show').length"));
  await until(H,"[...document.querySelectorAll('.sticker-show img')].some(i=>i.src.includes('stickers/13')&&i.complete&&i.naturalWidth>0)",8000); console.log('built-in sticker reached host');
  await sleep(100); await H.shot(shotDir+'/sticker-recv-'+TAG+'.png');
  await H.ev("document.getElementById('trayBtn').click();document.querySelector('#trayTabs [data-g=meme]').click();return 1");
  const LINK='https://media.tenor.com/-qBsG1HwR4oAAAA1/cat-dance-dancing-cat.webp';
  await H.ev(`document.querySelector('#trayTabs [data-g=mine]').click();document.getElementById('linkInput').value=${JSON.stringify(LINK)};document.getElementById('linkForm').requestSubmit();return 1`);
  await until(H,"customs.length>0",10000); await sleep(1200);
  await H.ev("document.querySelector('#trayGrid [data-c=\"0\"]').click();return 1");
  await until(G,`[...document.querySelectorAll('.sticker-show img')].some(i=>i.src===${JSON.stringify(LINK)})`,15000); console.log('linked sticker reached guest');
  await sleep(1300);
  await H.ev("send({type:'sticker',img:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='});return 1"); await sleep(2500);
  console.log('photo message ignored by guest:', await G.ev("return ![...document.querySelectorAll('.sticker-show img')].some(i=>i.src.startsWith('data:'))"));
  console.log('guest auto-saved it:', await G.ev("return JSON.parse(localStorage.getItem('bq-stickers')||'[]').length"));
  // guest reload -> reconnect & state restored
  const before=await H.ev("return state.moveNo");
  await G.nav(link+SUF); await until(G,"state && state.moveNo==="+before,20000); console.log('guest reload resync ok');
  // host reload -> reclaims id, guest reconnects
  await H.nav(hostUrl+SUF); await until(H,"state && state.moveNo==="+before,5000);
  await until(H,"document.querySelector('#conn .dot.on')",40000); console.log('host reload reconnect ok');
  console.log('profile dialog open on host before idle check:', await H.ev("return !document.getElementById('prof').classList.contains('hidden')"));
  for(const T of [H,G]) await T.ev("document.getElementById('prof').classList.add('hidden');return 1");
  await sleep(4500);
  for(const [nm,T] of [['host',H],['guest',G]]){
    const a=(await T.S('Page.captureScreenshot',{format:'png'})).result.data; await sleep(1200);
    const b=(await T.S('Page.captureScreenshot',{format:'png'})).result.data;
    console.log(nm+' idle screen identical after 1.2s:', a===b);
  }
  await H.shot(shotDir+'/host-'+TAG+'.png'); await G.shot(shotDir+'/guest-'+TAG+'.png');
  console.log('page errors:', errs.length?errs:'none');
  ch.kill(); process.exit(0);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
