// Arte HD gerada por código a partir das matrizes originais: upscale EPX (×4) + reamostragem suave
// (×6), contorno, sombreamento de volume e NORMAL MAP derivado de um height map ("pillow" por distância
// à borda + relevo por material). Tiles de solo são procedurais (ruído, grama desenhada, bisel).
import { Texture, CanvasSource, Rectangle } from 'pixi.js';
import { smsRgb, SPRITE_PAL, TILE_PALS } from './palette.js';
import { HERO_FRAMES } from './art/hero.js';
import { ENEMY_ART, BOSS_ART } from './art/enemies.js';
import { ITEM_ART } from './art/items.js';
import { TILE_ART, groundTile, THEME_GROUND } from './art/tiles.js';
import { makeCanvas } from './pixelart.js';
import { Rng } from '../core/math.js';

export const S = 6; // escala HD (texels por pixel retrô)

// ----- utilidades de imagem ---------------------------------------------------------------------
function matrixToRGBA(rows, pal) {
  const h = rows.length, w = rows[0].length; const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const code = pal[rows[y][x]]; if (code == null) continue; const [r, g, b] = smsRgb(code); const i = (y * w + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; }
  return { w, h, px };
}
const eq = (p, i, j) => p[i] === p[j] && p[i + 1] === p[j + 1] && p[i + 2] === p[j + 2] && p[i + 3] === p[j + 3];
/** EPX/Scale2x: dobra a resolução suavizando diagonais. */
function epx({ w, h, px }) {
  const W = w * 2, H = h * 2; const out = new Uint8ClampedArray(W * H * 4);
  const get = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : (y * w + x) * 4);
  const put = (X, Y, src) => { const o = (Y * W + X) * 4; if (src < 0) return; out[o] = px[src]; out[o + 1] = px[src + 1]; out[o + 2] = px[src + 2]; out[o + 3] = px[src + 3]; };
  const same = (a, b) => (a < 0 || b < 0 ? false : eq(px, a, b));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = get(x, y), A = get(x, y - 1), B = get(x + 1, y), C = get(x - 1, y), D = get(x, y + 1);
    let e1 = P, e2 = P, e3 = P, e4 = P;
    if (same(C, A) && !same(C, D) && !same(A, B)) e1 = A;
    if (same(A, B) && !same(A, C) && !same(B, D)) e2 = B;
    if (same(D, C) && !same(D, A) && !same(C, B)) e3 = C;
    if (same(B, D) && !same(B, A) && !same(D, C)) e4 = D;
    put(x * 2, y * 2, e1); put(x * 2 + 1, y * 2, e2); put(x * 2, y * 2 + 1, e3); put(x * 2 + 1, y * 2 + 1, e4);
  }
  return { w: W, h: H, px: out };
}
function toCanvas(img) { const c = makeCanvas(img.w, img.h); const ctx = c.getContext('2d'); const id = ctx.createImageData(img.w, img.h); id.data.set(img.px); ctx.putImageData(id, 0, 0); return c; }
/** Distância (em texels) até o pixel transparente mais próximo (chamfer 3-4, limitado). */
function insideDistance(data, w, h, cap = 14) {
  const d = new Float32Array(w * h); const INF = 1e4;
  for (let i = 0; i < w * h; i++) d[i] = data[i * 4 + 3] > 40 ? INF : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (d[i] === 0) continue; let m = d[i];
    if (x > 0) m = Math.min(m, d[i - 1] + 1); if (y > 0) m = Math.min(m, d[i - w] + 1); if (x > 0 && y > 0) m = Math.min(m, d[i - w - 1] + 1.4); if (x < w - 1 && y > 0) m = Math.min(m, d[i - w + 1] + 1.4);
    if (x === 0 || y === 0) m = Math.min(m, 1); d[i] = m; }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (d[i] === 0) continue; let m = d[i];
    if (x < w - 1) m = Math.min(m, d[i + 1] + 1); if (y < h - 1) m = Math.min(m, d[i + w] + 1); if (x < w - 1 && y < h - 1) m = Math.min(m, d[i + w + 1] + 1.4); if (x > 0 && y < h - 1) m = Math.min(m, d[i + w - 1] + 1.4);
    if (x === w - 1 || y === h - 1) m = Math.min(m, 1); d[i] = Math.min(m, cap); }
  return d;
}
/** Normal map a partir de height (0..1) por Sobel; alpha = emissivo. */
function heightToNormal(height, w, h, strength, alphaFn) {
  const out = new Uint8ClampedArray(w * h * 4);
  const H = (x, y) => height[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; // ny: +para cima na tela
    const i = (y * w + x) * 4; const a = alphaFn ? alphaFn(x, y) : { cov: 1, emis: 0 };
    out[i] = (nx * 0.5 + 0.5) * 255; out[i + 1] = (ny * 0.5 + 0.5) * 255; out[i + 2] = a.emis * 255; out[i + 3] = a.cov ? 255 : 0;
  }
  return out;
}
// materiais por cor (paleta de sprites): brilho/relevo
const MATERIAL = { y: { shine: 0.9, bump: 1.0 }, a: { shine: 1.0, bump: 0.8 }, A: { shine: 0.8, bump: 0.8 }, w: { shine: 0.5, bump: 0.6 }, s: { shine: 0.2, bump: 0.5 }, b: { shine: 0.6, bump: 0.7 }, r: { shine: 0.4, bump: 0.7 } };

