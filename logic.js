// Banqi (暗棋) rules, Taiwan style. Pure functions, shared by the page and the Node tests.
(function (root) {
  const ROWS = 4, COLS = 8, N = ROWS * COLS;
  const RANK = { K: 7, A: 6, E: 5, R: 4, H: 3, C: 2, P: 1 };
  const COUNT = { K: 1, A: 2, E: 2, R: 2, H: 2, C: 2, P: 5 };
  const DRAW_LIMIT = 50; // moves in a row with no flip and no capture

  function shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function newGame(first, rnd) {
    const pieces = [];
    for (const c of ['r', 'b']) for (const t in COUNT) for (let k = 0; k < COUNT[t]; k++) pieces.push({ t, c, up: false });
    return {
      board: shuffle(pieces, rnd || Math.random),
      colors: null,          // { host: 'r'|'b', guest: 'r'|'b' } once the first piece is flipped
      turn: first || 'host',
      first: first || 'host',
      noProgress: 0,
      winner: null,          // 'host' | 'guest' | 'draw'
      reason: null,
      last: null,
      captured: { r: [], b: [] },
      moveNo: 0,
    };
  }

  const other = role => (role === 'host' ? 'guest' : 'host');
  const rc = i => [Math.floor(i / COLS), i % COLS];
  const idx = (r, c) => r * COLS + c;
  const inside = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  function canCapture(att, def) {
    if (att.t === 'K' && def.t === 'P') return false;
    if (att.t === 'P' && def.t === 'K') return true;
    return RANK[att.t] >= RANK[def.t];
  }

  // Squares the piece at `from` may move or capture to.
  function targets(board, from) {
    const p = board[from];
    if (!p || !p.up) return [];
    const [r, c] = rc(from), out = [];
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (!inside(nr, nc)) continue;
      const q = board[idx(nr, nc)];
      if (!q) out.push(idx(nr, nc));
      else if (p.t !== 'C' && q.up && q.c !== p.c && canCapture(p, q)) out.push(idx(nr, nc));
    }
    if (p.t === 'C') {
      // Cannon captures by jumping exactly one piece (face-up or face-down), any distance, any rank.
      for (const [dr, dc] of DIRS) {
        let nr = r + dr, nc = c + dc, screen = false;
        while (inside(nr, nc)) {
          const q = board[idx(nr, nc)];
          if (q) {
            if (!screen) screen = true;
            else { if (q.up && q.c !== p.c) out.push(idx(nr, nc)); break; }
          }
          nr += dr; nc += dc;
        }
      }
    }
    return out;
  }

  function colorOf(state, role) { return state.colors ? state.colors[role] : null; }

  function legalActions(state, role) {
    const acts = [], col = colorOf(state, role);
    state.board.forEach((p, i) => {
      if (!p) return;
      if (!p.up) acts.push({ type: 'flip', i });
      else if (p.c === col) for (const to of targets(state.board, i)) acts.push({ type: 'move', from: i, to });
    });
    return acts;
  }

  function apply(state, role, action) {
    if (state.winner) return { ok: false, err: 'game over' };
    if (state.turn !== role) return { ok: false, err: 'not your turn' };
    const s = JSON.parse(JSON.stringify(state)), b = s.board;
    let progress = false;
    if (action.type === 'flip') {
      const p = b[action.i];
      if (!p || p.up) return { ok: false, err: 'cannot flip' };
      p.up = true;
      if (!s.colors) s.colors = { [role]: p.c, [other(role)]: p.c === 'r' ? 'b' : 'r' };
      s.last = { type: 'flip', i: action.i };
      progress = true;
    } else if (action.type === 'move') {
      const p = b[action.from];
      if (!p || !p.up || p.c !== colorOf(s, role)) return { ok: false, err: 'not your piece' };
      if (!targets(b, action.from).includes(action.to)) return { ok: false, err: 'illegal move' };
      const q = b[action.to];
      if (q) { s.captured[q.c].push(q.t); progress = true; }
      b[action.to] = p; b[action.from] = null;
      s.last = { type: 'move', from: action.from, to: action.to, cap: !!q };
    } else return { ok: false, err: 'bad action' };

    s.moveNo++;
    s.noProgress = progress ? 0 : s.noProgress + 1;
    s.turn = other(role);
    const opp = other(role), oppCol = colorOf(s, opp);
    if (oppCol && b.every(p => !p || p.c !== oppCol)) { s.winner = role; s.reason = 'capturedAll'; }
    else if (legalActions(s, opp).length === 0) { s.winner = role; s.reason = 'noMoves'; }
    else if (s.noProgress >= DRAW_LIMIT) { s.winner = 'draw'; s.reason = 'drawLimit'; }
    return { ok: true, state: s };
  }

  const api = { ROWS, COLS, N, RANK, DRAW_LIMIT, newGame, targets, legalActions, apply, canCapture, other };
  if (typeof module !== 'undefined') module.exports = api; else root.Banqi = api;
})(this);
