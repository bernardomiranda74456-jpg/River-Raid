// Renderizador retrô: cena → RenderTexture 256×192 (nearest) → escala inteira centralizada.
import { Container, Sprite, RenderTexture } from 'pixi.js';
export const RETRO_W = 256, RETRO_H = 192;
export class RetroRenderer {
  constructor(app) {
    this.app = app; this.rt = RenderTexture.create({ width: RETRO_W, height: RETRO_H, scaleMode: 'nearest', antialias: false });
    this.screen = new Sprite(this.rt); this.screen.anchor.set(0.5); this.root = new Container(); this.root.addChild(this.screen); this.scale = 1; this.crt = null;
    this.resize();
  }
  resize() {
    const w = this.app.renderer.width / this.app.renderer.resolution, h = this.app.renderer.height / this.app.renderer.resolution;
    const dpr = this.app.renderer.resolution;
    // escala inteira em pixels físicos, convertida para unidades CSS
    const physScale = Math.max(1, Math.floor(Math.min((w * dpr) / RETRO_W, (h * dpr) / RETRO_H)));
    this.scale = physScale / dpr; this.screen.scale.set(this.scale); this.screen.x = Math.round(w / 2); this.screen.y = Math.round(h / 2);
    if (this.crt) this.crt.resize(RETRO_W * this.scale, RETRO_H * this.scale);
  }
  render(sceneRoot) { this.app.renderer.render({ container: sceneRoot, target: this.rt, clear: true, clearColor: [0, 0, 0, 1] }); }
  setCrt(filter) { this.crt = filter; this.screen.filters = filter ? [filter] : null; if (filter) filter.resize(RETRO_W * this.scale, RETRO_H * this.scale); }
}
