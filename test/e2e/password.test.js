// Lobby + spectators + public/private chat + room-full + desktop layout. Four separate browser profiles.
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
  let id=0;const pend={},errs=[],promptAns={};
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id]}
    if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
    if(m.method==='Page.javascriptDialogOpening')send('Page.handleJavaScriptDialog',{accept:true,promptText:promptAns[m.sessionId]||''},m.sessionId)};
  const send=(method,params={},sessionId)=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params,sessionId}))});
  async function tab(w,h,mobile){const {result:{browserContextId}}=await send('Target.createBrowserContext');const {result:{targetId}}=await send('Target.createTarget',{url:'about:blank',browserContextId});
    const {result:{sessionId:s}}=await send('Target.attachToTarget',{targetId,flatten:true});const S=(m,p)=>send(m,p,s);
    await S('Runtime.enable');await S('Page.enable');await S('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await S('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:!!mobile});
    const ev=async e=>{const r=await S('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description);return r.result.result.value};
    const shot=async f=>{const r=await S('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,f),Buffer.from(r.result.data,'base64'))};
    return {sid:s,S,ev,shot,nav:async u=>{await S('Page.navigate',{url:u});await sleep(1500)}}}
  const until=async(t,expr,ms=20000)=>{const end=Date.now()+ms;while(Date.now()<end){try{if(await t.ev('return !!('+expr+')'))return true}catch(_){}await sleep(400)}return false};
  const answer=async(t,pw)=>{await until(t,"!document.getElementById('ask').classList.contains('hidden')&&!document.getElementById('askInput').classList.contains('hidden')",8000);await t.ev(`document.getElementById('askInput').value=${JSON.stringify(pw)};document.getElementById('askYes').click();return 1`);};
  const setProfile=(t,name)=>t.ev(`document.getElementById('profName').value=${JSON.stringify(name)};document.getElementById('profSave').click();return 1`);
  const H=await tab(1366,768), G=await tab(390,844,true), W=await tab(1200,820);
  // 1. host: public room with a password
  await H.nav(base+'/index.html'); await H.ev("document.getElementById('createPubBtn').click();return 1");
  await until(H,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(H,'房主小明');
  const room=await H.ev('return room');
  await H.ev("document.getElementById('cfgPw').value='1234';document.getElementById('cfgPwSave').click();return 1");
  check('invite link carries the key', await until(H,"/&k=[0-9a-f]{16}(&f=[0-9a-f]{16})?$/.test(document.getElementById('shareLink').value)",5000));
  // 2. lobby shows the lock
  await W.nav(base+'/index.html'); await G.nav(base+'/index.html');
  check('lobby shows 🔒', await until(G,`document.getElementById('roomList').textContent.includes('🔒 房主小明')`,25000));
  // 3. wrong password is refused, right one gets in
  await G.ev(`document.querySelector('#roomList [data-join="${room}"]').click();return 1`); await answer(G,'0000'); await sleep(2500);
  await until(G,"!document.getElementById('prof').classList.contains('hidden')",4000); await setProfile(G,'朋友小華');
  check('wrong password is refused', await until(G,"document.getElementById('status').textContent.includes('密碼不對')",20000));
  check('host did not seat the wrong-password guest', await H.ev("return !cfg.guest"));
  await G.ev("[...document.querySelectorAll('#status a')].find(a=>a.textContent==='輸入密碼').click();return 1"); await answer(G,'1234'); await sleep(3000);
  check('right password connects', await until(G,"typeof state!=='undefined'&&state&&document.querySelector('#conn .dot.on')",25000));
  check('host sees the friend', await until(H,"oppName()==='朋友小華'",15000));
  // 4. spectator: wrong password sees nothing, right one sees the game
  await H.ev("const s=document.getElementById('cfgWatch');s.value='chat';s.dispatchEvent(new Event('change'));return 1");
  await until(W,`document.querySelector('#roomList [data-watch="${room}"]')`,30000);
  await W.ev(`document.querySelector('#roomList [data-watch="${room}"]').click();return 1`); await answer(W,'9999'); await sleep(2500);
  await until(W,"!document.getElementById('prof').classList.contains('hidden')",4000); await setProfile(W,'觀眾阿呆');
  check('wrong password: spectator sees no board', await until(W,"document.getElementById('status').textContent.includes('密碼')",20000) && await W.ev("return !watchInfo"));
  await W.ev("[...document.querySelectorAll('#status a')].find(a=>a.textContent==='輸入密碼').click();return 1"); await answer(W,'1234'); await sleep(3000);
  check('right password: spectator sees the game', await until(W,"mode==='watch'&&state&&watchInfo",20000));
  // 5. public chat works on the keyed channel
  await W.ev("profileShown=true;document.getElementById('chatInput').value='有密碼也能聊';document.getElementById('chatForm').requestSubmit();return 1");
  check('public chat on the keyed channel', await until(H,"document.getElementById('chatLog').textContent.includes('有密碼也能聊')",12000) && await until(G,"document.getElementById('chatLog').textContent.includes('有密碼也能聊')",12000));
  // 5b. privacy: photos are not supported at all; a forged photo message is ignored everywhere
  await G.ev("send({type:'sticker',img:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='});return 1"); await sleep(3000);
  check('photo message not shown to the opponent', await H.ev("return ![...document.querySelectorAll('.sticker-show img')].some(i=>i.src.startsWith('data:'))"));
  check('photo message not shown to spectators', await W.ev("return ![...document.querySelectorAll('.sticker-show img')].some(i=>i.src.startsWith('data:'))"));
  check('no photo upload button anywhere', await G.ev("return !document.getElementById('stickerFile')&&!document.querySelector('[data-add]')"));
  // 6. clearing the password removes the lock
  await H.ev("document.getElementById('cfgPw').value='';document.getElementById('cfgPwSave').click();return 1");
  const X=await tab(1100,800); await X.nav(base+'/index.html');
  check('lock gone after clearing the password', await until(X,`document.getElementById('roomList').textContent.includes('房主小明')&&!document.getElementById('roomList').textContent.includes('🔒 房主小明')`,25000));
  // 7. host goes back to the lobby: the board and the lobby card are taken off the relay
  await H.ev("const s=document.getElementById('cfgWatch');s.value='fun';s.dispatchEvent(new Event('change'));return 1"); await sleep(1500);
  await H.ev("goHome();return 1"); await sleep(400); await H.ev("const y=document.getElementById('askYes');if(!document.getElementById('ask').classList.contains('hidden'))y.click();return 1");
  check('host left: spectator board cleared', await until(W,"!watchInfo&&document.getElementById('status').textContent.includes('關閉了觀戰')",15000));
  check('host left: lobby card removed', await until(X,`!document.getElementById('roomList').textContent.includes('房主小明')`,15000));
  console.log('page errors:', errs.length?errs:'none');
  console.log(fails?`${fails} FAILED`:'ALL PASSED');
  ch.kill();process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e.message);process.exit(1)});
