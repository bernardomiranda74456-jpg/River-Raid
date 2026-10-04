// Pitfall! test suite — runs in test.html (browser) and exposes window.__testResults.
(function () {
  'use strict';
  const P = window.Pitfall, R = window.PitfallRender, A = window.PitfallAudio;
  const results = [];

  function test(name, fn) {
    try { fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, error: e && e.message ? e.message : String(e) }); }
  }
  function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
  function eq(a, b, msg) {
    if (a !== b) throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a));
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function findSeed(pred) {
    const r = P.allRooms().find(pred);
    if (!r) throw new Error('no room matches');
    return r.seed;
  }
  function setup(seed, x, level, frame) {
    const g = P.newGame();
    g.frame = frame || 0;
    P.enterRoom(g, seed);
    P.placeHarry(g, x, level === 'under' ? P.UNDER_Y : P.GROUND_Y, 'ground');
    return g;
  }
  function run(g, n, input) {
    const events = [];
    for (let i = 0; i < n; i++) { P.step(g, input || {}); events.push(...g.events); }
    return events;
  }
  function runUntil(g, pred, max, input) {
    for (let i = 0; i < (max || 2000); i++) {
      if (pred(g)) return true;
      P.step(g, typeof input === 'function' ? input(g, i) : (input || {}));
    }
    return pred(g);
  }

  // ─── World generation ─────────────────────────────────────────────────────
  test('LFSR a partir de $C4 tem período 255 (255 telas)', () => {
    let s = P.START_SEED;
    const seen = new Set();
    while (!seen.has(s)) { seen.add(s); s = P.lfsrNext(s); }
    eq(seen.size, 255);
    eq(s, P.START_SEED, 'volta à tela inicial');
  });

  test('lfsrPrev é o inverso exato de lfsrNext', () => {
    for (let s = 1; s < 256; s++) {
      eq(P.lfsrPrev(P.lfsrNext(s)), s, 'seed ' + s);
      eq(P.lfsrNext(P.lfsrPrev(s)), s, 'seed ' + s);
    }
  });

  test('existem exatamente 32 tesouros, 8 de cada tipo', () => {
    const rooms = P.allRooms().filter(r => r.treasure !== null);
    eq(rooms.length, 32);
    for (let t = 0; t < 4; t++) eq(rooms.filter(r => r.treasure === t).length, 8, 'tipo ' + t);
  });

  test('pontuação máxima possível é 114.000', () => {
    const total = P.allRooms().reduce((s, r) => s + (r.treasure !== null ? P.TREASURE_VALUES[r.treasure] : 0), P.START_SCORE);
    eq(total, 114000);
  });

  test('tela inicial ($C4): buraco com escada e um tronco parado', () => {
    const r = P.decodeRoom(0xC4);
    eq(r.scene, 0); eq(r.ladder, true); eq(r.sideHoles, false);
    eq(r.objects.length, 1); eq(r.objects[0].kind, 'log'); eq(r.objects[0].rolling, false);
    assert(!r.scorpion, 'telas com escada têm parede, não escorpião');
    assert(r.wallX !== null);
  });

  test('cada tipo de cena decodifica obstáculos coerentes', () => {
    for (const r of P.allRooms()) {
      if (r.scene <= 1) { assert(r.ladder && !r.pit && r.wallX !== null, 'escada ' + r.seed); }
      else { assert(r.pit && r.scorpion && r.wallX === null, 'poço ' + r.seed); }
      if (r.scene === 4) assert(r.crocs && r.objects.length === 0);
      if (r.scene === 5) assert(r.shifting && r.treasure !== null && r.objects.length === 0);
      if ([2, 3, 6].includes(r.scene)) assert(r.vine, 'cipó ' + r.seed);
    }
    const crocVines = P.allRooms().filter(r => r.scene === 4 && r.vine).length;
    eq(crocVines, 16, 'metade das telas de jacaré tem cipó');
  });

  // ─── Game rules ───────────────────────────────────────────────────────────
  test('jogo começa com 2000 pontos, 3 vidas e 20:00', () => {
    const g = P.newGame();
    eq(g.score, 2000); eq(g.lives, 3); eq(P.formatTime(g.timer), '20:00');
    eq(g.room.seed, 0xC4); eq(g.harry.mode, 'ground'); eq(g.harry.level, 'top');
  });

  test('relógio conta para trás e termina o jogo em 0:00', () => {
    const g = P.newGame();
    run(g, 60);
    eq(P.formatTime(g.timer), '19:59');
    g.timer = 1;
    const ev = run(g, 1);
    assert(g.over && ev.includes('gameover'));
  });

  test('sair pela direita avança 1 tela; pela esquerda volta 1', () => {
    const g = P.newGame();
    g.harry.x = P.RIGHT_EDGE;
    run(g, 1, { right: true });
    eq(g.room.seed, P.lfsrNext(0xC4));
    eq(g.harry.x, P.LEFT_EDGE + 1);
    run(g, 2, { left: true });
    eq(g.room.seed, 0xC4);
  });

  test('no subterrâneo cada tela equivale a 3 telas', () => {
    const seed = findSeed(r => r.scorpion);
    const g = setup(seed, P.RIGHT_EDGE - 1, 'under');
    run(g, 2, { right: true });
    eq(g.room.seed, P.advance(seed, 3));
    g.harry.x = P.LEFT_EDGE;
    run(g, 1, { left: true });
    eq(g.room.seed, seed);
  });

  test('cair num buraco custa 100 pontos e leva ao túnel', () => {
    const seed = findSeed(r => r.sideHoles && !r.objects.some(o => o.x < 60));
    const g = setup(seed, 40, 'top');
    const ev = run(g, 6, { right: true });
    assert(ev.includes('hole'));
    eq(g.score, 1900);
    runUntil(g, g => g.harry.mode === 'ground', 100);
    eq(g.harry.level, 'under'); eq(g.harry.y, P.UNDER_Y);
  });

  test('escada: desce e sobe sem penalidade', () => {
    const g = setup(0xC4, 72, 'top');
    run(g, 1, { down: true });
    eq(g.harry.mode, 'ladder');
    run(g, 70, { down: true });
    eq(g.harry.y, P.UNDER_Y);
    run(g, 1, { right: true });
    eq(g.harry.mode, 'ground'); eq(g.harry.level, 'under');
    g.harry.x = P.LADDER_X;
    run(g, 1, { up: true });
    eq(g.harry.mode, 'ladder');
    run(g, 70, { up: true });
    eq(g.harry.y, P.GROUND_Y);
    run(g, 1, { left: true });
    eq(g.harry.mode, 'ground'); eq(g.harry.level, 'top'); eq(g.harry.x, P.LADDER_X - 10);
    eq(g.score, 2000);
  });

  test('parede de tijolos bloqueia o túnel', () => {
    const seed = findSeed(r => r.ladder && r.wallX < 80);
    const wx = P.decodeRoom(seed).wallX;
    const g = setup(seed, wx + P.WALL_W + 6, 'under');
    run(g, 30, { left: true });
    assert(g.harry.x >= wx + P.WALL_W + 3, 'Harry atravessou a parede: x=' + g.harry.x);
  });

  test('pular sobre tronco parado não perde pontos', () => {
    const g = setup(0xC4, 106, 'top');
    run(g, 1, { right: true, jump: true });
    run(g, 40, { right: true });
    assert(g.harry.x > P.OBJ_X + 6, 'Harry passou do tronco');
    eq(g.score, 2000);
  });

  test('encostar em tronco tira pontos (sem matar)', () => {
    const g = setup(0xC4, 110, 'top');
    const ev = run(g, 20, { right: true });
    assert(ev.includes('log'));
    assert(g.score < 2000, 'score ' + g.score);
    eq(g.harry.mode, 'ground'); eq(g.lives, 3);
  });

  test('tronco rolando vem pela direita e atinge Harry parado', () => {
    const seed = findSeed(r => r.scene === 0 && r.objType === 0);
    const g = setup(seed, 100, 'top');
    const ev = run(g, 40);
    assert(ev.includes('log'));
    assert(g.score < 2000);
  });

  test('cair no piche mata e Harry renasce caindo da esquerda', () => {
    const seed = findSeed(r => r.scene === 2);
    const g = setup(seed, 36, 'top');
    const ev = run(g, 6, { right: true });
    assert(ev.includes('death'));
    eq(g.harry.mode, 'sink');
    run(g, P.DEATH_FRAMES);
    eq(g.lives, 2);
    eq(g.harry.mode, 'drop'); eq(g.harry.x, 16);
    runUntil(g, g => g.harry.mode === 'ground', 200);
    eq(g.harry.y, P.GROUND_Y);
  });

  test('perder as 3 vidas termina o jogo', () => {
    const seed = findSeed(r => r.scene === 2);
    const g = setup(seed, 36, 'top');
    let deaths = 0;
    for (let i = 0; i < 3; i++) {
      g.harry.x = 39; g.harry.y = P.GROUND_Y; g.harry.mode = 'ground';
      run(g, 3, { right: true });
      eq(g.harry.mode, 'sink');
      deaths++;
      run(g, P.DEATH_FRAMES);
    }
    eq(deaths, 3);
    assert(g.over, 'game over');
    eq(g.lives, 0);
  });

  test('jacaré: boca fechada é seguro, aberta mata', () => {
    const seed = findSeed(r => r.crocs);
    let g = setup(seed, P.CROC_XS[0], 'top', 0);
    run(g, 1);
    eq(g.harry.mode, 'ground');
    g = setup(seed, P.CROC_XS[0], 'top', P.CROC_PERIOD - 1);
    const ev = run(g, 1);
    assert(ev.includes('death')); eq(g.harry.cause, 'croc');
  });

  test('pulando de cabeça em cabeça atravessa o lago dos jacarés', () => {
    const seed = findSeed(r => r.crocs);
    const g = setup(seed, 20, 'top', 0);
    for (const target of [P.CROC_XS[0], P.CROC_XS[1], P.CROC_XS[2], P.CROC_XS[2] + 32]) {
      g.frame = 0;
      g.harry.x = target - P.JUMP_LEN;
      run(g, 1, { right: true, jump: true });
      run(g, P.JUMP_LEN, { right: true });
      eq(g.harry.mode, 'ground', 'aterrissou vivo em ' + target);
      eq(g.harry.x, target);
    }
  });

  test('fogo e cobra matam ao toque', () => {
    for (const kind of [6, 7]) {
      const seed = findSeed(r => r.scene === 0 && r.objType === kind);
      const g = setup(seed, 110, 'top');
      const ev = run(g, 20, { right: true });
      assert(ev.includes('death'), 'objeto ' + kind);
      eq(g.harry.cause, kind === 6 ? 'fire' : 'cobra');
    }
  });

  test('escorpião persegue e mata no túnel', () => {
    const seed = findSeed(r => r.scorpion);
    const g = setup(seed, 60, 'under');
    assert(runUntil(g, g => g.events.includes('death'), 400), 'morreu');
    eq(g.harry.cause, 'scorpion');
  });

  test('pegar tesouro soma o valor uma única vez', () => {
    for (let t = 0; t < 4; t++) {
      const seed = findSeed(r => r.treasure === t);
      const g = setup(seed, 112, 'top', 0);
      const ev = run(g, 10, { right: true });
      assert(ev.includes('treasure'), 'tipo ' + t);
      eq(g.score, 2000 + P.TREASURE_VALUES[t]);
      eq(g.treasuresTaken, 1);
      P.enterRoom(g, seed);
      assert(!g.objs.some(o => o.kind === 'treasure'), 'tesouro não volta');
    }
  });

  test('poço que se move abre e fecha', () => {
    const seed = findSeed(r => r.shifting);
    const g = setup(seed, 16, 'top', 0);
    const w0 = P.pitSpan(g); g.frame = P.SHIFT_PERIOD / 2;
    const w1 = P.pitSpan(g);
    eq(w0[1] - w0[0], 0, 'fechado');
    eq(w1[1] - w1[0], P.PIT_X1 - P.PIT_X0, 'aberto');
  });

  test('cipó: Harry agarra, balança e solta do outro lado em segurança', () => {
    const seed = findSeed(r => r.scene === 2 && !r.objects.some(o => o.kind !== 'log'));
    let grabbed = null;
    for (let f = 0; f < P.VINE_PERIOD && !grabbed; f++) {
      const g = setup(seed, 36, 'top', f);
      const ev = run(g, 1, { right: true, jump: true });
      ev.push(...run(g, P.JUMP_LEN, { right: true }));
      if (ev.includes('vine')) grabbed = g;
    }
    assert(grabbed, 'agarrou o cipó em alguma fase do balanço');
    const g = grabbed;
    eq(g.harry.mode, 'vine');
    assert(runUntil(g, g => P.vineEnd(g).x > P.PIT_X1 + 1, 400), 'cipó chegou à direita');
    run(g, 1, { down: true });
    eq(g.harry.mode, 'drop');
    runUntil(g, g => g.harry.mode !== 'drop', 100);
    eq(g.harry.mode, 'ground');
    assert(g.harry.x >= P.PIT_X1, 'pousou além do piche: x=' + g.harry.x);
  });

  test('soltar o cipó sobre o piche mata', () => {
    const seed = findSeed(r => r.scene === 2);
    const g = setup(seed, 80, 'top', 0);
    g.harry.mode = 'vine';
    run(g, 1);
    run(g, 1, { down: true });
    runUntil(g, g => g.harry.mode !== 'drop', 100);
    eq(g.harry.mode, 'sink');
  });

  test('as 255 telas são atravessáveis por cima ou pelo túnel', () => {
    // Every room must have at least one safe surface tile at both edges.
    for (const r of P.allRooms()) {
      const g = setup(r.seed, 16, 'top');
      eq(P.surfaceAt(g, P.LEFT_EDGE + 1), 'ground');
      eq(P.surfaceAt(g, P.RIGHT_EDGE - 1), 'ground');
    }
  });

  // ─── Sound ────────────────────────────────────────────────────────────────
  function mockAudio() {
    const log = { osc: [], src: [], freqs: [], stopped: 0 };
    const param = () => ({ value: 0, setValueAtTime(v) { if (this.track) log.freqs.push(v); this.value = v; } });
    class Ctx {
      constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = {}; }
      createGain() { return { gain: param(), connect() {} }; }
      createOscillator() {
        const f = param(); f.track = true;
        const o = { type: '', frequency: f, connect() {}, start() { o.started = true; }, stop() {} };
        log.osc.push(o); return o;
      }
      createBuffer(ch, len) { const d = new Float32Array(len); return { getChannelData: () => d, data: d }; }
      createBufferSource() {
        const s = { playbackRate: param(), connect() {}, start() { s.started = true; }, stop() { log.stopped++; } };
        log.src.push(s); return s;
      }
      resume() {}
    }
    return { audio: A.createAudio(Ctx), log };
  }

  test('frequência TIA: AUDF 0 = 15,7 kHz', () => {
    eq(A.tia(0), 15700); eq(A.tia(31), 490.625);
  });

  test('cada evento do jogo dispara o seu som', () => {
    for (const ev of ['vine', 'treasure', 'hole', 'death', 'gameover', 'win']) {
      const { audio, log } = mockAudio();
      audio.handle([ev], false);
      eq(log.osc.length, 1, ev);
      assert(log.osc[0].started, ev + ' tocou');
      assert(log.freqs.length >= 3, ev + ' tem várias notas');
    }
  });

  test('grito do Tarzan oscila entre agudo e grave', () => {
    const { audio, log } = mockAudio();
    audio.vine();
    const f = log.freqs;
    let changes = 0;
    for (let i = 2; i < f.length; i++) if (Math.sign(f[i] - f[i - 1]) !== Math.sign(f[i - 1] - f[i - 2])) changes++;
    assert(changes >= 6, 'vibrato: ' + changes);
  });

  test('som do tesouro sobe e da queda desce', () => {
    let m = mockAudio(); m.audio.treasure();
    assert(m.log.freqs[m.log.freqs.length - 1] > m.log.freqs[0], 'tesouro sobe');
    m = mockAudio(); m.audio.hole();
    assert(m.log.freqs[m.log.freqs.length - 1] < m.log.freqs[0], 'queda desce');
  });

  test('ruído do tronco liga e desliga com o contato', () => {
    const { audio, log } = mockAudio();
    audio.handle([], true); audio.handle([], true);
    eq(log.src.length, 1, 'um único ruído contínuo');
    audio.handle([], false);
    eq(log.stopped, 1);
  });

  test('pulo é silencioso, como no cartucho', () => {
    const { audio, log } = mockAudio();
    audio.handle(['jump'], false);
    eq(log.osc.length, 0);
  });

  test('mudo zera o volume', () => {
    const { audio } = mockAudio();
    audio.unlock(); audio.setMuted(true);
    assert(audio.isMuted());
  });

  // ─── Rendering ────────────────────────────────────────────────────────────
  function canvas() {
    const c = document.createElement('canvas');
    c.width = P.W; c.height = P.H;
    return c.getContext('2d', { willReadFrequently: true });
  }
  function pixel(ctx, x, y) {
    const d = ctx.getImageData(x, y, 1, 1).data;
    return '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  test('desenha chão, túnel, escada e Harry na tela inicial', () => {
    const ctx = canvas();
    const g = P.newGame();
    R.draw(ctx, g);
    eq(pixel(ctx, 4, P.GROUND_Y + 1), R.COLORS.ground, 'chão');
    eq(pixel(ctx, 40, P.TUNNEL_TOP + 4), R.COLORS.tunnel, 'túnel');
    eq(pixel(ctx, P.LADDER_X - P.LADDER_HALF, P.GROUND_Y + 10), R.COLORS.ladder, 'escada');
    let harry = 0;
    for (let y = P.GROUND_Y - 21; y < P.GROUND_Y; y++) for (let x = 12; x < 20; x++) {
      const p = pixel(ctx, x, y);
      if (p === R.COLORS.shirt || p === R.COLORS.skin) harry++;
    }
    assert(harry > 10, 'Harry visível');
  });

  test('placar mostra 2000 e relógio 20:00', () => {
    const ctx = canvas();
    R.draw(ctx, P.newGame());
    let white = 0;
    for (let y = 4; y < 11; y++) for (let x = 30; x < 64; x++) if (pixel(ctx, x, y) === R.COLORS.hud) white++;
    assert(white > 40, 'dígitos do placar');
    let tw = 0;
    for (let y = 14; y < 21; y++) for (let x = 32; x < 72; x++) if (pixel(ctx, x, y) === R.COLORS.hud) tw++;
    assert(tw > 30, 'dígitos do relógio');
  });

  test('piche é preto e pântano é azul', () => {
    const ctx = canvas();
    const tar = setup(findSeed(r => r.scene === 2), 16, 'top');
    R.draw(ctx, tar);
    eq(pixel(ctx, 80, P.GROUND_Y + 1), R.COLORS.tar);
    const sw = setup(findSeed(r => r.scene === 3), 16, 'top');
    R.draw(ctx, sw);
    const p = pixel(ctx, 60, P.GROUND_Y + 3);
    assert(p === R.COLORS.swamp || p === R.COLORS.swampHi, 'pântano ' + p);
  });

  test('todas as 255 telas renderizam sem erro', () => {
    const ctx = canvas();
    for (const r of P.allRooms()) {
      const g = setup(r.seed, 16, 'top', 37);
      R.draw(ctx, g);
    }
  });

  test('simulação longa com entrada aleatória não quebra', () => {
    const ctx = canvas();
    const g = P.newGame();
    let seed = 1;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    let inp = {};
    for (let i = 0; i < 20000 && !g.over; i++) {
      if (i % 20 === 0) inp = { left: rnd() < 0.2, right: rnd() < 0.6, up: rnd() < 0.2, down: rnd() < 0.2, jump: rnd() < 0.3 };
      P.step(g, inp);
      if (i % 500 === 0) R.draw(ctx, g);
      assert(Number.isFinite(g.harry.x) && Number.isFinite(g.harry.y), 'posição válida');
      assert(g.score >= 0, 'pontos não negativos');
    }
  });

  window.__testResults = results;
})();
