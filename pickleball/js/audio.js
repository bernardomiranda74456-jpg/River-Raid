'use strict';
// Tiny synthesised sound bank — no assets, works offline.
var PB = (function () {
  var g = typeof window !== 'undefined' ? window : globalThis;
  return g.PB || (g.PB = {});
})();

PB.Audio = (function () {
  let ctx = null, master = null, muted = false;
  // The recorded applause, decoded once per context. Until it is ready (or if
  // the browser cannot decode MP3) the synthesised crowd stands in.
  let applause = null, applauseTried = false;
  // the umpire's spoken calls, decoded once alongside the applause
  const calls = {};

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
    loadApplause();
    loadCalls();
  }

  function loadApplause() {
    if (applauseTried || !ctx || !PB.APPLAUSE_MP3) return;
    applauseTried = true;
    try {
      const b64 = PB.APPLAUSE_MP3;
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      // Callback form: older Safari returns no promise from decodeAudioData.
      ctx.decodeAudioData(bytes.buffer, buf => { applause = buf; }, () => { applause = null; });
    } catch (e) { applause = null; }
  }
  function hasApplause() { return !!applause; }

  function loadCalls() {
    if (!ctx || !PB.CALLS_MP3) return;
    for (const name in PB.CALLS_MP3) {
      if (calls[name] !== undefined) continue;
      calls[name] = null;                       // claimed, so it decodes once
      try {
        const bin = atob(PB.CALLS_MP3[name]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        ctx.decodeAudioData(bytes.buffer, buf => { calls[name] = buf; }, () => { calls[name] = null; });
      } catch (e) { calls[name] = null; }
    }
  }
  function hasCall(name) { return !!calls[name]; }

  // The call the umpire makes at the end of a rally. It goes out in front of
  // the crowd, because the umpire calls it and the crowd answers.
  function call(name) {
    if (!ctx || muted || !calls[name]) return 0;
    try {
      resume();
      const buf = calls[name];
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.95;
      src.connect(g); g.connect(master);
      src.start(now);
      return buf.duration;
    } catch (e) { return 0; }
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

  function play(kind, power, final, delay) {
    if (!ctx || muted) return;
    try {
      playInner(kind, power, !!final, Math.max(0, delay || 0));
    } catch (e) { /* never let a sound break the frame */ }
  }

  function playInner(kind, power, final, delay) {
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
    } else if (kind === 'crowd' && applause) {
      // The recorded applause. The next point can start 1.85 s after the last
      // one ended (1.25 s pause plus the CPU's 0.6 s to serve), so a point gets
      // at most 1.8 s of clapping, a little more the longer the rally, from a
      // random start so two points in a row never sound identical. Only the
      // end of the game gets a long ovation.
      const now = ctx.currentTime;
      const offset = final ? 0 : 0.25 + Math.random() * 0.8;
      const dur = final ? 4.8 : 1.3 + p * 0.5;
      const fade = final ? 0.8 : 0.4;
      const peak = 0.55 + 0.45 * p;
      const src = ctx.createBufferSource();
      src.buffer = applause;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(peak, now + 0.12);
      g.gain.setValueAtTime(peak, now + dur - fade);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(g); g.connect(master);
      src.start(now, offset);
      src.stop(now + dur + 0.05);
    } else if (kind === 'crowd') {
      // Fallback while the recording is not decoded: a stand full of people at
      // the end of a point: a low roar and a brighter
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

  return { init, play, call, setMuted, isMuted, resume, unlock, state, hasApplause, hasCall };
})();
