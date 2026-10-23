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
  const STICKERS = MEMES.map((name, k) => ({ id: 'n-' + (k + 1), group: 'meme', name, img: `stickers/${String(k + 1).padStart(2, '0')}.webp` }));
  for (const k in mascot) STICKERS.push({ id: 'm-' + k, group: 'qibao', name: '棋寶' + MASCOT_NAMES[k], svg: svg(mascot[k]) });
  WORDS.forEach(([txt, c], i) => STICKERS.push({ id: 'w-' + i, group: 'qibao', name: txt, svg: word(txt, c) }));

  // Dancing cats, linked straight from Tenor (Tenor serves them; nothing is copied into this site).
  // "cut" ones are Tenor's transparent sticker versions, used for the victory dance.
  const TENOR = 'https://media.tenor.com/';
  const CATS_CUT = [['TcGFFG6utCk', 'dancing-cat-dance'], ['XOcBNSGZF2o', 'dancing-cats-dancing-cat'], ['E1E7Sv8n-kA', 'cat-dance'], ['LVCxvUXMYTE', 'gato-dance'], ['OrrDuvDw8B0', '7tv-cattime'], ['5EYt5mnIMvw', 'silly-cat-dance'], ['d-HSksPE2dM', 'cat-dance-happy-dance-cat'], ['Cbgs3WHCq_A', 'kitty-dance'], ['vkJQcnn06_E', 'dancing-cat-oppa-gangnam-style'], ['3gE520j0eiw', 'meow-zhe'], ['GQAsycjoZG8', 'scuba-scuba-cat'], ['Pj1z6_WvKdw', 'maxwell-cat-maxwell']];
  const CATS = [['-qBsG1HwR4o', 'cat-dance-dancing-cat'], ['FjB8OD0DZjg', 'cat-dance-cat'], ['aQFxoTQshVM', 'dance-cat-dance-funny'], ['dL6KEHdRaaI', 'orange-cat-dancing'], ['uSv9cb5DMEU', 'kucing-joget-joget'], ['opE011ucJ6k', 'dancing-cat'], ['g0Cb_FlAXGw', 'dance'], ['5BYK-WS0__g', 'cool-fun'], ['DINYn_yshao', 'cat-cat-dancing'], ['YR1hxyktKYY', 'cat'], ['YfUCc6gacQM', 'cats-dancing-brazil-dance'], ['GnT6WEh2xYk', 'cat-showercap-slyonicz'], ['3eV6Js6lcLw', 'dancing-cat-hump'], ['EX80kSnyheg', 'cat-chinese'], ['e-sar8g5Gb4', 'ai-kitty-dance']];
  CATS_CUT.forEach(([id, slug]) => STICKERS.push({ id: 'c-' + id, group: 'cat', cut: true, name: '跳舞貓', img: `${TENOR}${id}AAAAm/${slug}.webp` }));
  CATS.forEach(([id, slug]) => STICKERS.push({ id: 'c-' + id, group: 'cat', name: '跳舞貓', img: `${TENOR}${id}AAAA1/${slug}.webp` }));
  // More reaction themes from Tenor (also linked, not copied). [id, slug, transparent?]
  const THEMES = {
    nailong: ['奶龍', [["uuURvxqQc-g", "nailong", 1], ["f3D5-4CUP_0", "cute-dance-yellow-yellow-dance", 1], ["c7RTEAX8ajI", "kicaumanianailong-nailongkicaumania", 1], ["wtdwgv6-ano", "nailong-nailoong", 0], ["_knxFY7GE5U", "nailong-nailong-licking-lips", 0], ["PYHxqX4_n7w", "nailong-drooling-feigning", 0], ["SOarAe7aW_0", "nailong-love", 0], ["cCx_3jFMGQ4", "nailong-sad", 0], ["c9oIs4Tz1NA", "dwerk", 0], ["ZVFbJt_geJY", "nailong-running", 0], ["Ii343RZWOJg", "nailong-heart", 0], ["PlqRV0yzPtM", "nailong-nailongdaxiao", 0], ["KVGimKInVMY", "nailong-%E5%A5%B6%E9%BE%8D", 0], ["X9HCFBu49pE", "nailong-dancing-nailong", 0], ["_sTMJWb3s0A", "%E5%A5%BD%E5%AE%B6%E4%BC%99%E5%A5%B6%E9%BE%99", 0], ["3-SEeLRRnLU", "%E5%A5%B6%E9%BE%99", 0], ["hFbgtY3HubY", "dance-klenza", 0], ["JgEXdgqcZTE", "%E5%A5%BD%E5%AE%B6%E4%BC%99%E5%A5%B6%E9%BE%99", 0], ["HT7hJundc3g", "%E5%A5%BD%E5%AE%B6%E4%BC%99%E5%A5%B6%E9%BE%99", 0], ["JeI2t9_hJHc", "yellow-dragon-nailong", 0], ["UmCAMGMdpic", "%E5%A5%BD%E5%AE%B6%E4%BC%99%E5%A5%B6%E9%BE%99", 0], ["ibaD4YpUh-4", "%E5%A5%B6%E9%BE%8D", 0], ["r6pM34NS9Sk", "%E5%A5%B6%E9%BE%99", 1], ["TUDQZfuaaqs", "%E5%A5%B6%E9%BE%99-laughing", 0], ["qjDGYr_Hk_c", "%E5%A5%B6%E9%BE%8D", 0], ["V_K_D5xhwoY", "%E5%9A%B4%E8%82%85%E5%A5%B6%E9%BE%8D", 0], ["wRIS2RHzE-M", "%E5%A4%A7%E4%BD%AC%E7%99%BB%E5%9C%BA-%E5%A5%B6%E9%BE%99", 0], ["fPz_-GTlDNg", "%E5%A5%BD%E5%AE%B6%E4%BC%99%E5%A5%B6%E9%BE%99", 0], ["hFzfb9maTbk", "%E5%A5%BD%E5%AE%B6%E4%BC%99%E5%A5%B6%E9%BE%99", 0], ["6iqUYEgLmz0", "nailong-nailong-dancing", 0], ["ZZmAWiqRkqI", "dino-dancing", 0], ["nPdoONDlDXs", "yellow-dino-dancing", 0], ["nEDQVLZEVHI", "nailong", 0], ["X3vXcWrGqQg", "yellow-dino-dancing-yello-dino", 0], ["_vc6PMnHMVU", "nailong-yellow-dragon", 0], ["sjwmn6VDG3M", "nailong-yellow-dragon", 0], ["K1wly2h99j8", "dinosaur-dance", 0]]],
    cry: ['哭哭貓', [["ikTQ-pi_GyM", "cat-cry-kitten-cry", 1], ["5N0m-99IRos", "cat-crying", 1], ["_3BqrlB6mVI", "sad-sad-cat", 1], ["kyJAJB62rGM", "sad-cat", 1], ["VYot5egVEt8", "cat-crying-cat", 0], ["14b3oQe1uw0", "cat-crying-cat", 0], ["0QkZnCmGFX0", "banana-cat-banana-cat-crying", 0], ["KyTSHBMDmMI", "cat-crying-cat", 0], ["EGneBJlyNGo", "cat-crying-cat", 0], ["wk8ueqUDJBs", "cat-cry-cute", 0], ["AwMr7A1dZVc", "crying-cat-sad-cat", 0], ["9a9g-pOTZHk", "nsb14-meowl", 0], ["d9PoZm99CTg", "sadcat-crying-cat", 0], ["ufPsZFFomo4", "crying-cat-sad-cat", 0]]],
    shock: ['震驚貓', [["SuVGs-GL7Ro", "shocked-shocked-cat", 1], ["YYt4SeC12Nc", "omg-schock", 1], ["1zMZJqDSiOs", "wow-awesome", 1], ["aSHBPR_gCXQ", "shocked-surprised", 1], ["GZskxWx-48U", "cat-cat-meme", 1], ["CNI1fSM1XSo", "shocked-surprised", 0], ["btYkcmAPyCc", "cat-flabbergasted", 0], ["JgJ9BQVFT8M", "shocked-cat", 0], ["eyd22Sr49aQ", "say-what-woah", 0], ["VH28Xl67QD4", "ha", 0], ["V9irLqnUcLs", "shock-shocked", 0], ["cx-6vijuIsE", "kyo-cat", 0], ["yv0Y7-Tt9-U", "omg-cat", 0], ["ZuXnTDxIbjQ", "shocked-shocked-cat", 0], ["U3no6l5qz7Y", "shock-cat-shock", 0], ["keHPVm2ArXc", "stellarnushu", 0]]],
    clap: ['拍手', [["1Z3CkhWaWbM", "cat-catmeme", 1], ["oOeM3wX1Gto", "clapping-cat", 1], ["IrhE0Tc7Za0", "clapping-hands", 1], ["udeyohTRUKo", "clappi-clappi-clappi", 1], ["PQRkKRr9TBs", "bear-clap-clap", 1], ["Udj7rL0fan0", "smile", 1], ["6v9-LGHVbvg", "nice-bravo", 1], ["FkII0MF9ySo", "rabbit-sticker-bunny-sticker", 1], ["dCyV7txVjZc", "pengu-pudgy", 1], ["g-TTjIq8Wh8", "well-done-clap", 1], ["LFTQsK7LzBs", "clap-cat", 0], ["m3r_8NhxM9M", "cat-clapping-ai-cat-clapping", 0], ["s7UmfprIjPw", "clap-clapping", 0]]],
    speechless: ['無言', [["3iyXW84UMPY", "reaction-emotion", 1], ["xwp4HbxDego", "i-dont-know-what-to-say-confused", 1], ["rwmX4tQEM5k", "dont-know-what-to-say-dumbfounded", 1], ["QczwLeq6cOs", "line", 1], ["Zp309js7RZk", "yibo-wang-yibo", 1], ["eLVlG3oWAzE", "dont-know-what-to-say-dumbfounded", 0], ["ElayO469FlE", "hamster-hustling", 0], ["zPv37gqUnVc", "surprise-cat", 0], ["f02cT4A-dC4", "speechless-shocked", 0], ["oxJs0kRR2Y0", "ggmeow-speechless", 0], ["rHkObGZnD40", "cat", 0], ["YSfISiXlYqo", "holy-shit-holy-crap", 0]]],
    hot: ['熱門', [["bl_kkpr3kVo", "ultra-uno-reverse-card-uno-reverse-card", 0], ["KgaNE2deR7U", "violin-tiny", 0], ["rB8hWIin-2I", "hmm-suspect", 0], ["knLweartZ4A", "tongue-out-ca-white-cat", 0], ["D5xobfboBfM", "zootopia-nick-wilde", 0], ["0-wcS55fKQE", "yuh-huh", 0], ["y25bkMJsZtg", "lego-lego-batman", 0], ["Ag-_fLgiSJU", "stan-twitter-monkey", 0], ["2MVKIq70YZM", "clueless", 0], ["OeuYae1cQTk", "heart-cat", 0], ["Ue2HhEEP4Dg", "tired-cat", 0], ["hx73TtL7WcI", "cat-images", 0], ["W9DyiUQuukM", "gif-gifkk", 0], ["uI-TiNZoKnA", "pepe-laugh-pepe", 1], ["hfVjQ_ht3yU", "hahaha-lol", 0], ["PvXKgVlt6NY", "sus-susge", 1], ["oHn5usq0dDY", "sad-investor-watching-stock-crash-%E8%82%A1%E7%A5%A8%E5%A4%A7%E8%B7%8C%E7%9A%84%E5%B4%A9%E6%BD%B0%E7%8C%B4%E5%AD%90", 0]]],
    lol: ['笑死', [["-5wb89l9Tfg", "quby-laugh", 1], ["yG6Rp2BFLmY", "mochi-mochi-peach-cat-cat", 1], ["g30RdDcRL0w", "husky-laugh", 1], ["4RQPLDnqK7w", "milk-and-mocha-laughing-hysterically", 1], ["ShMz0zcxFCU", "hahaha-lol", 0], ["J4_WxmboYzA", "haha-lol", 0], ["CXYkbfaZZeE", "lengtoo-dying-of-laughter", 1], ["yd--wpYTwlY", "ecstatic-laugh-hard", 1], ["MSTammLe2e0", "hahaha-emoji", 1], ["E2aZT5nhSks", "rofl-laugh", 1], ["isVISFkL2KI", "crying-laughing-emoji-rofl", 0], ["mf0Ow78gt4w", "shum-sir", 1], ["DEb1mTNBI1k", "laphie", 1]]],
    wtf: ['傻眼崩潰', [["qjjU-KH4QVw", "speechless-dontknowwhat", 1], ["NaSTPlhhYOw", "watching-you-mochi", 1], ["XBwsRy9U0eg", "avi", 1], ["3m8RKx-n4so", "bubu-dudu-sseeyall", 1], ["Eiy9WdHo1WM", "%E5%B0%8F%E7%8C%AB%E5%90%83%E6%83%8A-what", 0], ["rNdcSgImTs4", "bruh-bruh-meme", 0], ["2Ln7upfBgv8", "capoo", 1], ["VZVeJ3Xp9Ao", "ggmeow-speechless", 1], ["LvJb089mmuM", "amicat-wow", 1], ["5UNzNTPDLMA", "%E7%9B%AE%E7%9E%AA%E5%8F%A3%E5%91%86-%E7%9E%B3%E5%AD%94%E5%9C%B0%E9%9C%87", 0], ["BZ-wKuKoS7Y", "bugcact-capoo", 1], ["FCYXArk5DNY", "capoo-bugcat", 1], ["GmuNS87tu88", "usagy-usagyuuun", 1], ["ARx4OyokBfM", "sad-crying", 1], ["zv2iQNQt9nk", "loading-catloading", 0]]],
    smug: ['得意白眼', [["D52UVShU2fE", "%E5%B0%8F%E3%84%90-%E5%BE%97%E6%84%8F", 1], ["ZDx9E73_Ks4", "cat-proud", 1], ["gswx4abtR4c", "ami-fat-cat-proud", 1], ["bGFi9e7b0f4", "amifatcat-thats-my-boy", 1], ["u6h1zmm-PFY", "cartoons", 1], ["icb4_aKFeGo", "tkthao219-bubududu", 1], ["FUwHtruGxH8", "bunny-pose", 0], ["_cenOrbRdIQ", "eye-roll-rolling-eyes", 1], ["SOB4NiETtmk", "roll-eyes", 1], ["VwCjkMyhZw4", "sad-martini", 1], ["tlSvnMhXWEg", "%E4%B8%89%E5%B0%8F-whatever", 0], ["GFI7p3feAwI", "%E6%B2%A1%E7%9C%BC%E7%9C%8B-peach-cat-and-goma", 1], ["x6XKhHRaD1Q", "%E5%81%B7%E6%87%92-%E6%8C%96%E9%BC%BB%E5%AD%94", 1], ["PPxamICGrgM", "lengtu-meh", 1]]],
    orig: ['原版梗', [["TltLEj_wFCc", "%E9%96%83%E8%BA%AB%E6%AD%A5-flash-step", 0], ["EIzChenjvgk", "%E9%96%83%E8%BA%AB%E6%AD%A5-meme", 0]]],
  };
  for (const g in THEMES) THEMES[g][1].forEach(([id, slug, cut]) =>
    STICKERS.push({ id: 't-' + id, group: g, cut: !!cut, name: THEMES[g][0], img: `${TENOR}${id}${cut ? 'AAAAm' : 'AAAA1'}/${slug}.webp` }));
  root.STICKERS = STICKERS;
})(this);
