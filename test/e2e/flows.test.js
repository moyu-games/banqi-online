// Flows not covered by p2p-test: guest new game, game-over sync on both sides, rematch, real touch taps, local mode, rules panel.
const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const base=process.argv[2], out=process.argv[3], SUF=process.argv[4]||'';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const [bin,extra]=require('./lib').chromeBin();
let fails=0;const check=(name,ok,extra='')=>{console.log((ok?'PASS ':'FAIL ')+name+(extra?' — '+extra:''));if(!ok)fails++};
(async()=>{
  const port=9300+Math.floor(Math.random()*500),ud=fs.mkdtempSync(path.join(os.tmpdir(),'qa-chrome-'));
  const ch=spawn(bin,[...extra,`--remote-debugging-port=${port}`,`--user-data-dir=${ud}`,'--no-first-run','--disable-gpu','about:blank'],{stdio:'ignore'});
  try{os.setPriority(ch.pid,os.constants.priority.PRIORITY_BELOW_NORMAL)}catch(_){}
  let ver;for(let i=0;i<50;i++){try{ver=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();break}catch(_){await sleep(200)}}
  const ws=new WebSocket(ver.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const pend={},errs=[],dialogSessions=new Set();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id]}
    if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
    if(m.method==='Page.javascriptDialogOpening')send('Page.handleJavaScriptDialog',{accept:true},m.sessionId)};
  const send=(method,params={},sessionId)=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params,sessionId}))});
  async function tab(w,h,touch){const {result:{browserContextId}}=await send('Target.createBrowserContext');const {result:{targetId}}=await send('Target.createTarget',{url:'about:blank',browserContextId});
    const {result:{sessionId:s}}=await send('Target.attachToTarget',{targetId,flatten:true});const S=(m,p)=>send(m,p,s);
    await S('Runtime.enable');await S('Page.enable');await S('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await S('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:touch?3:1,mobile:!!touch});
    if(touch)await S('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    const ev=async e=>{const r=await S('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description);return r.result.result.value};
    const tap=async sel=>{const r=await ev(`const b=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2]`);
      await S('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r[0],y:r[1]}]});await S('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})};
    const shot=async f=>{const r=await S('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,f),Buffer.from(r.result.data,'base64'))};
    return {S,ev,tap,shot,nav:u=>S('Page.navigate',{url:u})}}
  const until=async(t,expr,ms=20000)=>{const end=Date.now()+ms;while(Date.now()<end){try{if(await t.ev('return !!('+expr+')'))return true}catch(_){}await sleep(300)}return false};
  const H=await tab(1100,900,false), G=await tab(390,844,true);

  // connect
  await H.nav(base+'/index.html'+(SUF?'?'+SUF.slice(1):''));await sleep(1500);
  await H.ev("document.getElementById('createBtn').click();return 1");
  const link=await H.ev("return document.getElementById('shareLink').value"), hostUrl=await H.ev('return location.href');
  if(SUF)await H.nav(hostUrl+SUF);await sleep(2500);
  // before the friend arrives: taunts and stickers can be tried out on your own screen
  await until(H,"!document.getElementById('prof').classList.contains('hidden')",4000); await H.ev("document.getElementById('prof').classList.add('hidden');return 1");
  await H.ev("document.getElementById('tauntBtn').click();document.querySelector('#tauntChips [data-k=\"0\"]').click();return 1"); await sleep(300);
  check('alone: taunt plays on my screen', await H.ev("return [...document.querySelectorAll('.say.me')].some(d=>d.textContent==='就這？')"));
  check('alone: hint that the friend is not here yet', await H.ev("return document.getElementById('toast').textContent.includes('朋友還沒加入')"));
  await H.ev("document.getElementById('trayBtn').click();document.querySelector('#trayGrid .stk').click();return 1"); await sleep(300);
  check('alone: sticker pops on my screen', await H.ev("return !!document.querySelector('.sticker-show.me')"));
  await H.ev("document.getElementById('chatTabBtn').click();document.getElementById('prof').classList.remove('hidden');return 1");
  await G.nav(link+SUF);
  check('guest connects', await until(G,"typeof state!=='undefined'&&state&&document.querySelector('#conn .dot.on')"));
  check('profile dialog opens the first time', await until(H,"!document.getElementById('prof').classList.contains('hidden')",5000) && await until(G,"!document.getElementById('prof').classList.contains('hidden')",5000));
  await H.ev("document.getElementById('profName').value='比利';document.querySelector('#avGrid [data-av=\"c-TcGFFG6utCk\"]').click();document.getElementById('profSave').click();return 1");
  await G.ev("document.getElementById('profName').value='<b>粗</b>';document.querySelector('#avGrid [data-av=\"n-12\"]').click();document.getElementById('profSave').click();return 1");
  check('host sees the friend name as plain text', await until(H,"document.querySelector('#pOpp .who').textContent.startsWith('<b>粗</b>')&&document.querySelector('#pOpp .av').dataset.id==='n-12'",8000));
  check('guest sees host name and avatar', await until(G,"document.querySelector('#pOpp .who').textContent.startsWith('比利')&&document.querySelector('#pOpp .av').dataset.id==='c-TcGFFG6utCk'",8000));

  // 1. real touch tap flips a piece (host flips first, then guest taps)
  await H.ev("cells[0].click();return 1");
  await until(G,"state.moveNo===1",8000);
  const target=await G.ev("return state.board.findIndex(p=>p&&!p.up)");
  await G.tap(`.cell[data-i="${target}"]`);
  check('guest touch tap flips a piece on host', await until(H,`state.board[${target}].up&&state.moveNo===2`,8000));
  check('status escapes the friend name', await H.ev("return !document.querySelector('#status b b')"));

  // 1b. take-back: guest asks to undo its own move, host agrees
  await until(G,'state.moveNo===2',5000);
  check('undo button only for the player who just moved', await G.ev("return !document.getElementById('undoBtn').disabled") && await H.ev("return document.getElementById('undoBtn').disabled"));
  await G.ev("openSheet('game');return 1"); await sleep(450);
  await G.tap('#undoBtn');
  await G.ev("closeSheet();return 1");
  check('host is asked to agree', await until(H,"!document.getElementById('ask').classList.contains('hidden')&&document.getElementById('askText').textContent.includes('悔棋')",8000));
  await H.ev("document.getElementById('askYes').click();return 1");
  check('take-back applied on both sides', await until(H,`state.moveNo===1&&!state.board[${target}].up`,8000) && await until(G,`state.moveNo===1&&!state.board[${target}].up`,8000));
  // host asks, guest refuses
  await G.ev("const i=state.board.findIndex(p=>p&&!p.up);cells[i].click();return 1"); await until(H,'state.moveNo===2',8000);
  await H.ev("const a=Banqi.legalActions(state,'host').find(x=>x.type==='flip');cells[a.i].click();return 1"); await until(G,'state.moveNo===3',8000);
  await H.ev("document.getElementById('undoBtn').click();return 1");
  check('guest is asked to agree', await until(G,"!document.getElementById('ask').classList.contains('hidden')",8000));
  await G.ev("document.getElementById('askNo').click();return 1"); await sleep(1500);
  check('refused take-back changes nothing', await H.ev('return state.moveNo===3') && await G.ev('return state.moveNo===3'));
  check('host is told it was refused', await H.ev("return document.getElementById('toast').textContent.includes('不同意')"));

  // 2. guest presses New game mid-game (confirm dialog accepted)
  await G.ev("openSheet('game');return 1"); await sleep(450);
  await G.tap('#newBtn');
  await G.ev("closeSheet();return 1");
  check('host is asked to agree to a restart by the guest', await until(H,"!document.getElementById('ask').classList.contains('hidden')&&document.getElementById('askText').textContent.includes('重新開局')",8000));
  await H.ev("document.getElementById('askYes').click();return 1");
  check('guest new game resets both sides', await until(H,"state.moveNo===0",8000) && await until(G,"state.moveNo===0&&state.board.every(p=>!p.up)",8000));
  check('second game starts with the other player', await H.ev("return state.turn==='guest'"));

  // 3. game over: host plants an end position, captures the last black piece
  await H.ev(`const P=(t,c,up=true)=>({t,c,up});const b=Array(32).fill(null);b[0]=P('R','r');b[1]=P('H','b');
    setState({...state,board:b,colors:{host:'r',guest:'b'},turn:'host',moveNo:10,noProgress:0,winner:null,last:null,captured:{r:[],b:[]}},false);return 1`);
  await until(G,"state.moveNo===10",8000);
  await H.ev("cells[0].click();return 1");await sleep(150);await H.ev("cells[1].click();return 1");
  check('host sees win overlay with 勝', await until(H,"!document.getElementById('overlay').classList.contains('hidden')&&document.getElementById('ovStamp').textContent==='勝'",6000));
  check('guest sees lose overlay with 敗', await until(G,"!document.getElementById('overlay').classList.contains('hidden')&&document.getElementById('ovStamp').textContent==='敗'",8000));
  await sleep(800);await G.shot('flow-guest-lose.png');
  check('guest cannot move after game over', await G.ev("cells[0].click();return state.winner==='host'"));

  // 4. rematch from the guest's overlay
  await G.tap('#ovAgain');
  check('rematch: both back to a fresh game', await until(H,"state.moveNo===0&&!state.winner",8000) && await until(G,"state.moveNo===0&&!state.winner",8000));
  check('rematch: overlays closed on both', await H.ev("return document.getElementById('overlay').classList.contains('hidden')") && await G.ev("return document.getElementById('overlay').classList.contains('hidden')"));
  // resign + victory party
  await G.ev("document.getElementById('resignBtn').click();return 1");
  check('resign asks first', await until(G,"!document.getElementById('ask').classList.contains('hidden')",5000));
  await G.ev("document.getElementById('askYes').click();return 1");
  check('host wins by resignation', await until(H,"state.winner==='host'&&state.reason==='resign'&&document.getElementById('ovReason').textContent.includes('認輸')",8000));
  check('winner gets 6 dancers', await until(H,"document.querySelectorAll('#party .dancer').length===6",6000));
  check('loser gets 躺平 / 我沒事', await until(G,"document.querySelectorAll('#party .dancer').length===2",8000));
  await sleep(3000);
  check('Tenor dancing cats load', await H.ev("return [...document.querySelectorAll('#party img')].filter(i=>i.src.includes('tenor')&&i.complete&&i.naturalWidth>0).length>=3"));
  await H.shot('flow-party-win.png'); await G.shot('flow-party-lose.png');
  await G.ev("document.getElementById('ovAgain').click();return 1");
  check('rematch after resign clears the party', await until(H,"!state.winner&&state.moveNo===0&&!document.querySelector('#party .dancer')",8000) && await until(G,"!state.winner&&!document.querySelector('#party .dancer')",8000));
  check('in sync after rematch', await H.ev("return JSON.stringify(forGuest(state).board)")===await G.ev("return JSON.stringify(state.board)"));

  // 5. rules panel
  await G.tap('#rulesBtn');
  check('rules panel opens with 9 rules', await G.ev("return !document.getElementById('rules').classList.contains('hidden')&&document.querySelectorAll('#rulesList li').length===9"));

  // 7. guest cannot see face-down pieces
  check('guest state hides face-down pieces', await G.ev("return state.board.every(p=>!p||p.up||(p.t===undefined&&p.c===undefined))"));

  // 8. guest misses a state (e.g. phone backgrounded): it must catch up by itself
  await G.ev("window.__drop=true;const o=receive;receive=(m,c)=>{if(window.__drop&&m&&m.type==='state')return;o(m,c)};return 1");
  if(await H.ev("return state.turn")!=='host'){ await G.ev("window.__drop=false;const i=state.board.findIndex(p=>p&&!p.up);cells[i].click();return 1"); await until(H,"state.turn==='host'",8000); await sleep(800); await G.ev("window.__drop=true;return 1"); }
  const before=await H.ev("return state.seq");
  await H.ev("const a=Banqi.legalActions(state,'host').find(x=>x.type==='flip');cells[a.i].click();return 1");
  await sleep(600);
  check('dropped state really missed (guest behind)', await G.ev(`return state.seq<${before+1}`) || await H.ev("return state.turn==='host'"));
  await G.ev("window.__drop=false;return 1");
  check('guest catches up without any new move', await until(G,`state.seq===${before+1}`,12000));

  // 9. both press rematch at the same moment -> exactly one reset
  await H.ev(`const P=(t,c,up=true)=>({t,c,up});const b=Array(32).fill(null);b[0]=P('R','r');b[1]=P('H','b');
    setState({...state,board:b,colors:{host:'r',guest:'b'},turn:'host',moveNo:12,noProgress:0,winner:null,last:null,captured:{r:[],b:[]}},false);return 1`);
  await until(G,"state.moveNo===12",8000);
  await H.ev("cells[0].click();return 1");await sleep(150);await H.ev("cells[1].click();return 1");
  await until(G,"state.winner==='host'",8000); await sleep(1200);
  const firstBefore=await H.ev("return state.first");
  await Promise.all([H.ev("document.getElementById('ovAgain').click();return 1"), G.ev("document.getElementById('ovAgain').click();return 1")]);
  await sleep(2500);
  check('simultaneous rematch resets once', await H.ev(`return state.moveNo===0&&state.first!==${JSON.stringify(firstBefore)}`), 'first='+await H.ev('return state.first'));
  check('overlays closed after simultaneous rematch', await H.ev("return document.getElementById('overlay').classList.contains('hidden')") && await until(G,"document.getElementById('overlay').classList.contains('hidden')",5000));

  // 10. host loses its saved game (cleared storage) and reloads: guest must follow the new game
  const oldGid=await H.ev("return state.gid");
  await H.ev("localStorage.clear();return 1"); await H.nav(hostUrl+SUF); await sleep(2500);
  check('host with a new key: guest is told to ask for a new link', await until(G,"document.getElementById('conn').textContent.includes('新的邀請連結')",40000), await G.ev("return document.getElementById('conn').textContent"));
  check('guest did not follow the unknown key', await G.ev(`return state.gid===${JSON.stringify(oldGid)}`));
  console.log('host page:', await H.ev("return location.href+' prof='+!!document.getElementById('prof')+' share='+(document.getElementById('shareLink')||{}).value"));
  const newLink=await H.ev("return document.getElementById('shareLink').value");
  await G.nav(newLink+SUF); await G.ev("const p=document.getElementById('prof');if(p)p.classList.add('hidden');return 1");
  check('guest follows the host again through the new invite link', await until(G,`state.gid===${JSON.stringify(await H.ev('return state.gid'))}`,25000));

  // 11. sticker pops beside the sender's card and never overlaps the board
  await G.ev("document.getElementById('rules').classList.add('hidden');document.getElementById('trayBtn').click();document.querySelector('#trayTabs [data-g=meme]').click();return 1"); await sleep(400);
  await sleep(1300);
  await G.ev("scrollTo(0,0);return 1"); await sleep(300);
  await G.ev("document.querySelector('#trayGrid [data-id=\"n-12\"]').click();return 1"); await sleep(450);
  const geo = sel => `const s=document.querySelector('.sticker-show').getBoundingClientRect(),b=document.querySelector('.board-wrap').getBoundingClientRect(),v=document.querySelector('#${sel} .av').getBoundingClientRect();return {sl:Math.round(s.left),sr:Math.round(s.right),sb:Math.round(s.bottom),bt:Math.round(b.top),al:Math.round(v.left),ar:Math.round(v.right),bub:document.querySelector('.sticker-show').classList.contains('bubble'),ov:(()=>{const r=document.createRange();r.selectNodeContents(document.querySelector('#${sel} .who'));const w=r.getBoundingClientRect();const hit=q=>s.left<q.right&&s.right>q.left&&s.top<q.bottom&&s.bottom>q.top;return hit(v)||hit(w)})()}`;
  const gm=await G.ev(geo('pMe')); await G.shot('flow-sticker-sent.png');
  check('sender (phone): bubble by own card, not covering avatar or name', gm.bub && !gm.ov, JSON.stringify(gm));
  await until(H,"document.querySelector('.sticker-show')",6000); await sleep(350);
  const hm=await H.ev(geo('pOpp')); await H.shot('flow-sticker-recv.png');
  check('receiver (desktop): bubble in the friend card, not covering avatar or name, above the board', hm.bub && !hm.ov && hm.sb<=hm.bt, JSON.stringify(hm));
  // 11b. chat messages pop out next to the sender's avatar
  await sleep(1300);
  await G.ev("document.getElementById('chatInput').value='嗨嗨';document.getElementById('chatForm').requestSubmit();return 1");
  check('chat bubble by the friend avatar', await until(H,"[...document.querySelectorAll('.say.opp.chat')].some(d=>d.textContent==='嗨嗨')",8000));
  check('own chat bubble by my avatar', await G.ev("return [...document.querySelectorAll('.say.me.chat')].some(d=>d.textContent==='嗨嗨')"));

  // 12. paste a Tenor/Giphy link -> animated custom sticker, synced and saved on the other side
  const LINK='https://media.tenor.com/-qBsG1HwR4oAAAA1/cat-dance-dancing-cat.webp';
  await G.ev("scrollTo(0,0);document.getElementById('tray').classList.remove('hidden');document.querySelector('#trayTabs [data-g=\"mine\"]').click();return 1");
  check('mine tab shows the link box', await G.ev("return !document.getElementById('linkForm').classList.contains('hidden')"));
  await G.ev("document.getElementById('linkInput').value='https://tenor.com/view/cat-dance-gif-123';document.getElementById('linkForm').requestSubmit();return 1"); await sleep(300);
  check('Tenor page link gets a how-to hint', await G.ev("return document.getElementById('toast').textContent.includes('複製圖片網址')"));
  await G.ev("document.getElementById('linkInput').value='https://evil.example.com/a.gif';document.getElementById('linkForm').requestSubmit();return 1"); await sleep(300);
  check('other sites are refused', await G.ev("return document.getElementById('toast').textContent.includes('只支援')"));
  check('Giphy page link becomes its media file', await G.ev("return toImageLink('https://giphy.com/gifs/cat-dance-abcDEF12345').url==='https://media.giphy.com/media/abcDEF12345/giphy.webp'"));
  await G.ev(`document.getElementById('linkInput').value=${JSON.stringify(LINK)};document.getElementById('linkForm').requestSubmit();return 1`);
  check('pasted link is added to 我的', await until(G,`customs[0]===${JSON.stringify(LINK)}&&document.querySelector('#trayGrid [data-c="0"] img')`,10000));
  await sleep(1200);
  await G.ev("document.querySelector('#trayGrid [data-c=\"0\"]').click();return 1");
  check('linked sticker shows on the other side', await until(H,`[...document.querySelectorAll('.sticker-show img')].some(i=>i.src===${JSON.stringify(LINK)})`,10000));
  check('other side saved the link', await H.ev(`return JSON.parse(localStorage.getItem('bq-stickers')||'[]').includes(${JSON.stringify(LINK)})`));
  // 13. new theme tabs load
  for (const g of ['nailong','hot','cats','react','meme','qibao']) { const n=await G.ev(`return tabStickers('${g}').length`);
    await G.ev(`document.querySelector('#trayTabs [data-g="${g}"]').click();document.getElementById('trayGrid').scrollTop=0;return 1`);
    const cnt=await G.ev("return document.querySelectorAll('#trayGrid .stk').length");
    const ok=await until(G,"[...document.querySelectorAll('#trayGrid .stk img')].slice(0,3).every(i=>i.complete&&i.naturalWidth>0)",12000);
    check(`tab ${g}: ${cnt} stickers, first ones load`, cnt===n && ok);
  }
  await G.shot('tray-nailong.png');
  check('avatars include 奶龍', await G.ev("return AVATARS.filter(id=>STICKERS.find(s=>s.id===id).group==='nailong').length===STICKERS.filter(s=>s.group==='nailong').length"));

  // 14. taunts: phrases (spoken), sound board, hurry, follow-ups after a big capture, brag
  await H.ev("window.__v=[];const o=playVoice;playVoice=k=>{__v.push(k);return o(k)};return 1");
  await G.ev("window.__v=[];const o=playVoice;playVoice=k=>{__v.push(k);return o(k)};return 1");
  check('recorded voice clips decode', await H.ev("const b=await loadVoice(0);const c=await loadVoice(11);return b.duration>0.3&&c.duration>0.3"));
  await G.ev("scrollTo(0,0);document.getElementById('tray').classList.add('hidden');document.getElementById('tauntBtn').click();return 1");
  check('taunt panel: 10 phrases', await G.ev("return document.querySelectorAll('#tauntChips button').length===10"));
  await sleep(1300);
  await G.ev("document.querySelector('#tauntChips [data-k=\"0\"]').click();return 1");
  check('taunt bubble on the other side', await until(H,"[...document.querySelectorAll('.say.opp')].some(d=>d.textContent==='就這？')",8000));
  check('taunt voice clip played on the other side', await H.ev("return __v.includes(0)"));
  await sleep(1300);
  await G.ev("document.querySelector('#boardChips [data-b=\"1\"]').click();return 1");
  check('sound board reaches the other side', await until(H,"[...document.querySelectorAll('.say.opp')].some(d=>d.textContent===BOARD[1][0])",8000));
  check('sound board plays the MyInstants clip', await H.ev("return boardPlayer.src===boardUrl(1)"));
  check('sound board has 16 sounds (swear word and 館長 removed)', await G.ev("return document.querySelectorAll('#boardChips button').length===16&&!document.getElementById('boardChips').textContent.includes('館長')"));
  check('MyInstants clip is playable', await H.ev("return await new Promise(r=>{const a=new Audio(boardUrl(0));a.oncanplaythrough=()=>r(a.duration>0.3);a.onerror=()=>r(false);setTimeout(()=>r(false),8000)})"));
  if (await H.ev("return state.turn")!=='host') { await G.ev("const i=state.board.findIndex(p=>p&&!p.up);cells[i].click();return 1"); await until(H,"state.turn==='host'",8000); }
  await until(G,"state.turn==='host'",8000);
  await G.ev("turnStart-=20000;updateThink();return 1");
  check('thinking timer on the friend card', await G.ev("return /^想了 [0-9]+ 秒 🐌$/.test((document.querySelector('#pOpp .think')||{}).textContent||'')"), await G.ev("return (document.querySelector('#pOpp .think')||{}).textContent"));
  check('hurry button enabled after 15 s', await G.ev("return !document.getElementById('hurryBtn').disabled&&!document.getElementById('hurryBtn').classList.contains('hidden')"));
  await sleep(1300);
  await G.ev("document.getElementById('hurryBtn').click();return 1");
  check('hurry reaches the other side (snail + 快點啦)', await until(H,"document.querySelector('.snail')&&[...document.querySelectorAll('.say.opp')].some(d=>d.textContent==='快點啦！')",8000));
  await H.shot('flow-hurry.png');
  check('hurry has a cooldown', await G.ev("return document.getElementById('hurryBtn').disabled"));
  await H.ev(`const P=(t,c,up=true)=>({t,c,up});const b=Array(32).fill(null);b[9]=P('R','r');b[10]=P('R','b');b[31]=P('P','b',false);
    setState({...state,board:b,colors:{host:'r',guest:'b'},turn:'host',moveNo:20,noProgress:0,winner:null,last:null,captured:{r:[],b:['R','H']}},false);return 1`);
  await until(G,"state.moveNo===20",8000);
  await H.ev("cells[9].click();return 1");await sleep(120);await H.ev("cells[10].click();return 1");
  check('big capture offers 3 follow-up taunts', await until(H,"!document.getElementById('quick').classList.contains('hidden')&&document.querySelectorAll('#quick button').length===3",4000));
  await H.shot('flow-quick.png');
  await sleep(1300);
  const qt=await H.ev("const b=document.querySelector('#quick button');const t=b.textContent;b.click();return t");
  check('follow-up taunt reaches the other side', await until(G,`[...document.querySelectorAll('.say.opp')].some(d=>d.textContent===${JSON.stringify(qt)})`,8000), qt);
  await sleep(1300);
  await H.ev("document.getElementById('bragBtn').click();return 1");
  check('brag shows my 3 trophies on the other side', await until(G,"!document.getElementById('brag').classList.contains('hidden')&&document.querySelectorAll('#brag .mini').length===3",8000));
  await G.shot('flow-brag.png');

  // 6. local mode
  await H.nav(base+'/index.html?local=1');await sleep(1800);
  await H.ev("localStorage.removeItem('bq-local');return 1");await H.nav(base+'/index.html?local=1');await sleep(1800);
  await H.ev("cells[3].click();return 1");await sleep(700);
  await H.ev("cells[4].click();return 1");await sleep(700);
  check('local mode: two flips by alternating players', await H.ev("return state.moveNo===2&&state.board[3].up&&state.board[4].up&&state.turn==='host'"));
  await H.ev("document.getElementById('undoBtn').click();return 1"); await sleep(400);
  check('local mode: undo takes back the last flip', await H.ev("return state.moveNo===1&&!state.board[4].up&&state.board[3].up"));
  check('local mode: no chat or connection label', await H.ev("return document.getElementById('chatTabBtn').classList.contains('hidden')&&getComputedStyle(document.getElementById('chatForm')).display==='none'&&document.getElementById('conn').classList.contains('hidden')"));

  console.log('page errors:', errs.length?errs:'none');
  console.log(fails?`${fails} FAILED`:'ALL PASSED');
  ch.kill();process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e.message);process.exit(1)});
