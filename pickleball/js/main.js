'use strict';
// Menus, the frame loop and the glue between input, match and renderer.
(function () {
  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const renderer = new PB.Renderer(canvas);
  const input = new PB.Input(canvas);

  const DEFAULTS = { format: 'singles', humans: '1', arrangement: 'coop', difficulty: 'normal', targetPoints: '11', charStyle: 'atletico' };
  // Storage can throw outright (private mode, sandboxed frame, site data blocked),
  // so every read and write goes through here.
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* not available */ } },
  };
  let cfg = load();
  let match = null;
  let last = 0;
  let sound = store.get('pb.sound') !== '0';

  function load() {
    try {
      const raw = JSON.parse(store.get('pb.cfg') || '{}');
      return Object.assign({}, DEFAULTS, raw);
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function save() { store.set('pb.cfg', JSON.stringify(cfg)); }

  // ── screens ──────────────────────────────────────────────────────────────
  const screens = ['scr-title', 'scr-setup', 'scr-how', 'scr-pause', 'scr-over'];
  function show(id) {
    for (const s of screens) $(s).classList.toggle('on', s === id);
    $('pauseBtn').classList.toggle('on', id === null);
    input.enabled = id === null;
    if (id !== null) input.reset();
  }

  // ── option buttons ───────────────────────────────────────────────────────
  document.querySelectorAll('.opts').forEach(grp => {
    grp.addEventListener('click', e => {
      const b = e.target.closest('.opt');
      if (!b) return;
      cfg[grp.dataset.group] = b.dataset.val;
      if (grp.dataset.group === 'charStyle') PB.Renderer.charStyle = cfg.charStyle;
      syncOpts();
      save();
      buzz(8);
    });
  });

  function syncOpts() {
    document.querySelectorAll('.opts').forEach(grp => {
      const key = grp.dataset.group;
      grp.querySelectorAll('.opt').forEach(b => b.setAttribute('aria-pressed', String(cfg[key] === b.dataset.val)));
    });
    const twoInDoubles = cfg.format === 'doubles' && cfg.humans === '2';
    $('grp-arrangement').style.display = twoInDoubles ? 'flex' : 'none';
  }

  function buzz(ms) { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }

  // ── buttons ──────────────────────────────────────────────────────────────
  $('btn-play').onclick = () => { PB.Audio.init(); syncOpts(); show('scr-setup'); };
  $('btn-how').onclick = () => show('scr-how');
  $('btn-how-back').onclick = () => show('scr-title');
  $('btn-back').onclick = () => show('scr-title');
  $('btn-sound').onclick = () => {
    sound = !sound;
    PB.Audio.init();
    PB.Audio.setMuted(!sound);
    store.set('pb.sound', sound ? '1' : '0');
    $('btn-sound').textContent = sound ? '🔊 Som' : '🔇 Som';
  };
  $('btn-start').onclick = () => start();
  $('pauseBtn').onclick = () => { if (match) { match.paused = true; show('scr-pause'); } };
  $('btn-resume').onclick = () => { if (match) { match.paused = false; show(null); } };
  $('btn-restart').onclick = () => start();
  $('btn-quit').onclick = () => { match = null; show('scr-title'); };
  $('btn-rematch').onclick = () => start();
  $('btn-menu').onclick = () => { match = null; show('scr-title'); };

  function start() {
    PB.Renderer.charStyle = cfg.charStyle;
    PB.Audio.init();
    PB.Audio.setMuted(!sound);
    match = new PB.Match({
      format: cfg.format,
      humans: parseInt(cfg.humans, 10),
      arrangement: cfg.arrangement,
      difficulty: cfg.difficulty,
      targetPoints: parseInt(cfg.targetPoints, 10),
    });
    input.split = match.versus;
    input.coop = !match.versus && match.cfg.humans === 2;
    input.reset();
    renderer.trail.length = 0;
    show(null);
  }

  // ── loop ─────────────────────────────────────────────────────────────────
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    if (!match) { return; }
    if (!match.paused) {
      if (input.coop) {
        const a = match.players[match.slot.p1], b = match.players[match.slot.p2];
        input.coopFlip = a.x < b.x;
      }
      // let the input layer know who is waiting to serve
      if (match.state === 'ready') {
        input.serveSlots.p1 = match.slot.p1 === match.serverIdx;
        input.serveSlots.p2 = match.slot.p2 === match.serverIdx;
      } else {
        input.serveSlots.p1 = false;
        input.serveSlots.p2 = false;
      }
      const state = input.sample(dt);
      match.update(dt, state);
      drain(match);
    } else {
      input.sample(dt);
    }
    renderer.draw(match, input);
    if (match.state === 'gameover' && !$('scr-over').classList.contains('on')) gameOver();
  }

  function drain(m) {
    for (const e of m.events) {
      if (e.type === 'hit') { PB.Audio.play('hit', (e.power || 30) / 60); buzz(6); }
      else if (e.type === 'bounce') PB.Audio.play('bounce', (e.impact || 8) / 20);
      else if (e.type === 'net') PB.Audio.play('net');
      else if (e.type === 'point') {
        PB.Audio.play('point');
        PB.Audio.play('crowd', e.cheer || 0.6);
        buzz(28);
      }
    }
    m.events.length = 0;
  }

  function gameOver() {
    const m = match;
    PB.Audio.play('win');
    const s = m.score;
    const humanTeams = new Set(m.players.filter(p => p.ctrl === 'human').map(p => p.team));
    let title;
    if (m.cfg.humans === 2 && humanTeams.size === 2) title = m.winner === 0 ? 'P1 venceu!' : 'P2 venceu!';
    else if (humanTeams.has(m.winner)) title = 'Você venceu!';
    else title = 'Você perdeu';
    $('over-title').textContent = title;
    $('over-score').textContent = `${s[0]} - ${s[1]}`;
    $('over-sub').textContent = `${m.cfg.format === 'doubles' ? 'Duplas' : 'Simples'} • até ${m.cfg.targetPoints} pontos • ${labelDiff(m.cfg.difficulty)}`;
    show('scr-over');
  }

  function labelDiff(d) { return d === 'facil' ? 'Fácil' : d === 'dificil' ? 'Difícil' : 'Normal'; }

  // ── boot ─────────────────────────────────────────────────────────────────
  function resize() { renderer.resize(); }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && match && !match.paused && $('scr-pause') && !$('scr-title').classList.contains('on')) {
      match.paused = true;
      show('scr-pause');
    }
  });

  // exposed for debugging and automated play-testing
  window.PBGame = { get match() { return match; }, input, renderer, start, cfg: () => cfg };

  $('btn-sound').textContent = sound ? '🔊 Som' : '🔇 Som';
  syncOpts();
  resize();
  show('scr-title');
  requestAnimationFrame(frame);
})();
