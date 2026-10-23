// Built-in stickers: the meme pack (images), "棋寶" (an original chess-piece mascot) and meme text stickers (SVG).
(function (root) {
  const INK = '#3a2a1a';
  const body = (extra = '') => `
    <ellipse cx="60" cy="112" rx="34" ry="5" fill="rgba(0,0,0,.18)"/>
    <circle cx="60" cy="62" r="46" fill="#b8925c"/>
    <circle cx="60" cy="58" r="46" fill="#f4e6c8"/>
    <ellipse cx="44" cy="34" rx="18" ry="10" fill="#fffaf0" opacity=".7"/>
    <circle cx="60" cy="58" r="39" fill="none" stroke="#c0392b" stroke-width="3"/>${extra}
    <ellipse cx="34" cy="72" rx="7" ry="4" fill="#ff9d8a" opacity=".6"/>
    <ellipse cx="86" cy="72" rx="7" ry="4" fill="#ff9d8a" opacity=".6"/>`;
  const svg = (inner, vb = '0 0 120 120') => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  const line = (d, w = 4, c = INK) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const heart = (x, y, s, c = '#e8364b') => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 4 C0 -2 8 -4 10 2 C12 -4 20 -2 20 4 C20 12 10 18 10 18 C10 18 0 12 0 4Z" fill="${c}"/>`;
  const drop = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 0 C4 6 7 10 7 14 A7 7 0 0 1 -7 14 C-7 10 -4 6 0 0Z" fill="#5bb8f0"/>`;

  const mascot = {
    laugh: body(line('M38 52 q8 -10 16 0') + line('M66 52 q8 -10 16 0') +
      '<path d="M40 64 q20 30 40 0 z" fill="#7a1f14"/><ellipse cx="60" cy="80" rx="9" ry="4" fill="#ff7a6a"/>' + drop(26, 50, .9) + drop(94, 50, .9)),
    cry: body(line('M38 54 q8 6 16 0') + line('M66 54 q8 6 16 0') +
      '<path d="M43 58 h6 v38 h-6z" fill="#5bb8f0" opacity=".85"/><path d="M71 58 h6 v38 h-6z" fill="#5bb8f0" opacity=".85"/>' +
      line('M44 82 q8 -9 16 0 q8 9 16 0', 4)),
    shock: body('<circle cx="45" cy="52" r="9" fill="#fff" stroke="' + INK + '" stroke-width="3"/><circle cx="75" cy="52" r="9" fill="#fff" stroke="' + INK + '" stroke-width="3"/>' +
      '<circle cx="45" cy="52" r="2.5" fill="' + INK + '"/><circle cx="75" cy="52" r="2.5" fill="' + INK + '"/><ellipse cx="60" cy="82" rx="7" ry="10" fill="#7a1f14"/>' +
      drop(96, 22, 1.1) + line('M40 6 l4 8', 3) + line('M60 2 v9', 3) + line('M80 6 l-4 8', 3)),
    smug: body('<path d="M30 46 h26 v6 q-13 12 -26 0z" fill="#1b1a19"/><path d="M64 46 h26 v6 q-13 12 -26 0z" fill="#1b1a19"/>' + line('M56 48 h8', 3, '#1b1a19') +
      '<path d="M38 49 l6 -2" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' + line('M46 78 q14 8 28 -6') +
      '<path d="M98 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#ffd34d"/>'),
    angry: body('<circle cx="60" cy="58" r="44" fill="#ff5a3a" opacity=".18"/>' + line('M34 40 l20 10') + line('M86 40 l-20 10') +
      '<circle cx="46" cy="56" r="4" fill="' + INK + '"/><circle cx="74" cy="56" r="4" fill="' + INK + '"/>' + line('M44 84 q16 -14 32 0') +
      line('M84 18 q4 6 10 4 M92 12 q-2 8 4 12', 3, '#e8364b')),
    love: body(heart(35, 44, .9) + heart(65, 44, .9) + line('M44 72 q16 16 32 0') + heart(92, 10, .7, '#ff6b81') + heart(8, 18, .5, '#ff6b81')),
  };
  const MASCOT_NAMES = { laugh: '大笑', cry: '哭哭', shock: '嚇到', smug: '得意', angry: '生氣', love: '愛你' };

  const WORDS = [['笑死', '#ff9f1c'], ['好扯', '#7b5cff'], ['穩了', '#2bb673'], ['就這？', '#4a90e2'], ['快點啦', '#ff5d73'], ['太神啦', '#d99a2b'], ['我不信', '#6c757d'], ['哭啊', '#3fa7d6']];
  const word = (txt, color) => svg(`
    <g transform="rotate(-6 80 45)">
      <rect x="8" y="12" width="144" height="66" rx="20" fill="${color}" stroke="#fff" stroke-width="5"/>
      <text x="80" y="58" text-anchor="middle" font-size="${txt.length > 2 ? 34 : 42}" font-weight="900"
        font-family="'PingFang TC','Microsoft JhengHei','Noto Sans TC',sans-serif" fill="#fff"
        stroke="rgba(0,0,0,.35)" stroke-width="5" paint-order="stroke">${txt}</text>
    </g>`, '0 0 160 90');

  // Meme pack (images in stickers/), listed first.
  const MEMES = ['好啦', '吃太飽', '肚子餓', '我沒事', '氣噗噗', '閃身步', '先閃了', '沒在怕', '晚安', '好冷', '害羞', '蛤',
    '加一', '衝啊', '我來了', '謝謝', '讚啦', '想吃', '沒錢了', '躺平', '加油', '下班啦', '生日快樂', '掰掰'];
  const STICKERS = MEMES.map((name, k) => ({ id: 'n-' + (k + 1), name, img: `stickers/${String(k + 1).padStart(2, '0')}.webp` }));
  for (const k in mascot) STICKERS.push({ id: 'm-' + k, name: '棋寶' + MASCOT_NAMES[k], svg: svg(mascot[k]) });
  WORDS.forEach(([txt, c], i) => STICKERS.push({ id: 'w-' + i, name: txt, svg: word(txt, c) }));
  root.STICKERS = STICKERS;
})(this);
