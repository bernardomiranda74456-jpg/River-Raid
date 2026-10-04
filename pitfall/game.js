// Pitfall! — main loop, input and screen scaling.
(function () {
  'use strict';
  const P = window.Pitfall, R = window.PitfallRender;
  const audio = window.PitfallAudio.createAudio();

  const view = document.getElementById('screen');
  const vctx = view.getContext('2d');
  const buf = document.createElement('canvas');
  buf.width = P.W; buf.height = P.H;
  const bctx = buf.getContext('2d');

  const SX = 4, SY = 2.5;           // Atari pixels are wider than tall
  view.width = P.W * SX; view.height = P.H * SY;

  let g = P.newGame();
  let mode = 'title';                // title | play | paused | over
  const input = { left: false, right: false, up: false, down: false, jump: false };

  const KEYS = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'jump',
  };

  function start() {
    audio.unlock();
    if (mode === 'title' || mode === 'over') { g = P.newGame(); mode = 'play'; }
  }

  document.addEventListener('keydown', e => {
    if (KEYS[e.code]) { input[KEYS[e.code]] = true; e.preventDefault(); }
    if (e.code === 'Enter' || (e.code === 'Space' && mode !== 'play' && mode !== 'paused')) start();
    if (e.code === 'KeyP' && (mode === 'play' || mode === 'paused')) {
      mode = mode === 'play' ? 'paused' : 'play';
      if (mode === 'paused') audio.log(false);
    }
    if (e.code === 'KeyM') { audio.unlock(); audio.setMuted(!audio.isMuted()); updateMute(); }
  });
  document.addEventListener('keyup', e => { if (KEYS[e.code]) input[KEYS[e.code]] = false; });
  window.addEventListener('blur', () => { for (const k in input) input[k] = false; });

  // Touch / mouse buttons
  document.querySelectorAll('[data-key]').forEach(btn => {
    const k = btn.dataset.key;
    const on = e => { e.preventDefault(); if (mode !== 'play') start(); input[k] = true; btn.classList.add('on'); };
    const off = e => { e.preventDefault(); input[k] = false; btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointerleave', off);
    btn.addEventListener('pointercancel', off);
  });
  view.addEventListener('pointerdown', () => { if (mode !== 'play') start(); });

  const muteBtn = document.getElementById('mute');
  function updateMute() { if (muteBtn) muteBtn.textContent = audio.isMuted() ? 'Som: OFF (M)' : 'Som: ON (M)'; }
  if (muteBtn) muteBtn.addEventListener('click', () => { audio.unlock(); audio.setMuted(!audio.isMuted()); updateMute(); });
  updateMute();

  function overlay(lines) {
    vctx.fillStyle = 'rgba(0,0,0,0.55)';
    vctx.fillRect(0, view.height / 2 - 60, view.width, 120);
    vctx.fillStyle = '#ececec';
    vctx.textAlign = 'center';
    lines.forEach((l, i) => {
      vctx.font = (i === 0 ? 'bold 34px' : '18px') + ' monospace';
      vctx.fillText(l, view.width / 2, view.height / 2 - 20 + i * 34);
    });
  }

  function render() {
    R.draw(bctx, g);
    vctx.imageSmoothingEnabled = false;
    vctx.drawImage(buf, 0, 0, view.width, view.height);
    if (mode === 'title') overlay(['PITFALL!', 'ESPAÇO ou toque para começar']);
    else if (mode === 'paused') overlay(['PAUSA', 'P para continuar']);
    else if (mode === 'over') overlay([g.won ? 'PERFEITO!' : 'FIM DE JOGO', 'Pontos: ' + g.score + ' — ESPAÇO para recomeçar']);
  }

  // Fixed 60 Hz simulation, like the console
  const STEP = 1000 / 60;
  let last = performance.now(), acc = 0;
  function loop(now) {
    acc += Math.min(250, now - last);
    last = now;
    while (acc >= STEP) {
      acc -= STEP;
      if (mode === 'play') {
        P.step(g, input);
        audio.handle(g.events, g.logContact);
        if (g.over) { mode = 'over'; audio.log(false); }
      }
    }
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.__pitfall = { get state() { return g; }, get mode() { return mode; }, input, audio };
})();
