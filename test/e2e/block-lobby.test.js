// Per-viewer blocking in public chat, public rooms start at board-only, lobby summary.
require('./lib').run(async ({ tab, until, check, setProfile, sleep, send, base, out }) => {
  const H=await tab(1366,768), W1=await tab(1000,700), W2=await tab(390,844,true), L=await tab(1000,700);
  await L.nav(base+'/index.html');
  await H.nav(base+'/index.html'); await H.ev("document.getElementById('createPubBtn').click();return 1");
  await until(H,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(H,'公開房主');
  const room=await H.ev('return room');
  check('public room starts with board-only spectating', await H.ev("return cfg.watch==='board'&&document.getElementById('cfgWatch').value==='board'"));
  check('lobby shows the waiting room in the summary', await until(L,"document.getElementById('lobbyStats').textContent.includes('1 間在等對手')",30000), await L.ev("return document.getElementById('lobbyStats').textContent"));
  await H.ev("const s=document.getElementById('cfgWatch');s.value='chat';s.dispatchEvent(new Event('change'));return 1"); await sleep(1500);
  for(const [W,n] of [[W1,'吵鬧觀眾'],[W2,'安靜觀眾']]){ await W.nav(base+`/index.html?room=${room}&watch=1`); await until(W,"watchInfo&&lvl==='chat'",15000); await W.ev("document.getElementById('watchNameBtn').click();return 1"); await until(W,"!document.getElementById('prof').classList.contains('hidden')",3000); await setProfile(W,n); }
  check('spectators see the game', await until(W2,"watchInfo&&lvl==='chat'",15000) && await until(W1,"watchInfo&&lvl==='chat'",15000));
  await sleep(1500);
  const post=t=>W1.ev(`document.getElementById('chatInput').value=${JSON.stringify(t)};document.getElementById('chatForm').requestSubmit();return 1`);
  const sees=(T,t)=>T.ev(`return [...document.querySelectorAll('#chatLog .msg')].some(d=>d.textContent.includes(${JSON.stringify(t)}))`);
  await post('第一句很吵'); 
  check('spectator 2 sees the message', await until(W2,`[...document.querySelectorAll('#chatLog .msg')].some(d=>d.textContent.includes('第一句很吵'))`,10000));
  check('name is clickable', await W2.ev("return !!document.querySelector('#chatLog .tag.mutable')"));
  await W2.ev("document.querySelector('#chatLog .tag.mutable').click();return 1");
  await until(W2,"!document.getElementById('ask').classList.contains('hidden')",3000);
  check('block dialog explains it only affects me', await W2.ev("return document.getElementById('askText').textContent.includes('只有你自己看不到')"));
  await W2.ev("document.getElementById('askYes').click();return 1"); await sleep(300);
  check('old messages from that person are removed', !(await sees(W2,'第一句很吵')));
  check('block bar shows 1 person', await W2.ev("return !document.getElementById('muteBar').classList.contains('hidden')&&document.getElementById('muteN').textContent==='1'"));
  await post('第二句還是很吵'); await sleep(3000);
  check('host still sees the message (block is only mine)', await sees(H,'第二句還是很吵'));
  check('blocked person\'s new message is hidden', !(await sees(W2,'第二句還是很吵')));
  await W2.nav(base+`/index.html?room=${room}&watch=1`); await W2.ev("document.getElementById('prof').classList.add('hidden');return 1"); await until(W2,"watchInfo&&lvl==='chat'",15000); await sleep(1500);
  await post('重新整理後第三句'); await sleep(3000);
  check('block survives a reload', !(await sees(W2,'重新整理後第三句')));
  check('sound mute setting untouched', await W2.ev("return typeof muted==='boolean'"));
  await W2.ev("document.getElementById('muteClear').click();return 1"); await sleep(300);
  await post('解除後第四句');
  check('after clearing, messages show again', await until(W2,`[...document.querySelectorAll('#chatLog .msg')].some(d=>d.textContent.includes('解除後第四句'))`,10000));
  // lobby summary with hostile numbers
  const st=await L.ev(`const now=Date.now();for(const k in lobbyRooms)delete lobbyRooms[k];lobbyRooms.a1={room:'aaaaa1',n:'x',st:'play',lvl:'board',aud:3,ts:now};lobbyRooms.a2={room:'aaaaa2',n:'y',st:'play',lvl:'board',aud:'<b>9</b>',ts:now};lobbyRooms.a3={room:'aaaaa3',n:'z',st:'wait',lvl:'off',aud:1e9,ts:now};renderRooms();return document.getElementById('lobbyStats').textContent`);
  check('lobby summary counts and ignores junk numbers', st==='1 間在等對手・2 局對戰中・1002 人觀戰', st);
  const em=await L.ev("for(const k in lobbyRooms)delete lobbyRooms[k];renderRooms();return [document.getElementById('lobbyStats').textContent,document.getElementById('roomList').textContent]");
  check('empty lobby: no zero counts, invites to open a room', em[0]===''&&em[1].includes('開一間'), JSON.stringify(em));
});
