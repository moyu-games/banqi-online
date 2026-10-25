// A waiting room leaves the lobby when its host goes idle, comes back when the host returns, and leaves at once when the tab closes.
require('./lib').run(async ({ tab, until, check, setProfile, sleep, base }) => {
  const L = await tab(1000, 700), H = await tab(1366, 768);
  await L.nav(base + '/index.html');
  await H.nav(base + '/index.html'); await H.ev("document.getElementById('createPubBtn').click();return 1");
  await until(H, "!document.getElementById('prof').classList.contains('hidden')", 5000); await setProfile(H, '閒置測試房主');
  const room = await H.ev('return room');
  const listed = () => L.ev(`return !!document.querySelector('#roomList [data-join="${room}"]')`);
  check('new public room shows in the lobby', await until(L, `document.querySelector('#roomList [data-join="${room}"]')`, 30000));
  // host idle for 11 minutes (simulated) with nobody joined
  await H.ev("lastActive=Date.now()-11*60000;pubLobby(true);return 1");
  check('idle waiting room leaves the lobby', await until(L, `!document.querySelector('#roomList [data-join="${room}"]')`, 15000));
  check('host is told why and how to come back', await until(H, "document.getElementById('conn').textContent.includes('已從大廳隱藏')", 5000));
  await sleep(31000);
  check('it stays hidden through the 30 s refresh', !(await listed()));
  // the host comes back
  await H.ev("document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return 1");
  check('any input brings the room back to the lobby', await until(L, `document.querySelector('#roomList [data-join="${room}"]')`, 15000));
  check('host notice cleared', await H.ev("return !document.getElementById('conn').textContent.includes('已從大廳隱藏')"));
  // hidden tab for 6 minutes (simulated)
  await H.ev("hiddenSince=Date.now()-6*60000;pubLobby(true);return 1");
  check('a tab hidden for over 5 minutes leaves the lobby too', await until(L, `!document.querySelector('#roomList [data-join="${room}"]')`, 15000));
  await H.ev("hiddenSince=0;document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return 1");
  await until(L, `document.querySelector('#roomList [data-join="${room}"]')`, 15000);
  // closing the tab takes the card down right away (not after the broker's ~45 s timeout)
  const t0 = Date.now();
  await H.nav('about:blank');
  check('closing the host tab removes the card within 10 s', await until(L, `!document.querySelector('#roomList [data-join="${room}"]')`, 10000), Math.round((Date.now() - t0) / 1000) + ' s');
});
