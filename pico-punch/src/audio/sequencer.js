// Sequenciador tracker: padrões/ordem, 3 canais de tom + 1 de ruído, instrumentos com macros de
// volume, arpejo, vibrato e slide. Ticks a 60 Hz agendados por lookahead no relógio do AudioContext.
import { freqToPeriod } from './psg.js';

const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function parseNote(tok) { // "C#4" → midi
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok); if (!m) return null;
  let n = NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12; return n;
}
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Macros de volume predefinidas (níveis 0..15 por tick; o último valor sustenta). */
export const ENV = {
  pluck: { env: [15, 13, 11, 10, 9, 8, 8, 7, 7, 6, 6, 6, 5, 5, 5, 4], rel: [3, 1, 0] },
  lead: { env: [14, 15, 14, 13, 12, 12, 11, 11, 11, 10, 10, 10, 10], rel: [8, 6, 4, 2, 0] },
  soft: { env: [8, 11, 13, 13, 12, 12, 11, 11, 10, 10, 10], rel: [8, 6, 4, 2, 1, 0] },
  pad: { env: [6, 8, 10, 11, 12, 12, 12, 11, 11, 11, 10, 10, 10, 10, 9, 9, 9, 9, 8], rel: [8, 7, 6, 5, 4, 3, 2, 1, 0] },
  bass: { env: [15, 14, 13, 12, 11, 11, 10, 10, 9, 9, 8, 8, 8, 7, 7, 7, 6, 6, 6, 6, 5], rel: [4, 2, 0] },
  bassShort: { env: [15, 14, 12, 10, 8, 6, 4, 2, 0], rel: [0] },
  arp: { env: [13, 12, 11, 10, 9, 9, 8, 8, 8, 7, 7, 7], rel: [4, 0] },
  stab: { env: [15, 15, 12, 9, 6, 3, 0], rel: [0] },
  bell: { env: [15, 14, 12, 11, 10, 9, 8, 8, 7, 7, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 0], rel: [0] },
  organ: { env: [12, 12, 12, 12], rel: [8, 4, 0] },
  echo: { env: [12, 10, 8, 6, 5, 4, 3, 2, 1, 0], rel: [0] },
};
/** Bateria no PSG: macro de volume por tick e modo/taxa do ruído. HD: tipo de tambor sintetizado. */
export const DRUMS = {
  K: { white: false, rate: 2, env: [15, 13, 10, 7, 4, 1], hd: 'kick' },
  k: { white: false, rate: 2, env: [11, 8, 5, 2], hd: 'kickSoft' },
  S: { white: true, rate: 1, env: [15, 13, 11, 9, 7, 5, 3, 1], hd: 'snare' },
  s: { white: true, rate: 1, env: [11, 8, 5, 2], hd: 'snareSoft' },
  H: { white: true, rate: 0, env: [11, 6, 2], hd: 'hat' },
  h: { white: true, rate: 0, env: [8, 3], hd: 'hatSoft' },
  O: { white: true, rate: 0, env: [12, 10, 8, 7, 6, 5, 4, 3, 2, 1], hd: 'openHat' },
  C: { white: true, rate: 0, env: [15, 14, 13, 12, 11, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1], hd: 'crash' },
  T: { white: false, rate: 1, env: [15, 13, 11, 9, 6, 3], hd: 'tom' },
  t: { white: false, rate: 0, env: [14, 11, 8, 5, 2], hd: 'tomHi' },
};

/** Expande a string de um canal em array de tokens por linha. Suporta "|" (ignorado) e "tok*N". */
export function tokenize(str) {
  const out = []; if (!str) return out;
  for (const raw of str.split(/\s+/)) {
    if (!raw || raw === '|') continue;
    const m = /^(.*)\*(\d+)$/.exec(raw); if (m) { for (let i = 0; i < +m[2]; i++) out.push(m[1]); } else out.push(raw);
  }
  return out;
}

/** Compila a música: valida padrões, resolve instrumentos. */
export function compileSong(song) {
  const inst = {};
  for (const k in song.instruments) {
    const d = song.instruments[k]; const base = typeof d.env === 'string' ? ENV[d.env] : { env: d.env, rel: d.rel || [0] };
    inst[k] = { name: k, env: base.env, rel: d.rel || base.rel, arp: d.arp || null, arpSpeed: d.arpSpeed || 1, vib: d.vib || null, slide: d.slide || 0, hd: d.hd || {}, detune: d.detune || 0 };
  }
  const patterns = {};
  for (const name in song.patterns) {
    const p = song.patterns[name]; const chans = { A: tokenize(p.A), B: tokenize(p.B), C: tokenize(p.C), N: tokenize(p.N) };
    const rows = Math.max(chans.A.length, chans.B.length, chans.C.length, chans.N.length, p.rows || 0);
    for (const c in chans) while (chans[c].length < rows) chans[c].push('.');
    patterns[name] = { rows, ...chans };
  }
  for (const o of song.order) if (!patterns[o]) throw new Error(`Padrão inexistente na ordem: ${o} (${song.name})`);
  const speed = Array.isArray(song.speed) ? song.speed : [song.speed || 6];
  return { ...song, inst, patterns, speed, loopStart: song.loopStart || 0, loop: song.loop !== false };
}

