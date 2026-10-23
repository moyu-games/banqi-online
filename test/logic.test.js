const B = require('../logic.js'), assert = require('assert');
const P = (t, c, up = true) => ({ t, c, up });
const empty = () => { const s = B.newGame('host'); s.board = Array(32).fill(null); s.colors = { host: 'r', guest: 'b' }; return s; };
let n = 0; const ok = (name, f) => { f(); n++; console.log('ok', name); };

ok('new game has 32 shuffled face-down pieces', () => {
  const s = B.newGame();
  assert.equal(s.board.length, 32); assert(s.board.every(p => p && !p.up));
  assert.equal(s.board.filter(p => p.c === 'r').length, 16);
});
ok('first flip assigns colors to flipper', () => {
  const s = B.newGame('guest'); const c = s.board[5].c;
  const r = B.apply(s, 'guest', { type: 'flip', i: 5 }); assert(r.ok);
  assert.equal(r.state.colors.guest, c); assert.equal(r.state.turn, 'host');
  assert(!B.apply(r.state, 'guest', { type: 'flip', i: 6 }).ok, 'cannot move twice');
});
ok('rank capture, equal capture, king/soldier exception', () => {
  assert(B.canCapture(P('R', 'r'), P('H', 'b'))); assert(B.canCapture(P('H', 'r'), P('H', 'b')));
  assert(!B.canCapture(P('H', 'r'), P('R', 'b'))); assert(!B.canCapture(P('K', 'r'), P('P', 'b'))); assert(B.canCapture(P('P', 'r'), P('K', 'b')));
});
ok('cannot capture face-down or own pieces; moves only one step', () => {
  const s = empty(); s.board[9] = P('K', 'r'); s.board[10] = P('P', 'b', false); s.board[8] = P('A', 'r'); s.board[1] = P('A', 'b');
  const tg = B.targets(s.board, 9).sort((a, b) => a - b);
  assert.deepEqual(tg, [1, 17]);
});
ok('cannon jumps exactly one screen, any distance, any rank', () => {
  const s = empty(); s.board[0] = P('C', 'r'); s.board[2] = P('P', 'b', false); s.board[6] = P('K', 'b'); s.board[7] = P('A', 'b');
  s.board[8] = P('R', 'b'); // adjacent below: cannon cannot capture without screen
  const tg = B.targets(s.board, 0).sort((a, b) => a - b);
  assert.deepEqual(tg, [1, 6]);
});
ok('capturing last enemy piece wins', () => {
  const s = empty(); s.board[0] = P('R', 'r'); s.board[1] = P('H', 'b');
  const r = B.apply(s, 'host', { type: 'move', from: 0, to: 1 });
  assert(r.ok); assert.equal(r.state.winner, 'host'); assert.deepEqual(r.state.captured.b, ['H']);
});
ok('opponent with no legal move loses', () => {
  const s = empty(); s.board[0] = P('P', 'b'); s.board[1] = P('R', 'r'); s.board[8] = P('A', 'r'); s.board[30] = P('H', 'r');
  const r = B.apply(s, 'host', { type: 'move', from: 30, to: 31 });
  assert.equal(r.state.winner, 'host'); assert.equal(r.state.reason, 'noMoves');
});
ok('draw after DRAW_LIMIT quiet moves', () => {
  let s = empty(); s.board[0] = P('R', 'r'); s.board[31] = P('R', 'b');
  const moves = { host: [[0, 1], [1, 0]], guest: [[31, 30], [30, 31]] };
  for (let k = 0; k < B.DRAW_LIMIT; k++) { const role = s.turn, m = moves[role][Math.floor(k / 2) % 2]; const r = B.apply(s, role, { type: 'move', from: m[0], to: m[1] }); assert(r.ok, r.err); s = r.state; }
  assert.equal(s.winner, 'draw');
});
ok('random full games always terminate with legal actions only', () => {
  for (let g = 0; g < 300; g++) {
    let s = B.newGame(g % 2 ? 'host' : 'guest'), steps = 0;
    while (!s.winner) { const acts = B.legalActions(s, s.turn); const r = B.apply(s, s.turn, acts[Math.floor(Math.random() * acts.length)]); assert(r.ok, r.err); s = r.state; assert(++steps < 5000); }
  }
});
console.log(`${n} tests passed`);
