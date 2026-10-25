// Local-mode scenarios that trigger each effect; screenshots mid-effect and checks the fx layer cleans up.
const {spawn}=require('child_process'),fs=require('fs'),os=require('os'),path=require('path');
const base=process.argv[2], out=process.argv[3], W=+(process.argv[4]||1100), H=+(process.argv[5]||900);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const [bin,extra]=require('./lib').chromeBin();
const P=(t,c,up=true)=>({t,c,up});
function st(cells,extraBlack){const b=Array(32).fill(null);for(const [i,p] of Object.entries(cells))b[i]=p;
  return {board:b,colors:{host:'r',guest:'b'},turn:'host',first:'host',noProgress:0,winner:null,reason:null,last:null,captured:{r:[],b:[]},moveNo:5}}
(async()=>{
  const port=9300+Math.floor(Math.random()*500),ud=fs.mkdtempSync(path.join(os.tmpdir(),'qa-chrome-'));
  const ch=spawn(bin,[...extra,`--remote-debugging-port=${port}`,`--user-data-dir=${ud}`,'--no-first-run','--disable-gpu','--autoplay-policy=no-user-gesture-required','about:blank'],{stdio:'ignore'});
  try{os.setPriority(ch.pid,os.constants.priority.PRIORITY_BELOW_NORMAL)}catch(_){}
  let ver;for(let i=0;i<50;i++){try{ver=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();break}catch(_){await sleep(200)}}
  const ws=new WebSocket(ver.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
  let id=0;const pend={},errs=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id]}if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)};
  const send=(method,params={},sessionId)=>new Promise(r=>{const i=++id;pend[i]=r;ws.send(JSON.stringify({id:i,method,params,sessionId}))});
  const {result:{targetId}}=await send('Target.createTarget',{url:'about:blank'});
  const {result:{sessionId:s}}=await send('Target.attachToTarget',{targetId,flatten:true});const S=(m,p)=>send(m,p,s);
  await S('Runtime.enable');await S('Page.enable');await S('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await S('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:W<600});
  const ev=async e=>{const r=await S('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true});if(r.result.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description);return r.result.result.value};
  const shot=async f=>{const r=await S('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,f),Buffer.from(r.result.data,'base64'))};
  const click=i=>ev(`cells[${i}].click()`);
  const load=async state=>{await S('Page.navigate',{url:base+'/index.html?local=1'});await sleep(1200);
    await ev(`localStorage.setItem('bq-local',${JSON.stringify(JSON.stringify(state))});return 1`);await S('Page.navigate',{url:base+'/index.html?local=1'});await sleep(1500)};
  const fxCount=()=>ev("return document.getElementById('fx').children.length+document.getElementById('fxTop').children.length");
  const text=()=>ev("return [...document.querySelectorAll('#fxTop .banner .bt, #fxTop .pop')].map(e=>e.textContent).join(' | ')");

  const cases=[['R',{9:P('R','r'),10:P('P','b')},9,10],['H',{9:P('H','r'),10:P('P','b')},9,10],['C',{8:P('C','r'),9:P('P','b',false),10:P('E','b')},8,10],
    ['P',{9:P('P','r'),10:P('P','b')},9,10],['A',{9:P('A','r'),10:P('H','b')},9,10],['E',{9:P('E','r'),10:P('R','b')},9,10],['K',{9:P('K','r'),10:P('H','b')},9,10]];
  const imp={R:235,H:420,C:520,P:430,A:335,E:445,K:470}, word={R:'衝鋒！',H:'飛馬踢！',C:'砰！',P:'戳！',A:'喝！',E:'重踩！',K:'王令！'};
  let bad=0;
  for(const [t,cells,from,to] of cases){
    await load(st({...cells,31:P('P','b',false)}));
    await click(from);await sleep(80);await click(to);
    await sleep(imp[t]+90);
    const txt=await text(), fly=await ev("return document.querySelectorAll('.flyer').length"), nfx=await fxCount();
    await shot('cap-'+t+'.png');
    await sleep(2600);
    const after=await fxCount(), flyLeft=await ev("return document.querySelectorAll('.flyer').length"), trophy=await ev("return document.querySelectorAll('#pMe .caps .mini').length");
    const ok=txt.includes(word[t])&&fly===1&&nfx>10&&after===0&&flyLeft===0&&trophy===1;
    if(!ok)bad++;
    console.log((ok?'PASS ':'FAIL ')+t+': word="'+txt+'" flyer='+fly+' fxNodes='+nfx+' cleanAfter='+(after===0)+' trophy='+trophy);
  }
  // combo + soldier-takes-general still work
  await load(st({0:P('R','r'),1:P('H','b'),9:P('P','r'),10:P('K','b'),31:P('P','b',false)}));
  await click(0);await sleep(80);await click(1);await sleep(1400);await click(31);await sleep(900);
  await click(9);await sleep(80);await click(10);await sleep(560);
  const t2=await text(); console.log((t2.includes('小兵立大功')&&t2.includes('連吃')?'PASS':'FAIL')+' combo + 小兵立大功: '+t2);
  console.log(bad?bad+' capture styles FAILED':'all 7 capture styles PASSED');
  console.log('page errors:', errs.length?errs:'none');
  ch.kill();process.exit(0);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
