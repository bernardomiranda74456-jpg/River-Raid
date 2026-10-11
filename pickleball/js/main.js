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
    // the player's look, key by key, with the default for anything unknown
    c.look = menuLook(raw.look);
    return c;
  }
  function save() { store.set('pb.cfg', JSON.stringify(cfg)); }
  // On the menu every choice has a value: a missing shirt or skirt/shorts
  // colour is the team's own, which the match reads as null.
  function menuLook(raw) {
    const l = PB.Looks.normalize(raw);
    l.shirt = l.shirt || PB.Looks.DEFAULT_SHIRT;
    l.bottom = l.bottom || PB.Looks.DEFAULT_BOTTOM;
    return l;
  }

  // ── screens ──────────────────────────────────────────────────────────────
  const screens = ['scr-splash', 'scr-title', 'scr-setup', 'scr-player', 'scr-tutorial', 'scr-pause', 'scr-over'];
  // The company mark is shown in silence and the music comes in as it closes.
  // The menu screens share one loop; the match itself has none, so the
  // rally sounds and the crowd carry it. The end-of-match cue is started by
  // gameOver, and the pause screen keeps the match's silence.
  const MENU_SCREENS = ['scr-title', 'scr-setup', 'scr-player', 'scr-tutorial'];
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
    document.querySelectorAll('.opts[data-group]').forEach(grp => {
      const key = grp.dataset.group;
      grp.querySelectorAll('.opt').forEach(b => b.setAttribute('aria-pressed', String(cfg[key] === b.dataset.val)));
    });
  }

  // ── the player's look ────────────────────────────────────────────────────
  // Hair style, hair colour and skin tone. The swatches are painted from the
  // same table the renderer reads, so the menu can never show a colour the
  // figure does not wear.
  const Looks = PB.Looks;
  document.querySelectorAll('.looks').forEach(grp => {
    const table = { hair: Looks.HAIR, skin: Looks.SKIN, shirt: Looks.SHIRT, bottom: Looks.BOTTOM }[grp.dataset.look] || null;
    if (table) grp.querySelectorAll('.opt i').forEach(i => { i.style.background = table[i.parentNode.dataset.val]; });
    grp.addEventListener('click', e => {
      const b = e.target.closest('.opt');
      if (!b) return;
      cfg.look[grp.dataset.look] = b.dataset.val;
      cfg.look = menuLook(cfg.look);
      syncLooks();
      save();
      buzz(8);
    });
  });

  function syncLooks() {
    document.querySelectorAll('.looks').forEach(grp => {
      const key = grp.dataset.look;
      grp.querySelectorAll('.opt').forEach(b => b.setAttribute('aria-pressed', String(cfg.look[key] === b.dataset.val)));
    });
    // a swatch carries no word, so the label names the pick
    $('lbl-haircolor').textContent = I18n.t('ui.haircolor') + ' · ' + I18n.t('ui.hair.' + cfg.look.hair);
    $('lbl-skin').textContent = I18n.t('ui.skin') + ' · ' + I18n.t('ui.skin.' + cfg.look.skin);
    $('lbl-shirt').textContent = I18n.t('ui.shirt') + ' · ' + I18n.t('ui.shirt.' + cfg.look.shirt);
    // the colour label names the garment that was chosen
    const garment = cfg.look.garment === 'saia' ? 'ui.bottomcolor.skirt' : 'ui.bottomcolor.shorts';
    $('lbl-bottom').textContent = I18n.t(garment) + ' · ' + I18n.t('ui.bottom.' + cfg.look.bottom);
  }

  // The figure beside the choices is drawn by the game's own rig, facing the
  // camera in the chosen shirt, so what is chosen here is exactly what plays.
  // It redraws every frame while the screen is up, which keeps the blink.
  //
  // The canvas is measured by its box, never by itself: it sits out of the
  // flow (absolute inside the box), so changing its pixel size can never
  // change the layout. Measured on itself, in Safari, a canvas whose height
  // was a percentage of an auto-height box grew by the pixel ratio every
  // frame, and the whole screen zoomed away.
  const preview = $('player-preview');
  const previewBox = preview.parentNode;
  const model = { id: 0, team: 0, ctrl: 'cpu', crouch: 0.12, runPhase: 0, speedN: 0, prep: 0, swingT: 0 };
  function drawPreview() {
    if (!$('scr-player').classList.contains('on')) return;
    requestAnimationFrame(drawPreview);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = previewBox.clientWidth, h = previewBox.clientHeight;
    if (!w || !h) return;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (preview.width !== pw || preview.height !== ph) {
      preview.width = pw;
      preview.height = ph;
    }
    const ctx = preview.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    model.look = cfg.look;
    delete model._look;
    const s = h / 7.0;
    PB.Renderer.Char.draw(ctx, { side: 1 }, model, { x: w / 2, y: h - s * 0.7 }, s, false);
  }
  function openPlayer() { syncLooks(); show('scr-player'); drawPreview(); }

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
    if ($('scr-player').classList.contains('on')) syncLooks();
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
  $('btn-next').onclick = () => openPlayer();
  $('btn-player-back').onclick = () => show('scr-setup');
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
      look: cfg.look,
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
      else if (e.type === 'call') PB.Audio.call(e.call);     // match point, set point
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
  // takes over and the music comes in with it. A tap cuts the wait short.
  //
  // A phone that will not play sound before a touch (every browser on an
  // iPhone) would bring the menu up in silence and start the music on some
  // later tap. There the mark does not leave on its own: when its time is up
  // it asks for a touch, and that touch both closes it and lets the music in,
  // at the same instant. The tap is read on `click`, the event iOS accepts for
  // starting sound; the document listener unlocks the audio before this one
  // runs, and the click lands on the mark, not on a menu button under it.
  const SPLASH_MS = 4300;
  let splashDone = false;
  function leaveSplash() {
    if (splashDone) return;
    splashDone = true;
    clearTimeout(splashTimer);
    $('scr-splash').removeEventListener('click', leaveSplash);
    show('scr-title');
  }
  const splashTimer = setTimeout(() => {
    if (PB.Audio.state() === 'running' || PB.Audio.state() === 'none') leaveSplash();
    else $('scr-splash').classList.add('wait');          // shows "tap to enter"
  }, SPLASH_MS);
  $('scr-splash').addEventListener('click', leaveSplash);

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
