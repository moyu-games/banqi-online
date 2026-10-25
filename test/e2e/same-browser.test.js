// Host and guest as two tabs of one browser keep separate names, avatars and identities.
require('./lib').run(async ({ tab, until, check, setProfile, sleep, send, base, out }) => {
  const H=await tab(1366,768);
  await H.nav(base+'/index.html'); await H.ev("document.getElementById('createBtn').click();return 1");
  await until(H,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(H,'房主A');
  const link=await H.ev("return document.getElementById('shareLink').value"), hostId=await H.ev('return myId');
  const G=await tab(390,844,true,H.ctx);   // same browser, second tab
  await G.nav(link);
  check('second tab in the same browser asks for its own name', await until(G,"!document.getElementById('prof').classList.contains('hidden')",5000));
  check('second tab starts with a different name', await G.ev("return profile.name!=='房主A'"));
  await setProfile(G,'朋友B');
  check('host sees the friend\'s own name', await until(H,"oppName()==='朋友B'",20000));
  check('friend sees the host\'s name', await until(G,"oppName()==='房主A'",10000));
  check('the two tabs have different ids', await G.ev(`return myId!=='${hostId}'`));
  await sleep(1000);
  if(await H.ev('return state.turn')==='host'){ await H.ev("const a=Banqi.legalActions(state,'host').find(x=>x.type==='flip');cells[a.i].click();return 1"); await until(G,"state.turn==='guest'",10000); }
  const n=await H.ev('return state.moveNo');
  await G.ev("const i=state.board.findIndex(p=>p&&!p.up);cells[i].click();return 1");
  check('friend tab can play', await until(H,`state.moveNo===${n}+1`,10000));
  await H.nav(base+'/index.html'+(await H.ev('return location.search'))); await sleep(2500);
  check('host keeps its own name after a reload', await H.ev("return profile.name==='房主A'"));
  await G.nav(link); await sleep(2500);
  check('friend tab keeps its name and id after a reload', await G.ev("return profile.name==='朋友B'&&document.getElementById('prof').classList.contains('hidden')"));
  check('still connected as the seated friend', await until(H,"oppName()==='朋友B'",20000) && await G.ev("return !roomFull.done"));
});
