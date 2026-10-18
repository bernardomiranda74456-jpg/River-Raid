/**
 * Graphics / control settings with presets and localStorage persistence.
 * A preset is just a bundle of values; the user can override each one.
 */
export const PRESETS = {
  low:    { ao: false, bloom: false, smaa: false, grade: true,  dof: false, mblur: false, shadow: 1024, scale: 0.75, cascades: 1, anisotropy: 2,  particles: 0.35, maxChars: 24, envRes: 128 },
  medium: { ao: false, bloom: true,  smaa: true,  grade: true,  dof: false, mblur: false, shadow: 2048, scale: 1.0,  cascades: 2, anisotropy: 4,  particles: 0.6,  maxChars: 32, envRes: 256 },
  high:   { ao: true,  bloom: true,  smaa: true,  grade: true,  dof: false, mblur: false, shadow: 2048, scale: 1.0,  cascades: 3, anisotropy: 8,  particles: 1.0,  maxChars: 32, envRes: 256 },
  ultra:  { ao: true,  bloom: true,  smaa: true,  grade: true,  dof: true,  mblur: true,  shadow: 4096, scale: 1.0,  cascades: 3, anisotropy: 16, particles: 1.4,  maxChars: 32, envRes: 512 },
};

const KEY = 'wobblerush.settings.v1';

export class Settings {
  constructor() {
    this.preset = 'high';
    this.values = { ...PRESETS.high };
    this.sensitivity = 1.0;
    this.volume = 0.7;
    this.showFps = false;
    this.camMode = 'follow'; // 'follow' | 'first' | 'free'
    this.skin = 0;
    this.listeners = new Set();
    this.load();
  }
  applyPreset(name) {
    if (!PRESETS[name]) return;
    this.preset = name;
    this.values = { ...PRESETS[name] };
    this.save();
    this.emit();
  }
  set(key, value) {
    this.values[key] = value;
    this.preset = 'custom';
    this.save();
    this.emit();
  }
  get(key) { return this.values[key]; }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this); }
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ preset: this.preset, values: this.values, sensitivity: this.sensitivity, volume: this.volume, showFps: this.showFps, skin: this.skin, camMode: this.camMode }));
    } catch (e) { /* storage may be unavailable */ }
  }
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (d.values) this.values = { ...PRESETS.high, ...d.values };
      if (d.preset) this.preset = d.preset;
      if (typeof d.sensitivity === 'number') this.sensitivity = d.sensitivity;
      if (typeof d.volume === 'number') this.volume = d.volume;
      if (typeof d.showFps === 'boolean') this.showFps = d.showFps;
      if (['follow', 'first', 'free'].includes(d.camMode)) this.camMode = d.camMode;
      if (typeof d.skin === 'number') this.skin = d.skin;
      return true;
    } catch (e) { return false; }
  }
}
