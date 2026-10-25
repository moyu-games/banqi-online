// A spectator is told when the host tab dies without saying goodbye.
require('./lib').run(async ({ tab, until, check, setProfile, sleep, send, base, out }) => {
  const H=await tab(1366,768), W=await tab(1000,700);
  await H.nav(base+'/index.html'); await H.ev("document.getElementById('createBtn').click();return 1");
  await until(H,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(H,'會當掉的房主');
  const room=await H.ev('return room');
  await H.ev("const s=document.getElementById('cfgWatch');s.value='fun';s.dispatchEvent(new Event('change'));return 1"); await sleep(1500);
  await W.nav(base+`/index.html?room=${room}&watch=1`); await W.ev("document.getElementById('prof').classList.add('hidden');return 1");
  check('spectator sees the game', await until(W,"watchInfo",15000));
  H.S('Page.crash').catch(()=>{}); await sleep(500);   // (not awaited: a crashed tab never answers) the host tab dies without any goodbye (like a phone killing a background tab)
  const t0=Date.now();
  const ok=await until(W,"document.getElementById('conn').textContent.includes('離線')",130000);
  check('spectator is told the host seems offline', ok, Math.round((Date.now()-t0)/1000)+' s after the crash');
});
