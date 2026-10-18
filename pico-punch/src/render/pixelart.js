// Converte matrizes de caracteres (pixel art) em canvas e texturas Pixi (nearest, para o retrô).
import { Texture, CanvasSource, Rectangle } from 'pixi.js';
import { smsRgb } from './palette.js';

/** Desenha uma matriz (array de strings) em um ImageData, usando a paleta letra→código SMS. */
export function paintMatrix(img, rows, pal, ox = 0, oy = 0, flipX = false) {
  const W = img.width, data = img.data;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]; const code = pal[ch];
      if (code === null || code === undefined) continue;
      const [r, g, b] = smsRgb(code);
      const px = ox + (flipX ? row.length - 1 - x : x), py = oy + y;
      if (px < 0 || py < 0 || px >= W || py >= img.height) continue;
      const i = (py * W + px) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
}

/** Compõe várias partes em uma única matriz w×h (último sobrescreve). parts: [{rows,x,y,flipX}] */
export function compose(w, h, parts) {
  const grid = Array.from({ length: h }, () => Array(w).fill('.'));
  for (const p of parts) {
    const rows = p.rows; const fx = !!p.flipX;
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x]; if (ch === '.') continue;
      const gx = p.x + (fx ? rows[y].length - 1 - x : x), gy = p.y + y;
      if (gx >= 0 && gy >= 0 && gx < w && gy < h) grid[gy][gx] = ch;
    }
  }
  return grid.map((r) => r.join(''));
}

/** Substitui letras de uma matriz (ex.: recolorir um inimigo). */
export const recolor = (rows, map) => rows.map((r) => r.replace(/./g, (c) => map[c] ?? c));

export function makeCanvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

/**
 * Atlas de frames de uma arte: frames é um objeto nome → matriz (todas w×h).
 * Retorna { texture(frame), canvas, w, h, names }.
 */
export class PixelAtlas {
  constructor(frames, pal, opts = {}) {
    this.names = Object.keys(frames);
    const first = frames[this.names[0]];
    this.w = opts.w || first[0].length; this.h = opts.h || first.length;
    const cols = Math.min(this.names.length, 16); const rowsN = Math.ceil(this.names.length / cols);
    this.canvas = makeCanvas(cols * this.w, rowsN * this.h);
    const ctx = this.canvas.getContext('2d'); const img = ctx.createImageData(this.canvas.width, this.canvas.height);
    this.rects = {};
    this.names.forEach((n, i) => {
      const cx = (i % cols) * this.w, cy = Math.floor(i / cols) * this.h;
      paintMatrix(img, frames[n], pal, cx, cy); this.rects[n] = new Rectangle(cx, cy, this.w, this.h);
    });
    ctx.putImageData(img, 0, 0);
    this.source = new CanvasSource({ resource: this.canvas, scaleMode: 'nearest', alphaMode: 'premultiply-alpha-on-upload' });
    this.textures = {};
    for (const n of this.names) this.textures[n] = new Texture({ source: this.source, frame: this.rects[n] });
  }
  texture(name) { return this.textures[name] || this.textures[this.names[0]]; }
}
