'use strict';
// Menus, the frame loop and the glue between input, match and renderer.
(function () {
  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const renderer = new PB.Renderer(canvas);
  const input = new PB.Input(canvas);

  const DEFAULTS = { format: 'singles', difficulty: 'normal', targetPoints: '11', charStyle: 'boneco' };
  // Storage can throw outright (private mode, sandboxed frame, site data blocked),
  // so every read and write goes through here.
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* not available */ } },
  };
  let cfg = load();
  // Language: what was chosen before, else whatever the phone asks for.
  const I18n = PB.I18n;
  let lang = I18n.setLang(store.get('pb.lang') || I18n.detect());
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
  const screens = ['scr-splash', 'scr-title', 'scr-setup', 'scr-tutorial', 'scr-pause', 'scr-over'];
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
  }

  // ── language ─────────────────────────────────────────────────────────────
  function paintLangs() {
    document.querySelectorAll('#langs .lang').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
    });
  }
  function setLang(l) {
    lang = I18n.setLang(l);
    store.set('pb.lang', lang);
    paintLangs();
    paintSound();
    // anything painted by hand rather than by data-i18n
    if ($('scr-tutorial').classList.contains('on')) paintTutorial();
  }
  document.querySelectorAll('#langs .lang').forEach(b => {
    b.onclick = () => { setLang(b.dataset.lang); buzz(8); };
  });

  function paintSound() {
    $('btn-sound').textContent = (sound ? '🔊 ' : '🔇 ') + I18n.t('ui.sound');
  }

  function buzz(ms) { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }

  // ── buttons ──────────────────────────────────────────────────────────────
  // Every tap is a chance to unlock audio on iOS, and to wake it after the
  // page was backgrounded. Cheap, and it makes the first sound reliable.
  document.addEventListener('pointerdown', () => PB.Audio.unlock(), { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) PB.Audio.resume(); });
  $('btn-play').onclick = () => { PB.Audio.init(); syncOpts(); show('scr-setup'); };
  // ── tutorial ─────────────────────────────────────────────────────────────
  let tutAt = 0;
  $('tut-dots').innerHTML = PB.Tutorial.steps().map(() => '<i></i>').join('');
  const dots = Array.from($('tut-dots').children);

  function paintTutorial() {
    const steps = PB.Tutorial.steps();
    const st = steps[tutAt];
    $('tut-step').textContent = I18n.t('ui.tut.step', { a: tutAt + 1, b: steps.length });
    dots.forEach((d, i) => d.classList.toggle('on', i === tutAt));
    $('tut-stage').innerHTML = `<div class="tut-art">${st.stage}</div>`;
    $('tut-body').innerHTML = `<h3>${st.title}</h3>${st.body}`;
    $('btn-tut-prev').disabled = tutAt === 0;
    $('btn-tut-next').textContent = I18n.t(tutAt === steps.length - 1 ? 'ui.tut.playnow' : 'ui.tut.next');
    $('scr-tutorial').scrollTop = 0;
  }
  function openTutorial() { tutAt = 0; paintTutorial(); show('scr-tutorial'); }

  $('btn-tutorial').onclick = openTutorial;
  $('btn-tut-home').onclick = () => show('scr-title');
  $('btn-tut-prev').onclick = () => { if (tutAt > 0) { tutAt--; paintTutorial(); } };
  $('btn-tut-next').onclick = () => {
    if (tutAt < PB.Tutorial.steps().length - 1) { tutAt++; paintTutorial(); }
    else { PB.Audio.init(); syncOpts(); show('scr-setup'); }
  };
  $('btn-back').onclick = () => show('scr-title');
  $('btn-sound').onclick = () => {
    sound = !sound;
    PB.Audio.init();
    PB.Audio.setMuted(!sound);
    store.set('pb.sound', sound ? '1' : '0');
    paintSound();
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
      difficulty: cfg.difficulty,
      targetPoints: parseInt(cfg.targetPoints, 10),
    });
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
      // let the input layer know whether the player is the one waiting to serve
      input.serveSlots.p1 = match.state === 'ready' && match.humanIdx === match.serverIdx;
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
        // The umpire calls it, then the crowd answers. A second serve is not a
        // point, so nobody claps for it.
        const spoke = PB.Audio.call(e.call);
        if (!spoke) PB.Audio.play('point');
        if (e.call !== 'second') PB.Audio.play('crowd', e.cheer || 0.6, e.final, spoke ? 0.38 : 0);
        buzz(28);
      }
    }
    m.events.length = 0;
  }

  function gameOver() {
    const m = match;
    PB.Audio.play('win');
    const s = m.score;
    const won = m.players[m.humanIdx].team === m.winner;
    $('over-title').textContent = I18n.t(won ? 'ui.over.win' : 'ui.over.lose');
    $('over-score').textContent = `${s[0]} - ${s[1]}`;
    $('over-sub').textContent = I18n.t('ui.over.sub', {
      format: I18n.t(m.cfg.format === 'doubles' ? 'ui.format.doubles' : 'ui.format.singles'),
      n: m.cfg.targetPoints,
      diff: I18n.t('ui.diff.' + m.cfg.difficulty),
    });
    show('scr-over');
  }

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

  // Entry screen: the mark fades up over 1.2 s, holds, then the menu takes over.
  // A tap cuts the wait short for anyone who has seen it before.
  const SPLASH_MS = 2300;
  let splashDone = false;
  function leaveSplash() {
    if (splashDone) return;
    splashDone = true;
    clearTimeout(splashTimer);
    $('scr-splash').removeEventListener('pointerdown', leaveSplash);
    show('scr-title');
  }
  const splashTimer = setTimeout(leaveSplash, SPLASH_MS);
  $('scr-splash').addEventListener('pointerdown', leaveSplash);

  paintLangs();
  paintSound();
  syncOpts();
  resize();
  show('scr-splash');
  requestAnimationFrame(frame);
})();
