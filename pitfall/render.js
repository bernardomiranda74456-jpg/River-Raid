// Pitfall! renderer: draws a game state onto a 160×192 canvas context.
(function (root) {
  'use strict';
  const P = root.Pitfall || (typeof require !== 'undefined' && require('./engine.js'));

  // Approximate NTSC Atari 2600 palette entries used by the cartridge.
  const C = {
    canopy: '#1a5410', leaf: '#346c18', jungle: '#4c8c2c', trunk: '#6c4010',
    vine: '#5c4410', ground: '#bcac44', earth: '#a08c2c', tunnel: '#000000',
    deep: '#887420', tar: '#000000', swamp: '#2c50b0', swampHi: '#4c70d0',
    brick: '#b03c28', mortar: '#d0c8b0', ladder: '#d0c050',
    hair: '#4c2c00', skin: '#e4a870', shirt: '#5cbc3c', pants: '#e0d8a0', boots: '#3c2400',
    log: '#8c5018', logDark: '#542c08', croc: '#2c7c1c', crocEye: '#e8e840',
    fire1: '#e84c1c', fire2: '#f8a03c', fire3: '#f8f070', cobra: '#c8c8c8', cobraEye: '#e83c3c',
    scorpion: '#ececec', silver: '#c8c8d0', gold: '#e8c030', bag: '#a8a8a8', ring: '#e8c030',
    diamond: '#f0f0ff', hud: '#ececec',
  };

  // Sprites: one string per row; '.' = transparent, other chars index a colour map.
  const HARRY_UP = [
    '...hhh..', '..hhhhh.', '..hfff..', '...fff..', '...ff...',
    '..ssss..', '.ssssss.', '.s.ss.s.', '.s.ss.s.', '.f.ss.f.', '...ss...',
  ];
  const HARRY_RUN_ARMS = [
    '...hhh..', '..hhhhh.', '..hfff..', '...fff..', '...ff...',
    '..ssss..', '.sssssss', 's.sss..f', 's.sss...', 'f.ss....', '...ss...',
  ];
  const LEGS = {
    stand: ['..pppp..', '..pppp..', '..p..p..', '..p..p..', '..p..p..', '..p..p..', '..p..p..', '..p..p..', '..b..b..', '.bb..bb.'],
    run1: ['..pppp..', '.pp..pp.', '.p....p.', 'pp....pp', 'p......p', 'p......p', 'p......p', 'p......p', 'b......b', 'bb....bb'],
    run2: ['..pppp..', '..pppp..', '..p.pp..', '..p..p..', '.pp..p..', '.p...p..', '.p...pp.', '.p....p.', '.b....b.', 'bb....bb'],
    run3: ['..pppp..', '..pppp..', '...pp...', '...pp...', '...pp...', '...pp.p.', '...ppp..', '...pp...', '...bb...', '...bbb..'],
    jump: ['..pppp..', '.pppppp.', 'pp....pp', 'p......p', 'b......b', 'bb....bb', '........', '........', '........', '........'],
  };
  const HARRY_HANG = [
    'f......f', 's......s', 's.hhh..s', 's.hhhh.s', '.shfffs.', '.s.ff.s.', '..ssss..',
    '..ssss..', '..ssss..', '..ssss..', '...ss...',
    '..pppp..', '..pppp..', '..p..p..', '..p..p..', '..p..p..', '..p..p..', '..p..p..', '..p..p..', '..b..b..', '..b..b..',
  ];
  const HARRY_CLIMB = [
    '...hhh..', '..hhhhh.', 'f.hhhh..', 's.hhh..f', 's.hh...s', 'ssssssss', '.ssssss.',
    '..ssss..', '..ssss..', '..ssss..', '...ss...',
    '..pppp..', '..pppp..', '..p..p..', '..p..p..', '..p..pp.', '..p...p.', '.pp...p.', '.p....b.', '.b....bb', 'bb......',
  ];
  const HARRY_KNEEL = [
    '........', '........', '........', '........',
    '...hhh..', '..hhhhh.', '..hfff..', '...fff..', '...ff...',
    '..ssss..', '.ssssss.', '.s.ss.s.', '.f.ss.f.', '...ss...',
    '..pppp..', '..ppppp.', '..p..pp.', '..p...p.', '..pp..p.', '..b...bb', '.bb.....',
  ];
  const HARRY_COLORS = { h: C.hair, f: C.skin, s: C.shirt, p: C.pants, b: C.boots };

  const LOG = [
    ['..LLLL..', '.LLLLLL.', 'LLdLLLLL', 'LLLLLdLL', 'LLLLLLLL', 'LdLLLLLL', '.LLLdLL.', '..LLLL..'],
    ['..LLLL..', '.LLLLLL.', 'LLLLdLLL', 'LdLLLLLL', 'LLLLLLdL', 'LLLLLLLL', '.LdLLLL.', '..LLLL..'],
  ];
  const FIRE = [
    ['...r....', '..rr.r..', '..ror.r.', '.rooorr.', '.roooor.', 'rooyyoor', 'royyyyor', 'royyyyor', '.LLLLLL.', 'LLLLLLLL'],
    ['....r...', '.r.rr...', '.r.ror..', '.rroooe.', '.roooor.', 'roooyoor', 'royyyyor', 'royyyyor', '.LLLLLL.', 'LLLLLLLL'],
  ];
  const COBRA = ['..ccc...', '.ccecc..', '.cc.cc..', '....cc..', '...cc...', '..cc....', '.cc.....', '.cccccc.', 'cc....cc', '.cccccc.'];
  const SCORPION = [
    ['.....s..', '....s.s.', '.....ss.', '..ss.s..', '.sssss..', 'ssssss..', 's.s.s.s.', '.s.s.s.s'],
    ['......s.', '....ss..', '.....ss.', '..ss.s..', '.sssss..', 'ssssss..', '.s.s.s.s', 's.s.s.s.'],
  ];
  const CROC_CLOSED = ['..cccccccccc....', 'cccccccccccccccc', 'cyccccccccccccc.'];
  const CROC_OPEN = ['cc..............', 'cyc.............', 'ccccc...........', 'cccccccccccccccc', '.ccccccccccccccc'];
  const TREASURE = [
    ['...gg...', '..g..g..', '...gg...', '..gggg..', '.gggggg.', 'gg.gg.gg', 'gggg.ggg', 'gg.gg.gg', '.gggggg.', '..gggg..'],
    ['........', '........', '........', '..aaaaaa', '.aaaaaaa', 'aaaaaaa.', 'aaaaaa..', '........'],
    ['........', '........', '........', '..aaaaaa', '.aaaaaaa', 'aaaaaaa.', 'aaaaaa..', '........'],
    ['...dd...', '..dddd..', '...dd...', '..y..y..', '.y....y.', '.y....y.', '..y..y..', '...yy...'],
  ];

  // Tree trunk x positions for the four tree patterns.
  const TREES = [[20, 52, 104, 136], [12, 60, 96, 144], [28, 44, 112, 128], [16, 68, 88, 140]];

  const FONT = {
    '0': ['111', '101', '101', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '010', '010', '111'],
    '2': ['111', '001', '001', '111', '100', '100', '111'],
    '3': ['111', '001', '001', '111', '001', '001', '111'],
    '4': ['101', '101', '101', '111', '001', '001', '001'],
    '5': ['111', '100', '100', '111', '001', '001', '111'],
    '6': ['111', '100', '100', '111', '101', '101', '111'],
    '7': ['111', '001', '001', '010', '010', '010', '010'],
    '8': ['111', '101', '101', '111', '101', '101', '111'],
    '9': ['111', '101', '101', '111', '001', '001', '111'],
    ':': ['000', '010', '010', '000', '010', '010', '000'],
  };

  function sprite(ctx, rows, colors, x, y, flip, maxY) {
    for (let r = 0; r < rows.length; r++) {
      const py = y + r;
      if (maxY !== undefined && py >= maxY) break;
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[flip ? row.length - 1 - c : c];
        if (ch === '.') continue;
        ctx.fillStyle = colors[ch];
        ctx.fillRect(x + c, py, 1, 1);
      }
    }
  }

  function text(ctx, str, x, y, color) {
    ctx.fillStyle = color || C.hud;
    for (const ch of str) {
      const g = FONT[ch];
      if (g) for (let r = 0; r < 7; r++) for (let c = 0; c < 3; c++) {
        if (g[r][c] === '1') ctx.fillRect(x + c * 2, y + r, 2, 1);
      }
      x += 8;
    }
  }

  function harryRows(g) {
    const h = g.harry;
    if (h.mode === 'vine') return HARRY_HANG;
    if (h.mode === 'ladder') return (h.walkT >> 3) % 2 ? HARRY_CLIMB : HARRY_CLIMB.map(r => r.split('').reverse().join(''));
    if (h.hit) return HARRY_KNEEL;
    if (h.mode === 'jump' || h.mode === 'drop') return HARRY_UP.concat(LEGS.jump);
    if (h.mode === 'fall') return HARRY_UP.concat(LEGS.jump);
    if (h.moving) {
      const f = (h.walkT >> 2) % 4;
      const legs = [LEGS.run1, LEGS.run2, LEGS.run3, LEGS.run2][f];
      return (f % 2 ? HARRY_UP : HARRY_RUN_ARMS).concat(legs);
    }
    return HARRY_UP.concat(LEGS.stand);
  }

  function drawPitShape(ctx, x0, x1, y, color) {
    // rounded-ended pool: rows get narrower further down
    const insets = [0, 1, 2, 4, 6];
    for (let i = 0; i < insets.length; i++) {
      const a = x0 + insets[i], b = x1 - insets[i];
      if (b > a) { ctx.fillStyle = color; ctx.fillRect(a, y + i * 2, b - a, 2); }
    }
  }

  function draw(ctx, g) {
    const r = g.room, h = g.harry;
    const GY = P.GROUND_Y, TT = P.TUNNEL_TOP, UY = P.UNDER_Y;

    // Jungle background and canopy
    ctx.fillStyle = C.jungle; ctx.fillRect(0, 0, P.W, GY);
    ctx.fillStyle = C.canopy; ctx.fillRect(0, 0, P.W, 52);
    // leaf texture + jagged lower edge of the canopy
    ctx.fillStyle = C.leaf;
    for (let x = 0; x < P.W; x += 8) {
      const k = ((x >> 3) * 7 + r.trees * 3) % 5;
      ctx.fillRect(x, 30 + k, 6, 3);
      ctx.fillRect(x + 2, 40 + ((k + 2) % 5), 5, 3);
    }
    ctx.fillStyle = C.canopy;
    for (let x = 0; x < P.W; x += 4) {
      const depth = [2, 5, 7, 4, 1, 6, 3, 8][((x >> 2) + r.trees) % 8];
      ctx.fillRect(x, 52, 4, depth);
    }

    // Trunks with branches
    ctx.fillStyle = C.trunk;
    for (const tx of TREES[r.trees]) {
      ctx.fillRect(tx, 52, 4, GY - 52);
      ctx.fillRect(tx - 4, 54, 4, 2); ctx.fillRect(tx + 4, 56, 4, 2);
      ctx.fillRect(tx - 1, GY - 3, 6, 3);
    }

    // Vine
    if (r.vine) {
      const e = P.vineEnd(g);
      ctx.fillStyle = C.vine;
      const n = 60;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        ctx.fillRect(Math.round(P.VINE_PX + (e.x - P.VINE_PX) * t), Math.round(P.VINE_PY + (e.y - P.VINE_PY) * t), 1, 1);
      }
    }

    // Ground, earth and tunnel
    ctx.fillStyle = C.ground; ctx.fillRect(0, GY, P.W, 6);
    ctx.fillStyle = C.earth; ctx.fillRect(0, GY + 6, P.W, TT - GY - 6);
    ctx.fillStyle = C.tunnel; ctx.fillRect(0, TT, P.W, UY - TT);
    ctx.fillStyle = C.earth; ctx.fillRect(0, UY, P.W, 8);
    ctx.fillStyle = C.deep; ctx.fillRect(0, UY + 8, P.W, P.H - UY - 8);

    // Holes and ladder
    if (r.ladder) {
      const holes = [[P.LADDER_X - P.LADDER_HALF, P.LADDER_X + P.LADDER_HALF]];
      if (r.sideHoles) holes.push(...P.SIDE_HOLES);
      ctx.fillStyle = C.tunnel;
      for (const [a, b] of holes) ctx.fillRect(a, GY, b - a, TT - GY);
      ctx.fillStyle = C.ladder;
      const lx = P.LADDER_X - P.LADDER_HALF;
      ctx.fillRect(lx, GY, 1, UY - GY); ctx.fillRect(lx + 7, GY, 1, UY - GY);
      for (let y = GY + 2; y < UY; y += 4) ctx.fillRect(lx, y, 8, 1);
    }

    // Pits
    const span = P.pitSpan(g);
    if (span && span[1] - span[0] > 0) {
      drawPitShape(ctx, span[0], span[1], GY, r.pit === 'tar' ? C.tar : C.swamp);
      if (r.pit === 'swamp') {
        ctx.fillStyle = C.swampHi;
        for (let x = span[0] + 4; x < span[1] - 4; x += 10) ctx.fillRect(x + ((g.frame >> 4) % 3), GY + 1, 3, 1);
      }
    }
    if (r.crocs) {
      const open = P.crocsOpen(g);
      for (const cx of P.CROC_XS) {
        const rows = open ? CROC_OPEN : CROC_CLOSED;
        sprite(ctx, rows, { c: C.croc, y: C.crocEye }, cx - 8, GY - rows.length + 2);
      }
    }

    // Underground wall / scorpion
    if (r.wallX !== null) {
      for (let y = TT; y < UY; y += 4) {
        ctx.fillStyle = C.mortar; ctx.fillRect(r.wallX, y, P.WALL_W, 4);
        ctx.fillStyle = C.brick;
        const off = ((y - TT) >> 2) % 2 ? 0 : 4;
        ctx.fillRect(r.wallX, y, P.WALL_W, 3);
        ctx.fillStyle = C.mortar; ctx.fillRect(r.wallX + off, y, 1, 3);
      }
    }
    if (r.scorpion) {
      sprite(ctx, SCORPION[(g.frame >> 3) % 2], { s: C.scorpion }, g.scorpionX - 4, UY - 8, h.x < g.scorpionX);
    }

    // Ground objects
    for (const o of g.objs) {
      if (o.kind === 'log') {
        const f = o.rolling ? (g.frame >> 2) % 2 : 0;
        sprite(ctx, LOG[f], { L: C.log, d: C.logDark }, Math.round(o.x) - 4, GY - 8);
      } else if (o.kind === 'fire') {
        sprite(ctx, FIRE[(g.frame >> 2) % 2], { r: C.fire1, o: C.fire2, y: C.fire3, e: C.fire1, L: C.log }, o.x - 4, GY - 10);
      } else if (o.kind === 'cobra') {
        sprite(ctx, COBRA, { c: C.cobra, e: C.cobraEye }, o.x - 4, GY - 10, h.x < o.x);
      } else if (o.kind === 'treasure') {
        const rows = TREASURE[o.type];
        const col = { g: C.bag, a: o.type === 1 ? C.silver : C.gold, d: C.diamond, y: C.ring };
        sprite(ctx, rows, col, o.x - 4, GY - rows.length);
      }
    }

    // Harry
    const rows = harryRows(g);
    const hx = Math.round(h.x) - 4;
    const hy = Math.round(h.y) - rows.length;
    const flip = h.dir < 0 && h.mode !== 'vine' && h.mode !== 'ladder';
    const blink = h.mode === 'dead' && (h.deadT >> 3) % 2;
    if (!blink) sprite(ctx, rows, HARRY_COLORS, hx, hy, flip, h.mode === 'sink' ? GY + 1 : undefined);

    // HUD: score, lives tally, timer
    const sc = String(g.score);
    text(ctx, sc, 64 - sc.length * 8, 4);
    ctx.fillStyle = C.hud;
    for (let i = 0; i < g.lives - 1; i++) ctx.fillRect(18 + i * 4, 14, 1, 7);
    text(ctx, P.formatTime(g.timer), 32, 14);
  }

  const api = { draw, sprite, text, COLORS: C, TREES, FONT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PitfallRender = api;
})(this);
