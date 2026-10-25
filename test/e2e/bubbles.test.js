// Sticker / taunt / chat bubbles never cover a name or avatar, nor each other (desktop and phone).
require('./lib').run(async ({ tab, until, check, setProfile, sleep, send, base, out }) => {
  const H=await tab(1366,768), G=await tab(390,844,true);
  await H.nav(base+'/index.html'); await H.ev("document.getElementById('createBtn').click();return 1");
  await until(H,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(H,'房主小明');
  const link=await H.ev("return document.getElementById('shareLink').value");
  await G.nav(link); await until(G,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(G,'朋友阿華');
  await until(H,"oppName()==='朋友阿華'",20000); await sleep(800);
  if(await H.ev('return state.turn')==='host'){ await H.ev("const a=Banqi.legalActions(state,'host').find(x=>x.type==='flip');cells[a.i].click();return 1"); await sleep(1500); }
  // geometry: every bubble vs every avatar / name text, and bubbles on the same side vs each other
  const geo=`const R=e=>e.getBoundingClientRect(),hit=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
    const txt=e=>{const r=document.createRange();r.selectNodeContents(e);return r.getBoundingClientRect()};
    const blocks=['pMe','pOpp'].flatMap(id=>[[id+' avatar',R(document.querySelector('#'+id+' .av'))],[id+' name',txt(document.querySelector('#'+id+' .who'))]]);
    const bubs=[...document.querySelectorAll('.sticker-show,.say')].map(e=>[e.className,R(e)]);
    const bad=[];for(const [n,b] of bubs){for(const [m,k] of blocks) if(hit(b,k)) bad.push(n+' covers '+m);
      if(b.left<0||b.right>innerWidth+1) bad.push(n+' off screen');}
    for(let i=0;i<bubs.length;i++)for(let j=i+1;j<bubs.length;j++) if(hit(bubs[i][1],bubs[j][1])) bad.push(bubs[i][0]+' overlaps '+bubs[j][0]);
    return {n:bubs.length,bad}`;
  const scene=async(T,order)=>{await T.ev("document.querySelectorAll('.sticker-show,.say').forEach(x=>x.remove());return 1");
    if(order==='taunt-first') await T.ev("sayTaunt(5,true);sayTaunt(8,false);showSticker({sid:'n-3'},true);showSticker({sid:'n-5'},false);return 1");
    else await T.ev("showSticker({sid:'n-3'},true);showSticker({sid:'n-5'},false);sayTaunt(5,true);sayTaunt(8,false);return 1");
    await sleep(700); return T.ev(geo)};
  for(const [T,dev] of [[H,'desktop'],[G,'phone']]) for(const order of ['taunt-first','sticker-first']){
    const r=await scene(T,order); check(`${dev}, ${order}: ${r.n} bubbles, none covers a name/avatar or each other`, r.n===4&&r.bad.length===0, r.bad.join('; '));
    await T.shot(`bub-${dev}-${order}.png`); }
  // a long chat line on the desktop
  await H.ev("document.querySelectorAll('.sticker-show,.say').forEach(x=>x.remove());say('這是一句很長很長的聊天訊息，看看會不會蓋到名字',false,true);return 1"); await sleep(600);
  const lc=await H.ev(geo); check('desktop long chat line: does not cover a name/avatar', lc.bad.length===0, lc.bad.join('; '));
});
