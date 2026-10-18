// Backend "remaster": as mesmas notas do sequenciador tocadas com síntese mais rica
// (PeriodicWave com harmônicos, 2 osciladores destunados, filtro, sub-baixo, bateria sintética,
// reverb por convolução e delay leves).
import { attToGain } from './psg.js';

const waveCache = new WeakMap();
function periodicWave(ctx, kind) {
  let m = waveCache.get(ctx); if (!m) { m = {}; waveCache.set(ctx, m); }
  if (m[kind]) return m[kind];
  const N = 48; const re = new Float32Array(N), im = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    let a = 0;
    switch (kind) {
      case 'saw': a = 1 / n; break;
      case 'square': a = n % 2 ? 1 / n : 0; break;
      case 'pulse25': a = Math.sin(n * Math.PI * 0.25) / n; break;
      case 'pulse12': a = Math.sin(n * Math.PI * 0.125) / n; break;
      case 'tri': a = n % 2 ? (1 / (n * n)) * (((n - 1) / 2) % 2 ? -1 : 1) : 0; break;
      case 'organ': a = n === 1 ? 1 : n === 2 ? 0.55 : n === 3 ? 0.2 : n === 4 ? 0.35 : n === 8 ? 0.18 : 0; break;
      case 'bright': a = n % 2 ? 1 / n : 0.5 / n; break;
      case 'sine': a = n === 1 ? 1 : 0; break;
      default: a = n % 2 ? 1 / n : 0;
    }
    im[n] = a;
  }
  const w = ctx.createPeriodicWave(re, im, { disableNormalization: false }); m[kind] = w; return w;
}
function noiseBuffer(ctx) {
  if (ctx.__noise) return ctx.__noise; const len = ctx.sampleRate; const b = ctx.createBuffer(1, len, ctx.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; ctx.__noise = b; return b;
}
function reverbIR(ctx, seconds = 1.6, decay = 3.2) {
  const len = Math.floor(ctx.sampleRate * seconds); const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const e = Math.pow(1 - i / len, decay); const n = (Math.random() * 2 - 1) * e; lp += (n - lp) * 0.35; d[i] = lp * (i < 200 ? i / 200 : 1); } }
  return b;
}

class Voice {
  constructor(ctx, bus, index) {
    this.ctx = ctx; this.index = index;
    this.osc1 = ctx.createOscillator(); this.osc2 = ctx.createOscillator(); this.sub = ctx.createOscillator(); this.sub.type = 'sine';
    this.mix1 = ctx.createGain(); this.mix2 = ctx.createGain(); this.subG = ctx.createGain(); this.mix1.gain.value = 0.6; this.mix2.gain.value = 0.4; this.subG.gain.value = 0;
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 3000; this.filter.Q.value = 0.8;
    this.gain = ctx.createGain(); this.gain.gain.value = 0; this.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    this.osc1.connect(this.mix1); this.osc2.connect(this.mix2); this.sub.connect(this.subG); this.mix1.connect(this.filter); this.mix2.connect(this.filter); this.subG.connect(this.filter); this.filter.connect(this.gain);
    this.sendDry = ctx.createGain(); this.sendRev = ctx.createGain(); this.sendDel = ctx.createGain();
    const tail = this.pan || this.gain; if (this.pan) this.gain.connect(this.pan);
    tail.connect(this.sendDry); tail.connect(this.sendRev); tail.connect(this.sendDel);
    this.sendDry.connect(bus.dry); this.sendRev.connect(bus.rev); this.sendDel.connect(bus.del);
    this.osc1.start(); this.osc2.start(); this.sub.start(); this.wave = null; this.inst = null; this.lastF = 0;
  }
  setInst(inst, t) {
    const hd = inst.hd || {}; const wave = hd.wave || (this.index === 2 ? 'saw' : this.index === 1 ? 'pulse25' : 'square');
    if (wave !== this.wave) { this.wave = wave; const pw = periodicWave(this.ctx, wave); this.osc1.setPeriodicWave(pw); this.osc2.setPeriodicWave(pw); }
    this.osc2.detune.setValueAtTime(hd.detune ?? (this.index === 2 ? 0 : 7), t);
    this.subG.gain.setValueAtTime(hd.sub ? 0.5 : 0, t);
    this.filter.Q.setValueAtTime(hd.q ?? 0.9, t);
    this.sendRev.gain.setValueAtTime(hd.reverb ?? 0.22, t); this.sendDel.gain.setValueAtTime(hd.delay ?? (this.index === 0 ? 0.18 : 0.06), t); this.sendDry.gain.setValueAtTime(0.9, t);
    if (this.pan) this.pan.pan.setValueAtTime(hd.pan ?? [-0.18, 0.2, 0][this.index], t);
    this.cutoff = hd.cutoff ?? (this.index === 2 ? 900 : 3200); this.level = hd.level ?? (this.index === 2 ? 0.85 : 0.6); this.inst = inst;
  }
  tone(t, freq, att, inst, onset) {
    if (inst && inst !== this.inst) this.setInst(inst, t);
    const g = attToGain(att) * this.level * 0.36;
    if (att >= 15) { this.gain.gain.setTargetAtTime(0, t, 0.012); return; }
    if (onset) {
      this.osc1.frequency.setValueAtTime(freq, t); this.osc2.frequency.setValueAtTime(freq, t); this.sub.frequency.setValueAtTime(freq / 2, t);
      const f = this.filter.frequency; f.cancelScheduledValues(t); f.setValueAtTime(Math.min(16000, this.cutoff * 2.6), t); f.exponentialRampToValueAtTime(Math.max(80, this.cutoff), t + 0.12);
      this.gain.gain.cancelScheduledValues(t); this.gain.gain.setValueAtTime(this.gain.gain.value, t); this.gain.gain.linearRampToValueAtTime(g, t + 0.006);
    } else {
      if (Math.abs(freq - this.lastF) > 0.01) { this.osc1.frequency.setTargetAtTime(freq, t, 0.004); this.osc2.frequency.setTargetAtTime(freq, t, 0.004); this.sub.frequency.setTargetAtTime(freq / 2, t, 0.004); }
      this.gain.gain.setTargetAtTime(g, t, 0.01);
    }
    this.lastF = freq;
  }
  off(t) { this.gain.gain.cancelScheduledValues(t); this.gain.gain.setTargetAtTime(0, t, 0.01); }
}

