// Partículas com pool (sem alocação no loop). Modo retrô: quadrados na paleta; HD: texturas suaves.
import { Container, Sprite, Texture, CanvasSource, Rectangle } from 'pixi.js';
import { makeCanvas } from './pixelart.js';
import { GRAVITY } from '../world/physics.js';

const MAX = 600;
/** Arredonda uma cor 24 bits para a paleta do Master System (2 bits por canal). */
const quantizeHex = (c) => { const q = (v) => Math.round(v / 85) * 85; return (q((c >> 16) & 255) << 16) | (q((c >> 8) & 255) << 8) | q(c & 255); };
export class Particles {
  constructor() {
    this.container = new Container(); this.pool = []; this.live = []; this.mode = 'retro';
    this._buildTextures();
    for (let i = 0; i < MAX; i++) { const s = new Sprite(this.tex.square); s.visible = false; s.anchor.set(0.5); this.container.addChild(s); this.pool.push({ s, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, g: 0, kind: 0, size: 1, rot: 0, vr: 0, fade: true, shrink: false, color: 0xffffff, px: 0, py: 0 }); }
  }
  _buildTextures() {
    // atlas 64×64: quadrado 2×2, círculo suave 16, caco triangular, folha, bolha, faísca
    const c = makeCanvas(96, 32); const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 4, 4);
    const g = ctx.createRadialGradient(24, 16, 0, 24, 16, 14); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(8, 0, 32, 32);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(42, 2); ctx.lineTo(60, 8); ctx.lineTo(48, 28); ctx.closePath(); ctx.fill(); // caco
    ctx.beginPath(); ctx.ellipse(76, 16, 6, 12, 0.6, 0, Math.PI * 2); ctx.fill(); // folha
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(88, 24, 5, 0, Math.PI * 2); ctx.stroke(); // bolha
    const src = new CanvasSource({ resource: c, scaleMode: 'linear' });
    const srcN = new CanvasSource({ resource: c, scaleMode: 'nearest' });
    this.tex = {
      square: new Texture({ source: srcN, frame: new Rectangle(0, 0, 4, 4) }),
      soft: new Texture({ source: src, frame: new Rectangle(8, 0, 32, 32) }),
      shard: new Texture({ source: src, frame: new Rectangle(40, 0, 24, 32) }),
      leaf: new Texture({ source: src, frame: new Rectangle(68, 2, 16, 28) }),
      bubble: new Texture({ source: src, frame: new Rectangle(82, 18, 12, 12) }),
    };
  }
  setMode(m) { this.mode = m; }
  emit(x, y, vx, vy, life, color, opts = {}) {
    if (!this.pool.length) return null;
    const p = this.pool.pop(); p.x = x; p.y = y; p.px = x; p.py = y; p.vx = vx; p.vy = vy; p.life = life; p.maxLife = life; p.g = opts.g ?? 0; p.kind = opts.kind || 'square';
    p.size = opts.size ?? 1; p.rot = opts.rot ?? 0; p.vr = opts.vr ?? 0; p.fade = opts.fade ?? true; p.shrink = opts.shrink ?? false; p.color = color; p.drag = opts.drag ?? 0; p.blend = opts.blend || 'normal';
    const s = p.s; s.visible = true; s.tint = this.mode === 'retro' ? quantizeHex(color) : color; s.alpha = 1; s.rotation = p.rot; s.blendMode = this.mode === 'retro' ? 'normal' : p.blend; // SMS não soma cores
    const hd = this.mode === 'hd';
    s.texture = hd ? (this.tex[p.kind] || this.tex.soft) : this.tex.square;
    const base = hd ? (p.kind === 'square' ? 0.12 : 0.1) : 0.5;
    s.scale.set(base * p.size);
    this.live.push(p); return p;
  }
  update(dt) {
    let w = 0;
    for (let i = 0; i < this.live.length; i++) {
      const p = this.live[i]; p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; this.pool.push(p); continue; }
      p.px = p.x; p.py = p.y; p.vy += p.g * dt; if (p.drag) { p.vx -= p.vx * p.drag * dt; p.vy -= p.vy * p.drag * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; this.live[w++] = p;
    }
    this.live.length = w;
  }
  render(alpha, retro) {
    for (const p of this.live) {
      const s = p.s; const t = p.life / p.maxLife;
      let x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha; if (retro) { x = Math.round(x); y = Math.round(y); }
      s.x = x; s.y = y; s.rotation = retro ? 0 : p.rot;
      if (p.fade) s.alpha = retro ? 1 : Math.min(1, t * 2); // retrô: sem alpha — cintila no fim da vida (abaixo)
      if (p.shrink) { const base = (this.mode === 'hd' ? (p.kind === 'square' ? 0.12 : 0.1) : 0.5) * p.size; s.scale.set(base * (0.3 + 0.7 * t)); }
      if (retro && p.fade && t < 0.3 && Math.floor(p.life * 30) % 2) s.visible = false; else s.visible = true;
    }
  }
  clear() { for (const p of this.live) { p.s.visible = false; this.pool.push(p); } this.live.length = 0; }
  // ----- Receitas usadas pelo gameplay (level.fx) -------------------------------------------
  dust(x, y, n) { for (let i = 0; i < n; i++) this.emit(x + (Math.random() - 0.5) * 8, y - 1, (Math.random() - 0.5) * 50, -Math.random() * 30 - 5, 0.3 + Math.random() * 0.25, 0xd8ccb0, { g: 60, kind: 'soft', size: 0.8 + Math.random() * 0.6, shrink: false, drag: 3 }); }
  splash(x, y) { for (let i = 0; i < 10; i++) this.emit(x + (Math.random() - 0.5) * 10, y, (Math.random() - 0.5) * 90, -Math.random() * 120 - 30, 0.5, 0xbfe9ff, { g: GRAVITY * 0.6, kind: 'soft', size: 0.5 }); }
  bubbles(x, y, n) { for (let i = 0; i < n; i++) this.emit(x + (Math.random() - 0.5) * 6, y, (Math.random() - 0.5) * 10, -20 - Math.random() * 20, 0.8 + Math.random() * 0.6, 0xd0f4ff, { kind: 'bubble', size: 0.4 + Math.random() * 0.5, fade: true }); }
  sparks(x, y, n) { for (let i = 0; i < n; i++) this.emit(x, y, (Math.random() - 0.5) * 140, (Math.random() - 0.5) * 140, 0.25 + Math.random() * 0.2, 0xffe08a, { g: 300, kind: 'soft', size: 0.4, blend: 'add' }); }
  sparkle(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 40; this.emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.4 + Math.random() * 0.3, 0xfff3a0, { kind: 'soft', size: 0.5, shrink: true, blend: 'add' }); } }
  pop(x, y) { for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; this.emit(x, y, Math.cos(a) * 70, Math.sin(a) * 70, 0.35, 0xffffff, { kind: 'soft', size: 0.5, shrink: true }); } }
  shards(x, y, kind) { const col = kind === 'star' ? 0xffd040 : 0xe0e0e0; for (let i = 0; i < 10; i++) this.emit(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 160, -Math.random() * 160 - 20, 0.6 + Math.random() * 0.4, col, { g: GRAVITY, kind: 'shard', size: 0.4 + Math.random() * 0.5, vr: (Math.random() - 0.5) * 20, rot: Math.random() * 6 }); }
  ember(x, y) { this.emit(x, y, (Math.random() - 0.5) * 15, -15 - Math.random() * 20, 0.6 + Math.random() * 0.5, 0xff9a3c, { kind: 'soft', size: 0.35, shrink: true, blend: 'add' }); }
  confetti(x, y, n) { const cols = [0xff5a5a, 0xffd36b, 0x6bf0a0, 0x6bb8ff, 0xd98cff]; for (let i = 0; i < n; i++) this.emit(x + (Math.random() - 0.5) * 40, y, (Math.random() - 0.5) * 120, -Math.random() * 180 - 40, 1.2 + Math.random(), cols[i % cols.length], { g: 250, kind: 'leaf', size: 0.5, vr: (Math.random() - 0.5) * 12, drag: 1.5 }); }
}
