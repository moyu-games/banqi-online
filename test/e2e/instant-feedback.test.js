// The guest's taps answer at once over the relay; lost, repeated and refused actions.
require('./lib').run(async ({ tab, until, check, setProfile, sleep, send, base, out }) => {
  const suffix=process.argv[4]||'&relay';
  const H=await tab(1366,768), G=await tab(390,844,true);
  await H.nav(base+'/index.html?'+suffix.slice(1)); await H.ev("document.getElementById('createBtn').click();return 1");
  await until(H,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(H,'房主');
  const link=(await H.ev("return document.getElementById('shareLink').value"))+suffix;
  await G.nav(link); await until(G,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(G,'朋友');
  check('connected over '+suffix, await until(H,"oppName()==='朋友'",20000)); await sleep(2500);
  const inSync=()=>Promise.all([H.ev("return JSON.stringify(forGuest(state).board)+state.moveNo"),G.ev("return JSON.stringify(state.board)+state.moveNo")]).then(([a,b])=>a===b);
  const hostFlip=async()=>{await H.ev("const L=Banqi.legalActions(state,'host'),a=L.find(x=>x.type==='flip')||L[0];if(a.type==='flip')cells[a.i].click();else{cells[a.from].click();cells[a.to].click()}return 1");await until(G,"state.turn==='guest'&&!pend",10000);await sleep(200)};
  const guestFlip=async()=>{await G.ev("const L=Banqi.legalActions(state,'guest'),a=L.find(x=>x.type==='flip')||L[0];if(a.type==='flip')cells[a.i].click();else{cells[a.from].click();cells[a.to].click()}return 1");await until(H,"state.turn==='host'",10000);await until(G,"!pend",10000);await sleep(200)};
  const guestHasMove="Banqi.legalActions(state,'guest').some(a=>a.type==='move'&&!state.board[a.to])";
  // 1. flip: the piece lifts at once, then turns over when the host answers
  if(await H.ev('return state.turn')==='host') await hostFlip();
  const f=await G.ev(`const i=state.board.findIndex(p=>p&&!p.up),n=state.moveNo,t0=performance.now();cells[i].click();
    const lift=await new Promise(r=>requestAnimationFrame(()=>r(cells[i].querySelector('.piece').classList.contains('pending'))));
    const done=await new Promise(r=>{const f=()=>{if(state.moveNo!==n)r(Math.round(performance.now()-t0));else if(performance.now()-t0>8000)r(-1);else requestAnimationFrame(f)};f()});
    await new Promise(r=>requestAnimationFrame(r));
    return {lift,done,after:!!cells[i].querySelector('.piece.pending'),up:state.board[i].up}`);
  check('flip: piece lifts on the very next frame', f.lift);
  check('flip: turns over when the host answers, lift removed', f.done>0&&!f.after&&f.up, JSON.stringify(f));
  await until(H,"state.turn==='host'",8000); await sleep(300);
  check('in sync after the flip', await inSync());
  // 2. double tap: a second tap while waiting does nothing
  await hostFlip();
  const mv0=await H.ev('return state.moveNo');
  await G.ev("const d=state.board.map((p,i)=>p&&!p.up?i:-1).filter(i=>i>=0);cells[d[0]].click();cells[d[1]].click();cells[d[1]].click();return 1");
  await sleep(2500);
  check('rapid taps: host applied exactly one action', await H.ev(`return state.moveNo===${mv0}+1`), 'moveNo '+mv0+' → '+await H.ev('return state.moveNo'));
  check('in sync after rapid taps', await inSync());
  // play flips until the guest has a plain move
  // set up a board with empty squares (a fresh board is full, so nobody can move yet)
  const setup=async()=>{await H.ev("const s=JSON.parse(JSON.stringify(state));s.board=s.board.map((p,i)=>i%4===1?null:p);s.board.forEach(p=>p&&(p.up=true));s.turn='guest';s.last=null;setState(s,false);return 1");await until(G,"state.turn==='guest'&&!state.board[1]",8000);await sleep(300)};
  await setup();
  check('guest has a move to make', await G.ev('return state.turn==="guest"&&'+guestHasMove));
  // 3. move: shown at once
  const m=await G.ev(`const a=Banqi.legalActions(state,'guest').find(a=>a.type==='move'&&!state.board[a.to]);const sig=JSON.stringify(state.board[a.from]),t0=performance.now();
    cells[a.from].click();cells[a.to].click();const shown=JSON.stringify(state.board[a.to])===sig&&!state.board[a.from];const ms=Math.round(performance.now()-t0);
    const n0=state.moveNo; await new Promise(r=>{const f=()=>{if(!pend||performance.now()-t0>8000)r();else requestAnimationFrame(f)};f()});
    return {shown,ms,confirm:Math.round(performance.now()-t0),still:JSON.stringify(state.board[a.to])===sig}`);
  check('move: board shows it immediately', m.shown&&m.ms<50, m.ms+' ms to show, host confirmed after '+m.confirm+' ms');
  check('move: still there after the host confirms', m.still);
  await sleep(500); check('in sync after the move', await inSync());
  // 4. a lost message is re-sent
  await setup();
  await G.ev("window.__drop=1;const o=send;window.send=send=function(x){if(x.type==='action'&&window.__drop>0){window.__drop--;return}return o(x)};return 1");
  const mv1=await H.ev('return state.moveNo');
  await G.ev("const L=Banqi.legalActions(state,'guest'),a=L.find(x=>x.type==='flip')||L[0];if(a.type==='flip')cells[a.i].click();else{cells[a.from].click();cells[a.to].click()}return 1");
  check('first send lost: retry gets through', await until(H,`state.moveNo===${mv1}+1`,8000));
  await until(G,"!pend",8000); check('in sync after the retry', await inSync());
  // 5. everything lost: gives up, puts the board back, tells the player
  await setup();
  if(await G.ev('return '+guestHasMove)){
    await G.ev("window.__drop=9;return 1");
    const before=await G.ev('return JSON.stringify(state.board)');
    await G.ev(`const a=Banqi.legalActions(state,'guest').find(a=>a.type==='move'&&!state.board[a.to]);cells[a.from].click();cells[a.to].click();return 1`);
    check('total loss: move shown while trying', await G.ev(`return JSON.stringify(state.board)!==${JSON.stringify(before)}`));
    check('total loss: gives up and restores the board', await until(G,`!pend&&JSON.stringify(state.board)===${JSON.stringify(before)}`,12000));
    check('total loss: player is told', await G.ev("return document.getElementById('toast').textContent.includes('沒送到')"));
    await G.ev("window.__drop=0;return 1");
  } else console.log('skip total-loss (no plain move)');
  // 6. host refuses a move the guest showed early: guest board goes back
  await setup();
  if(await G.ev('return state.turn==="guest"&&'+guestHasMove)){
    await H.ev("const oa=Banqi.apply;window.__rej=1;Banqi.apply=(s,r,a)=>{if(r==='guest'&&window.__rej&&a.type==='move')return{ok:false,err:'x'};return oa(s,r,a)};return 1");
    const before=await G.ev('return JSON.stringify(state.board)');
    await G.ev(`const a=Banqi.legalActions(state,'guest').find(a=>a.type==='move'&&!state.board[a.to]);cells[a.from].click();cells[a.to].click();return 1`);
    check('refused move: guest board restored', await until(G,`!pend&&JSON.stringify(state.board)===${JSON.stringify(before)}`,8000));
    check('refused move: guest can play again', await G.ev("return state.turn==='guest'&&!pend"));
    check('in sync after the refusal', await inSync());
  } else console.log('skip refusal (no plain move)');
});
