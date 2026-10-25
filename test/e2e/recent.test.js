// "Recent games" on the home page lists only games under way: not empty rooms, finished games or spectating.
require('./lib').run(async ({ tab, until, check, sleep, base }) => {
  const H = await tab(1366, 768);
  const home = async () => { await H.nav(base + '/index.html'); await sleep(1200); };
  const listed = () => H.ev("return [...document.querySelectorAll('#recentList .room')].map(e=>e.textContent)");
  const open = async () => {
    await home(); await H.ev("document.getElementById('createBtn').click();return 1");
    await until(H, 'typeof room==="string"&&room.length===6', 5000); await sleep(800);
    await H.ev("document.getElementById('prof').classList.add('hidden');return 1");
    return H.ev('return room');
  };

  const empty = await open();
  await home();
  check('an empty room is not listed', !(await listed()).some(t => t.includes(empty)));
  check('the section is hidden when nothing is under way', await H.ev("return document.getElementById('recent').classList.contains('hidden')"));

  const live = await open();
  await H.ev('cells[0].click();return 1'); await sleep(1000);
  await home();
  const rows = await listed();
  check('a game with a move is listed', rows.some(t => t.includes(live)) && rows.length === 1);
  check('it says the game is not finished', rows[0] && rows[0].includes('還沒下完'));
  await H.ev(`document.querySelector('#recentList [data-q]').click();return 1`); await sleep(2500);
  check('continue returns to it as host', await H.ev(`return mode==='host'&&room==='${live}'&&state.moveNo===1`));

  await home();
  await H.ev("document.querySelector('#recentList [data-del]').click();return 1"); await sleep(300);
  check('the ✕ removes it', (await listed()).length === 0 && await H.ev("return document.getElementById('recent').classList.contains('hidden')"));

  // finished, stale, spectated and older-format entries never show; at most three are listed
  await H.ev(`const now=Date.now(),q=r=>'?room='+r+'&host=abc123';
    store.set('bq-recent',JSON.stringify([
      {room:'aaaaa1',q:q('aaaaa1'),role:'host',ts:now,st:'live'},{room:'aaaaa2',q:q('aaaaa2'),role:'host',ts:now,st:'live'},
      {room:'aaaaa3',q:q('aaaaa3'),role:'host',ts:now,st:'live'},{room:'aaaaa4',q:q('aaaaa4'),role:'host',ts:now,st:'live'},
      {room:'bbbbb1',q:q('bbbbb1'),role:'host',ts:now,st:'done'},{room:'bbbbb2',q:q('bbbbb2'),role:'host',ts:now-2*864e5,st:'live'},
      {room:'bbbbb3',q:'?room=bbbbb3&watch=1',role:'watch',ts:now,st:'live'},{room:'bbbbb4',q:q('bbbbb4'),role:'host',ts:now}]));renderRecent();return 1`);
  const many = await listed();
  await H.shot('recent-list.png');
  check('at most three, only live ones', many.length === 3 && many.every(t => t.includes('aaaaa')));

  // a finished game drops off the list
  const fin = await open();
  await H.ev('cells[0].click();return 1'); await sleep(800);
  await H.ev("state={...state,winner:'red'};render(false);return 1"); await sleep(300);
  await home();
  check('a finished game is not listed', !(await listed()).some(t => t.includes(fin)));
});
