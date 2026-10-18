// Emulação do SN76489 (PSG do Master System) como AudioWorkletProcessor.
// 3 canais de onda quadrada (período de 10 bits) + 1 canal de ruído (LFSR de 16 bits, taps 0 e 3,
// branco/periódico, taxas /16 /32 /64 ou acoplado ao tom 2). Atenuação em 16 passos de 2 dB.
// Eventos chegam com tempo absoluto (relógio do AudioContext) e são aplicados por amostra.
const CLOCK = 3579545 / 16; // 223721.5625 Hz: taxa do contador de tons
const VOL = new Float32Array(16);
for (let i = 0; i < 16; i++) VOL[i] = i === 15 ? 0 : Math.pow(10, (-2 * i) / 20);

class PsgProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.period = [1, 1, 1]; this.counter = [1, 1, 1]; this.out = [1, 1, 1]; this.att = [15, 15, 15, 15];
    this.noiseWhite = true; this.noiseRate = 0; this.noiseCounter = 0x10; this.noiseFlip = 0; this.lfsr = 0x8000; this.noiseOut = 0;
    this.queue = []; this.step = CLOCK / sampleRate; this.acc = 0; this.hp = 0; this.hpPrev = 0; this.gain = 0.22;
    this.port.onmessage = (e) => this.onMessage(e.data);
  }
  onMessage(m) {
    if (m.type === 'batch') { for (const ev of m.events) this.enqueue(ev); return; }
    if (m.type === 'gain') { this.gain = m.value; return; }
    if (m.type === 'ping') { this.port.postMessage({ type: 'pong', id: m.id }); return; }
    this.enqueue(m);
  }
  enqueue(ev) {
    // insere mantendo ordem por tempo (a maioria chega em ordem: busca do fim)
    const q = this.queue; let i = q.length; while (i > 0 && q[i - 1].t > ev.t) i--; q.splice(i, 0, ev);
  }
  apply(ev) {
    switch (ev.type) {
      case 'tone': { const n = Math.max(1, Math.min(1023, ev.n | 0)); this.period[ev.ch] = n; break; }
      case 'vol': this.att[ev.ch] = Math.max(0, Math.min(15, ev.att | 0)); break;
      case 'noise': { const changed = this.noiseRate !== ev.rate || this.noiseWhite !== !!ev.white; this.noiseWhite = !!ev.white; this.noiseRate = ev.rate & 3; if (changed) { this.lfsr = 0x8000; } break; }
      case 'allOff': for (let i = 0; i < 4; i++) this.att[i] = 15; break;
      case 'reset': this.att.fill(15); this.lfsr = 0x8000; break;
    }
  }
  noisePeriod() { return this.noiseRate === 3 ? this.period[2] : 0x10 << this.noiseRate; }
  process(inputs, outputs) {
    const out = outputs[0]; const L = out[0]; const R = out[1] || null; const n = L.length;
    const t0 = currentTime; const inv = 1 / sampleRate; const q = this.queue;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * inv;
      while (q.length && q[0].t <= t) this.apply(q.shift());
      // avança o chip em passos de contador, acumulando a saída (filtro de caixa = anti-alias simples)
      this.acc += this.step; let sum = 0, steps = 0;
      while (this.acc >= 1) {
        this.acc -= 1; steps++;
        for (let c = 0; c < 3; c++) { if (--this.counter[c] <= 0) { this.counter[c] = this.period[c]; this.out[c] = -this.out[c]; } }
        if (--this.noiseCounter <= 0) {
          this.noiseCounter = this.noisePeriod(); this.noiseFlip ^= 1;
          if (this.noiseFlip === 0) { // borda de descida: desloca o LFSR
            const fb = this.noiseWhite ? ((this.lfsr ^ (this.lfsr >> 3)) & 1) : (this.lfsr & 1);
            this.lfsr = (this.lfsr >> 1) | (fb << 15); this.noiseOut = (this.lfsr & 1) ? 1 : -1;
          }
        }
        // período 1 em canal de tom = "DC" (usado por jogos para samples); tratamos como silêncio constante
        const s0 = this.period[0] === 1 ? 1 : this.out[0], s1 = this.period[1] === 1 ? 1 : this.out[1], s2 = this.period[2] === 1 ? 1 : this.out[2];
        sum += s0 * VOL[this.att[0]] + s1 * VOL[this.att[1]] + s2 * VOL[this.att[2]] + this.noiseOut * VOL[this.att[3]];
      }
      let v = steps ? (sum / steps) * this.gain : this.hpPrev;
      // remove DC suavemente (passa-altas de 1 polo ~ 8 Hz)
      const hp = v - this.hpPrev + 0.9989 * this.hp; this.hpPrev = v; this.hp = hp; v = hp;
      L[i] = v; if (R) R[i] = v;
    }
    return true;
  }
}
registerProcessor('psg', PsgProcessor);
