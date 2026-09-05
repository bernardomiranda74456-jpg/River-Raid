'use strict';
// Tiny synthesised sound bank — no assets, works offline.
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.Audio = (function () {
  let ctx = null, master = null, muted = false;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }

  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function noise(dur) {
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  function blip(freq, dur, type, vol, slideTo) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }

  function play(kind, power) {
    if (!ctx || muted) return;
    resume();
    const p = Math.max(0.2, Math.min(1, power || 0.6));
    if (kind === 'hit') {
      const src = noise(0.05);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1500 + p * 1800; f.Q.value = 1.4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5 * p, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
      blip(700 + p * 500, 0.05, 'square', 0.10 * p);
    } else if (kind === 'bounce') {
      blip(300 + p * 200, 0.06, 'sine', 0.16 * p, 180);
    } else if (kind === 'net') {
      const src = noise(0.09);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.35, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } else if (kind === 'point') {
      blip(520, 0.12, 'triangle', 0.2);
      setTimeout(() => ctx && blip(780, 0.16, 'triangle', 0.18), 90);
    } else if (kind === 'win') {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => ctx && blip(f, 0.22, 'triangle', 0.2), i * 110));
    }
  }

  function setMuted(v) { muted = v; if (master) master.gain.value = v ? 0 : 0.5; }
  function isMuted() { return muted; }

  return { init, play, setMuted, isMuted, resume };
})();
