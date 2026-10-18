// Áudio: Web Audio API. Efeitos sintetizados (sem arquivos) e um loop musical
// original gerado proceduralmente (sequenciador de 16 passos, tom menor).
import { RNG, clamp, lerp } from './utils.js';

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.started = false;
    this.music = { playing: false, nextStep: 0, step: 0, nextTime: 0, bpm: 126, bar: 0 };
    this.loops = {};
    this.coinPitch = 0; this.coinT = 0;
  }
  /** Deve ser chamado num gesto do usuário. */
  start() {
    if (this.started) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.8;
    this.comp = c.createDynamicsCompressor(); this.comp.threshold.value = -12; this.comp.ratio.value = 4;
    this.master.connect(this.comp); this.comp.connect(c.destination);
    this.sfxGain = c.createGain(); this.sfxGain.connect(this.master);
    this.musGain = c.createGain(); this.musGain.connect(this.master);
    this.ambGain = c.createGain(); this.ambGain.connect(this.master);
    // buffers de ruído
    this.noise = this.makeNoise(2);
    this.delay = c.createDelay(1.0); this.delay.delayTime.value = 0.28;
    this.delayGain = c.createGain(); this.delayGain.gain.value = 0.25;
    this.delayFilter = c.createBiquadFilter(); this.delayFilter.type = 'lowpass'; this.delayFilter.frequency.value = 2200;
    this.delay.connect(this.delayFilter); this.delayFilter.connect(this.delayGain); this.delayGain.connect(this.delay); this.delayGain.connect(this.musGain);
    this.startAmbience();
    this.applyVolumes();
    this.started = true;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 60);
  }
  applyVolumes() {
    if (!this.ctx) return;
    this.sfxGain.gain.value = this.settings.sfx ? 0.9 : 0;
    this.musGain.gain.value = this.settings.music ? 0.5 : 0;
    this.ambGain.gain.value = this.settings.sfx ? 0.8 : 0;
  }
  makeNoise(sec) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  /* --------------------------------------------------------- helpers */
  osc(type, freq, t0, dur, gain, { attack = 0.005, decay = 0.05, freqEnd = null, dest = null, detune = 0 } = {}) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0); o.detune.value = detune;
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.setValueAtTime(gain, t0 + Math.max(attack, dur - decay)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  noiseBurst(t0, dur, gain, { type = 'bandpass', freq = 1000, q = 1, freqEnd = null, dest = null } = {}) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true;
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    s.start(t0); s.stop(t0 + dur + 0.05);
  }
  /* ------------------------------------------------------------- SFX */
  play(name, opt = 0) {
    if (!this.ctx || !this.settings.sfx) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'jump': this.noiseBurst(t, 0.18, 0.25, { freq: 900, freqEnd: 2500, q: 0.8 }); this.osc('sine', 300, t, 0.2, 0.15, { freqEnd: 700 }); break;
      case 'roll': this.noiseBurst(t, 0.3, 0.3, { freq: 500, freqEnd: 180, q: 0.7 }); break;
      case 'swish': this.noiseBurst(t, 0.14, 0.18, { freq: 1800, freqEnd: 600, q: 1.2 }); break;
      case 'land': this.noiseBurst(t, 0.1, 0.2, { type: 'lowpass', freq: 400 }); this.osc('sine', 90, t, 0.12, 0.2, { freqEnd: 50 }); break;
      case 'coin': {
        const now = performance.now();
        this.coinPitch = now - this.coinT < 350 ? Math.min(this.coinPitch + 1, 12) : 0;
        this.coinT = now;
        const f = 1046 * Math.pow(2, this.coinPitch / 12);
        this.osc('sine', f, t, 0.12, 0.16, { decay: 0.1 }); this.osc('sine', f * 1.5, t + 0.05, 0.16, 0.12, { decay: 0.12 });
        break;
      }
      case 'powerup': for (let i = 0; i < 5; i++) this.osc('triangle', 440 * Math.pow(2, [0, 4, 7, 12, 16][i] / 12), t + i * 0.06, 0.25, 0.18, { decay: 0.2 }); break;
      case 'key': for (let i = 0; i < 3; i++) this.osc('sine', 880 * Math.pow(2, [0, 5, 9][i] / 12), t + i * 0.08, 0.3, 0.2); break;
      case 'stumble': this.noiseBurst(t, 0.2, 0.5, { type: 'lowpass', freq: 600 }); this.osc('sine', 120, t, 0.25, 0.35, { freqEnd: 40 }); break;
      case 'crash':
        this.noiseBurst(t, 0.6, 0.9, { type: 'lowpass', freq: 1800, freqEnd: 150 }); this.osc('sine', 80, t, 0.7, 0.6, { freqEnd: 25 });
        this.osc('square', 220, t, 0.12, 0.2, { freqEnd: 60 });
        break;
      case 'caught': this.osc('sawtooth', 200, t, 0.5, 0.25, { freqEnd: 80 }); this.noiseBurst(t, 0.3, 0.4, { type: 'lowpass', freq: 700 }); break;
      case 'horn': {
        const dest = this.sfxGain;
        for (const f of [233, 311, 370]) { this.osc('sawtooth', f, t, 1.1, 0.09, { attack: 0.05, decay: 0.4, dest, detune: 5 }); this.osc('sawtooth', f, t, 1.1, 0.09, { attack: 0.05, decay: 0.4, dest, detune: -6 }); }
        break;
      }
      case 'whoosh': this.noiseBurst(t, 0.9, 0.6, { type: 'bandpass', freq: 300, freqEnd: 1600, q: 0.6 }); break;
      case 'board': this.osc('sine', 300, t, 0.4, 0.2, { freqEnd: 1200 }); this.noiseBurst(t, 0.3, 0.2, { freq: 3000, q: 2 }); break;
      case 'boardBreak': this.noiseBurst(t, 0.4, 0.6, { type: 'highpass', freq: 1500 }); this.osc('square', 500, t, 0.2, 0.15, { freqEnd: 100 }); break;
      case 'click': this.osc('square', 1200, t, 0.04, 0.08); break;
      case 'step': this.noiseBurst(t, 0.05, 0.08 + opt * 0.05, { type: 'lowpass', freq: 500 + opt * 300 }); break;
      case 'jetStart': this.noiseBurst(t, 1.2, 0.5, { type: 'bandpass', freq: 200, freqEnd: 1200, q: 0.5 }); this.osc('sawtooth', 60, t, 1.0, 0.2, { freqEnd: 180 }); break;
      case 'continue': for (let i = 0; i < 4; i++) this.osc('triangle', 523 * Math.pow(2, [0, 7, 12, 19][i] / 12), t + i * 0.1, 0.4, 0.2); break;
      default: break;
    }
  }
  /* ------------------------------------------------------- ambiência */
  startAmbience() {
    const c = this.ctx;
    const mk = (freq, q, type = 'bandpass') => {
      const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); g.gain.value = 0;
      s.connect(f); f.connect(g); g.connect(this.ambGain); s.start();
      return { g, f };
    };
    this.loops.wind = mk(400, 0.5, 'lowpass');
    this.loops.rain = mk(3000, 0.4, 'highpass');
    this.loops.jet = mk(300, 1.2);
    this.loops.rumble = mk(70, 1.5, 'lowpass');
  }
  /** Atualiza loops contínuos com o estado do jogo. */
  updateLoops(speedT, rain, jet, running, tunnel) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const L = this.loops;
    L.wind.g.gain.setTargetAtTime(running ? 0.05 + speedT * 0.25 : 0.02, t, 0.2);
    L.wind.f.frequency.setTargetAtTime(300 + speedT * 900, t, 0.2);
    L.rain.g.gain.setTargetAtTime(rain * 0.18 * (1 - tunnel * 0.8), t, 0.5);
    L.jet.g.gain.setTargetAtTime(jet ? 0.3 : 0, t, 0.15);
    L.rumble.g.gain.setTargetAtTime(running ? 0.12 + speedT * 0.18 + tunnel * 0.15 : 0, t, 0.3);
  }
  /* --------------------------------------------------------- música */
  setMusic(on, seed = 1) {
    if (!this.ctx) return;
    const m = this.music;
    if (on && !m.playing) {
      m.playing = true; m.step = 0; m.bar = 0; m.nextTime = this.ctx.currentTime + 0.1;
      const r = new RNG(seed);
      // tom e progressão (menor): i, VI, III, VII  ou  i, VII, VI, VII
      const roots = [45, 47, 48, 50, 52];
      m.root = r.pick(roots);
      m.prog = r.chance(0.5) ? [0, 8, 3, 10] : [0, 10, 8, 10];
      m.arp = []; for (let i = 0; i < 16; i++) m.arp.push(r.chance(0.6) ? r.pick([0, 3, 7, 10, 12, 15]) : -1);
      m.bassPat = []; for (let i = 0; i < 16; i++) m.bassPat.push(i % 4 === 0 || r.chance(0.3));
      m.hatPat = []; for (let i = 0; i < 16; i++) m.hatPat.push(i % 2 === 1 || r.chance(0.2));
      m.leadWave = r.pick(['square', 'sawtooth', 'triangle']);
    }
    if (!on) m.playing = false;
  }
  setTempo(bpm) { this.music.bpm = bpm; }
  scheduleMusic() {
    const m = this.music;
    if (!m.playing || !this.ctx || !this.settings.music) return;
    const c = this.ctx;
    const stepDur = 60 / m.bpm / 4;
    while (m.nextTime < c.currentTime + 0.2) {
      this.playStep(m.step, m.nextTime, stepDur);
      m.nextTime += stepDur;
      m.step++;
      if (m.step % 16 === 0) m.bar++;
    }
  }
  midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  playStep(step, t, dur) {
    const m = this.music, c = this.ctx;
    const s = step % 16;
    const chord = m.prog[m.bar % 4];
    const rootN = m.root + chord;
    const dest = this.musGain;
    // bateria
    if (s % 4 === 0) { this.osc('sine', 150, t, 0.25, 0.7, { freqEnd: 40, decay: 0.2, dest }); }
    if (s === 4 || s === 12) { this.noiseBurst(t, 0.15, 0.35, { type: 'bandpass', freq: 1800, q: 0.7, dest }); this.osc('triangle', 220, t, 0.1, 0.25, { freqEnd: 120, dest }); }
    if (m.hatPat[s]) this.noiseBurst(t, s % 4 === 2 ? 0.12 : 0.05, 0.12, { type: 'highpass', freq: 7000, dest });
    // baixo
    if (m.bassPat[s]) {
      const n = rootN - 12 + (s % 8 === 6 ? 7 : 0);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(150, t + dur * 2); f.connect(dest);
      this.osc('sawtooth', this.midi(n), t, dur * 1.8, 0.35, { decay: 0.1, dest: f });
    }
    // arpejo/lead com delay
    const a = m.arp[s];
    if (a >= 0 && (m.bar % 8 >= 2)) {
      const n = rootN + 12 + a;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2500; f.connect(dest); f.connect(this.delay);
      this.osc(m.leadWave, this.midi(n), t, dur * 0.9, 0.09, { decay: 0.08, dest: f });
    }
    // pad (uma vez por compasso)
    if (s === 0) {
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.connect(dest);
      for (const iv of [0, 3, 7]) { this.osc('sawtooth', this.midi(rootN + iv), t, dur * 16, 0.045, { attack: 0.4, decay: 1.2, dest: f, detune: 6 }); this.osc('sawtooth', this.midi(rootN + iv), t, dur * 16, 0.045, { attack: 0.4, decay: 1.2, dest: f, detune: -7 }); }
    }
  }
}