/**
 * Sprite HD: devolve { diffuse: canvas, normal: canvas } (w*S × h*S).
 * emissiveColors: conjunto de códigos de cor que brilham (lava, cristais...).
 */
export function spriteHD(rows, pal, { outline = true, pillow = 1, emissive = null, flatTop = false, alpha = 1, smooth = 0 } = {}) {
  const base = matrixToRGBA(rows, pal); const up = epx(epx(base)); // ×4
  const w = base.w * S, h = base.h * S; const c = makeCanvas(w, h); const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(toCanvas(up), 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h); const data = id.data;
  // limiar de alpha para bordas limpas
  for (let i = 3; i < data.length; i += 4) data[i] = data[i] > 110 ? Math.round(255 * alpha) : 0;
  const dist = insideDistance(data, w, h, 16);
  const height = new Float32Array(w * h); const emis = new Float32Array(w * h);
  const colorKeyAt = (x, y) => rows[Math.min(rows.length - 1, Math.floor(y / S))][Math.min(rows[0].length - 1, Math.floor(x / S))];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (data[i * 4 + 3] === 0) continue;
    const k = colorKeyAt(x, y); const mat = MATERIAL[k] || { shine: 0.35, bump: 0.6 };
    if (emissive && emissive.has(k)) emis[i] = 1;
    if (smooth) { height[i] = 0.5; continue; }
    const d = dist[i]; const pil = Math.sqrt(Math.min(1, d / 14)) * pillow * mat.bump; // altura "almofada"
    height[i] = pil * 0.75 + 0.1;
    // sombreamento de volume: realce no topo-esquerda, sombra na base-direita + contorno escuro
    const edge = d < 2.2 && outline ? 0.55 : 1;
    const nx = x > 0 ? dist[i - 1] - (x < w - 1 ? dist[i + 1] : d) : 0; const ny = y > 0 ? dist[i - w] - (y < h - 1 ? dist[i + w] : d) : 0;
    const lambert = 1 + (nx * -0.06 + ny * -0.08) * mat.shine; // luz vinda de cima-esquerda
    const spec = d > 3 && d < 7 && nx < 0 && ny < 0 ? 0.08 * mat.shine : 0;
    const o = i * 4; data[o] = Math.min(255, data[o] * edge * lambert + spec * 255); data[o + 1] = Math.min(255, data[o + 1] * edge * lambert + spec * 255); data[o + 2] = Math.min(255, data[o + 2] * edge * lambert + spec * 255);
    if (emissive && emissive.has(k)) emis[i] = 1;
  }
  ctx.putImageData(id, 0, 0);
  const nrm = heightToNormal(height, w, h, 2.2, (x, y) => { const i = y * w + x; return { cov: data[i * 4 + 3] !== 0, emis: emis[i] }; });
  const nc = makeCanvas(w, h); const nctx = nc.getContext('2d'); const nid = nctx.createImageData(w, h); nid.data.set(nrm); nctx.putImageData(nid, 0, 0);
  return { diffuse: c, normal: nc };
}