class ChannelState {
  constructor() { this.reset(); }
  reset() { this.note = null; this.inst = null; this.tick = 0; this.released = false; this.relTick = 0; this.vol = 15; this.lastAtt = -1; this.lastN = -1; this.slideAcc = 0; this.hdOn = false; }
}

/**
 * Sequencer: toca uma música em um backend (PSG ou HD). Métodos: play(song, opts), stop(), tick position.
 * Backend: { tone(t, ch, freq, att, inst, isOnset), noise(t, white, rate, att), drum(t, kind, att), allOff(t) }
 */
export class Sequencer {
  constructor(ctx, backend) {
    this.ctx = ctx; this.backend = backend; this.song = null; this.playing = false; this.lookahead = 0.16; this.tickDur = 1 / 60;
    this.ch = [new ChannelState(), new ChannelState(), new ChannelState()]; this.drum = { env: null, tick: 0, def: null };
    this.pos = { order: 0, row: 0, tickInRow: 0, speedIdx: 0 }; this.nextTickTime = 0; this.timer = null; this.onEnd = null; this.ended = false; this.tickCount = 0;
    this.batch = []; this.paused = false;
  }
  play(song, { restart = true, once = false } = {}) {
    this.song = song; this.once = once; this.ended = false; this.playing = true; this.paused = false;
    if (restart) { this.pos = { order: 0, row: 0, tickInRow: 0, speedIdx: 0 }; for (const c of this.ch) c.reset(); this.drum.env = null; this.tickCount = 0; }
    this.nextTickTime = this.ctx.currentTime + 0.05;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 20);
    this.schedule();
  }
  stop(t) { this.playing = false; if (this.timer) { clearInterval(this.timer); this.timer = null; } this.backend.allOff(t ?? this.ctx.currentTime); for (const c of this.ch) c.hdOn = false; }
  pause() { if (!this.playing) return; this.paused = true; this.backend.allOff(this.ctx.currentTime); }
  resume() { if (!this.paused) return; this.paused = false; this.nextTickTime = this.ctx.currentTime + 0.05; }
  /** Troca o backend mantendo a posição. */
  setBackend(b) { const t = this.ctx.currentTime; this.backend.allOff(t); this.backend = b; for (const c of this.ch) { c.lastAtt = -1; c.lastN = -1; c.hdOn = false; } }
  /** Renderização offline: agenda todos os ticks de uma vez (OfflineAudioContext). */
  renderAll(song, seconds, { once = false } = {}) {
    this.song = song; this.once = once; this.playing = true; this.pos = { order: 0, row: 0, tickInRow: 0, speedIdx: 0 }; for (const c of this.ch) c.reset();
    let t = 0.02; const n = Math.ceil(seconds * 60);
    for (let i = 0; i < n && this.playing; i++) { this.doTick(t); t += this.tickDur; }
    this.backend.flush?.(); return t;
  }
  schedule() {
    if (!this.playing || this.paused) return;
    const until = this.ctx.currentTime + this.lookahead; let guard = 0;
    while (this.nextTickTime < until && guard++ < 64 && this.playing) { this.doTick(this.nextTickTime); this.nextTickTime += this.tickDur; }
    if (this.batch.length) { this.backend.flush?.(this.batch); this.batch.length = 0; }
  }
  doTick(t) {
    const s = this.song; const pos = this.pos;
    if (pos.tickInRow === 0) this.readRow(t);
    // avança estado por canal
    for (let i = 0; i < 3; i++) this.renderChannel(i, t);
    this.renderDrum(t);
    // próximo tick / linha
    pos.tickInRow++; this.tickCount++;
    const spd = s.speed[pos.speedIdx % s.speed.length];
    if (pos.tickInRow >= spd) {
      pos.tickInRow = 0; pos.row++; pos.speedIdx++;
      const pat = s.patterns[s.order[pos.order]];
      if (pos.row >= pat.rows) {
        pos.row = 0; pos.order++;
        if (pos.order >= s.order.length) {
          if (s.loop && !this.once) pos.order = s.loopStart; else { pos.order = s.order.length - 1; pos.row = pat.rows; this.playing = false; this.ended = true; this.backend.allOff(t + this.tickDur * 2); if (this.timer) { clearInterval(this.timer); this.timer = null; } if (this.onEnd) this.onEnd(this); return; }
        }
      }
    }
  }
  readRow(t) {
    const s = this.song; const pat = s.patterns[s.order[this.pos.order]]; const row = this.pos.row;
    for (let i = 0; i < 3; i++) {
      const tok = pat['ABC'[i]][row]; const c = this.ch[i];
      if (tok === '.' || tok === '--' || tok === '---') continue;
      if (tok === '==' || tok === '===' || tok === 'x') { if (c.note !== null && !c.released) { c.released = true; c.relTick = 0; } continue; }
      // NOTE[:inst][vN]
      const m = /^([A-G][#b]?-?\d)(?::([A-Za-z_][A-Za-z0-9_]*?))?(?:v(\d+))?$/.exec(tok);
      if (!m) { console.warn('[seq] token inválido', tok, 'em', s.name); continue; }
      const midi = parseNote(m[1]); if (m[2]) c.inst = s.inst[m[2]]; if (!c.inst) c.inst = s.inst[Object.keys(s.inst)[0]];
      if (m[3]) c.vol = Math.min(15, +m[3]);
      c.note = midi; c.tick = 0; c.released = false; c.relTick = 0; c.slideAcc = 0; c.onset = true;
    }
    const d = pat.N[row];
    if (d && d !== '.' && DRUMS[d]) { this.drum.def = DRUMS[d]; this.drum.tick = 0; this.drum.kind = d; this.drum.onset = true; }
  }
  renderChannel(i, t) {
    const c = this.ch[i]; const inst = c.inst;
    if (c.note === null || !inst) { if (c.lastAtt !== 15) { this.backend.tone(t, i, 0, 15, inst, false, c); c.lastAtt = 15; c.hdOn = false; } return; }
    let level;
    if (c.released) { level = c.relTick < inst.rel.length ? inst.rel[c.relTick] : 0; c.relTick++; if (level === 0 && c.relTick > inst.rel.length) { c.note = null; } }
    else level = inst.env[Math.min(c.tick, inst.env.length - 1)];
    level = Math.round(level * (c.vol / 15)); const att = 15 - Math.max(0, Math.min(15, level));
    // pitch
    let midi = c.note;
    if (inst.arp) midi += inst.arp[Math.floor(c.tick / inst.arpSpeed) % inst.arp.length];
    if (inst.vib && c.tick >= (inst.vib.delay || 0)) midi += Math.sin((c.tick - (inst.vib.delay || 0)) * this.tickDur * Math.PI * 2 * inst.vib.rate) * inst.vib.depth;
    if (inst.slide) { c.slideAcc += inst.slide; midi += c.slideAcc; }
    midi += inst.detune;
    const f = midiToFreq(midi);
    this.backend.tone(t, i, f, att, inst, c.onset, c); c.onset = false; c.lastAtt = att; c.tick++;
  }
  renderDrum(t) {
    const d = this.drum; if (!d.def) { return; }
    const env = d.def.env; const level = d.tick < env.length ? env[d.tick] : 0; const att = 15 - level;
    if (d.onset) { this.backend.drum(t, d.def.hd, att, d.kind); d.onset = false; }
    this.backend.noise(t, d.def.white, d.def.rate, att);
    d.tick++; if (d.tick > env.length) { d.def = null; this.backend.noise(t, true, 0, 15); }
  }
}

/** Backend PSG: converte eventos de alto nível em escritas de registradores com tempo. */
/** Duração de um loop completo em segundos (soma das linhas × speed). */
export function loopSeconds(song) {
  let ticks = 0, si = 0;
  for (const o of song.order) { const p = song.patterns[o]; for (let r = 0; r < p.rows; r++) { ticks += song.speed[si % song.speed.length]; si++; } }
  return ticks / 60;
}
export class PsgBackend {
  constructor(psg) { this.psg = psg; this.events = []; this.lastN = [-1, -1, -1]; this.lastAtt = [-1, -1, -1, -1]; this.lastNoise = ''; }
  tone(t, ch, freq, att, inst, onset, state) {
    if (att < 15) { let f = freq; while (f > 0 && f < 109.5) f *= 2; while (f > 56000) f /= 2; const n = freqToPeriod(f); if (n !== this.lastN[ch]) { this.events.push({ type: 'tone', ch, n, t }); this.lastN[ch] = n; } }
    if (att !== this.lastAtt[ch]) { this.events.push({ type: 'vol', ch, att, t }); this.lastAtt[ch] = att; }
  }
  noise(t, white, rate, att) {
    const key = (white ? 'w' : 'p') + rate; if (key !== this.lastNoise && att < 15) { this.events.push({ type: 'noise', white, rate, t }); this.lastNoise = key; }
    if (att !== this.lastAtt[3]) { this.events.push({ type: 'vol', ch: 3, att, t }); this.lastAtt[3] = att; }
  }
  drum() {}
  allOff(t) { this.events.push({ type: 'allOff', t }); this.lastAtt.fill(15); this.flush(); }
  flush() { if (this.events.length) { this.psg.send(this.events); this.events = []; } }
}
