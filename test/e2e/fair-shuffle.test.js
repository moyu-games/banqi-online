// Commit-reveal shuffle: joint seed, secret stays hidden, verification, cheating hosts are caught.
require('./lib').run(async ({ tab, until, check, setProfile, sleep, send, base, out }) => {
  const H=await tab(1366,768), G=await tab(390,844,true), A=await tab(800,600);
  await H.nav(base+'/index.html'); await H.ev("document.getElementById('createBtn').click();return 1");
  await until(H,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(H,'房主');
  const room=await H.ev('return room'), link=await H.ev("return document.getElementById('shareLink').value");
  // eavesdropper on the relay
  await A.nav(base+'/index.html');
  await A.ev(`window.cap=[];window.atk=mqtt.connect(BROKERS[0],{clientId:'eav-'+Math.random().toString(36).slice(2),clean:true});await new Promise(r=>atk.on('connect',r));atk.subscribe('banqi-tw/v1/${room}/#');atk.on('message',(tp,p)=>cap.push(p.toString()));return 1`);
  check('host committed before the friend arrived', await until(H,"state.fair&&state.fair.c&&!state.fair.gs",5000));
  await G.nav(link); await until(G,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(G,'朋友');
  check('joint shuffle done with the friend\'s own seed', await until(G,"state.fair&&state.fair.gs&&state.fair.gs===mySeed.gs",15000));
  check('host board equals the layout rebuilt from both halves', await H.ev("const b=await dealFrom(state.fair.hs,state.fair.gs,state.first);return JSON.stringify(b)===JSON.stringify(state.board)&&state.moveNo===0"));
  const hs=await H.ev('return state.fair.hs');
  check('secret never reaches the friend during the game', await G.ev('return !state.fair.hs'));
  check('secret never goes over the relay during the game', await A.ev(`return !cap.some(x=>x.includes('${hs}'))`), 'captured '+await A.ev('return cap.length'));
  check('shuffle is uniform (general lands on each square ~equally)', await H.ev(`const cnt=Array(32).fill(0);for(let k=0;k<6400;k++){const b=Banqi.newGame('host',seededRnd(randHex(16)+'00000000000000000000000000000000')).board;cnt[b.findIndex(p=>p.t==='K'&&p.c==='r')]++}
    const chi=cnt.reduce((s,c)=>s+(c-200)**2/200,0);return chi<70`), 'chi² over 32 squares');
  const play=async n=>{for(let k=0;k<n;k++){const who=await H.ev('return state.turn');const T=who==='host'?H:G;
    await T.ev(`const L=Banqi.legalActions(state,'${who}'),a=L.find(x=>x.type==='flip')||L[0];if(a.type==='flip')cells[a.i].click();else{cells[a.from].click();cells[a.to].click()}return 1`);
    await until(H,`state.moveNo>=${k+1}+base0`,8000).catch(()=>{});await until(G,'!pend',8000);await sleep(150)}};
  let base0=0; await play(8);
  check('friend logged the flips it saw', await G.ev('return Object.keys(flipLog.f).length>=6'), await G.ev('return Object.keys(flipLog.f).length')+' flips');
  await G.ev("send({type:'resign',gid:state.gid});return 1");
  check('game over: friend verifies the shuffle', await until(G,"document.getElementById('ovFair').textContent.includes('已驗證')",10000), await G.ev("return document.getElementById('ovFair').textContent"));
  check('game over: host sees the joint-shuffle note', await until(H,"document.getElementById('ovFair').textContent.includes('雙方共同洗牌')",5000));
  // 2. a cheating host swaps two hidden pieces mid-game
  await H.ev("document.getElementById('overlay').classList.add('hidden');resetGame();return 1"); await G.ev("document.getElementById('overlay').classList.add('hidden');return 1");
  check('new game: joint shuffle again', await until(G,"state.moveNo===0&&state.fair&&state.fair.gs&&state.fair.gs===mySeed.gs&&mySeed.gid===state.gid",15000));
  const sw=await H.ev(`const s=JSON.parse(JSON.stringify(state)),b=s.board;let i=0,j=b.findIndex(p=>p.c+p.t!==b[0].c+b[0].t);[b[i],b[j]]=[b[j],b[i]];setState(s,false);return [i,j]`);
  await sleep(1200);
  const who=await H.ev('return state.turn'); const T=who==='host'?H:G; base0=await H.ev('return state.moveNo');
  await T.ev(`cells[${sw[0]}].click();return 1`); await until(G,'state.moveNo>=1&&!pend',8000); await sleep(300);
  await G.ev("send({type:'resign',gid:state.gid});return 1");
  check('cheat: friend is warned the layout does not match', await until(G,"document.getElementById('ovFair').textContent.includes('對不上')",10000), await G.ev("return document.getElementById('ovFair').textContent"));
  // 3. a host that reveals a different secret
  await H.ev("document.getElementById('overlay').classList.add('hidden');resetGame();return 1"); await G.ev("document.getElementById('overlay').classList.add('hidden');return 1");
  await until(G,"state.moveNo===0&&state.fair&&state.fair.gs&&mySeed.gid===state.gid",15000); await sleep(500);
  await H.ev("const s=JSON.parse(JSON.stringify(state));s.fair.hs=randHex(16);state=s;return 1");
  await G.ev("send({type:'resign',gid:state.gid});return 1");
  check('fake secret: friend is warned', await until(G,"document.getElementById('ovFair').textContent.includes('承諾對不上')",10000), await G.ev("return document.getElementById('ovFair').textContent"));
  await A.ev("atk.end(true);return 1");
});