// ----- Tiles de solo procedurais -----------------------------------------------------------------
const THEME_LOOK = {
  mountain: { rock: ['#7d7468', '#4e4740', '#a69c8c'], grass: ['#58b53a', '#3f8f2a', '#8fe060'], dirt: ['#6e4f33', '#4a3322'], snow: ['#f4f7ff', '#cfd8ea', '#ffffff'], kind: 'rock' },
  forest: { rock: ['#6a5a40', '#4e4230', '#8a7858'], grass: ['#4fb33c', '#2f7d25', '#86e066'], dirt: ['#6b4a2e', '#4a3220'], kind: 'dirt' },
  lake: { rock: ['#6b7d7a', '#4a5c5a', '#8aa29e'], grass: ['#5bb561', '#327a3c', '#8fe090'], dirt: ['#5e6e64', '#3f4d45'], kind: 'rock' },
  village: { rock: ['#c8a376', '#9c7a53', '#e2c49a'], grass: ['#d8d0c0', '#b0a690', '#f0e8d8'], dirt: ['#a08060', '#705840'], kind: 'brick' },
  desert: { rock: ['#d9b26a', '#b58d4a', '#f0d08c'], grass: ['#e8c87a', '#c4a052', '#fde6a8'], dirt: ['#d9b26a', '#b58d4a'], kind: 'sand' },
  road: { rock: ['#8a8a8a', '#666666', '#aaaaaa'], grass: ['#8c8c8c', '#5e5e5e', '#b8b8b8'], dirt: ['#7a6a5a', '#54483c'], kind: 'rock' },
  sky: { rock: ['#9a9aa8', '#70707f', '#c0c0cc'], grass: ['#62c04c', '#3f8a30', '#9ae878'], dirt: ['#7a6a5a', '#54483c'], kind: 'rock' },
  cave: { rock: ['#5a4a58', '#3a2e3a', '#7c6a7a'], grass: ['#b4442a', '#6e2416', '#e07a40'], dirt: ['#4a3a48', '#2e2230'], kind: 'rock' },
  city: { rock: ['#5a6474', '#3c4452', '#7a8696'], grass: ['#8a94a4', '#5a6474', '#aab4c4'], dirt: ['#3c4452', '#262c36'], kind: 'metal' },
  castle: { rock: ['#7a7a88', '#55555f', '#9c9cac'], grass: ['#9898a8', '#6a6a78', '#c0c0d0'], dirt: ['#4a4a58', '#333340'], kind: 'brick' },
};
function noise2(rng) { const g = new Float32Array(64 * 64); for (let i = 0; i < g.length; i++) g[i] = rng.next(); return (x, y) => { const xi = Math.floor(x) & 63, yi = Math.floor(y) & 63, fx = x - Math.floor(x), fy = y - Math.floor(y); const a = g[yi * 64 + xi], b = g[yi * 64 + ((xi + 1) & 63)], c = g[((yi + 1) & 63) * 64 + xi], d = g[((yi + 1) & 63) * 64 + ((xi + 1) & 63)]; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy; }; }
const hexToRgb = (hx) => [parseInt(hx.slice(1, 3), 16), parseInt(hx.slice(3, 5), 16), parseInt(hx.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Tile de solo HD (96×96) com textura, superfície e bisel; normal map a partir da altura. */
export function groundHD(theme, mask, alt, variant = 0) {
  const look = THEME_LOOK[theme] || THEME_LOOK.mountain; const rng = new Rng(1234 + mask * 7 + (alt ? 99 : 0) + variant * 1013); const n = noise2(rng); const n2 = noise2(new Rng(77 + mask + variant * 31)); const n3 = noise2(new Rng(555 + variant * 17));
  const w = 16 * S, h = 16 * S; const c = makeCanvas(w, h); const ctx = c.getContext('2d'); const id = ctx.createImageData(w, h); const d = id.data; const height = new Float32Array(w * h);
  const rock = look.rock.map(hexToRgb), grass = (alt && look.snow ? look.snow : look.grass).map(hexToRgb), dirt = look.dirt.map(hexToRgb);
  const up = !!(mask & 1), right = !!(mask & 2), down = !!(mask & 4), left = !!(mask & 8);
  const surfaceH = alt && look.snow ? 22 : look.kind === 'sand' ? 16 : 26; // altura da camada superficial em texels
  // Worley periódico por tile (4×4 células de 24 texels); células de borda usam semente fixa para
  // que as pedras continuem entre tiles vizinhos de variantes diferentes.
  const CELL = 24; const hashf = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const cellPoint = (cx, cy) => { const wx = ((cx % 4) + 4) % 4, wy = ((cy % 4) + 4) % 4; const border = wx === 0 || wx === 3 || wy === 0 || wy === 3; const seed = border ? 1 : variant + 2; const jx = hashf(wx, wy, seed) - 0.5, jy = hashf(wy + 7, wx + 3, seed) - 0.5; return [cx * CELL + CELL / 2 + jx * CELL * 0.7, cy * CELL + CELL / 2 + jy * CELL * 0.7, wx + wy * 4 + seed * 16]; };
  const worley = (x, y) => { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); let f1 = 1e9, f2 = 1e9, id = 0, px = 0, py = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const p = cellPoint(cx + i, cy + j); const d = Math.hypot(x - p[0], y - p[1]); if (d < f1) { f2 = f1; f1 = d; id = p[2]; px = p[0]; py = p[1]; } else if (d < f2) f2 = d; } const light = ((px - x) + (py - y)) / (CELL * 1.2); return { f1, f2, id, light }; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; const u = x / w, v = y / h;
    let col, hgt;
    // textura base por tipo
    if (look.kind === 'brick') { const by = Math.floor(y / 24), bx = Math.floor((x + (by % 2) * 24) / 48); const my = (y % 24) < 3, mx = ((x + (by % 2) * 24) % 48) < 3; const shade = 0.85 + n(x * 0.12 + bx * 9, y * 0.12 + by * 7) * 0.3; col = (my || mx) ? mix(rock[1], [20, 20, 25], 0.5) : mix(rock[0], rock[2], shade - 0.85); hgt = (my || mx) ? 0.2 : 0.55 + n(x * 0.2, y * 0.2) * 0.1; }
    else if (look.kind === 'metal') { const panel = ((x % 48) < 2 || (y % 48) < 2); const rivet = ((x % 48) > 5 && (x % 48) < 11 && (y % 48) > 5 && (y % 48) < 11); col = panel ? rock[1] : rivet ? rock[2] : mix(rock[0], rock[2], n(x * 0.05, y * 0.05) * 0.25); hgt = panel ? 0.3 : rivet ? 0.8 : 0.55; }
    else if (look.kind === 'sand') { const s = n(x * 0.08, y * 0.08) * 0.6 + n2(x * 0.3, y * 0.3) * 0.4; col = mix(dirt[1], dirt[0], s); hgt = 0.5 + (s - 0.5) * 0.2 + Math.sin((x + y * 0.3) * 0.25) * 0.03; }
    else { // rocha/terra: pedras (Worley) com argamassa, cúpula por pedra e grão fino
      const W1 = worley(x, y); const dome = Math.max(0, 1 - Math.pow(W1.f1 / (CELL * 0.62), 2)); const mortar = Math.max(0, 1 - (W1.f2 - W1.f1) / 5.0);
      const grain = n2(x * 0.35, y * 0.35) * 0.45 + n(x * 0.11, y * 0.11) * 0.55; const crack = Math.abs(n2(x * 0.03 + 13, y * 0.03) - 0.5) < 0.004 ? 1 : 0;
      const baseCols = look.kind === 'dirt' ? [dirt[1], dirt[0], mix(dirt[0], [255, 230, 200], 0.15)] : rock;
      const tint = (W1.id % 7) / 7 - 0.5; // variação por pedra
      let shade = 0.42 + dome * 0.38 + (grain - 0.5) * 0.28 + tint * 0.12 + W1.light * 0.18;
      shade = shade * (1 - mortar * 0.55);
      col = shade < 0.45 ? mix(baseCols[1], baseCols[0], shade / 0.45) : mix(baseCols[0], baseCols[2], Math.min(1, (shade - 0.45) / 0.55));
      if (crack) col = mix(col, [0, 0, 0], 0.4);
      hgt = crack ? 0.25 : 0.25 + dome * 0.5 + (grain - 0.5) * 0.08 - mortar * 0.25;
    }
    // camada superficial (grama/areia/neve/pavimento) no topo exposto
    if (up) {
      const blade = Math.floor(x / 6); const bh = surfaceH + (((blade * 37) % 11) - 5) * 1.6 + n(x * 0.3, 0) * 6;
      const tip = y < 10 ? (((x + blade * 3) % 6) < 3 && y > 10 - ((blade * 13) % 10)) : false;
      if (y < bh || tip) { const g = (y / bh); const gc = look.kind === 'brick' || look.kind === 'metal' ? grass : grass; col = mix(mix(gc[2], gc[0], Math.min(1, g * 1.4)), gc[1], Math.max(0, g - 0.6) * 2.5); if (look.kind !== 'sand' && !alt) { const stripe = ((x + y * 2) % 9) < 2 ? 0.08 : 0; col = mix(col, gc[1], stripe); } hgt = 0.75 - g * 0.25 + n(x * 0.4, y * 0.4) * 0.08; if (y < 10 && !tip && y > bh - 1) hgt = 0.2; }
      else if (y < bh + 10 && look.kind !== 'brick' && look.kind !== 'metal') { const t = (y - bh) / 10; col = mix(dirt[1], col, t); hgt = hgt * (0.7 + 0.3 * t); }
    }
    // biséis nas bordas expostas
    const bev = 10; let b = 1;
    if (left && x < bev) { b *= 0.78 + 0.22 * (x / bev); hgt *= 0.6 + 0.4 * (x / bev); }
    if (right && x >= w - bev) { b *= 0.7 + 0.3 * ((w - 1 - x) / bev); hgt *= 0.6 + 0.4 * ((w - 1 - x) / bev); }
    if (down && y >= h - bev) { b *= 0.62 + 0.38 * ((h - 1 - y) / bev); hgt *= 0.5 + 0.5 * ((h - 1 - y) / bev); }
    if (up && y < 3) { b *= 1.1; }
    // oclusão sutil nos cantos internos
    if (!up && y < 6) b *= 0.9 + 0.1 * (y / 6);
    const o = i * 4; d[o] = Math.min(255, col[0] * b); d[o + 1] = Math.min(255, col[1] * b); d[o + 2] = Math.min(255, col[2] * b); d[o + 3] = 255; height[i] = hgt;
  }
  // cantos arredondados no topo (como no retrô)
  if (up && left) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (Math.hypot(8 - x, 8 - y) > 8) d[(y * w + x) * 4 + 3] = 0;
  if (up && right) for (let y = 0; y < 8; y++) for (let x = w - 8; x < w; x++) if (Math.hypot(x - (w - 9), 8 - y) > 8) d[(y * w + x) * 4 + 3] = 0;
  ctx.putImageData(id, 0, 0);
  const nrm = heightToNormal(height, w, h, 3.0, (x, y) => ({ cov: d[(y * w + x) * 4 + 3] !== 0, emis: theme === 'cave' && up && y < 10 ? 0.18 : 0 }));
  const nc = makeCanvas(w, h); const nctx = nc.getContext('2d'); const nid = nctx.createImageData(w, h); nid.data.set(nrm); nctx.putImageData(nid, 0, 0);
  return { diffuse: c, normal: nc };
}