export class HDSynth {
  constructor(ctx, dest) {
    this.ctx = ctx; this.out = ctx.createGain(); this.out.gain.value = 1; this.out.connect(dest);
    const dry = ctx.createGain(); dry.connect(this.out);
    const rev = ctx.createGain(); const conv = ctx.createConvolver(); conv.buffer = reverbIR(ctx); const revOut = ctx.createGain(); revOut.gain.value = 0.55; rev.connect(conv); conv.connect(revOut); revOut.connect(this.out);
    const del = ctx.createGain(); const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.31; const fb = ctx.createGain(); fb.gain.value = 0.28; const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    del.connect(delay); delay.connect(dlp); dlp.connect(fb); fb.connect(delay); dlp.connect(this.out);
    this.bus = { dry, rev, del }; this.delayNode = delay;
    this.voices = [new Voice(ctx, this.bus, 0), new Voice(ctx, this.bus, 1), new Voice(ctx, this.bus, 2)];
    this.drumGain = ctx.createGain(); this.drumGain.gain.value = 0.7; this.drumGain.connect(dry); this.drumGain.connect(rev);
    this.noiseBuf = noiseBuffer(ctx);
  }
  setTempoDelay(bpm) { this.delayNode.delayTime.setTargetAtTime(60 / bpm * 0.75, this.ctx.currentTime, 0.1); }
  tone(t, ch, freq, att, inst, onset) { this.voices[ch].tone(t, freq, att, inst, onset); }
  noise() {}
  drum(t, kind, att) {
    const ctx = this.ctx; const g = attToGain(att) * 0.9; const out = this.drumGain;
    const env = (node, peak, dur, curve = 'exp') => { node.gain.setValueAtTime(0.0001, t); node.gain.linearRampToValueAtTime(peak, t + 0.003); if (curve === 'exp') node.gain.exponentialRampToValueAtTime(0.0001, t + dur); else node.gain.linearRampToValueAtTime(0, t + dur); };
    const noiseHit = (filterType, freqHz, q, dur, peak) => { const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freqHz; f.Q.value = q; const gg = ctx.createGain(); env(gg, peak, dur); s.connect(f); f.connect(gg); gg.connect(out); s.start(t); s.stop(t + dur + 0.05); };
    const sineDrop = (f0, f1, dur, peak) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5); const gg = ctx.createGain(); env(gg, peak, dur); o.connect(gg); gg.connect(out); o.start(t); o.stop(t + dur + 0.05); };
    switch (kind) {
      case 'kick': sineDrop(160, 42, 0.28, 0.95 * g); noiseHit('lowpass', 900, 0.7, 0.03, 0.4 * g); break;
      case 'kickSoft': sineDrop(140, 45, 0.18, 0.6 * g); break;
      case 'snare': sineDrop(210, 150, 0.12, 0.45 * g); noiseHit('bandpass', 1900, 0.8, 0.18, 0.7 * g); noiseHit('highpass', 5000, 0.5, 0.1, 0.3 * g); break;
      case 'snareSoft': noiseHit('bandpass', 2000, 0.9, 0.1, 0.4 * g); break;
      case 'hat': noiseHit('highpass', 7500, 0.6, 0.05, 0.35 * g); break;
      case 'hatSoft': noiseHit('highpass', 8000, 0.6, 0.035, 0.22 * g); break;
      case 'openHat': noiseHit('highpass', 6500, 0.6, 0.3, 0.3 * g); break;
      case 'crash': noiseHit('bandpass', 5500, 0.4, 1.4, 0.45 * g); noiseHit('highpass', 9000, 0.4, 0.9, 0.25 * g); break;
      case 'tom': sineDrop(220, 110, 0.3, 0.7 * g); break;
      case 'tomHi': sineDrop(320, 180, 0.22, 0.6 * g); break;
    }
  }
  allOff(t) { for (const v of this.voices) v.off(t); }
  flush() {}
}
