'use strict';
// Menus, the frame loop and the glue between input, match and renderer.
(function () {
  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const renderer = new PB.Renderer(canvas);
  const input = new PB.Input(canvas);

  const DEFAULTS = { difficulty: 'pro', targetPoints: '11', sets: '1' };
  // Só entra no cfg o que a tela ainda oferece: uma escolha antiga guardada no
  // aparelho (7 pontos, o desenho dos jogadores) viraria um botão sem par.
  const ESCOLHAS = { difficulty: ['facil', 'pro'], targetPoints: ['5', '11'], sets: ['1', '3'] };
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
    let raw = {};
    try { raw = JSON.parse(store.get('pb.cfg') || '{}') || {}; } catch (e) { /* não serve */ }
    const c = Object.assign({}, DEFAULTS);
    for (const k of Object.keys(DEFAULTS)) {
      if (ESCOLHAS[k].indexOf(raw[k]) >= 0) c[k] = raw[k];
    }
    return c;
  }
  function save() { store.set('pb.cfg', JSON.stringify(cfg)); }

  // ── screens ──────────────────────────────────────────────────────────────
  const screens = ['scr-splash', 'scr-title', 'scr-setup', 'scr-tutorial', 'scr-pause', 'scr-over'];
  // The company mark is shown in silence and the music comes in as it closes.
  // The menu screens share one loop; the match itself has none, so the
  // rally sounds and the crowd carry it. The end-of-match cue is started by
  // gameOver, and the pause screen keeps the match's silence.
  const MENU_SCREENS = ['scr-title', 'scr-setup', 'scr-tutorial'];
  function show(id) {
    if (MENU_SCREENS.indexOf(id) >= 0) PB.Audio.music('menu');
    else if (id === null) PB.Audio.stopMusic(0.6);
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
  // Every kind of tap gets the chance to bring sound back: iOS does not count a
  // bare pointerdown as a gesture that may start audio, but it does count the
  // end of a touch and a click.
  // The first of them also creates the audio context, since the menu music can
  // only start from inside a gesture; after that it only unlocks.
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click']) {
    document.addEventListener(ev, () => {
      if (ev === 'pointerdown') PB.Audio.unlock(); else PB.Audio.init();
    }, { passive: true, capture: true });
  }
  window.addEventListener('orientationchange', () => PB.Audio.resume());
  document.addEventListener('visibilitychange', () => { if (document.hidden) PB.Audio.suspend(); else PB.Audio.resume(); });
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
    PB.Audio.init();
    PB.Audio.setMuted(!sound);
    match = new PB.Match({
      format: 'doubles',
      difficulty: cfg.difficulty,
      targetPoints: parseInt(cfg.targetPoints, 10),
      sets: parseInt(cfg.sets, 10),
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
        // The umpire calls it, then the crowd answers — a second serve included,
        // since the rally that just ended was worth watching either way.
        const spoke = PB.Audio.call(e.call);
        if (!spoke) PB.Audio.play('point');
        PB.Audio.play('crowd', e.cheer || 0.6, e.final, spoke ? 0.38 : 0);
        buzz(28);
      }
    }
    m.events.length = 0;
  }

  function gameOver() {
    const m = match;
    const bo3 = m.cfg.sets >= 3;
    const won = m.players[m.humanIdx].team === m.matchWinner;
    // a happy cue for a win, a sad one for a loss; the old synthesised
    // fanfare only if the page carries no music
    if (!PB.Audio.music(won ? 'win' : 'lose')) PB.Audio.play('win');
    $('over-title').textContent = I18n.t(won ? 'ui.over.win' : 'ui.over.lose');
    // best of three: the big number is the sets, the games go underneath
    $('over-score').textContent = bo3 ? `${m.sets[0]} - ${m.sets[1]}` : `${m.score[0]} - ${m.score[1]}`;
    $('over-sub').textContent = I18n.t('ui.over.sub', {
      n: m.cfg.targetPoints,
      sets: I18n.t('ui.sets.' + m.cfg.sets),
      diff: I18n.t('ui.diff.' + m.cfg.difficulty),
    }) + (bo3 ? '\n' + I18n.t('ui.over.games', { list: m.history.map(g => g.join('-')).join(', ') }) : '');
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

  // Entry screen: the mark fades up over 1.3 s, holds for three, then the menu
  // takes over.
  // A tap cuts the wait short for anyone who has seen it before.
  const SPLASH_MS = 4300;
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

  PB.Audio.setMuted(!sound);
  // The audio is created at boot rather than on the first tap, so the menu
  // music is decoded and ready by the time the company mark closes. Where the
  // browser lets a page play before any touch it starts right there; where it
  // does not (iPhone), it is already queued and plays from its first note on
  // the first touch.
  PB.Audio.init();
  paintLangs();
  paintSound();
  syncOpts();
  resize();
  show('scr-splash');
  requestAnimationFrame(frame);
})();
