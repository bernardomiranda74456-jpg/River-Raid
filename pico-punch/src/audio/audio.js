// Motor de áudio: AudioContext criado no primeiro gesto; mixer (música/efeitos); PSG para música,
// PSG para efeitos; backends PSG e HD trocáveis mantendo a posição; jingles com ducking.
import { PsgNode, freqToPeriod } from './psg.js';
import { Sequencer, PsgBackend, compileSong } from './sequencer.js';
import { HDSynth } from './hdsynth.js';
import { SFX } from './sfx.js';
import { SONGS } from './music/index.js';

const WORKLET_URL = new URL('./psg-worklet.js', import.meta.url).href;

export class AudioEngine {
  constructor(game) {
    this.game = game; this.ctx = null; this.ready = false; this.unlocking = false; this.mode = game.mode; this.songs = {}; this.compiled = {};
    this.music = { play: (n, o) => this.playMusic(n, o), stop: () => this.stopMusic(), pause: () => this.seq?.pause(), resume: () => this.seq?.resume(), current: null };
    this.sfxChan = 0; this.pendingMusic = null; this.engineOn = false; this.volumes = { music: game.save.settings.musicVol, sfx: game.save.settings.sfxVol };
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; if (document.hidden) this.ctx.suspend(); else this.ctx.resume(); });
  }
  /** Chamado no primeiro gesto do usuário. */
  async unlock() {
    if (this.ready || this.unlocking) { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); return; }
    this.unlocking = true;
    const AC = window.AudioContext || window.webkitAudioContext; this.ctx = new AC({ latencyHint: 'interactive' });
    await this.buildGraph(this.ctx);
    this.ready = true; this.unlocking = false;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.pendingMusic) { const p = this.pendingMusic; this.pendingMusic = null; this.playMusic(p.name, p.opts); }
  }
  async buildGraph(ctx) {
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value = -10; this.comp.knee.value = 12; this.comp.ratio.value = 4; this.comp.attack.value = 0.004; this.comp.release.value = 0.12;
    this.master.connect(this.comp); this.comp.connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.volumes.music; this.musicBus.connect(this.master);
    this.duckGain = ctx.createGain(); this.duckGain.connect(this.musicBus);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.volumes.sfx; this.sfxBus.connect(this.master);
    this.jingleBus = ctx.createGain(); this.jingleBus.connect(this.musicBus);
    this.psgMusic = await PsgNode.create(ctx, this.duckGain, WORKLET_URL);
    this.psgJingle = await PsgNode.create(ctx, this.jingleBus, WORKLET_URL);
    this.psgSfx = await PsgNode.create(ctx, this.sfxBus, WORKLET_URL); this.psgSfx.setGain(0.3);
    this.hdMusic = new HDSynth(ctx, this.duckGain); this.hdJingle = new HDSynth(ctx, this.jingleBus);
    this.backends = { retro: { music: new PsgBackend(this.psgMusic), jingle: new PsgBackend(this.psgJingle) }, hd: { music: this.hdMusic, jingle: this.hdJingle } };
    const m = this.mode === 'hd' ? 'hd' : 'retro';
    this.seq = new Sequencer(ctx, this.backends[m].music); this.jingleSeq = new Sequencer(ctx, this.backends[m].jingle);
    this.jingleSeq.onEnd = () => { this.unduck(); };
  }
  song(name) { if (!this.compiled[name]) { const s = SONGS[name]; if (!s) { console.warn('[áudio] música inexistente:', name); return null; } this.compiled[name] = compileSong(s); } return this.compiled[name]; }
  playMusic(name, opts = {}) {
    if (!this.ready) { if (!opts.once) this.pendingMusic = { name, opts }; return; }
    const song = this.song(name); if (!song) return;
    if (opts.once) {
      this.jingleSeq.stop(); this.jingleSeq.play(song, { restart: true, once: true });
      if (opts.duck) this.duck(0.3); else { this.seq.stop(); this.music.current = null; }
      if (this.mode === 'hd') this.hdJingle.setTempoDelay(3600 / ((song.speed[0]) * (song.rpb || 4)));
      return;
    }
    if (this.music.current === name && this.seq.playing && !opts.restart) return;
    this.music.current = name; this.seq.stop(); this.seq.play(song, { restart: true });
    if (this.mode === 'hd') this.hdMusic.setTempoDelay(3600 / ((song.speed[0]) * (song.rpb || 4)));
  }
  stopMusic() { this.music.current = null; this.seq?.stop(); this.pendingMusic = null; }
  duck(level) { if (!this.ctx) return; const t = this.ctx.currentTime; this.duckGain.gain.cancelScheduledValues(t); this.duckGain.gain.setTargetAtTime(level, t, 0.05); }
  unduck() { if (!this.ctx) return; const t = this.ctx.currentTime; this.duckGain.gain.cancelScheduledValues(t); this.duckGain.gain.setTargetAtTime(1, t + 0.1, 0.25); }
  setMode(mode) {
    this.mode = mode; if (!this.ready) return;
    const b = this.backends[mode === 'hd' ? 'hd' : 'retro']; this.seq.setBackend(b.music); this.jingleSeq.setBackend(b.jingle);
    if (mode === 'hd' && this.seq.song) this.hdMusic.setTempoDelay(3600 / ((this.seq.song.speed[0]) * (this.seq.song.rpb || 4)));
  }
  setVolumes(music, sfx) { this.volumes = { music, sfx }; if (this.musicBus) { this.musicBus.gain.setTargetAtTime(music, this.ctx.currentTime, 0.02); this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02); } }
  /** Toca um efeito: usa um canal de tom rotativo (0-1) e o canal de ruído do PSG de efeitos. Canal 2 é do motor. */
  sfx(name) {
    if (!this.ready) return; const def = SFX[name]; if (!def) { console.warn('[sfx] inexistente:', name); return; }
    const t0 = this.ctx.currentTime + 0.005; const ev = []; const dt = 1 / 60;
    if (def.tone) {
      const ch = this.sfxChan; this.sfxChan = (this.sfxChan + 1) % 2;
      def.tone.forEach((fr, i) => { const t = t0 + i * dt; if (fr[0] > 0) ev.push({ type: 'tone', ch, n: freqToPeriod(fr[0]), t }); ev.push({ type: 'vol', ch, att: fr[0] > 0 ? fr[1] : 15, t }); });
      ev.push({ type: 'vol', ch, att: 15, t: t0 + def.tone.length * dt });
    }
    if (def.noise) {
      def.noise.forEach((fr, i) => { const t = t0 + i * dt; ev.push({ type: 'noise', white: fr[0], rate: fr[1], t }); ev.push({ type: 'vol', ch: 3, att: fr[2], t }); });
      ev.push({ type: 'vol', ch: 3, att: 15, t: t0 + def.noise.length * dt });
    }
    this.psgSfx.send(ev);
  }
  /** Motor de veículo contínuo no canal 2 do PSG de efeitos; pitch pela velocidade (0..1). */
  engine(on, speed = 0, kind = 'moto') {
    if (!this.ready) return; const t = this.ctx.currentTime;
    if (!on) { if (this.engineOn) { this.psgSfx.send([{ type: 'vol', ch: 2, att: 15, t }]); this.engineOn = false; } return; }
    const f = kind === 'heli' ? 40 + speed * 30 : kind === 'boat' ? 35 + speed * 20 : 45 + speed * 110;
    const att = kind === 'heli' ? 7 : 6 + Math.round((1 - speed) * 3);
    this.psgSfx.send([{ type: 'tone', ch: 2, n: freqToPeriod(f), t }, { type: 'vol', ch: 2, att, t }]); this.engineOn = true;
  }
}
