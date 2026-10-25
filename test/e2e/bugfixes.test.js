// Regression checks for fixed bugs: early resign on one screen, queued dialogs, stale actions, undo naming.
require('./lib').run(async ({ tab, until, check, setProfile, sleep, send, base, out }) => {
  const D=await tab(1366,768);
  // 1. same device: resign before anyone flipped
  await D.nav(base+'/index.html'); await D.ev("localStorage.removeItem('bq-local');return 1"); await D.nav(base+'/index.html?local=1');
  await D.ev("doResign(state.turn);return 1"); await sleep(1200);
  check('same device: resign before any flip shows the winner, no error', await D.ev("return !document.getElementById('overlay').classList.contains('hidden')&&/玩家[一二]獲勝/.test(document.getElementById('ovTitle').textContent)&&/玩家[一二]獲勝/.test(document.getElementById('status').textContent)"), await D.ev("return document.getElementById('ovTitle').textContent+' | '+document.getElementById('status').textContent"));
  await D.nav(base+'/index.html?local=1'); await sleep(800);
  check('same device: reload after that early resign still renders', await D.ev("return document.querySelectorAll('#board .cell').length===32"));
  // 2. dialogs queue instead of replacing each other
  await D.ev("window.__a=ask('第一個問題','好','不要').then(v=>window.__r1=v);window.__b=ask('第二個問題','好','不要').then(v=>window.__r2=v);return 1"); await sleep(300);
  check('first dialog shows first', await D.ev("return document.getElementById('askText').textContent==='第一個問題'"));
  await D.ev("document.getElementById('askYes').click();return 1"); await sleep(300);
  check('second dialog appears after the first is answered', await D.ev("return document.getElementById('askText').textContent==='第二個問題'&&!document.getElementById('ask').classList.contains('hidden')&&window.__r1===true"));
  await D.ev("document.getElementById('askNo').click();return 1"); await sleep(300);
  check('both answers delivered to the right question', await D.ev("return window.__r1===true&&window.__r2===false&&document.getElementById('ask').classList.contains('hidden')"));
  // 3. online: an action from an older game is refused; the guest's own undo is named correctly
  const H=await tab(1366,768), G=await tab(390,844,true);
  await H.nav(base+'/index.html'); await H.ev("document.getElementById('createBtn').click();return 1");
  await until(H,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(H,'房主');
  await until(H,"/&f=/.test(document.getElementById('shareLink').value)",8000);
  const link=await H.ev("return document.getElementById('shareLink').value");
  await G.nav(link); await until(G,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(G,'朋友');
  check('connected', await until(H,"oppName()==='朋友'",20000)); await sleep(1500);
  if(await H.ev('return state.turn')==='host'){ await H.ev("const a=Banqi.legalActions(state,'host').find(x=>x.type==='flip');cells[a.i].click();return 1"); await until(G,"state.turn==='guest'",10000); await sleep(500); }
  const mv=await H.ev('return state.moveNo');
  await G.ev("send({type:'action',action:{type:'flip',i:state.board.findIndex(p=>p&&!p.up)},gid:'oldgame0001',n:state.moveNo});return 1"); await sleep(1500);
  check('action stamped with an older game is refused', await H.ev(`return state.moveNo===${mv}`));
  await G.ev("const i=state.board.findIndex(p=>p&&!p.up);cells[i].click();return 1");
  check('a normal action still goes through', await until(H,`state.moveNo===${mv}+1`,8000)); await until(G,"!pend",8000); await sleep(500);
  await G.ev("document.getElementById('undoBtn').click();return 1");
  check('host is asked about the guest undo', await until(H,"!document.getElementById('ask').classList.contains('hidden')&&document.getElementById('askText').textContent.includes('悔棋')",8000));
  await H.ev("document.getElementById('askYes').click();return 1");
  check('guest sees "you took it back"', await until(G,"[...document.querySelectorAll('.banner')].some(b=>b.textContent.includes('你收回'))",8000), await G.ev("return [...document.querySelectorAll('.banner')].map(b=>b.textContent).join('|')"));
});