/** Lava HD procedural (96×96): base escura com veios brilhantes; emissivo forte nos veios. */
export function lavaHD(frame = 0) {
  const w = 16 * S, h = 16 * S; const c = makeCanvas(w, h); const ctx = c.getContext('2d'); const id = ctx.createImageData(w, h); const d = id.data;
  const n = noise2(new Rng(9001)), n2 = noise2(new Rng(9002)); const nrm = new Uint8ClampedArray(w * h * 4); const ph = frame * 0.35;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // periódico no tile: usa coordenadas em torno de um círculo para repetir sem emenda
    const u = x / w, v = y / h; const px = Math.cos(u * Math.PI * 2) * 1.2, py = Math.sin(u * Math.PI * 2) * 1.2, pz = Math.cos(v * Math.PI * 2) * 1.2, pw = Math.sin(v * Math.PI * 2) * 1.2;
    const a = n(px * 2 + pz + ph, py * 2 + pw), b = n2(pz * 3 + px + ph * 2, pw * 3 + py);
    const ridge = 1 - Math.abs((a + b) - 1); const vein = Math.pow(Math.max(0, ridge - 0.78) / 0.22, 1.4); const glow = Math.pow(Math.max(0, ridge - 0.5) / 0.5, 3) * 0.5;
    const base = [95 + a * 50 + glow * 90, 14 + a * 18 + glow * 50, 8]; const hot = [255, 170 + b * 50, 50];
    const i = (y * w + x) * 4; d[i] = base[0] + (hot[0] - base[0]) * vein; d[i + 1] = base[1] + (hot[1] - base[1]) * vein; d[i + 2] = base[2] + (hot[2] - base[2]) * vein; d[i + 3] = 255;
    nrm[i] = 128; nrm[i + 1] = 128; nrm[i + 2] = Math.round(255 * Math.min(1, 0.15 + glow * 0.5 + vein * 0.85)); nrm[i + 3] = 255;
  }
  ctx.putImageData(id, 0, 0); const nc = makeCanvas(w, h); const nid = nc.getContext('2d').createImageData(w, h); nid.data.set(nrm); nc.getContext('2d').putImageData(nid, 0, 0);
  return { diffuse: c, normal: nc };
}
// ----- Banco HD ------------------------------------------------------------------------------------
const EMISSIVE_TILES = { lava0: new Set(['r', 'o', 'y']), lava1: new Set(['r', 'o', 'y']), crystal: new Set(['c', 'w']), torchWall: new Set(['y', 'o', 'r']), window: new Set(['y', 'w']) };
const EMISSIVE_SPRITES = { bolt: new Set(['w', 'b']), capsule: new Set(['b', 'w']), star: new Set(['y']), jelly: new Set(['p']), slug: new Set(['o', 'y']), drone: new Set(['r']) };
export class HDArt {
  constructor() { this.sprites = {}; this.tiles = {}; this.atlases = []; }
  _tex(canvas, linear = true) { const src = new CanvasSource({ resource: canvas, scaleMode: linear ? 'linear' : 'nearest', autoGenerateMipmaps: false, alphaMode: 'premultiply-alpha-on-upload' }); return new Texture({ source: src }); }
  _spriteFrames(art) {
    if (art === 'hero') return HERO_FRAMES; if (ENEMY_ART[art]) return ENEMY_ART[art]; if (BOSS_ART[art]) return BOSS_ART[art]; if (ITEM_ART[art]) return ITEM_ART[art]; return null;
  }
  sprite(art, frame) {
    const key = art + '|' + frame; let e = this.sprites[key];
    if (!e) { const frames = this._spriteFrames(art); if (!frames || !frames[frame]) return null; const r = spriteHD(frames[frame], SPRITE_PAL, { emissive: EMISSIVE_SPRITES[art] || null }); e = this.sprites[key] = { d: this._tex(r.diffuse), n: this._tex(r.normal) }; }
    return e.d;
  }
  normal(art, frame) { this.sprite(art, frame); const e = this.sprites[art + '|' + frame]; return e ? e.n : null; }
  tile(theme, key) {
    const k = theme + '|' + key; let e = this.tiles[k];
    if (!e) {
      let r;
      if (key[0] === 'g' || key[0] === 'a') { const parts = key.slice(1).split('v'); const mask = +parts[0]; const variant = +(parts[1] || 0); if (!Number.isNaN(mask)) r = groundHD(theme, mask, key[0] === 'a', variant); }
      if (!r && key.startsWith('lava')) r = lavaHD(key === 'lava1' ? 1 : 0);
      if (!r) { const rows = TILE_ART[key]; if (!rows) return null; const pal = TILE_PALS[theme] || TILE_PALS.mountain; const water = key === 'water' || key.startsWith('waterTop'); const lava = key.startsWith('lava'); r = spriteHD(rows, pal, { emissive: EMISSIVE_TILES[key] || null, pillow: water || lava ? 0 : 1, outline: !(water || lava), alpha: water ? 0.55 : 1, smooth: water || lava ? 1 : 0 }); }
      e = this.tiles[k] = { d: this._tex(r.diffuse), n: this._tex(r.normal) };
    }
    return e.d;
  }
  tileNormal(theme, key) { this.tile(theme, key); const e = this.tiles[theme + '|' + key]; return e ? e.n : null; }
}
