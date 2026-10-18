// Persistência em localStorage, com versão e defaults.
const KEY = 'picopunch.save.v1';
const DEFAULTS = () => ({
  version: 1,
  settings: { mode: 'hd', crt: false, crtHD: false, spriteLimit: false, musicVol: 0.8, sfxVol: 0.9, keys: null, showFps: false, reduceFx: false },
  progress: { unlocked: 1, money: 0, lives: 3, items: {}, bestTimes: {}, bestScores: {}, beaten: {} },
});
export class Save {
  constructor() { this.data = DEFAULTS(); this.load(); }
  load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { const d = JSON.parse(raw); if (d && d.version === 1) { this.data.settings = { ...this.data.settings, ...d.settings }; this.data.progress = { ...this.data.progress, ...d.progress }; } } }
    catch (e) { /* localStorage indisponível (modo privado) — segue com defaults */ }
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignora */ } }
  reset() { this.data = DEFAULTS(); this.save(); }
  get settings() { return this.data.settings; }
  get progress() { return this.data.progress; }
}
