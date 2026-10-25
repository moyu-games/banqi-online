// Forged messages against the host, the room key on the relay, spectator limits, photo filtering.
require('./lib').run(async ({ tab, until, check, setProfile, sleep, send, base, out }) => {
  const H=await tab(1366,768), G=await tab(390,844,true), A=await tab(1000,700), W=await tab(1000,700);
  await H.nav(base+'/index.html'); await H.ev("document.getElementById('createBtn').click();return 1");
  await until(H,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(H,'房主');
  const room=await H.ev('return room'), link=await H.ev("return document.getElementById('shareLink').value");
  await G.nav(link); await until(G,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(G,'真朋友');
  check('real friend connected', await until(H,"oppName()==='真朋友'",20000));
  // attacker: a raw MQTT client on the same broker (uses the page's own mqtt.js)
  await A.nav(base+'/index.html');
  await A.ev(`window.cap=[];window.atk=mqtt.connect(BROKERS[0],{clientId:'atk-'+Math.random().toString(36).slice(2),clean:true});
    await new Promise(r=>atk.on('connect',r));atk.subscribe('banqi-tw/v1/${room}/#');atk.on('message',(tp,p)=>cap.push(tp+' '+p.toString()));return 1`);
  const pub=(who,obj)=>A.ev(`atk.publish('banqi-tw/v1/${room}/${who}',JSON.stringify(Object.assign({id:Math.random().toString(36).slice(2)},${JSON.stringify(obj)})));return 1`);
  if(await H.ev('return state.turn')!=='guest'){ await H.ev("const a=Banqi.legalActions(state,'host').find(x=>x.type==='flip');cells[a.i].click();return 1"); await sleep(1500); }
  const mv1=await H.ev('return state.moveNo');
  const flipI=await H.ev("return state.board.findIndex(p=>p&&!p.up)");
  await pub('host',{type:'action',action:{type:'flip',i:flipI}}); await sleep(1500);
  check('forged move without sender is ignored', await H.ev(`return state.moveNo===${mv1}`));
  await pub('host',{type:'resign',gid:await H.ev('return state.gid')}); await sleep(1500);
  check('forged resign is ignored', await H.ev('return !state.winner'));
  await pub('host',{type:'profile',pf:{n:'冒牌貨',a:'n-1'}}); await sleep(1500);
  check('forged profile is ignored', await H.ev("return oppName()==='真朋友'"));
  await pub('host',{type:'action',from:'impostor99',action:{type:'flip',i:flipI}}); await sleep(1500);
  check('impostor with another id cannot move', await H.ev(`return state.moveNo===${mv1}`));
  check('unsigned impostor gets no answer at all', await A.ev("return !cap.some(x=>x.includes('impostor99')&&x.includes('full'))"));
  check('real friend still seated', await H.ev("return oppName()==='真朋友'&&!!cfg.guest&&cfg.guest!=='impostor99'"));
  // the room key must never appear on the relay
  await H.ev("document.getElementById('cfgPw').value='abcd';document.getElementById('cfgPwSave').click();return 1"); await sleep(6000);
  const key=await H.ev('return cfg.key');
  check('room key never sent over the relay', await A.ev(`return !cap.some(x=>x.includes('"rk":"${key}"'))`), 'captured '+await A.ev('return cap.length')+' messages');
  check('friend still follows the new key (via the direct link)', await until(G,`roomKey==='${key}'`,10000));
  // spectator cannot edit the host card or send on the game channel
  await H.ev("const s=document.getElementById('cfgWatch');s.value='fun';s.dispatchEvent(new Event('change'));return 1");
  await W.nav(base+`/index.html?room=${room}&watch=1&k=${key}`); await W.ev("document.getElementById('prof').classList.add('hidden');return 1");
  check('spectator with the key sees the game', await until(W,"watchInfo",15000));
  await W.ev("document.getElementById('pMe').click();return 1"); await sleep(400);
  check('spectator cannot open the profile editor on the host card', await W.ev("return document.getElementById('prof').classList.contains('hidden')"));
  const capN=await A.ev('return cap.length'); await W.ev("send({type:'profile'});send({type:'chat',text:'x'});return 1"); await sleep(1500);
  const gpub=await G.ev('return myPub'); const leak=await A.ev(`return cap.slice(${capN}).filter(x=>x.includes('/host ')&&!x.includes(${JSON.stringify(gpub)}))`);
  check('spectator sends nothing on the game channel', leak.length===0, leak.length?leak[0].slice(0,160):'');
  // a photo from an old client is never forwarded to spectators; built-in stickers still are
  const capM=await A.ev('return cap.length');
  await G.ev("send({type:'sticker',url:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='});return 1"); await sleep(1300);
  await G.ev("send({type:'sticker',sid:'n-1'});return 1"); await sleep(3000);
  check('photo never shown to the spectator', await W.ev("return ![...document.querySelectorAll('.sticker-show img')].some(i=>i.src.startsWith('data:'))"));
  check('built-in sticker still reaches spectators', await until(W,"[...document.querySelectorAll('.sticker-show img')].some(i=>i.src.includes('stickers/01'))",8000));
  await A.ev("atk.end(true);return 1");
});
