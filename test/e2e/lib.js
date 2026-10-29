// Shared harness for the browser tests: finds a headless Chrome, opens isolated tabs over the DevTools Protocol,
// and reports one PASS/FAIL line per check. A test file is just: require('./lib').run(async ({ tab, until, check }) => { ... })
// Usage of a single test: node <file> <base-url> [out-dir] [extra args]
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Chrome to drive: $CHROME_PATH, else Playwright's headless shell, else an installed Chrome / Chromium.
function chromeBin() {
  if (process.env.CHROME_PATH) return [process.env.CHROME_PATH, ['--headless=new']];
  const home = os.homedir();
  const caches = [process.env.PLAYWRIGHT_BROWSERS_PATH, process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'),
    path.join(home, 'Library', 'Caches', 'ms-playwright'), path.join(home, '.cache', 'ms-playwright')].filter(Boolean);
  for (const c of caches) {
    let dirs = []; try { dirs = fs.readdirSync(c).filter(d => d.startsWith('chromium_headless_shell')).sort().reverse(); } catch (_) {}
    for (const d of dirs) for (const sub of ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-headless-shell-mac-arm64/chrome-headless-shell',
      'chrome-headless-shell-mac-x64/chrome-headless-shell', 'chrome-headless-shell-linux64/chrome-headless-shell']) {
      const p = path.join(c, d, sub); if (fs.existsSync(p)) return [p, []];
    }
  }
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'])
    if (fs.existsSync(p)) return [p, ['--headless=new']];
  throw new Error('No Chrome found. Install Google Chrome or set CHROME_PATH.');
}

// Launch Chrome (low priority, no window) and connect to it.
async function launch(flags = []) {
  const [bin, extra] = chromeBin();
  const port = 9300 + Math.floor(Math.random() * 500), ud = fs.mkdtempSync(path.join(os.tmpdir(), 'banqi-e2e-'));
  const ch = spawn(bin, [...extra, `--remote-debugging-port=${port}`, `--user-data-dir=${ud}`, '--no-first-run', '--disable-gpu', ...flags, 'about:blank'], { stdio: 'ignore' });
  try { os.setPriority(ch.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (_) {}
  let ver; for (let i = 0; i < 60; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch (_) { await sleep(200); } }
  if (!ver) throw new Error('Chrome did not start');
  const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  return { ch, ws };
}

function run(body, opts = {}) {   // opts.flags: extra Chrome switches for every browser of this test
  const base = process.argv[2], out = process.argv[3] || path.join(__dirname, 'out');
  if (!base) { console.error('usage: node ' + path.basename(process.argv[1]) + ' <base-url> [out-dir]'); process.exit(2); }
  fs.mkdirSync(out, { recursive: true });
  let fails = 0;
  const check = (name, ok, x = '') => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (x ? ' — ' + x : '')); if (!ok) fails++; };
  const errs = [], browsers = [];
  // One Chrome process; its tabs share Chrome's network stack (and its per-server connection queue).
  async function browser() {
    const { ch, ws } = await launch(opts.flags);
    browsers.push(ch);
    let id = 0; const pend = {};
    const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; }
      if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }, m.sessionId);
    };
    // A tab with its own browser profile (pass ctx from another tab to share one, like two tabs of the same browser).
    async function tab(w, h, mobile, ctx) {
      const browserContextId = ctx || (await send('Target.createBrowserContext')).result.browserContextId;
      const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
      const { result: { sessionId: s } } = await send('Target.attachToTarget', { targetId, flatten: true });
      const S = (m, p) => send(m, p, s);
      await S('Runtime.enable'); await S('Page.enable');
      await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
      await S('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
      const ev = async e => {
        const r = await S('Runtime.evaluate', { expression: `(async()=>{${e}})()`, awaitPromise: true, returnByValue: true });
        if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
        return r.result.result.value;
      };
      const shot = async f => { const r = await S('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(out, f), Buffer.from(r.result.data, 'base64')); };
      return { ctx: browserContextId, S, ev, shot, nav: async u => { await S('Page.navigate', { url: u }); await sleep(1500); } };
    }
    return { tab, send };
  }
  (async () => {
    const { tab, send } = await browser();
    const until = async (t, expr, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { if (await t.ev('return !!(' + expr + ')')) return true; } catch (_) {} await sleep(400); } return false; };
    const setProfile = (t, name) => t.ev(`document.getElementById('profName').value=${JSON.stringify(name)};document.getElementById('profSave').click();return 1`);
    // browser(): a second, separate Chrome, like a second device
    await body({ tab, browser, until, check, setProfile, sleep, send, base, out, errs });
    console.log('page errors:', errs.length ? errs : 'none');
    console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
    browsers.forEach(ch => ch.kill()); process.exit(fails ? 1 : 0);
  })().catch(e => { console.error('CRASH', e.message); browsers.forEach(ch => ch.kill()); process.exit(1); });
}

module.exports = { run, chromeBin, launch, sleep };
