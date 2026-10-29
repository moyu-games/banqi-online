// A phone that leaves the browser mid-game and comes back: the page is frozen and its connections die, sometimes
// it is reloaded. Both players must end up on the same game, able to move, within a few seconds of coming back.
// The guest uses only the relay, as a phone on mobile data often must (no direct WebRTC link through the carrier).
// Host and guest run in two separate Chrome processes, like two devices.
require('./lib').run(async ({ tab, browser, until, check, sleep, base }) => {
  const gb = await browser();
  let H = await tab(1100, 900), G = await gb.tab(390, 844, true);
  await H.nav(base + '/index.html');
  await H.ev("document.getElementById('createBtn').click();return 1"); await sleep(1500);
  await H.ev("document.getElementById('prof').classList.add('hidden');return 1");
  const link = await H.ev("return document.getElementById('shareLink').value"), hostUrl = await H.ev('return location.href');
  await G.nav(link + (process.env.GSUF ?? '&relay=1'));
  await G.ev("const p=document.getElementById('prof');if(p)p.classList.add('hidden');return 1");
  check('guest joins', await until(G, "state && document.querySelector('#conn .dot.on')", 30000));

  const T = who => (who === 'host' ? H : G);
  const synced = () => H.ev('return JSON.stringify(forGuest(state).board)+state.gid+state.moveNo').then(async h => h === await G.ev('return state&&JSON.stringify(state.board)+state.gid+state.moveNo'));
  async function play(n) {   // n plies, whoever's turn; flips and moves through real clicks
    for (let k = 0; k < n; k++) {
      const turn = await H.ev("return state.winner?'over':state.turn"); if (turn === 'over') return;
      const P = T(turn), n0 = await H.ev('return state.moveNo');
      const a = await P.ev("const as=Banqi.legalActions(state,state.turn);return as[Math.floor(Math.random()*as.length)]");
      const click = i => P.ev(`document.querySelector('.cell[data-i="${i}"]').click();return 1`);
      if (a.type === 'flip') await click(a.i); else { await click(a.from); await sleep(150); await click(a.to); }
      if (!await until(H, `state.moveNo>${n0}`, 15000) || !await until(G, `state && state.moveNo>${n0}`, 15000)) return false;
    }
    return true;
  }
  // "leave the browser": freeze the page, as a phone does to a background tab. It stops answering the brokers' keepalive,
  // so after ~30-45 s they drop it and it wakes up to dead sockets. (Chrome's offline emulation is not used: it leaks
  // into the other tab of the same browser.)
  // netLag: the phone's network is still waking up, so every connection attempt fails for that long after it returns
  async function away(P, secs, netLag = 0) {
    if (netLag) await P.ev(`if(!window.__realConnect){window.__realConnect=mqtt.connect;mqtt.connect=(u,o)=>__realConnect(Date.now()<__netDownUntil?'wss://127.0.0.1:9/mqtt':u,o)}
      window.__netDownUntil=Date.now()+${(secs + netLag) * 1000};return 1`);
    await P.S('Page.setWebLifecycleState', { state: 'frozen' });
    await sleep(secs * 1000);
    await P.S('Page.setWebLifecycleState', { state: 'active' });
    await P.ev("document.dispatchEvent(new Event('visibilitychange'));return 1");
  }
  async function recovered(label, limit = 15) {
    const t0 = Date.now();
    const ok = await until(H, 'true', 1) && await (async () => { const end = Date.now() + 60000; while (Date.now() < end) { if (await synced().catch(() => false)) return true; await sleep(500); } return false; })();
    const s1 = ((Date.now() - t0) / 1000).toFixed(1);
    const moved = ok && await play(2);
    const s2 = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`   ${label}: same board after ${s1}s, two more moves done after ${s2}s`);
    check(label + ': both screens show the same game', ok, s1 + 's');
    check(label + ': play goes on', !!moved);
    check(label + ': back within ' + limit + ' s', ok && moved && +s2 <= limit, s2 + 's');
  }

  check('opening moves', await play(4));
  for (const [who, secs] of [['guest', 8], ['guest', 70], ['host', 8], ['host', 70]]) {
    // the other side moves while this one is away, when it is their turn
    await away(T(who), secs);
    await recovered(`${who} away ${secs}s`);
  }
  // back from the background before the network is: the first reconnects fail
  for (const lag of [2, 6]) await away(G, 70, lag), await recovered(`guest away 70s, network back ${lag}s late`);
  for (const lag of [2, 6]) await away(H, 70, lag), await recovered(`host away 70s, network back ${lag}s late`);
  // the phone browser drops the tab and reloads it on return
  await G.nav(link + (process.env.GSUF ?? '&relay=1')); await recovered('guest page reloaded');
  await H.nav(hostUrl); await recovered('host page reloaded');
  // the friend comes back in a browser that kept nothing (e.g. tapped the invite again and it opened in a new in-app browser)
  {
    await G.S('Page.close'); await sleep(13000);   // the old page is gone; the host stops hearing it
    G = await gb.tab(390, 844, true); await G.nav(link + (process.env.GSUF ?? '&relay=1'));
    await G.ev("const p=document.getElementById('prof');if(p)p.classList.add('hidden');return 1");
    check('the friend is told to wait for the host, not that the room is full', await until(G, "document.getElementById('conn').textContent.includes('等房主同意')", 20000));
    check('the host is asked to let them take over', await until(H, "!document.getElementById('ask').classList.contains('hidden')&&document.getElementById('askText').textContent.includes('接手')", 10000));
    await H.ev("document.getElementById('askYes').click();return 1");
    await recovered('guest back in a fresh browser, host lets them in');
    // a host link opened in a browser that never had the room says so instead of quietly starting over
    const F = await tab(1000, 800); await F.nav(hostUrl);
    check('a host link in another browser explains the new board', await until(F, "!document.getElementById('ask').classList.contains('hidden')&&document.getElementById('askText').textContent.includes('沒有這局的紀錄')", 8000));
    await F.S('Page.close');
  }
  // both away at once
  await Promise.all([away(H, 70), away(G, 70)]); await recovered('both away 70s');
}, {
  // Unfreezing a page from DevTools leaves it throttled like a background tab (timers about once a minute), which a
  // phone brought back to the front is not; so background throttling is off for this test.
  flags: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
