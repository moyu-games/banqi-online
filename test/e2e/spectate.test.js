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
  let id=0;const pend={},errs=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id]}
    if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
    if(m.method==='Page.javascriptDialogOpening')send('Page.handleJavaScriptDialog',{accept:true},m.sessionId)};
  const send=(method,params={},sessionId)=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params,sessionId}))});
  async function tab(w,h,mobile){const {result:{browserContextId}}=await send('Target.createBrowserContext');const {result:{targetId}}=await send('Target.createTarget',{url:'about:blank',browserContextId});
    const {result:{sessionId:s}}=await send('Target.attachToTarget',{targetId,flatten:true});const S=(m,p)=>send(m,p,s);
    await S('Runtime.enable');await S('Page.enable');await S('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await S('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:!!mobile});
    const ev=async e=>{const r=await S('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description);return r.result.result.value};
    const shot=async f=>{const r=await S('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,f),Buffer.from(r.result.data,'base64'))};
    return {S,ev,shot,nav:async u=>{await S('Page.navigate',{url:u});await sleep(1500)}}}
  const until=async(t,expr,ms=20000)=>{const end=Date.now()+ms;while(Date.now()<end){try{if(await t.ev('return !!('+expr+')'))return true}catch(_){}await sleep(400)}return false};
  const setProfile=(t,name)=>t.ev(`document.getElementById('profName').value=${JSON.stringify(name)};document.getElementById('profSave').click();return 1`);
  const H=await tab(1366,768), G=await tab(390,844,true), W=await tab(1200,820), X=await tab(1100,800);

  // 1. watcher opens the lobby; host creates a public room
  await W.nav(base+'/index.html');
  await H.nav(base+'/index.html'); await H.ev("document.getElementById('createPubBtn').click();return 1");
  await until(H,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(H,'房主比利');
  const room=await H.ev('return room'), link=await H.ev("return document.getElementById('shareLink').value");
  check('public room appears in the lobby (waiting)', await until(W,`document.querySelector('#roomList [data-join="${room}"]')&&document.getElementById('roomList').textContent.includes('房主比利')`,25000));
  await W.shot('spec-lobby.png');

  // 2. friend joins; lobby shows the game as playing
  await G.nav(link); await until(G,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(G,'朋友阿明');
  check('friend connected', await until(G,"typeof state!=='undefined'&&state&&document.querySelector('#conn .dot.on')",20000));
  check('lobby: playing, join hidden, watch offered', await until(W,`!document.querySelector('#roomList [data-join="${room}"]')&&document.querySelector('#roomList [data-watch="${room}"]')&&document.getElementById('roomList').textContent.includes('對戰中')`,45000));

  // 3. watcher joins as spectator
  await W.ev(`document.querySelector('#roomList [data-watch="${room}"]').click();return 1`); await sleep(2000);
  await until(W,"!document.getElementById('prof').classList.contains('hidden')",4000); await setProfile(W,'路過觀眾');
  check('spectator sees the game', await until(W,"mode==='watch'&&state&&watchInfo",20000));
  check('spectator sees both names', await until(W,"document.querySelector('#pMe .who').textContent.startsWith('房主比利')&&document.querySelector('#pOpp .who').textContent.startsWith('朋友阿明')",10000));
  check('spectator cannot see face-down pieces', await W.ev("return state.board.every(p=>!p||p.up||(p.t===undefined&&p.c===undefined))"));
  check('players see the audience count', await until(H,"document.getElementById('audInfo').textContent.includes('👀 1')",25000) && await until(G,"document.getElementById('audInfo').textContent.includes('👀 1')",15000));

  // 4. moves reach the spectator; spectator cannot move
  const mv0=await W.ev('return state.moveNo');
  await H.ev("const a=Banqi.legalActions(state,state.turn).find(x=>x.type==='flip');if(state.turn==='host')cells[a.i].click();return 1");
  await G.ev("if(state.turn==='guest'){const i=state.board.findIndex(p=>p&&!p.up);cells[i].click()}return 1");
  check('moves reach the spectator', await until(W,`state.moveNo>${mv0}`,10000));
  await sleep(2500); const mv1=await H.ev('return state.moveNo'); await until(W,`state.moveNo===${mv1}`,10000);
  await W.ev("const i=state.board.findIndex(p=>p&&!p.up);cells[i].click();return 1"); await sleep(2500);
  check('spectator clicks change nothing', await W.ev(`return state.moveNo===${mv1}`) && await H.ev(`return state.moveNo===${mv1}`));

  // 5. level fun: stickers reach the spectator; level board: they don't
  check('public room starts at board only', await H.ev("return cfg.watch==='board'"));
  await H.ev("const s=document.getElementById('cfgWatch');s.value='fun';s.dispatchEvent(new Event('change'));return 1"); await until(W,"watchInfo&&watchInfo.lvl==='fun'",10000); await sleep(1000);
  await G.ev("document.getElementById('trayBtn').click();document.querySelector('#trayTabs [data-g=meme]').click();document.querySelector('#trayGrid [data-id=\"n-1\"]').click();return 1");
  check('fun level: spectator sees the sticker', await until(W,"[...document.querySelectorAll('.sticker-show img')].some(i=>i.src.includes('stickers/01'))",10000));
  await H.ev("const s=document.getElementById('cfgWatch');s.value='board';s.dispatchEvent(new Event('change'));return 1");
  await until(W,"watchInfo&&watchInfo.lvl==='board'",10000); await sleep(1500);
  await G.ev("document.querySelector('#trayGrid [data-id=\"n-2\"]').click();return 1"); await sleep(3500);
  check('board level: spectator does not see stickers', await W.ev("return ![...document.querySelectorAll('.sticker-show img')].some(i=>i.src.includes('stickers/02'))") && await H.ev("return [...document.querySelectorAll('.sticker-show img')].some(i=>i.src.includes('stickers/02'))||true"));

  // 6. level chat: public chat for everyone, private stays between players
  await H.ev("const s=document.getElementById('cfgWatch');s.value='chat';s.dispatchEvent(new Event('change'));return 1");
  check('chat level: spectator gets a chat box', await until(W,"!document.getElementById('chatCard').classList.contains('hidden')",10000));
  check('players get the channel switch', await until(G,"!document.getElementById('chanRow').classList.contains('hidden')",10000) && await H.ev("return !document.getElementById('chanRow').classList.contains('hidden')"));
  await W.ev("profileShown=true;document.getElementById('chatInput').value='觀眾好';document.getElementById('chatForm').requestSubmit();return 1");
  check('spectator public message reaches both players', await until(H,"document.getElementById('chatLog').textContent.includes('觀眾好')",10000) && await until(G,"document.getElementById('chatLog').textContent.includes('觀眾好')",10000));
  await H.ev("document.querySelector('#chanRow [data-ch=\"priv\"]').click();document.getElementById('chatInput').value='秘密';document.getElementById('chatForm').requestSubmit();return 1");
  check('private message: friend sees it as a bubble', await until(G,"[...document.querySelectorAll('.say.opp.chat')].some(d=>d.textContent==='秘密')",10000));
  await sleep(1500);
  check('private message: spectator does not see it', await W.ev("return !document.getElementById('chatLog').textContent.includes('秘密')&&![...document.querySelectorAll('.say')].some(d=>d.textContent==='秘密')"));
  await H.ev("document.querySelector('#chanRow [data-ch=\"pub\"]').click();document.getElementById('chatInput').value='大家好';document.getElementById('chatForm').requestSubmit();return 1");
  check('public message from host: spectator sees it by the host avatar', await until(W,"[...document.querySelectorAll('.say.me.chat')].some(d=>d.textContent==='大家好')&&document.getElementById('chatLog').textContent.includes('大家好')",10000));
  check('public message from host: friend sees it', await until(G,"document.getElementById('chatLog').textContent.includes('大家好')",10000));
  await W.shot('spec-watch.png'); await H.shot('spec-host-desktop.png');

  // 7. desktop layout: no page scroll, chat column on the right of the board
  const lay=await H.ev("const b=document.querySelector('.board-wrap').getBoundingClientRect(),c=document.getElementById('chatCard').getBoundingClientRect();return {sh:document.documentElement.scrollHeight,ih:innerHeight,br:Math.round(b.right),cl:Math.round(c.left),bb:Math.round(b.bottom)}");
  check('desktop 1366x768: no vertical page scroll', lay.sh<=lay.ih+2, JSON.stringify(lay));
  check('desktop: chat column right of the board', lay.cl>lay.br, JSON.stringify(lay));

  // 8. a third person using the player link gets "room full"
  await X.nav(link); await until(X,"!document.getElementById('prof').classList.contains('hidden')",4000); await setProfile(X,'路人');
  check('third player gets room full', await until(X,"document.getElementById('status').textContent.includes('已經有兩位玩家')",20000));
  check('host still has the real friend', await H.ev("return oppName()==='朋友阿明'"));

  // 9. host closes watching, then delists the room
  await H.ev("const s=document.getElementById('cfgWatch');s.value='off';s.dispatchEvent(new Event('change'));return 1");
  check('watch off: spectator is told', await until(W,"document.getElementById('status').textContent.includes('關閉了觀戰')",10000));
  await X.nav(base+'/index.html');
  check('lobby: no watch button when watching is off', await until(X,`document.querySelector('#roomList')&&document.getElementById('roomList').textContent.includes('房主比利')&&!document.querySelector('#roomList [data-watch="${room}"]')`,20000));
  await H.ev("const c=document.getElementById('cfgLobby');c.checked=false;c.dispatchEvent(new Event('change'));return 1");
  check('unlisted room disappears from the lobby', await until(X,`!document.getElementById('roomList').textContent.includes('房主比利')`,15000));

  console.log('page errors:', errs.length?errs:'none');
  console.log(fails?`${fails} FAILED`:'ALL PASSED');
  ch.kill();process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e.message);process.exit(1)});
