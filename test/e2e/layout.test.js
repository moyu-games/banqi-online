// Extra checks: phone spectator, phone landscape, local mode on a phone, dark-mode contrast, crowded lobby + hostile lobby data.
const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const base=process.argv[2], out=process.argv[3];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const [bin,extra]=require('./lib').chromeBin();
let fails=0;const check=(name,ok,x='')=>{console.log((ok?'PASS ':'FAIL ')+name+(x?' — '+x:''));if(!ok)fails++};
(async()=>{
  const port=9300+Math.floor(Math.random()*500),ud=fs.mkdtempSync(path.join(os.tmpdir(),'qa-chrome-'));
  const ch=spawn(bin,[...extra,`--remote-debugging-port=${port}`,`--user-data-dir=${ud}`,'--no-first-run','--disable-gpu','about:blank'],{stdio:'ignore'});
  try{os.setPriority(ch.pid,os.constants.priority.PRIORITY_BELOW_NORMAL)}catch(_){}
  let ver;for(let i=0;i<50;i++){try{ver=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();break}catch(_){await sleep(200)}}
  const ws=new WebSocket(ver.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const pend={},errs=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id]}
    if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
    if(m.method==='Page.javascriptDialogOpening')send('Page.handleJavaScriptDialog',{accept:true},m.sessionId);
    if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errs.push('console: '+m.params.args.map(a=>a.value).join(' '))};
  const send=(method,params={},sessionId)=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params,sessionId}))});
  async function tab(w,h,mobile){const {result:{browserContextId}}=await send('Target.createBrowserContext');const {result:{targetId}}=await send('Target.createTarget',{url:'about:blank',browserContextId});
    const {result:{sessionId:s}}=await send('Target.attachToTarget',{targetId,flatten:true});const S=(m,p)=>send(m,p,s);
    await S('Runtime.enable');await S('Page.enable');
    const size=async(w,h,m)=>S('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:m?3:1,mobile:!!m});await size(w,h,mobile);
    const ev=async e=>{const r=await S('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description);return r.result.result.value};
    const shot=async f=>{const r=await S('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,f),Buffer.from(r.result.data,'base64'))};
    return {S,ev,shot,size,nav:async u=>{await S('Page.navigate',{url:u});await sleep(2200)}}}
  const until=async(t,expr,ms=20000)=>{const end=Date.now()+ms;while(Date.now()<end){try{if(await t.ev('return !!('+expr+')'))return true}catch(_){}await sleep(400)}return false};
  const closeProf=t=>t.ev("document.getElementById('prof').classList.add('hidden');return 1");
  const H=await tab(1366,768), W=await tab(390,844,true), L=await tab(390,844,true);

  // 1. phone spectator
  await H.nav(base+'/index.html'); await H.ev("document.getElementById('createBtn').click();return 1"); await sleep(1200); await closeProf(H);
  const room=await H.ev('return room');
  await H.ev("const s=document.getElementById('cfgWatch');s.value='board';s.dispatchEvent(new Event('change'));return 1");
  await W.nav(base+'/index.html?room='+room+'&watch=1'); await closeProf(W);
  check('phone spectator sees the board', await until(W,"watchInfo&&state",20000));
  check('phone spectator (board only): no bottom bar', await W.ev("return getComputedStyle(document.getElementById('actbar')).display==='none'"));
  await H.ev("const s=document.getElementById('cfgWatch');s.value='chat';s.dispatchEvent(new Event('change'));return 1");
  check('phone spectator (chat): bar with only 💬', await until(W,"getComputedStyle(document.getElementById('actbar')).display==='flex'&&[...document.querySelectorAll('#actbar [data-m]')].filter(b=>!b.classList.contains('hidden')).map(b=>b.dataset.m).join()==='chat'",12000));
  check('phone spectator: no page scroll', await W.ev("return document.documentElement.scrollHeight<=innerHeight+1"), await W.ev("return document.documentElement.scrollHeight+'/'+innerHeight"));
  await W.ev("document.querySelector('#actbar [data-m=chat]').click();return 1"); await sleep(500);
  check('phone spectator chat sheet opens with input', await W.ev("return document.body.classList.contains('sheet-open')&&getComputedStyle(document.getElementById('chatForm')).display!=='none'"));
  await W.shot('extra-phone-watch.png');

  // 2. phone landscape, host
  await L.size(844,390,true); await L.nav(base+'/index.html?room=lands1&host=k1'); await closeProf(L);
  const land=await L.ev("const b=document.querySelector('.board-wrap').getBoundingClientRect(),a=document.getElementById('actbar').getBoundingClientRect();return {br:Math.round(b.right),rail:Math.round(a.left),bb:Math.round(b.bottom),bt:Math.round(b.top),bar:Math.round(a.top),sh:document.documentElement.scrollHeight,ih:innerHeight,cell:document.getElementById('board').style.getPropertyValue('--cell')}");
  check('phone landscape: rail on the right does not cover the board', land.rail>=land.br-1, JSON.stringify(land));
  await L.shot('extra-phone-landscape.png');

  // 3. local mode on a phone
  await L.size(390,844,true); await L.nav(base+'/index.html'); await L.ev("localStorage.removeItem('bq-local');return 1"); await L.nav(base+'/index.html?local=1');
  check('local on phone: bottom bar without chat', await L.ev("return getComputedStyle(document.getElementById('actbar')).display==='flex'&&document.querySelector('#actbar [data-m=chat]').classList.contains('hidden')"));
  check('local on phone: no page scroll', await L.ev("return document.documentElement.scrollHeight<=innerHeight+1"), await L.ev("return document.documentElement.scrollHeight+'/'+innerHeight"));
  await L.ev("document.querySelector('#actbar [data-m=game]').click();return 1"); await sleep(400);
  check('local on phone: game buttons reachable (in 更多)', await L.ev("return document.getElementById('newBtn').offsetParent!==null"));
  await L.ev("closeSheet();return 1"); await sleep(300);
  await L.ev("cells[0].click();return 1"); await sleep(700);
  check('local on phone: flipping works', await L.ev("return state.moveNo===1"));
  await L.shot('extra-phone-local.png');

  // 4. dark mode contrast (WCAG ratio of text vs its nearest opaque-ish background)
  await H.ev("document.documentElement.classList.add('dark');themeIcon();return 1"); await sleep(300);
  const contrast=await H.ev(`
    const lum=c=>{const m=c.match(/[\\d.]+/g).map(Number);const [r,g,b]=m.slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};
    const bgOf=el=>{for(let e=el;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor;const a=(c.match(/[\\d.]+/g)||[]).map(Number);if(a.length===3||(a.length===4&&a[3]>.5))return c}return getComputedStyle(document.documentElement).getPropertyValue('--bg')?'rgb(22,18,14)':'rgb(0,0,0)'};
    const ratio=el=>{const a=lum(getComputedStyle(el).color),b=lum(bgOf(el));return +( (Math.max(a,b)+.05)/(Math.min(a,b)+.05) ).toFixed(1)};
    const pick=['#status','#pMe .who','#conn','#newBtn','#chatInput','#cfgWatch','.modes button.on','.modes button:not(.on)','.brand .zh','.muted'];
    const out={};for(const q of pick){const el=document.querySelector(q);if(el)out[q]=ratio(el)}
    const opt=document.querySelector('#cfgWatch option');out['select option bg']=getComputedStyle(opt).backgroundColor;out['select option color']=getComputedStyle(opt).color;
    return out`);
  const low=Object.entries(contrast).filter(([k,v])=>typeof v==='number'&&v<4.5);
  check('dark mode: text contrast ≥ 4.5', low.length===0, JSON.stringify(contrast));
  await H.ev("document.getElementById('cfgDlg').classList.remove('hidden');return 1"); await sleep(300); await H.shot('extra-dark-settings.png'); await H.ev("document.getElementById('cfgDlg').classList.add('hidden');return 1");

  // 5. crowded lobby + hostile lobby data
  await W.size(390,844,true); await W.nav(base+'/index.html');
  const t0=await W.ev(`const now=Date.now();for(let i=0;i<25;i++){const r='zz'+String(i).padStart(4,'0');lobbyRooms[r]={room:r,n:'房間'+i,a:'n-'+(1+i%24),st:i%3?'play':'wait',lvl:['off','board','fun','chat'][i%4],aud:i%5,lock:i%2===0,ts:now}}
    lobbyRooms['evil01']={room:'evil01',n:'<img src=x onerror=window.__pwn=1>',a:'"><script>window.__pwn=2</script>',st:'wait',lvl:'chat" onclick="window.__pwn=3',aud:'<b>9</b>',lock:true,ts:now};
    const t=performance.now();renderRooms();return Math.round(performance.now()-t)`);
  await sleep(500);
  check('crowded lobby renders fast', t0<50, t0+'ms for 26 rooms');
  check('crowded lobby lists all rooms', await W.ev("return document.querySelectorAll('#roomList .room').length>=26"));
  check('hostile lobby entry shown as text, nothing runs', await W.ev("return !window.__pwn&&document.getElementById('roomList').textContent.includes('<img src=x')"));
  check('lobby: no horizontal overflow on phone', await W.ev("return document.documentElement.scrollWidth<=innerWidth"));
  await W.shot('extra-lobby-crowded.png');

  console.log('page errors:', errs.length?errs:'none');
  console.log(fails?`${fails} FAILED`:'ALL PASSED');
  ch.kill();process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e.message);process.exit(1)});
