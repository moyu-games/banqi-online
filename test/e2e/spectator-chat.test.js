// Spectator levels, public vs private chat in every direction, host badge, emoji bubbles.
require('./lib').run(async ({ tab, until, check, setProfile, sleep, send, base, out }) => {
  const H=await tab(1366,768), G=await tab(390,844,true), W1=await tab(1200,760), W2=await tab(390,844,true), E=await tab(800,600);
  await H.nav(base+'/index.html'); await H.ev("document.getElementById('createPubBtn').click();return 1");
  await until(H,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(H,'房主');
  const room=await H.ev('return room'), link=await H.ev("return document.getElementById('shareLink').value");
  await E.nav(base+'/index.html');
  await E.ev(`window.cap=[];window.atk=mqtt.connect(BROKERS[0],{clientId:'eav-'+Math.random().toString(36).slice(2),clean:true});await new Promise(r=>atk.on('connect',r));atk.subscribe('banqi-tw/v1/${room}/#');atk.on('message',(tp,p)=>cap.push(tp+' '+p.toString()));return 1`);
  await G.nav(link); await until(G,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(G,'朋友');
  check('friend connected', await until(H,"oppName()==='朋友'",20000));
  const W3=await tab(1000,700,false,H.ctx);   // a spectator tab in the host's own browser
  const specs=[[W1,'電腦觀眾'],[W2,'手機觀眾'],[W3,'同瀏覽器觀眾']];
  for(const [W] of specs) await W.nav(base+`/index.html?room=${room}&watch=1`);
  for(const [W,n] of specs) check(n+': sees the board', await until(W,"watchInfo&&state",15000));
  check('host counts 3 spectators', await until(H,"audN===3",30000), 'audN='+await H.ev('return audN'));
  for(const [W] of specs) await W.ev("window.__stk=0;const o=showSticker;showSticker=function(...a){__stk++;return o.apply(this,a)};return 1");
  const chatShown=W=>W.ev("const c=document.getElementById('chatCard');const bar=document.querySelector('#actbar [data-m=chat]');return (!c.classList.contains('hidden')&&getComputedStyle(c).display!=='none')||(!!bar&&!bar.classList.contains('hidden')&&getComputedStyle(document.getElementById('actbar')).display!=='none')");
  const setLvl=async l=>{await H.ev(`const s=document.getElementById('cfgWatch');s.value='${l}';s.dispatchEvent(new Event('change'));return 1`);for(const [W] of specs) await until(W,`lvl==='${l}'`,15000);await until(G,`lvl==='${l}'`,15000);await sleep(800)};
  // host badge
  const tagOn=(T,id)=>T.ev(`return getComputedStyle(document.querySelector('#${id} .host-tag')).display==='block'`);
  check('host badge: host sees it on own card only', await tagOn(H,'pMe') && !(await tagOn(H,'pOpp')));
  check('host badge: friend sees it on the host card only', await tagOn(G,'pOpp') && !(await tagOn(G,'pMe')));
  check('host badge: spectator sees it on the host card only', await tagOn(W1,'pMe') && !(await tagOn(W1,'pOpp')));
  // board only
  check('default level is board only', await H.ev("return cfg.watch==='board'"));
  await H.ev("send({type:'sticker',sid:'n-1'});showSticker({sid:'n-1'},true);return 1"); await sleep(2500);
  for(const [W,n] of specs) check(n+' (board): no stickers, no chat box', await W.ev('return __stk===0') && !(await chatShown(W)));
  // fun
  await setLvl('fun');
  await H.ev("send({type:'sticker',sid:'n-2'});showSticker({sid:'n-2'},true);return 1");
  for(const [W,n] of specs) check(n+' (fun): sees the sticker, still no chat box', await until(W,'__stk>=1',8000) && !(await chatShown(W)));
  // chat
  await setLvl('chat');
  for(const [W,n] of specs) check(n+' (chat): chat box available', await chatShown(W));
  check('players get the public/private switch', await H.ev("return !document.getElementById('chanRow').classList.contains('hidden')") && await G.ev("return !document.getElementById('chanRow').classList.contains('hidden')"));
  await W1.ev("document.getElementById('chatInput').value='還沒取名就想講話';document.getElementById('chatForm').requestSubmit();return 1");
  check('unnamed spectator is asked for a name before the first message', await until(W1,"!document.getElementById('prof').classList.contains('hidden')",3000));
  check('typed message is kept while naming', await W1.ev("return document.getElementById('chatInput').value==='還沒取名就想講話'"));
  await setProfile(W1,'電腦觀眾'); await W1.ev("document.getElementById('chatInput').value='';return 1");
  check('spectator name shown above the chat box', await W1.ev("return document.getElementById('watchNameV').textContent==='電腦觀眾'&&!document.getElementById('watchName').classList.contains('hidden')"));
  for(const [W,n] of specs.slice(1)){ await W.ev("document.getElementById('watchNameBtn').click();return 1"); check(n+': rename button opens the name dialog', await until(W,"!document.getElementById('prof').classList.contains('hidden')",3000)); await setProfile(W,n); }
  const all=[[H,'房主'],[G,'朋友'],...specs];
  const cnt=(T,t)=>T.ev(`return [...document.querySelectorAll('#chatLog .msg')].filter(d=>d.textContent.includes(${JSON.stringify(t)})).length`);
  const post=async(T,t,ch)=>{ if(ch) await T.ev(`setChan('${ch}');return 1`); await T.ev(`document.getElementById('chatInput').value=${JSON.stringify(t)};document.getElementById('chatForm').requestSubmit();return 1`); };
  const expectAll=async(t,label)=>{ await sleep(3500); for(const [T,n] of all){ const c=await cnt(T,t); check(label+' → '+n+' sees it exactly once', c===1, 'count '+c); } };
  await post(H,'房主公開說哈囉','pub'); await expectAll('房主公開說哈囉','host public');
  await post(G,'朋友公開說嗨','pub'); await expectAll('朋友公開說嗨','friend public');
  await post(W1,'電腦觀眾來了'); await expectAll('電腦觀眾來了','desktop spectator');
  await post(W2,'手機觀眾加一'); await expectAll('手機觀眾加一','phone spectator');
  await post(W3,'同瀏覽器觀眾說話'); await expectAll('同瀏覽器觀眾說話','same-browser spectator');
  const tagsG=await G.ev("return [...document.querySelectorAll('#chatLog .msg.pub .tag')].map(t=>t.textContent)");
  check('chat labels: host and spectators marked', tagsG.some(t=>t.includes('房主（房主）'))&&tagsG.some(t=>t.includes('電腦觀眾（觀眾）'))&&tagsG.some(t=>t.includes('同瀏覽器觀眾（觀眾）')), JSON.stringify(tagsG));
  // private stays private
  await post(H,'這句只給朋友看','priv'); await sleep(3500);
  check('private: friend sees it', await cnt(G,'這句只給朋友看')===1);
  for(const [W,n] of specs) check('private: '+n+' does not see it', await cnt(W,'這句只給朋友看')===0);
  check('private: never on the spectator or public channels', await E.ev("return !cap.some(x=>(x.includes('/watch')||x.includes('/pub'))&&x.includes('這句只給朋友看'))"));
  await post(G,'朋友私下回覆','priv'); await sleep(3500);
  check('private reply: host sees it', await cnt(H,'朋友私下回覆')===1);
  for(const [W,n] of specs) check('private reply: '+n+' does not see it', await cnt(W,'朋友私下回覆')===0);
  // emoji like stickers
  await G.ev("floatEmoji(EMOJI[0],true);send({type:'react',e:EMOJI[0]});return 1");
  check('emoji: bubble beside the sender (friend)', await G.ev("return !!document.querySelector('.sticker-show.me.emoji .emo-big')"));
  check('emoji: bubble beside the friend card (host)', await until(H,"document.querySelector('.sticker-show.opp.emoji .emo-big')",4000));
  check('emoji: bubble beside the friend card (spectator)', await until(W1,"document.querySelector('.sticker-show.opp.emoji .emo-big')",5000));
  // level goes down again
  await setLvl('board');
  for(const [W,n] of specs) check(n+' (back to board): chat box gone', !(await chatShown(W)));
  check('players lose the public switch and fall back to private', await H.ev("return document.getElementById('chanRow').classList.contains('hidden')&&chan==='priv'"));
  await E.ev(`atk.publish('banqi-tw/v1/${room}/pub',JSON.stringify({type:'pub',id:'x'+Date.now(),w:'eve12345',n:'路人',r:'watch',text:'關掉後硬塞的訊息'}));return 1`); await sleep(2500);
  for(const [T,n] of all) check('after closing: '+n+' ignores a stray public message', await cnt(T,'關掉後硬塞的訊息')===0);
  await E.ev("atk.end(true);return 1");
});
