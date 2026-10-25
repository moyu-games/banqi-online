// Same-device stickers/emoji/taunts, sticker timing and tap-to-close, messages typed before the friend joins.
require('./lib').run(async ({ tab, until, check, setProfile, sleep, send, base, out }) => {
  const D=await tab(1366,768), P=await tab(390,844,true);
  // 1. same device on a computer: stickers, emoji and taunts pop by the right player's card
  await D.nav(base+'/index.html'); await D.ev("localStorage.removeItem('bq-local');return 1"); await D.nav(base+'/index.html?local=1');
  check('desktop local: social card visible', await D.ev("const c=document.getElementById('chatCard');return !c.classList.contains('hidden')&&getComputedStyle(c).display!=='none'"));
  check('desktop local: no chat tab, opens on stickers', await D.ev("return document.getElementById('chatTabBtn').classList.contains('hidden')&&chatMode==='sticker'&&getComputedStyle(document.getElementById('chatForm')).display==='none'"));
  check('desktop local: who-is-sending picker shown', await D.ev("return !document.getElementById('localWho').classList.contains('hidden')"));
  await D.ev("cells[0].click();return 1"); await sleep(900);   // player one flips, so "just moved" = player one
  await D.ev("document.querySelector('#trayGrid [data-id]').click();return 1"); await sleep(400);
  check('auto: sticker pops by player one (who just moved)', await D.ev("return !!document.querySelector('.sticker-show.me')&&!document.querySelector('.sticker-show.opp')"));
  await D.ev("document.querySelector('#localWho [data-r=guest]').click();document.querySelector('#reacts [data-e]').click();return 1"); await sleep(400);
  check('picked player two: emoji pops by player two', await D.ev("return !!document.querySelector('.sticker-show.opp.emoji')"));
  await sleep(1300);
  await D.ev("setMode('taunt');document.querySelector('#tauntChips [data-k]').click();return 1"); await sleep(400);
  check('picked player two: taunt bubble by player two', await D.ev("return !!document.querySelector('.say.opp')"));
  check('local: no "friend not here" note', !(await D.ev("return document.getElementById('toast').textContent.includes('朋友還沒加入')")));
  // 2. timing: sticker stays about 3.5 s, emoji about 2 s, a tap closes a sticker early
  await D.ev("document.querySelectorAll('.sticker-show').forEach(x=>x.remove());showSticker({sid:'n-3'},true);return 1");
  await sleep(3000); check('sticker still showing at 3 s', await D.ev("return !!document.querySelector('.sticker-show.me')"));
  await sleep(900); check('sticker gone by 3.9 s', !(await D.ev("return !!document.querySelector('.sticker-show.me')")));
  await D.ev("floatEmoji(EMOJI[1],true);return 1"); await sleep(1500); check('emoji still showing at 1.5 s', await D.ev("return !!document.querySelector('.sticker-show.emoji')"));
  await sleep(800); check('emoji gone by 2.3 s', !(await D.ev("return !!document.querySelector('.sticker-show.emoji')")));
  await D.ev("showSticker({sid:'n-4'},true);return 1"); await sleep(500);
  await D.ev("document.querySelector('.sticker-show.me').click();return 1"); await sleep(100);
  check('tapping a sticker closes it at once', !(await D.ev("return !!document.querySelector('.sticker-show.me')")));
  // 3. same device on a phone: bottom bar without chat, board fits, game buttons in 更多
  await P.nav(base+'/index.html'); await P.ev("localStorage.removeItem('bq-local');return 1"); await P.nav(base+'/index.html?local=1');
  check('phone local: bottom bar with emoji/sticker/taunt/more, no chat', await P.ev("return getComputedStyle(document.getElementById('actbar')).display==='flex'&&[...document.querySelectorAll('#actbar [data-m]')].filter(b=>!b.classList.contains('hidden')).map(b=>b.dataset.m).join()==='emoji,sticker,taunt,game'"));
  check('phone local: no page scroll', await P.ev("return document.documentElement.scrollHeight<=innerHeight+1"), await P.ev("return document.documentElement.scrollHeight+'/'+innerHeight"));
  check('phone local: board clear of the bar', await P.ev("return document.querySelector('.board-wrap').getBoundingClientRect().bottom<=document.getElementById('actbar').getBoundingClientRect().top+1"));
  await P.ev("document.querySelector('#actbar [data-m=game]').click();return 1"); await sleep(400);
  check('phone local: new game / undo / resign in 更多', await P.ev("return ['newBtn','undoBtn','resignBtn'].every(id=>document.getElementById(id).offsetParent!==null)"));
  await P.ev("closeSheet();cells[5].click();return 1"); await sleep(700);
  check('phone local: flipping still works', await P.ev("return state.moveNo===1"));
  await P.ev("document.querySelector('#actbar [data-m=sticker]').click();return 1"); await sleep(400);
  await P.ev("document.querySelector('#trayGrid [data-id]').click();return 1"); await sleep(400);
  check('phone local: sticker pops', await P.ev("return !!document.querySelector('.sticker-show')"));
  await P.shot('v19-phone-local.png'); await D.shot('v19-desktop-local.png');
  // 4. private messages written before the friend arrives are delivered when they join
  const H=await tab(1366,768), G=await tab(390,844,true);
  await H.nav(base+'/index.html'); await H.ev("document.getElementById('createBtn').click();return 1");
  await until(H,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(H,'房主');
  const link=await H.ev("return document.getElementById('shareLink').value");
  const say=t=>H.ev(`document.getElementById('chatInput').value=${JSON.stringify(t)};document.getElementById('chatForm').requestSubmit();return 1`);
  await say('你終於來了'); await say('快點下');
  check('before the friend: messages shown and marked as waiting', await H.ev("return document.querySelectorAll('#chatLog .msg.queued').length===2"));
  check('before the friend: told they will be delivered', await H.ev("return document.getElementById('toast').textContent.includes('一進房就會收到')"));
  await G.nav(link); await until(G,"!document.getElementById('prof').classList.contains('hidden')",5000); await setProfile(G,'朋友');
  check('friend receives the waiting messages in order', await until(G,"(()=>{const t=[...document.querySelectorAll('#chatLog .msg')].map(d=>d.textContent).join('|');return t.indexOf('你終於來了')>=0&&t.indexOf('快點下')>t.indexOf('你終於來了')})()",20000));
  check('host: waiting marks cleared', await until(H,"document.querySelectorAll('#chatLog .msg.queued').length===0",5000));
  await say('現在即時'); check('after joining: messages go straight through', await until(G,"[...document.querySelectorAll('#chatLog .msg')].some(d=>d.textContent.includes('現在即時'))",10000));
  check('each waiting message delivered once', await G.ev("return [...document.querySelectorAll('#chatLog .msg')].filter(d=>d.textContent.includes('你終於來了')).length===1"));
});
