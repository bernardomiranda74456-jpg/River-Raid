// Fundos em parallax por tema. Retrô: 3 camadas pixel art geradas (céu, montanhas distantes, colinas).
// HD: substituído por hd/parallax-hd.js (6+ camadas). Ambos expõem update(camX, camY, t).
import { Container, Sprite, TilingSprite, Texture, CanvasSource } from 'pixi.js';
import { makeCanvas } from './pixelart.js';
import { smsCss, TILE_PALS } from './palette.js';

/** Desenha uma camada 256×H de silhuetas pixeladas numa cor, periódica em x. */
function silhouette(w, h, color, fn) {
  const c = makeCanvas(w, h); const ctx = c.getContext('2d'); ctx.fillStyle = color;
  for (let x = 0; x < w; x++) { const top = Math.round(fn(x / w)); ctx.fillRect(x, Math.max(0, top), 1, h - top); }
  return c;
}
const tex = (canvas) => new Texture({ source: new CanvasSource({ resource: canvas, scaleMode: 'nearest', addressModeU: 'repeat', addressModeV: 'clamp-to-edge' }) });

export const THEME_BG = {
  mountain: { sky: ['s', 'c'], far: 'q', near: 'R', ground: 'G', time: 'morning' },
  forest: { sky: ['s', 'b'], far: 'G', near: 'g', ground: 'G' },
  lake: { sky: ['s', 'b'], far: 'q', near: 'G', ground: 'G' },
  village: { sky: ['s', 'c'], far: 'q', near: 'R', ground: 'g' },
  desert: { sky: ['c', 's'], far: 'D', near: 'd', ground: 'd' },
  road: { sky: ['s', 'c'], far: 'q', near: 'g', ground: 'G' },
  sky: { sky: ['s', 'c'], far: 'c', near: 'w', ground: 'c' },
  cave: { sky: ['k', 's'], far: 'q', near: 'R', ground: 'q' },
  city: { sky: ['k', 's'], far: 'D', near: 'q', ground: 'q' },
  castle: { sky: ['k', 's'], far: 'q', near: 'R', ground: 'q' },
};

export class RetroParallax {
  constructor(theme, viewW, viewH) {
    this.root = new Container(); this.layers = []; this.viewW = viewW; this.viewH = viewH; this.theme = theme;
    const pal = TILE_PALS[theme] || TILE_PALS.mountain; const cfg = THEME_BG[theme] || THEME_BG.mountain;
    // céu em faixas (gradiente de 2 cores com dithering em 4 bandas)
    const sky = makeCanvas(8, 192); const sctx = sky.getContext('2d');
    const c0 = smsCss(pal[cfg.sky[0]]), c1 = smsCss(pal[cfg.sky[1]]);
    for (let y = 0; y < 192; y++) for (let x = 0; x < 8; x++) { const f = y / 192; const chk = (x + y) % 2 === 0; const q = (x % 2 === 0) && (y % 2 === 0); sctx.fillStyle = f < 0.3 ? c0 : f < 0.45 ? (q ? c1 : c0) : f < 0.6 ? (chk ? c1 : c0) : f < 0.75 ? (q ? c0 : c1) : c1; sctx.fillRect(x, y, 1, 1); }
    this.sky = new TilingSprite({ texture: tex(sky), width: viewW + 16, height: viewH }); this.root.addChild(this.sky);
    const seedF = (s) => (x) => Math.sin(x * Math.PI * 2 * 3 + s) * 0.5 + Math.sin(x * Math.PI * 2 * 7 + s * 2) * 0.25 + Math.sin(x * Math.PI * 2 * 13 + s * 3) * 0.12;
    const addLayer = (color, baseY, amp, s, factor, h = 192) => {
      const f = seedF(s); const c = silhouette(512, h, smsCss(pal[color]), (u) => baseY - amp * (f(u) + 0.6));
      const ts = new TilingSprite({ texture: tex(c), width: viewW + 16, height: h }); ts.y = viewH - h; this.root.addChild(ts); this.layers.push({ ts, factor, h }); return ts;
    };
    if (theme === 'city') { // prédios em vez de montanhas
      const c = makeCanvas(512, 160); const ctx = c.getContext('2d'); let x = 0; let i = 0;
      while (x < 512) { const w = 16 + ((i * 37) % 32), hgt = 40 + ((i * 53) % 90); ctx.fillStyle = smsCss(pal.D); ctx.fillRect(x, 160 - hgt, w, hgt); ctx.fillStyle = smsCss(pal.y); for (let wy = 160 - hgt + 4; wy < 156; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) if (((wx * 7 + wy * 13) % 5) < 2) ctx.fillRect(wx, wy, 2, 3); x += w + 4; i++; }
      const ts = new TilingSprite({ texture: tex(c), width: viewW + 16, height: 160 }); ts.y = viewH - 160; this.root.addChild(ts); this.layers.push({ ts, factor: 0.25, h: 160 });
      addLayer('q', 150, 10, 2, 0.5, 192);
    } else {
      addLayer(cfg.far, 120, 50, 1, 0.15);
      addLayer(cfg.near, 160, 28, 2, 0.35);
    }
    // nuvens (apenas temas ao ar livre)
    if (!['cave', 'castle', 'city'].includes(theme)) {
      const cl = makeCanvas(256, 48); const cctx = cl.getContext('2d'); cctx.fillStyle = smsCss(pal.w);
      const blob = (x, y, w) => { cctx.fillRect(x, y + 2, w, 4); cctx.fillRect(x + 3, y, w - 6, 2); cctx.fillRect(x + 2, y + 6, w - 4, 2); };
      blob(10, 8, 30); blob(90, 20, 22); blob(170, 4, 40); blob(220, 26, 18);
      this.clouds = new TilingSprite({ texture: tex(cl), width: viewW + 16, height: 48 }); this.clouds.y = 8; this.root.addChild(this.clouds); this.cloudT = 0;
    }
  }
  resize(w, h) { this.viewW = w; this.viewH = h; this.sky.width = w + 16; this.sky.height = h; for (const l of this.layers) { l.ts.width = w + 16; l.ts.y = h - l.h; } if (this.clouds) this.clouds.width = w + 16; }
  update(camX, camY, t, retro) {
    const r = (v) => (retro ? Math.round(v) : v);
    for (const l of this.layers) { l.ts.tilePosition.x = r(-camX * l.factor); l.ts.y = r(this.viewH - l.h + 20 - camY * 0.1 * l.factor); }
    if (this.clouds) { this.clouds.tilePosition.x = r(-camX * 0.08 - t * 4); this.clouds.y = r(8 - camY * 0.02); }
    this.sky.tilePosition.y = r(-camY * 0.05);
  }
}
