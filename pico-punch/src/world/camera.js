// Câmera suave com look-ahead, zonas por trecho, zoom e shake.
import { clamp, lerp, approach } from '../core/math.js';
export class Camera {
  constructor(viewW, viewH) {
    this.x = 0; this.y = 0; this.viewW = viewW; this.viewH = viewH; this.zoom = 1; this.targetZoom = 1;
    this.lookX = 0; this.shakeT = 0; this.shakeA = 0; this.sx = 0; this.sy = 0; this.bounds = { x: 0, y: 0, w: 4096, h: 192 };
    this.zones = []; this.lockY = null; this.px = 0; this.py = 0; this.snapped = false; this.verticalBias = 0;
  }
  setView(w, h) { this.viewW = w; this.viewH = h; }
  snapTo(target, mapW, mapH) { if (mapW) this.bounds = { x: 0, y: 0, w: mapW, h: mapH }; this.x = target.cx - this.viewW / 2; this.y = target.cy - this.viewH / 2 - 10; this.clampToBounds(); this.px = this.x; this.py = this.y; this.lookX = 0; }
  shake(amp, time) { this.shakeA = Math.max(this.shakeA, amp); this.shakeT = Math.max(this.shakeT, time); }
  clampToBounds() {
    const b = this.bounds; const vw = this.viewW / this.zoom, vh = this.viewH / this.zoom;
    this.x = clamp(this.x, b.x, Math.max(b.x, b.x + b.w - vw)); this.y = clamp(this.y, b.y, Math.max(b.y, b.y + b.h - vh));
  }
  update(dt, target, mapW, mapH) {
    this.px = this.x; this.py = this.y;
    // zona ativa (por posição x do alvo) pode restringir y ou travar
    let b = { x: 0, y: 0, w: mapW, h: mapH };
    for (const z of this.zones) if (target.cx >= z.x && target.cx < z.x + z.w) { b = { x: z.x, y: z.y ?? 0, w: z.w, h: z.h ?? mapH }; if (z.zoom) this.targetZoom = z.zoom; break; }
    this.bounds = b;
    this.zoom = approach(this.zoom, this.targetZoom, dt * 1.5);
    const vw = this.viewW / this.zoom, vh = this.viewH / this.zoom;
    // look-ahead na direção do movimento
    const want = Math.abs(target.vx) > 20 ? Math.sign(target.vx) * 28 : this.lookX;
    this.lookX = approach(this.lookX, want, dt * 60);
    const tx = target.cx + this.lookX - vw / 2;
    // vertical: segue com zona morta; sobe mais devagar que desce
    const ty = target.cy - vh * 0.58 + this.verticalBias;
    this.x = lerp(this.x, tx, 1 - Math.pow(0.001, dt));
    const dy = ty - this.y; const k = dy > 0 ? 1 - Math.pow(0.002, dt) : 1 - Math.pow(0.01, dt);
    if (target.onGround || Math.abs(dy) > vh * 0.3 || target.state === 'swim' || target.state === 'climb') this.y = lerp(this.y, ty, k);
    this.clampToBounds();
    if (this.shakeT > 0) { this.shakeT -= dt; const a = this.shakeA * Math.min(1, this.shakeT * 8); this.sx = (Math.random() * 2 - 1) * a; this.sy = (Math.random() * 2 - 1) * a; } else { this.sx = 0; this.sy = 0; this.shakeA = 0; }
  }
  /** Posição para render (interpolada). */
  renderX(alpha) { return lerp(this.px, this.x, alpha) + this.sx; }
  renderY(alpha) { return lerp(this.py, this.y, alpha) + this.sy; }
}
