// Persistência em localStorage: moedas, recorde, chaves, skins, missões e
// configurações.
const KEY = 'fuga-nos-trilhos.save.v1';

export class Save {
  constructor() {
    this.data = {
      coins: 0, best: 0, keys: 0, unlocked: [0], skin: 0, runs: 0,
      missions: { active: [], done: [], progress: {} },
      settings: { quality: 'auto', ao: true, bloom: true, motionBlur: true, chroma: true, flare: true, smaa: true, shadows: true, rain: true, sfx: true, music: true },
    };
    this.read();
  }
  read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        this.data = Object.assign(this.data, d);
        this.data.settings = Object.assign({ quality: 'auto', ao: true, bloom: true, motionBlur: true, chroma: true, flare: true, smaa: true, shadows: true, rain: true, sfx: true, music: true }, d.settings || {});
        this.data.missions = Object.assign({ active: [], done: [], progress: {} }, d.missions || {});
      }
    } catch (e) { /* storage indisponível */ }
  }
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* noop */ }
  }
}
