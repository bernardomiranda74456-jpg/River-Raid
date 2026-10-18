// Wrapper do PSG: AudioWorklet (preferido) ou fallback com OscillatorNode/GainNode.
export const PSG_CLOCK = 3579545;
export const freqToPeriod = (f) => Math.max(1, Math.min(1023, Math.round(PSG_CLOCK / (32 * Math.max(1, f)))));
export const periodToFreq = (n) => PSG_CLOCK / (32 * n);
export const attToGain = (att) => (att >= 15 ? 0 : Math.pow(10, (-2 * att) / 20));

export class PsgNode {
  constructor(ctx, dest) { this.ctx = ctx; this.dest = dest; this.ready = false; this.pending = []; this.node = null; this.fallback = null; }
  static async create(ctx, dest, workletUrl) {
    const p = new PsgNode(ctx, dest);
    try {
      if (!ctx.audioWorklet) throw new Error('sem AudioWorklet');
      await ctx.audioWorklet.addModule(workletUrl);
      p.node = new AudioWorkletNode(ctx, 'psg', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
      p.node.connect(dest); p.ready = true;
    } catch (e) {
      console.warn('[áudio] AudioWorklet indisponível, usando fallback de osciladores:', e.message);
      p.fallback = new PsgFallback(ctx, dest); p.ready = true;
    }
    return p;
  }
  /** events: [{type:'tone',ch,n,t}, {type:'vol',ch,att,t}, {type:'noise',white,rate,t}] */
  send(events) { if (!events.length) return; if (this.node) this.node.port.postMessage({ type: 'batch', events }); else this.fallback.send(events); }
  allOff(t) { this.send([{ type: 'allOff', t }]); }
  setGain(v) { if (this.node) this.node.port.postMessage({ type: 'gain', value: v }); else this.fallback.gain.gain.value = v; }
  /** Garante que todas as mensagens já enviadas foram recebidas pelo worklet (renderização offline). */
  sync() { if (!this.node) return Promise.resolve(); return new Promise((res) => { const id = Math.random(); const h = (e) => { if (e.data && e.data.type === 'pong' && e.data.id === id) { this.node.port.removeEventListener('message', h); res(); } }; this.node.port.addEventListener('message', h); this.node.port.start(); this.node.port.postMessage({ type: 'ping', id }); }); }
}

/** Fallback: 3 osciladores quadrados + ruído em buffer. Aproximação sem precisão de ciclo. */
class PsgFallback {
  constructor(ctx, dest) {
    this.ctx = ctx; this.gain = ctx.createGain(); this.gain.gain.value = 0.22; this.gain.connect(dest);
    this.osc = []; this.g = []; this.period = [1, 1, 1];
    for (let i = 0; i < 3; i++) { const o = ctx.createOscillator(); o.type = 'square'; const g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(this.gain); o.start(); this.osc.push(o); this.g.push(g); }
    // ruído: LFSR pré-gerado (branco) e periódico
    const mk = (white) => { const len = ctx.sampleRate; const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0); let l = 0x8000; for (let i = 0; i < len; i++) { const fb = white ? ((l ^ (l >> 3)) & 1) : (l & 1); l = (l >> 1) | (fb << 15); d[i] = (l & 1) ? 1 : -1; } return buf; };
    this.white = mk(true); this.periodic = mk(false); this.noiseG = ctx.createGain(); this.noiseG.gain.value = 0; this.noiseG.connect(this.gain); this.noiseSrc = null; this.noiseWhite = true; this.noiseRate = 0;
    this._startNoise();
  }
  _startNoise() {
    if (this.noiseSrc) { try { this.noiseSrc.stop(); } catch (e) {} }
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseWhite ? this.white : this.periodic; s.loop = true; s.connect(this.noiseG); s.start(); this.noiseSrc = s; this._setNoiseRate();
  }
  _setNoiseRate(t) {
    const n = this.noiseRate === 3 ? this.period[2] : (0x10 << this.noiseRate); const shiftRate = PSG_CLOCK / (32 * n); // Hz
    const rate = Math.max(0.01, Math.min(16, shiftRate / this.ctx.sampleRate)); if (this.noiseSrc) this.noiseSrc.playbackRate.setValueAtTime(rate, t ?? this.ctx.currentTime);
  }
  send(events) {
    for (const ev of events) {
      const t = Math.max(this.ctx.currentTime, ev.t || 0);
      switch (ev.type) {
        case 'tone': this.period[ev.ch] = ev.n; this.osc[ev.ch].frequency.setValueAtTime(periodToFreq(ev.n), t); if (ev.ch === 2 && this.noiseRate === 3) this._setNoiseRate(t); break;
        case 'vol': if (ev.ch < 3) this.g[ev.ch].gain.setValueAtTime(attToGain(ev.att), t); else this.noiseG.gain.setValueAtTime(attToGain(ev.att) * 0.8, t); break;
        case 'noise': if (!!ev.white !== this.noiseWhite || ev.rate !== this.noiseRate) { this.noiseWhite = !!ev.white; this.noiseRate = ev.rate; this._startNoise(); } break;
        case 'allOff': for (const g of this.g) g.gain.setValueAtTime(0, t); this.noiseG.gain.setValueAtTime(0, t); break;
      }
    }
  }
}
