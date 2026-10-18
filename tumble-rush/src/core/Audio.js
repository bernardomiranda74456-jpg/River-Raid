/**
 * Synthesized sound effects with the Web Audio API. No audio files are used.
 * Every effect is built from oscillators / filtered noise at call time.
 */
export class AudioSys {
  constructor() {
    this.ctx = null; this.master = null; this.volume = 0.7; this.noiseBuf = null; this.ambient = null; this.started = false;
    this._lastPlay = new Map();
  }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
    const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; this.master.disconnect(); this.master.connect(comp); comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2; const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }
  resume() { if (!this.ctx) this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); this.started = true; }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  _throttle(name, ms) { const now = performance.now(); const last = this._lastPlay.get(name) || 0; if (now - last < ms) return true; this._lastPlay.set(name, now); return false; }
  _env(gainNode, t, a, d, peak = 1) { const g = gainNode.gain; g.setValueAtTime(0.0001, t); g.exponentialRampToValueAtTime(peak, t + a); g.exponentialRampToValueAtTime(0.0001, t + a + d); }
  _osc(type, f0, f1, dur, vol, a = 0.01) {
    if (!this.ctx) return; const t = this.ctx.currentTime; const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    this._env(g, t, a, dur, vol); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + a + dur + 0.05);
  }
  _noise(dur, vol, filterFreq = 1000, q = 1, type = 'bandpass', a = 0.005) {
    if (!this.ctx) return; const t = this.ctx.currentTime; const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq; f.Q.value = q; const g = this.ctx.createGain();
    this._env(g, t, a, dur, vol); s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + a + dur + 0.05);
  }
  jump() { if (this._throttle('jump', 80)) return; this._osc('sine', 300, 700, 0.18, 0.25); this._noise(0.08, 0.08, 2500, 0.7); }
  land(strength = 1) { if (this._throttle('land', 60)) return; this._noise(0.12 * strength, 0.18 * Math.min(1.5, strength), 300, 0.6, 'lowpass'); this._osc('sine', 120, 60, 0.1, 0.15 * strength); }
  step() { if (this._throttle('step', 110)) return; this._noise(0.05, 0.05, 600, 0.8, 'lowpass'); }
  dive() { this._noise(0.3, 0.12, 1800, 0.5, 'bandpass', 0.05); this._osc('triangle', 500, 200, 0.25, 0.1); }
  hit(strength = 1) { if (this._throttle('hit', 90)) return; this._osc('square', 220, 60, 0.25, 0.3 * strength); this._noise(0.2, 0.25 * strength, 700, 0.5, 'lowpass'); this._osc('sine', 90, 40, 0.3, 0.3 * strength); }
  metal() { if (this._throttle('metal', 120)) return; this._osc('triangle', 2200, 1800, 0.25, 0.12); this._osc('sine', 3300, 3100, 0.3, 0.05); this._noise(0.08, 0.1, 5000, 1); }
  boing() { this._osc('sine', 150, 900, 0.3, 0.25, 0.02); }
  whoosh() { if (this._throttle('whoosh', 300)) return; this._noise(0.45, 0.07, 900, 0.4, 'bandpass', 0.15); }
  qualify() { const n = [523, 659, 784, 1047]; n.forEach((f, i) => setTimeout(() => this._osc('triangle', f, f, 0.25, 0.25), i * 90)); this._noise(0.5, 0.08, 4000, 0.5, 'highpass', 0.05); }
  eliminated() { const n = [440, 370, 311, 220]; n.forEach((f, i) => setTimeout(() => this._osc('sawtooth', f, f * 0.9, 0.3, 0.18), i * 180)); }
  countdown(final = false) { this._osc('square', final ? 880 : 440, final ? 880 : 440, final ? 0.5 : 0.15, 0.2, 0.005); }
  sizzle() { if (this._throttle('sizzle', 200)) return; this._noise(0.6, 0.25, 3000, 0.3, 'highpass', 0.02); this._osc('sawtooth', 200, 50, 0.5, 0.12); }
  click() { this._osc('sine', 900, 600, 0.06, 0.12, 0.003); }
  tileCrumble() { if (this._throttle('tile', 40)) return; this._noise(0.15, 0.12, 1200, 0.8, 'lowpass'); this._osc('triangle', 400, 120, 0.15, 0.08); }
  win() { const n = [523, 659, 784, 1047, 1319, 1568]; n.forEach((f, i) => setTimeout(() => this._osc('triangle', f, f, 0.4, 0.22), i * 110)); }

  /** Continuous ambient bed: filtered wind noise + low lava rumble, intensity driven by game. */
  startAmbient() {
    if (!this.ctx || this.ambient) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 0.5;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.13; const lg = this.ctx.createGain(); lg.gain.value = 200; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
    const rumble = this.ctx.createOscillator(); rumble.type = 'sine'; rumble.frequency.value = 38; const rg = this.ctx.createGain(); rg.gain.value = 0.0; rumble.connect(rg); rg.connect(this.master); rumble.start();
    this.ambient = { noise: s, gain: g, rumbleGain: rg, lfo, rumble };
  }
  setAmbient(wind = 0.05, rumble = 0) {
    if (!this.ambient) return; const t = this.ctx.currentTime;
    this.ambient.gain.gain.setTargetAtTime(wind, t, 0.5); this.ambient.rumbleGain.gain.setTargetAtTime(rumble, t, 0.5);
  }
}
