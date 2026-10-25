// Runs the browser tests one at a time against a local copy of the site (served by a tiny built-in web server),
// or against the published site with --live, and prints a summary. Exit code 1 if anything failed.
//
//   node test/e2e/run-all.js                 every functional test + frame timing, on a local copy
//   node test/e2e/run-all.js flows attacks   only the tests whose file name contains one of the words
//   node test/e2e/run-all.js --live          against https://moyu-games.github.io/banqi-online
//   node test/e2e/run-all.js --metrics       also the load-speed and latency reports
//   node test/e2e/run-all.js --verbose       print every line the tests print
const { spawn } = require('child_process'), fs = require('fs'), http = require('http'), path = require('path');

const ROOT = path.resolve(__dirname, '..', '..'), OUT = path.join(__dirname, 'out');
const LIVE = 'https://moyu-games.github.io/banqi-online';
// [file, extra args]; order: quick and central first
const SUITE = [
  ['flows.test.js'], ['instant-feedback.test.js'], ['attacks.test.js'], ['security.test.js'], ['bugfixes.test.js'],
  ['fair-shuffle.test.js'], ['spectate.test.js'], ['spectator-chat.test.js'], ['password.test.js'], ['block-lobby.test.js'],
  ['same-browser.test.js'], ['lobby-idle.test.js'], ['social.test.js'], ['bubbles.test.js'], ['layout.test.js'], ['stale-host.test.js'],
  ['p2p.test.js', ['', 'both']], ['effects.test.js'], ['home.test.js'], ['perf.test.js', ['4']],
];
const METRICS = [['load.test.js'], ['latency.test.js'], ['latency.test.js', ['&relay']]];

const args = process.argv.slice(2), live = args.includes('--live'), metrics = args.includes('--metrics'), verbose = args.includes('--verbose');
const words = args.filter(a => !a.startsWith('--'));
let list = metrics ? SUITE.concat(METRICS) : SUITE;
if (words.length) list = SUITE.concat(METRICS).filter(([f]) => words.some(w => f.includes(w)));

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.mp3': 'audio/mpeg' };
function serve() {   // static files from the repo root, no caching, so every run sees the working copy
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])));
      if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p, (err, data) => {
        if (err) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

function runOne(file, extra, base) {
  return new Promise(resolve => {
    const t0 = Date.now(), lines = [];
    const p = spawn(process.execPath, [path.join(__dirname, file), base, OUT, ...extra], { stdio: ['ignore', 'pipe', 'pipe'] });
    const take = d => String(d).split(/\r?\n/).forEach(l => { if (!l.trim()) return; lines.push(l); if (verbose || /^(FAIL|CRASH)/.test(l)) console.log('   ' + l); });
    p.stdout.on('data', take); p.stderr.on('data', take);
    const timer = setTimeout(() => { lines.push('CRASH timed out after 10 minutes'); p.kill(); }, 600000);
    p.on('close', code => {
      clearTimeout(timer);
      const finished = lines.some(l => /^(page errors|FRIEND)/.test(l));   // every test prints one of these as its last word
      const failed = code !== 0 || !finished || lines.some(l => /^(FAIL|CRASH)/.test(l));
      const passes = lines.filter(l => l.startsWith('PASS')).length;
      resolve({ file, failed, passes, secs: Math.round((Date.now() - t0) / 1000), report: lines.filter(l => /^(HOME|FRIEND|LAT|  biggest)/.test(l)) });
    });
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = live ? null : await serve();
  const base = live ? LIVE : `http://127.0.0.1:${srv.address().port}`;
  console.log(`Testing ${base} — ${list.length} test file(s), one at a time\n`);
  const results = [];
  for (const [file, extra = []] of list) {
    process.stdout.write(`▶ ${file}${extra.length ? ' ' + extra.filter(Boolean).join(' ') : ''}\n`);
    const r = await runOne(file, extra, base);
    results.push(r);
    r.report.forEach(l => console.log('   ' + l));
    console.log(`   ${r.failed ? '✗ FAILED' : '✓ passed'}  (${r.passes} checks, ${r.secs}s)`);
  }
  if (srv) srv.close();
  const bad = results.filter(r => r.failed);
  console.log(`\n${results.length - bad.length}/${results.length} test files passed` + (bad.length ? ` — failed: ${bad.map(r => r.file).join(', ')}` : ''));
  console.log(`Screenshots and reports: ${OUT}`);
  process.exit(bad.length ? 1 : 0);
})();
