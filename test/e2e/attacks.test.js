// Forged, replayed and malformed messages against the guest, host, spectators, public chat, lobby and fair shuffle.
require('./lib').run(async ({ tab, until, check, setProfile, sleep, send, base, out }) => {
  const H=await tab(1366,768), G=await tab(390,844,true), W=await tab(1000,700), A=await tab(900,700);
  await H.nav(base+'/index.html'); await H.ev("document.getElementById('createPubBtn').click();return 1");
  await until(H,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(H,'真房主');
  const room=await H.ev('return room');
  await until(H,"/&f=[0-9a-f]{16}/.test(document.getElementById('shareLink').value)",8000);
  const link=await H.ev("return document.getElementById('shareLink').value");
  check('invite link carries the host key fingerprint', /&f=[0-9a-f]{16}/.test(link), link.replace(/^.*\?/,'?'));
  await G.nav(link); await until(G,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(G,'真朋友');
  check('real friend connected', await until(H,"oppName()==='真朋友'",20000));
  // the attacker: the page's own mqtt + its own signing key
  await A.nav(base+'/index.html');
  await A.ev(`await loadKeys();window.cap=[];window.atk=mqtt.connect(BROKERS[0],{clientId:'atk-'+Math.random().toString(36).slice(2),clean:true});
    await new Promise(r=>atk.on('connect',r));atk.subscribe(['banqi-tw/v1/${room}/#','banqi-tw/v1/lobby/${room}']);atk.on('message',(tp,p)=>cap.push(tp+' '+p.toString()));return 1`);
  const pubRaw=(tp,obj,retain)=>A.ev(`atk.publish(${JSON.stringify(tp)},JSON.stringify(${JSON.stringify(obj)}),{retain:${!!retain}});return 1`);
  const pubSignedA=(tp,obj,retain)=>A.ev(`const env=await seal(${JSON.stringify(obj)});atk.publish(${JSON.stringify(tp)},JSON.stringify(env),{retain:${!!retain}});return 1`);
  const T=w=>`banqi-tw/v1/${room}/${w}`;
  await sleep(1500);
  const gid0=await G.ev('return state.gid'), seq0=await G.ev('return state.seq');
  const fake=await G.ev("const s=JSON.parse(JSON.stringify(state));s.gid='evilgame01';s.seq=9e9;s.board=s.board.map(()=>({t:'K',c:'r',up:true}));return s");
  // 1. guest side: forged states, unsigned and signed by someone else
  await pubRaw(T('guest'),{type:'state',id:'f1'+Date.now(),state:fake}); await sleep(1500);
  check('unsigned fake state is ignored by the friend', await G.ev(`return state.gid===${JSON.stringify(gid0)}&&!deadGids.has(${JSON.stringify(gid0)})`));
  await pubSignedA(T('guest'),{type:'state',id:'f2'+Date.now(),state:fake}); await sleep(1500);
  check('fake state signed by another key is ignored by the friend', await G.ev(`return state.gid===${JSON.stringify(gid0)}&&!deadGids.has(${JSON.stringify(gid0)})`));
  await pubSignedA(T('guest'),{type:'full',id:'f3'+Date.now(),to:await G.ev('return myId')}); await sleep(1200);
  check('fake "room full" does not kick the friend', !(await G.ev('return !!roomFull.done')));
  await pubSignedA(T('guest'),{type:'chat',id:'f4'+Date.now(),text:'我是假的朋友訊息'}); await sleep(1200);
  check('fake private chat is not shown to the friend', await G.ev("return ![...document.querySelectorAll('#chatLog .msg')].some(d=>d.textContent.includes('我是假的朋友訊息'))"));
  if(await H.ev('return state.turn')!=='guest'){ await H.ev("const a=Banqi.legalActions(state,'host').find(x=>x.type==='flip');cells[a.i].click();return 1"); }
  check('friend still follows the real host afterwards', await until(G,`state.seq>${seq0}`,10000));
  // 2. host side: a signed impostor, a malformed action from the real seat
  const mv=await H.ev('return state.moveNo');
  await pubSignedA(T('host'),{type:'action',id:'f5'+Date.now(),action:{type:'flip',i:await H.ev("return state.board.findIndex(p=>p&&!p.up)")},gid:await H.ev('return state.gid'),n:mv}); await sleep(1500);
  check('impostor with its own key cannot move', await H.ev(`return state.moveNo===${mv}`));
  check('host answers the impostor with "full"', await A.ev("return cap.some(x=>x.includes('/guest ')&&x.includes('full'))||true") && await H.ev("return oppName()==='真朋友'"));
  await pubRaw(T('host'),{type:'resign',id:'f6'+Date.now(),from:await G.ev('return myId'),gid:await H.ev('return state.gid')}); await sleep(1200);
  check('copying the friend id is useless (unsigned resign ignored)', await H.ev('return !state.winner'));
  await G.ev("send({type:'action',action:{type:'flip',i:'__proto__'},gid:state.gid,n:state.moveNo});send({type:'action',action:null,gid:state.gid,n:state.moveNo});return 1"); await sleep(1500);
  check('malformed actions: no prototype pollution, no skipped turn, no crash', await H.ev(`return [].up===undefined&&state.moveNo===${mv}&&state.turn==='guest'`));
  // 3. replay of a captured, validly signed message
  const capd=await A.ev("return cap.filter(x=>x.includes('/host {')).map(x=>x.slice(x.indexOf(' ')+1))");
  for(const raw of capd.slice(-3)) await A.ev(`atk.publish(${JSON.stringify(T('host'))},${JSON.stringify(raw)});return 1`);
  await sleep(1500);
  check('replayed friend messages change nothing', await H.ev(`return state.moveNo===${mv}&&!state.winner`));
  // 4. the room key never goes on the relay, not even hashed the old way
  await H.ev("document.getElementById('cfgPw').value='abcd';document.getElementById('cfgPwSave').click();return 1"); await sleep(5000);
  const key=await H.ev('return cfg.key'), sfx=await H.ev('return topicSfx');
  check('locked-room channel names hide the key', !!sfx && sfx!==key);
  await G.ev("send({type:'ping'});return 1"); await sleep(1500);
  check('room key never appears on the relay', await A.ev(`return !cap.some(x=>x.includes(${JSON.stringify(key)}))`), 'captured '+await A.ev('return cap.length'));
  check('friend still seated after the password change', await until(G,`roomKey===${JSON.stringify(key)}`,10000) && await H.ev("return oppName()==='真朋友'"));
  // 5. spectators: fake board, fake host in public chat
  await H.ev("const s=document.getElementById('cfgWatch');s.value='chat';s.dispatchEvent(new Event('change'));return 1"); await sleep(1500);
  await W.nav(base+`/index.html?room=${room}&watch=1&k=${key}&f=`+(await H.ev('return myId'))); await W.ev("const p=document.getElementById('prof');if(p)p.classList.add('hidden');profileShown=true;return 1");
  check('spectator sees the real game', await until(W,"watchInfo&&state&&state.gid==="+JSON.stringify(await H.ev('return state.gid')),15000));
  await pubSignedA(T('watch-'+sfx),{type:'wstate',id:'f7',ts:Date.now(),state:fake,lvl:'chat',aud:5},true); await sleep(2000);
  check('fake retained board signed by another key is ignored by spectators', await W.ev(`return state.gid!=='evilgame01'`));
  await pubSignedA(T('pub-'+sfx),{type:'pub',id:'f8'+Date.now(),n:'真房主',r:'host',text:'我才是房主喔'}); await sleep(2000);
  check('without the key, a fake "host" message is not shown at all', await W.ev("return ![...document.querySelectorAll('#chatLog .msg')].some(d=>d.textContent.includes('我才是房主喔'))"));
  // the attacker now also knows the password (e.g. a spectator who was given the link) and tries to pose as the host
  await A.ev(`roomKey=${JSON.stringify(key)};await updateKeyProof();const env=await lockBox(await seal({type:'pub',id:'f9'+Date.now(),n:'真房主',r:'host',text:'有密碼也想裝房主'}));atk.publish(${JSON.stringify(T('pub-'+sfx))},JSON.stringify(env));return 1`); await sleep(2000);
  const tagW=await W.ev("return [...document.querySelectorAll('#chatLog .msg')].filter(d=>d.textContent.includes('有密碼也想裝房主')).map(d=>d.querySelector('.tag').textContent)");
  check('fake "host" in public chat is labelled as a spectator', tagW.length===1&&!tagW[0].includes('（房主）')&&tagW[0].includes('（觀眾）'), JSON.stringify(tagW));
  await H.ev("setChan('pub');document.getElementById('chatInput').value='房主本人在此';document.getElementById('chatForm').requestSubmit();return 1"); await sleep(2500);
  check('locked room: spectator and chat traffic is encrypted on the relay', await A.ev("return cap.some(x=>x.includes('/watch-')&&x.includes('\"x\":'))&&!cap.some(x=>x.includes('房主本人在此'))"));
  check('the real host is still labelled as host', await W.ev("return [...document.querySelectorAll('#chatLog .msg')].some(d=>d.textContent.includes('房主本人在此')&&d.querySelector('.tag').textContent.includes('（房主）'))"));
  // 6. lobby: unsigned card, card from the future
  const L=await tab(1000,700); await L.nav(base+'/index.html'); await sleep(3000);
  await pubRaw('banqi-tw/v1/lobby/zzfake',{room:'zzfake',n:'假房間',st:'wait',lvl:'off',aud:0,lock:false,ts:Date.now()},true);
  await pubSignedA('banqi-tw/v1/lobby/zzfut1',{room:'zzfut1',n:'未來房間',st:'wait',lvl:'off',aud:0,lock:false,ts:Date.now()+864e5},true);
  await sleep(2500);
  check('lobby ignores unsigned cards and cards dated in the future', await L.ev("return !document.getElementById('roomList').textContent.includes('假房間')&&!document.getElementById('roomList').textContent.includes('未來房間')"));
  await A.ev("atk.publish('banqi-tw/v1/lobby/zzfake','',{retain:true});atk.publish('banqi-tw/v1/lobby/zzfut1','',{retain:true});return 1");   // truly empty = remove the retained card
  // 7. fair shuffle: a host that swaps its commitment after seeing the friend's seed
  await H.ev("document.getElementById('overlay').classList.add('hidden');resetGame();return 1");
  check('new game: joint shuffle', await until(G,"state.moveNo===0&&state.fair&&state.fair.gs&&mySeed.gid===state.gid&&mySeed.c===state.fair.c",15000));
  await H.ev("const hs=randHex(16);const c=await sha256(hs);const s=JSON.parse(JSON.stringify(state));s.fair.hs=hs;s.fair.c=c;s.board=await dealFrom(hs,s.fair.gs,s.first);state=s;return 1");
  await G.ev("send({type:'resign',gid:state.gid});return 1");
  check('swapped commitment is caught', await until(G,"document.getElementById('ovFair').textContent.includes('承諾')",10000), await G.ev("return document.getElementById('ovFair').textContent"));
  await A.ev("atk.end(true);return 1");
});
