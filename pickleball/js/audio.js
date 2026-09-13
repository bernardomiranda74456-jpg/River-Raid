'use strict';
// Tiny synthesised sound bank — no assets, works offline.
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.Audio = (function () {
  let ctx = null, master = null, muted = false;

  // Audio is a nicety: if the context cannot be created (older iOS, a frame
  // without permission, an autoplay policy) the game must carry on silently.
  function init() {
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.7;
        master.connect(ctx.destination);
      } catch (e) {
        ctx = null;
        master = null;
        return;
      }
    }
    unlock();
  }

  // iOS keeps a fresh context suspended and only honours resume() from inside a
  // user gesture, so this runs on every tap until the context reports running.
  // Playing one silent sample in the same gesture is the classic unlock for
  // older WebKit, and it is harmless everywhere else.
  let unlocked = false;
  function unlock() {
    if (!ctx || unlocked) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      if (ctx.state === 'running') unlocked = true;
      else ctx.resume().then(() => { unlocked = ctx.state === 'running'; }).catch(() => {});
    } catch (e) { /* ignore */ }
  }

  function resume() { try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) { /* ignore */ } }
  function state() { return ctx ? ctx.state : 'none'; }

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
    try {
      playInner(kind, power);
    } catch (e) { /* never let a sound break the frame */ }
  }

  function playInner(kind, power) {
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
    } else if (kind === 'crowd') {
      // A stand full of people at the end of a point: a low roar and a brighter
      // hiss that swell and fall together, a scatter of claps on top, and on the
      // big points a whistle or two. Loud enough to be heard on a phone speaker.
      const dur = 2.0 + p * 1.3;
      const now = ctx.currentTime;
      const layer = (freq, q, peak) => {
        const src = noise(dur);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(peak, now + 0.22);
        g.gain.setValueAtTime(peak, now + 0.22 + dur * 0.25);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        src.connect(f); f.connect(g); g.connect(master);
        src.start();
      };
      layer(420, 0.6, 0.30 * p + 0.06);          // the roar
      layer(1400 + p * 600, 0.8, 0.20 * p + 0.04); // the hiss of many voices
      const claps = Math.round(10 + p * 16);
      for (let i = 0; i < claps; i++) {
        const at = now + 0.12 + Math.random() * dur * 0.75;
        const c = noise(0.035);
        const cf = ctx.createBiquadFilter();
        cf.type = 'highpass'; cf.frequency.value = 1600;
        const cg = ctx.createGain();
        cg.gain.setValueAtTime(0.09 * p + 0.02, at);
        cg.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
        c.connect(cf); cf.connect(cg); cg.connect(master);
        c.start(at);
      }
      if (p > 0.7) {
        const whistles = p > 0.9 ? 2 : 1;
        for (let i = 0; i < whistles; i++) {
          setTimeout(() => ctx && blip(2300 + Math.random() * 400, 0.35, 'sine', 0.06, 1900), 250 + i * 420);
        }
      }
    } else if (kind === 'point') {
      blip(520, 0.12, 'triangle', 0.2);
      setTimeout(() => ctx && blip(780, 0.16, 'triangle', 0.18), 90);
    } else if (kind === 'win') {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => ctx && blip(f, 0.22, 'triangle', 0.2), i * 110));
    }
  }

  function setMuted(v) { muted = v; try { if (master) master.gain.value = v ? 0 : 0.7; } catch (e) { /* ignore */ } }
  function isMuted() { return muted; }

  return { init, play, setMuted, isMuted, resume, unlock, state };
})();
