// Texturas procedurais (canvas): concreto, asfalto, brita, metal pintado, ferrugem,
// fachadas, grafites originais, placas, sprites de partículas e normal maps.
// Tudo é gerado em tempo de carregamento; nada é baixado.
import * as THREE from 'three';
import { RNG, clamp, lerp, smoothstep } from './utils.js';

export const texRng = new RNG(20240917);

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/* ---------------------------------------------------------------- noise */
const PERM = new Uint8Array(512);
{
  const r = new RNG(99);
  const p = [];
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}
const hashLattice = (x, y) => PERM[(PERM[x & 255] + y) & 255] / 255;
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Value noise periódico (período inteiro `p`) → [0,1]. */
export function vnoise(x, y, p = 256) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p;
  const x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
  const a = hashLattice(x0, y0), b = hashLattice(x1, y0), c = hashLattice(x0, y1), d = hashLattice(x1, y1);
  const u = fade(xf), v = fade(yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/** fbm periódico: `freq` células por textura (inteiro) garante tiling. */
export function fbm(u, v, freq = 4, oct = 5, gain = 0.5, lac = 2) {
  let amp = 0.5, sum = 0, norm = 0, f = freq;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(u * f, v * f, f);
    norm += amp; amp *= gain; f *= lac;
  }
  return sum / norm;
}

/** Ruído tipo Worley/Voronoi periódico: retorna [dist1, dist2, id]. */
const _wo = [0, 0, 0];
export function worley(u, v, n, jitter = 0.9, seed = 0) {
  const x = u * n, y = v * n;
  const xi = Math.floor(x), yi = Math.floor(y);
  let d1 = 1e9, d2 = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = ((xi + i) % n + n) % n, cy = ((yi + j) % n + n) % n;
      const h = hashLattice(cx + seed * 7, cy + seed * 13);
      const h2 = hashLattice(cy + seed * 3 + 101, cx + seed * 17 + 59);
      const px = xi + i + 0.5 + (h - 0.5) * jitter;
      const py = yi + j + 0.5 + (h2 - 0.5) * jitter;
      const d = (x - px) * (x - px) + (y - py) * (y - py);
      if (d < d1) { d2 = d1; d1 = d; id = h; } else if (d < d2) d2 = d;
    }
  }
  _wo[0] = Math.sqrt(d1); _wo[1] = Math.sqrt(d2); _wo[2] = id;
  return _wo;
}

/* ------------------------------------------------------------- helpers */
/** Gera um canvas chamando fn(u, v, out) por pixel; out = [r,g,b,a] 0..255. */
export function genPixels(w, h, fn) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const out = [0, 0, 0, 255];
  let i = 0;
  for (let y = 0; y < h; y++) {
    const v = 1 - (y + 0.5) / h; // v=1 no topo do canvas
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      out[0] = 0; out[1] = 0; out[2] = 0; out[3] = 255;
      fn(u, v, out);
      d[i++] = out[0]; d[i++] = out[1]; d[i++] = out[2]; d[i++] = out[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Normal map (tangent space) a partir de um canvas de altura (luminância). */
export function heightToNormal(src, strength = 2, wrap = true) {
  const w = src.width, h = src.height;
  const sctx = src.getContext('2d');
  const sd = sctx.getImageData(0, 0, w, h).data;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const H = (x, y) => {
    if (wrap) { x = (x + w) % w; y = (y + h) % h; } else { x = clamp(x, 0, w - 1); y = clamp(y, 0, h - 1); }
    return sd[(y * w + x) * 4] / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = H(x - 1, y - 1), t = H(x, y - 1), tr = H(x + 1, y - 1);
      const l = H(x - 1, y), r = H(x + 1, y);
      const bl = H(x - 1, y + 1), b = H(x, y + 1), br = H(x + 1, y + 1);
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      let nx = -dx * strength, ny = dy * strength, nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * w + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function toTexture(canvas, { srgb = false, repeat = null, aniso = 4, wrap = true, filter = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } else { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (!filter) { t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; }
  t.needsUpdate = true;
  return t;
}

const hexToRgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const mix3 = (a, b, t, out) => { out[0] = a[0] + (b[0] - a[0]) * t; out[1] = a[1] + (b[1] - a[1]) * t; out[2] = a[2] + (b[2] - a[2]) * t; };

/* -------------------------------------------------- materiais de base */
/** Concreto com manchas, grão, rachaduras. Retorna {map, normal, rough}. */
export function concreteSet(size, { tint = 0x9a9a96, dark = 0x55554f, cracks = 4, stains = 3, seed = 1, soot = 0 } = {}) {
  const base = hexToRgb(tint), dk = hexToRgb(dark);
  const tmp = [0, 0, 0];
  const height = genPixels(size, size, (u, v, o) => {
    const n = fbm(u + seed, v + seed * 0.37, 6, 5, 0.55);
    const g = vnoise(u * 256 + seed * 11, v * 256, 256);
    const hgt = 0.55 + (n - 0.5) * 0.6 + (g - 0.5) * 0.25;
    o[0] = o[1] = o[2] = clamp(hgt, 0, 1) * 255;
  });
  const hctx = height.getContext('2d');
  const color = genPixels(size, size, (u, v, o) => {
    const n = fbm(u + seed, v + seed * 0.37, 6, 5, 0.55);
    const g = vnoise(u * 256 + seed * 11, v * 256, 256);
    const st = smoothstep(0.52, 0.72, fbm(u * 1 + 3.3 + seed, v + 7.1, 3, 4));
    let t = clamp(0.55 + (n - 0.5) * 0.9 + (g - 0.5) * 0.18, 0, 1);
    mix3(dk, base, t, tmp);
    const stainMix = st * 0.55 + soot * smoothstep(0.3, 0.9, 1 - v) * 0.6;
    o[0] = tmp[0] * (1 - stainMix) + dk[0] * 0.6 * stainMix;
    o[1] = tmp[1] * (1 - stainMix) + dk[1] * 0.6 * stainMix;
    o[2] = tmp[2] * (1 - stainMix) + dk[2] * 0.6 * stainMix;
  });
  const cctx = color.getContext('2d');
  const r = new RNG(seed * 1000 + 7);
  // rachaduras: passeios aleatórios finos
  for (let i = 0; i < cracks; i++) {
    let x = r.range(0, size), y = r.range(0, size), a = r.range(0, Math.PI * 2);
    cctx.strokeStyle = 'rgba(30,28,26,0.75)'; hctx.strokeStyle = 'rgba(0,0,0,0.9)';
    cctx.lineWidth = r.range(0.8, 1.6); hctx.lineWidth = cctx.lineWidth + 0.5;
    cctx.beginPath(); hctx.beginPath(); cctx.moveTo(x, y); hctx.moveTo(x, y);
    const steps = r.int(20, 60);
    for (let s = 0; s < steps; s++) {
      a += r.range(-0.7, 0.7);
      x += Math.cos(a) * r.range(3, 9); y += Math.sin(a) * r.range(3, 9);
      cctx.lineTo(x, y); hctx.lineTo(x, y);
    }
    cctx.stroke(); hctx.stroke();
  }
  // manchas escorridas
  for (let i = 0; i < stains; i++) {
    const x = r.range(0, size), y = r.range(0, size * 0.6), w = r.range(size * 0.02, size * 0.08), h = r.range(size * 0.1, size * 0.5);
    const g = cctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(40,36,30,0.35)'); g.addColorStop(1, 'rgba(40,36,30,0)');
    cctx.fillStyle = g; cctx.fillRect(x, y, w, h);
  }
  const rough = genPixels(size, size, (u, v, o) => {
    const n = fbm(u + seed, v + seed * 0.37, 6, 4);
    const val = clamp(0.72 + (n - 0.5) * 0.4, 0.45, 1);
    o[0] = o[1] = o[2] = val * 255;
  });
  return { map: color, normal: heightToNormal(height, 1.6), rough };
}

/** Asfalto escuro com poças (máscara nas poças → roughness baixa). */
export function asphaltSet(size, seed = 2) {
  const height = genPixels(size, size, (u, v, o) => {
    const g = vnoise(u * 512 + seed, v * 512, 512);
    const n = fbm(u, v, 8, 4);
    const puddle = smoothstep(0.58, 0.66, fbm(u + 0.3, v + 0.9, 2, 4));
    const h = clamp(0.5 + (g - 0.5) * 0.5 + (n - 0.5) * 0.3, 0, 1) * (1 - puddle * 0.95) + puddle * 0.5;
    o[0] = o[1] = o[2] = h * 255;
  });
  const color = genPixels(size, size, (u, v, o) => {
    const g = vnoise(u * 512 + seed, v * 512, 512);
    const n = fbm(u, v, 8, 4);
    const puddle = smoothstep(0.58, 0.66, fbm(u + 0.3, v + 0.9, 2, 4));
    let t = clamp(0.28 + (g - 0.5) * 0.25 + (n - 0.5) * 0.2, 0.08, 0.6);
    t *= 1 - puddle * 0.5;
    o[0] = t * 255 * 0.98; o[1] = t * 255 * 0.98; o[2] = t * 255 * 1.02;
  });
  const rough = genPixels(size, size, (u, v, o) => {
    const puddle = smoothstep(0.58, 0.66, fbm(u + 0.3, v + 0.9, 2, 4));
    const n = fbm(u, v, 8, 3);
    const val = lerp(clamp(0.82 + (n - 0.5) * 0.3, 0.5, 1), 0.08, puddle);
    o[0] = o[1] = o[2] = val * 255;
  });
  return { map: color, normal: heightToNormal(height, 1.4), rough };
}

/** Brita: pedras via Worley. */
export function ballastSet(size, seed = 3) {
  const N = 38;
  const stone = (u, v) => {
    const w = worley(u, v, N, 0.95, seed);
    const r = 0.55 + w[2] * 0.25;
    const edge = clamp(1 - w[0] / r, 0, 1);
    const gap = smoothstep(0.02, 0.18, w[1] - w[0]);
    return [edge * gap, w[2], gap];
  };
  const height = genPixels(size, size, (u, v, o) => {
    const s = stone(u, v);
    const g = vnoise(u * 256 + seed, v * 256, 256);
    const h = clamp(0.15 + s[0] * 0.75 + (g - 0.5) * 0.15, 0, 1);
    o[0] = o[1] = o[2] = h * 255;
  });
  const color = genPixels(size, size, (u, v, o) => {
    const s = stone(u, v);
    const g = vnoise(u * 256 + seed, v * 256, 256);
    const warm = s[1];
    let t = clamp(0.3 + s[0] * 0.45 + (g - 0.5) * 0.2, 0.05, 0.95);
    t *= 0.5 + s[2] * 0.5;
    o[0] = t * (150 + warm * 60); o[1] = t * (142 + warm * 40); o[2] = t * (130 + warm * 25);
  });
  const rough = genPixels(size, size, (u, v, o) => { const g = vnoise(u * 128, v * 128, 128); o[0] = o[1] = o[2] = (0.8 + (g - 0.5) * 0.2) * 255; });
  return { map: color, normal: heightToNormal(height, 3.2), rough };
}

/** Metal escuro com ferrugem (postes, barreiras). */
export function rustMetalSet(size, { base = 0x3a3d42, rust = 0x7a3b1a, amount = 0.45, seed = 4 } = {}) {
  const b = hexToRgb(base), rs = hexToRgb(rust), dk = [40, 18, 8];
  const tmp = [0, 0, 0];
  const rustMask = (u, v) => smoothstep(0.5 - amount * 0.25, 0.62, fbm(u + seed, v * 1.3, 3, 5, 0.6));
  const color = genPixels(size, size, (u, v, o) => {
    const m = rustMask(u, v);
    const n = fbm(u * 2 + seed, v * 2, 12, 4);
    const sc = smoothstep(0.75, 0.8, vnoise(u * 512, v * 4 + seed, 512)) * 0.5;
    mix3(b, [b[0] * 1.5, b[1] * 1.5, b[2] * 1.5], sc + (n - 0.5) * 0.3, tmp);
    const rc = [lerp(rs[0], dk[0], n), lerp(rs[1], dk[1], n), lerp(rs[2], dk[2], n)];
    o[0] = lerp(tmp[0], rc[0], m); o[1] = lerp(tmp[1], rc[1], m); o[2] = lerp(tmp[2], rc[2], m);
  });
  const rough = genPixels(size, size, (u, v, o) => { const m = rustMask(u, v); const n = fbm(u, v, 8, 3); o[0] = o[1] = o[2] = lerp(0.45 + (n - 0.5) * 0.2, 0.95, m) * 255; });
  const metal = genPixels(size, size, (u, v, o) => { const m = rustMask(u, v); o[0] = o[1] = o[2] = lerp(0.9, 0.1, m) * 255; });
  const height = genPixels(size, size, (u, v, o) => { const m = rustMask(u, v); const n = fbm(u * 2, v * 2, 16, 3); o[0] = o[1] = o[2] = (0.5 + m * (n - 0.5) * 0.8) * 255; });
  return { map: color, rough, metal, normal: heightToNormal(height, 1.2) };
}

/** Tijolos (parede). */
export function brickSet(size, { tint = 0x7e5446, mortar = 0x8f8a80, seed = 5, rows = 28 } = {}) {
  const b = hexToRgb(tint), m = hexToRgb(mortar);
  const cols = rows / 2;
  const cell = (u, v) => {
    const row = Math.floor(v * rows);
    const off = (row % 2) * 0.5;
    const cx = (u * cols + off);
    const col = Math.floor(cx);
    const fx = cx - col, fy = v * rows - row;
    const id = hashLattice(((col % cols) + cols) % cols + 13 * seed, row);
    const mx = 0.06, my = 0.12;
    const inB = (fx > mx && fx < 1 - mx * 0.5 && fy > my && fy < 1 - my * 0.5) ? 1 : 0;
    const edge = Math.min(fx - mx, 1 - mx * 0.5 - fx, (fy - my) * 2, (1 - my * 0.5 - fy) * 2);
    return [inB, id, clamp(edge * 8, 0, 1)];
  };
  const color = genPixels(size, size, (u, v, o) => {
    const c = cell(u, v);
    const n = fbm(u + seed, v, 6, 4);
    const g = vnoise(u * 256, v * 256 + seed, 256);
    if (c[0]) {
      const t = 0.7 + (c[1] - 0.5) * 0.6 + (n - 0.5) * 0.5 + (g - 0.5) * 0.2;
      o[0] = b[0] * t; o[1] = b[1] * t; o[2] = b[2] * t;
    } else {
      const t = 0.75 + (g - 0.5) * 0.4 + (n - 0.5) * 0.3;
      o[0] = m[0] * t; o[1] = m[1] * t; o[2] = m[2] * t;
    }
  });
  const height = genPixels(size, size, (u, v, o) => {
    const c = cell(u, v);
    const g = vnoise(u * 256, v * 256 + seed, 256);
    const h = c[0] ? 0.55 + c[2] * 0.35 + (g - 0.5) * 0.15 : 0.2 + (g - 0.5) * 0.2;
    o[0] = o[1] = o[2] = clamp(h, 0, 1) * 255;
  });
  const rough = genPixels(size, size, (u, v, o) => { const c = cell(u, v); const g = vnoise(u * 64, v * 64, 64); o[0] = o[1] = o[2] = (c[0] ? 0.78 : 0.95) * 255 * (0.9 + g * 0.1); });
  return { map: color, normal: heightToNormal(height, 2.2), rough };
}

/** Madeira (tapumes, bancos). */
export function woodSet(size, { tint = 0x8a6238, seed = 6, planks = 6 } = {}) {
  const b = hexToRgb(tint);
  const grain = (u, v) => {
    const plank = Math.floor(u * planks);
    const pid = hashLattice(plank + seed, 3);
    const g = Math.sin((v * 40 + fbm(u * 3, v, 4, 3) * 6 + pid * 20) * Math.PI) * 0.5 + 0.5;
    const edge = Math.abs((u * planks) - plank - 0.5) > 0.47 ? 0 : 1;
    return [g, pid, edge];
  };
  const color = genPixels(size, size, (u, v, o) => {
    const g = grain(u, v); const n = fbm(u, v * 4, 4, 4);
    const t = (0.75 + (g[1] - 0.5) * 0.5 + g[0] * 0.25 + (n - 0.5) * 0.25) * (0.5 + g[2] * 0.5);
    o[0] = b[0] * t; o[1] = b[1] * t; o[2] = b[2] * t;
  });
  const height = genPixels(size, size, (u, v, o) => { const g = grain(u, v); o[0] = o[1] = o[2] = (0.3 + g[0] * 0.3 + g[2] * 0.3) * 255; });
  const rough = genPixels(size, size, (u, v, o) => { const g = grain(u, v); o[0] = o[1] = o[2] = (0.7 + g[0] * 0.2) * 255; });
  return { map: color, normal: heightToNormal(height, 1.5), rough };
}

/** Chapa corrugada pintada (contêineres, galpões). */
export function corrugatedSet(size, { tint = 0x2f5f8a, seed = 7, ridges = 24 } = {}) {
  const b = hexToRgb(tint), rs = [120, 60, 25];
  const ridge = (u) => Math.sin(u * ridges * Math.PI * 2) * 0.5 + 0.5;
  const rustM = (u, v) => smoothstep(0.6, 0.75, fbm(u * 2 + seed, v * 2, 4, 4)) + smoothstep(0.9, 1, 1 - v) * 0.5;
  const color = genPixels(size, size, (u, v, o) => {
    const r = rustM(u, v); const n = fbm(u, v, 6, 3);
    const t = 0.65 + ridge(u) * 0.3 + (n - 0.5) * 0.3;
    o[0] = lerp(b[0] * t, rs[0], clamp(r, 0, 1)); o[1] = lerp(b[1] * t, rs[1], clamp(r, 0, 1)); o[2] = lerp(b[2] * t, rs[2], clamp(r, 0, 1));
  });
  const height = genPixels(size, size, (u, v, o) => { o[0] = o[1] = o[2] = (0.2 + ridge(u) * 0.6) * 255; });
  const rough = genPixels(size, size, (u, v, o) => { const r = clamp(rustM(u, v), 0, 1); o[0] = o[1] = o[2] = lerp(0.45, 0.95, r) * 255; });
  const metal = genPixels(size, size, (u, v, o) => { const r = clamp(rustM(u, v), 0, 1); o[0] = o[1] = o[2] = lerp(0.75, 0.1, r) * 255; });
  return { map: color, normal: heightToNormal(height, 2.5), rough, metal };
}

/** Piso de plataforma: ladrilhos. */
export function tileSet(size, { tint = 0xb7b3a8, seed = 8, n = 8 } = {}) {
  const b = hexToRgb(tint);
  const cell = (u, v) => {
    const fx = (u * n) % 1, fy = (v * n) % 1;
    const id = hashLattice(Math.floor(u * n) + seed, Math.floor(v * n));
    const gr = (fx < 0.04 || fy < 0.04) ? 0 : 1;
    return [gr, id];
  };
  const color = genPixels(size, size, (u, v, o) => {
    const c = cell(u, v); const g = fbm(u, v, 8, 4);
    const t = c[0] ? 0.8 + (c[1] - 0.5) * 0.25 + (g - 0.5) * 0.3 : 0.35 + (g - 0.5) * 0.2;
    o[0] = b[0] * t; o[1] = b[1] * t; o[2] = b[2] * t;
  });
  const height = genPixels(size, size, (u, v, o) => { const c = cell(u, v); const g = vnoise(u * 256, v * 256, 256); o[0] = o[1] = o[2] = (c[0] ? 0.6 + (g - 0.5) * 0.1 : 0.2) * 255; });
  const rough = genPixels(size, size, (u, v, o) => { const c = cell(u, v); const g = fbm(u, v, 4, 3); o[0] = o[1] = o[2] = (c[0] ? 0.45 + g * 0.25 : 0.9) * 255; });
  return { map: color, normal: heightToNormal(height, 2), rough };
}

/* ------------------------------------------------------------ trens */
/**
 * Pintura lateral do vagão: janelas, portas, faixa, logo inventado, sujeira e
 * ferrugem. Retorna {map, rough, metal, emissive, normal}. 2048×512 (ou menor).
 */
export function trainLiverySet(w, h, { body = 0xc8102e, accent = 0xf2f2f2, stripe = 0x1c1c1c, number = 1203, seed = 10, windows = 8, operator = 'LVM' } = {}) {
  const r = new RNG(seed * 77 + 1);
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const rough = makeCanvas(w, h), rctx = rough.getContext('2d');
  const metal = makeCanvas(w, h), mctx = metal.getContext('2d');
  const emis = makeCanvas(w, h), ectx = emis.getContext('2d');
  const height = makeCanvas(w, h), hctx = height.getContext('2d');
  const bodyHex = '#' + body.toString(16).padStart(6, '0');
  const accentHex = '#' + accent.toString(16).padStart(6, '0');
  const stripeHex = '#' + stripe.toString(16).padStart(6, '0');
  // base de pintura
  ctx.fillStyle = bodyHex; ctx.fillRect(0, 0, w, h);
  rctx.fillStyle = '#5a5a5a'; rctx.fillRect(0, 0, w, h);
  mctx.fillStyle = '#1a1a1a'; mctx.fillRect(0, 0, w, h);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, w, h);
  hctx.fillStyle = '#808080'; hctx.fillRect(0, 0, w, h);
  // variação de tom (pintura com manchas suaves)
  const grunge = genPixels(w >> 2, h >> 2, (u, v, o) => { const n = fbm(u * 4, v, 6, 4); const a = (n - 0.5) * 40; o[0] = o[1] = o[2] = 128 + a; o[3] = 90; });
  ctx.globalCompositeOperation = 'overlay'; ctx.drawImage(grunge, 0, 0, w, h); ctx.globalCompositeOperation = 'source-over';
  // faixa inferior e superior
  const skirtH = h * 0.1;
  ctx.fillStyle = stripeHex; ctx.fillRect(0, h - skirtH, w, skirtH);
  ctx.fillStyle = accentHex; ctx.fillRect(0, h * 0.62, w, h * 0.035);
  ctx.fillStyle = '#2a2a2a'; ctx.fillRect(0, 0, w, h * 0.06); // calha do teto
  // janelas
  const winTop = h * 0.2, winH = h * 0.33;
  const segW = w / windows;
  for (let i = 0; i < windows; i++) {
    const isDoor = (i === 1 || i === windows - 2);
    const x0 = i * segW;
    if (isDoor) {
      // porta dupla
      ctx.fillStyle = accentHex; ctx.fillRect(x0 + segW * 0.08, h * 0.12, segW * 0.84, h * 0.78);
      ctx.fillStyle = '#111'; ctx.fillRect(x0 + segW * 0.49, h * 0.12, segW * 0.02, h * 0.78);
      ctx.fillStyle = '#0d1420'; ctx.fillRect(x0 + segW * 0.16, winTop, segW * 0.3, winH);
      ctx.fillRect(x0 + segW * 0.54, winTop, segW * 0.3, winH);
      rctx.fillStyle = '#1e1e1e'; rctx.fillRect(x0 + segW * 0.16, winTop, segW * 0.3, winH); rctx.fillRect(x0 + segW * 0.54, winTop, segW * 0.3, winH);
      hctx.fillStyle = '#6a6a6a'; hctx.fillRect(x0 + segW * 0.08, h * 0.12, segW * 0.84, h * 0.78);
    } else {
      const wx = x0 + segW * 0.1, ww = segW * 0.8;
      roundRect(ctx, wx, winTop, ww, winH, 8); ctx.fillStyle = '#0b121c'; ctx.fill();
      const g = ctx.createLinearGradient(0, winTop, 0, winTop + winH);
      g.addColorStop(0, 'rgba(120,160,200,0.35)'); g.addColorStop(0.5, 'rgba(60,80,110,0.1)'); g.addColorStop(1, 'rgba(20,30,40,0.5)');
      roundRect(ctx, wx, winTop, ww, winH, 8); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 4; roundRect(ctx, wx, winTop, ww, winH, 8); ctx.stroke();
      roundRect(rctx, wx, winTop, ww, winH, 8); rctx.fillStyle = '#141414'; rctx.fill();
      roundRect(hctx, wx, winTop, ww, winH, 8); hctx.fillStyle = '#5c5c5c'; hctx.fill();
      // luz interna sutil (emissivo baixo, acende à noite via intensidade)
      roundRect(ectx, wx + 4, winTop + 4, ww - 8, winH - 8, 6); const eg = ectx.createLinearGradient(0, winTop, 0, winTop + winH); eg.addColorStop(0, 'rgba(255,225,180,0.12)'); eg.addColorStop(0.55, 'rgba(255,215,160,0.4)'); eg.addColorStop(1, 'rgba(120,90,60,0.25)'); ectx.fillStyle = eg; ectx.fill();
      ectx.fillStyle = 'rgba(0,0,0,0.5)'; for (let k = 1; k < 3; k++) ectx.fillRect(wx + (ww * k) / 3 - 2, winTop, 4, winH);
    }
  }
  // logo e número (marca inventada)
  ctx.fillStyle = accentHex; ctx.font = `bold ${Math.round(h * 0.11)}px Arial, Helvetica, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(operator, segW * 2.2, h * 0.78);
  ctx.font = `${Math.round(h * 0.07)}px Arial, Helvetica, sans-serif`;
  ctx.fillText(String(number), w - segW * 1.6, h * 0.78);
  // rebites / linhas de painel
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; hctx.strokeStyle = 'rgba(60,60,60,1)'; hctx.lineWidth = 2;
  for (let i = 1; i < windows; i++) { ctx.beginPath(); ctx.moveTo(i * segW, h * 0.06); ctx.lineTo(i * segW, h * 0.9); ctx.stroke(); hctx.beginPath(); hctx.moveTo(i * segW, h * 0.06); hctx.lineTo(i * segW, h * 0.9); hctx.stroke(); }
  // sujeira: gradiente embaixo + escorridos sob as janelas
  const dirt = ctx.createLinearGradient(0, h * 0.55, 0, h);
  dirt.addColorStop(0, 'rgba(50,40,30,0)'); dirt.addColorStop(1, 'rgba(50,40,30,0.55)');
  ctx.fillStyle = dirt; ctx.fillRect(0, 0, w, h);
  rctx.fillStyle = dirt; rctx.globalCompositeOperation = 'lighter'; rctx.fillRect(0, 0, w, h); rctx.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 40; i++) {
    const x = r.range(0, w), y = winTop + winH, len = r.range(h * 0.05, h * 0.3), wd = r.range(2, 6);
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, 'rgba(30,25,20,0.45)'); g.addColorStop(1, 'rgba(30,25,20,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, wd, len);
  }
  // arranhões (metal exposto)
  for (let i = 0; i < 90; i++) {
    const x = r.range(0, w), y = r.range(h * 0.6, h), len = r.range(10, 80), a = r.range(-0.3, 0.3);
    ctx.strokeStyle = `rgba(210,210,215,${r.range(0.2, 0.6)})`; ctx.lineWidth = r.range(0.6, 1.5);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
    mctx.strokeStyle = 'rgba(230,230,230,0.9)'; mctx.lineWidth = ctx.lineWidth; mctx.beginPath(); mctx.moveTo(x, y); mctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); mctx.stroke();
    rctx.strokeStyle = 'rgba(60,60,60,0.9)'; rctx.lineWidth = ctx.lineWidth; rctx.beginPath(); rctx.moveTo(x, y); rctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); rctx.stroke();
  }
  // ferrugem na saia
  const rustMask = genPixels(w >> 2, h >> 2, (u, v, o) => {
    const m = smoothstep(0.55, 0.7, fbm(u * 4 + seed, v + 0.5, 6, 4)) * smoothstep(0.35, 0.05, v);
    o[0] = 120; o[1] = 55; o[2] = 20; o[3] = m * 255;
  });
  ctx.drawImage(rustMask, 0, 0, w, h);
  rctx.globalAlpha = 0.9; rctx.drawImage(rustMask, 0, 0, w, h); rctx.globalAlpha = 1;
  // chuva/riscos de rodas: pontos escuros
  return { map: c, rough, metal, emissive: emis, normal: heightToNormal(height, 1.0, false) };
}

/** Frente do trem: para-brisa, faróis (emissivos), painel de destino. */
export function trainFrontSet(size, { body = 0xc8102e, accent = 0xf2f2f2, line = 'LINHA 9', seed = 11 } = {}) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  const emis = makeCanvas(size, size), ectx = emis.getContext('2d');
  const rough = makeCanvas(size, size), rctx = rough.getContext('2d');
  const bodyHex = '#' + body.toString(16).padStart(6, '0');
  ctx.fillStyle = bodyHex; ctx.fillRect(0, 0, size, size);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#606060'; rctx.fillRect(0, 0, size, size);
  const grunge = genPixels(size >> 2, size >> 2, (u, v, o) => { const n = fbm(u, v, 4, 4); o[0] = o[1] = o[2] = 128 + (n - 0.5) * 50; o[3] = 90; });
  ctx.globalCompositeOperation = 'overlay'; ctx.drawImage(grunge, 0, 0, size, size); ctx.globalCompositeOperation = 'source-over';
  // saia preta + grade
  ctx.fillStyle = '#1b1b1b'; ctx.fillRect(0, size * 0.8, size, size * 0.2);
  ctx.fillStyle = '#2b2b2b'; ctx.fillRect(size * 0.1, size * 0.86, size * 0.8, size * 0.08);
  for (let i = 0; i < 12; i++) { ctx.fillStyle = '#0a0a0a'; ctx.fillRect(size * (0.12 + i * 0.065), size * 0.87, size * 0.03, size * 0.06); }
  // para-brisa
  roundRect(ctx, size * 0.12, size * 0.18, size * 0.76, size * 0.34, 18); ctx.fillStyle = '#0b1420'; ctx.fill();
  const g = ctx.createLinearGradient(0, size * 0.18, 0, size * 0.52);
  g.addColorStop(0, 'rgba(140,180,220,0.4)'); g.addColorStop(1, 'rgba(10,20,30,0.2)');
  roundRect(ctx, size * 0.12, size * 0.18, size * 0.76, size * 0.34, 18); ctx.fillStyle = g; ctx.fill();
  roundRect(rctx, size * 0.12, size * 0.18, size * 0.76, size * 0.34, 18); rctx.fillStyle = '#121212'; rctx.fill();
  // painel de destino
  ctx.fillStyle = '#060606'; ctx.fillRect(size * 0.2, size * 0.07, size * 0.6, size * 0.09);
  ctx.fillStyle = '#ff9a1f'; ctx.font = `bold ${Math.round(size * 0.065)}px "Courier New", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(line, size * 0.5, size * 0.115);
  ectx.fillStyle = '#ff8a10'; ectx.font = ctx.font; ectx.textAlign = 'center'; ectx.textBaseline = 'middle'; ectx.fillText(line, size * 0.5, size * 0.115);
  // faróis
  for (const x of [0.2, 0.8]) {
    for (const [cx, cy, rad, col, ecol] of [[x, 0.68, 0.055, '#e8f0ff', '#ffffff'], [x, 0.68, 0.03, '#ffffff', '#ffffff']]) {
      ctx.beginPath(); ctx.arc(size * cx, size * cy, size * rad, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      ectx.beginPath(); ectx.arc(size * cx, size * cy, size * rad, 0, Math.PI * 2); ectx.fillStyle = ecol; ectx.fill();
      rctx.beginPath(); rctx.arc(size * cx, size * cy, size * rad, 0, Math.PI * 2); rctx.fillStyle = '#202020'; rctx.fill();
    }
    // lanterna vermelha pequena
    ctx.beginPath(); ctx.arc(size * (x + (x < 0.5 ? 0.1 : -0.1)), size * 0.7, size * 0.02, 0, Math.PI * 2); ctx.fillStyle = '#ff2a2a'; ctx.fill();
    ectx.beginPath(); ectx.arc(size * (x + (x < 0.5 ? 0.1 : -0.1)), size * 0.7, size * 0.02, 0, Math.PI * 2); ectx.fillStyle = '#ff1010'; ectx.fill();
  }
  // porta frontal central e limpadores
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(size * 0.5, size * 0.55); ctx.lineTo(size * 0.5, size * 0.8); ctx.stroke();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(size * 0.3, size * 0.5); ctx.lineTo(size * 0.42, size * 0.25); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(size * 0.7, size * 0.5); ctx.lineTo(size * 0.58, size * 0.25); ctx.stroke();
  const dirt = ctx.createLinearGradient(0, size * 0.5, 0, size);
  dirt.addColorStop(0, 'rgba(40,30,20,0)'); dirt.addColorStop(1, 'rgba(40,30,20,0.5)');
  ctx.fillStyle = dirt; ctx.fillRect(0, 0, size, size);
  const _ = seed;
  return { map: c, emissive: emis, rough };
}

/** Teto do trem: cinza com sujeira e painéis. */
export function trainRoofSet(size, seed = 12) {
  const color = genPixels(size, size, (u, v, o) => {
    const n = fbm(u * 4, v, 8, 4); const g = vnoise(u * 256, v * 256, 256);
    const panel = (Math.abs(((u * 6) % 1) - 0.5) > 0.48) ? 0.6 : 1;
    const t = (0.45 + (n - 0.5) * 0.4 + (g - 0.5) * 0.15) * panel;
    o[0] = 110 * t; o[1] = 112 * t; o[2] = 115 * t;
  });
  const rough = genPixels(size, size, (u, v, o) => { const n = fbm(u * 4, v, 8, 3); o[0] = o[1] = o[2] = (0.6 + n * 0.3) * 255; });
  const _ = seed;
  return { map: color, rough };
}

/* --------------------------------------------------------- fachadas */
/**
 * Fachada de prédio: grade de janelas; `emissive` contém só as janelas acesas
 * (aleatórias). `kind`: 'office' | 'residential' | 'old'.
 */
export function facadeSet(size, { kind = 'office', seed = 13 } = {}) {
  const r = new RNG(seed * 31 + 5);
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  const e = makeCanvas(size, size), ectx = e.getContext('2d');
  const ro = makeCanvas(size, size), rctx = ro.getContext('2d');
  const cols = kind === 'office' ? 6 : kind === 'residential' ? 5 : 4;
  const rows = kind === 'office' ? 6 : 5;
  const wallCol = kind === 'office' ? '#6f7378' : kind === 'residential' ? '#b9ae9a' : '#8a6a56';
  ctx.fillStyle = wallCol; ctx.fillRect(0, 0, size, size);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, size, size);
  rctx.fillStyle = kind === 'office' ? '#707070' : '#b0b0b0'; rctx.fillRect(0, 0, size, size);
  const grunge = genPixels(size >> 2, size >> 2, (u, v, o) => { const n = fbm(u, v, 4, 4); o[0] = o[1] = o[2] = 128 + (n - 0.5) * 60; o[3] = 110; });
  ctx.globalCompositeOperation = 'overlay'; ctx.drawImage(grunge, 0, 0, size, size); ctx.globalCompositeOperation = 'source-over';
  const cw = size / cols, ch = size / rows;
  const wx = kind === 'office' ? 0.1 : 0.22, wy = kind === 'office' ? 0.12 : 0.25;
  const ww = 1 - 2 * wx, wh = 1 - 2 * wy;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * cw + cw * wx, y = j * ch + ch * wy, w = cw * ww, h = ch * wh;
      const lit = r.chance(kind === 'office' ? 0.45 : 0.35);
      // vidro
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#5f7d9a'); g.addColorStop(1, '#1c2a3a');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      if (lit) {
        const warm = r.chance(0.7);
        const col = warm ? `rgba(255,${200 + r.int(0, 40)},${120 + r.int(0, 60)},1)` : `rgba(${180 + r.int(0, 40)},${210 + r.int(0, 30)},255,1)`;
        ctx.fillStyle = col; ctx.globalAlpha = 0.22; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
        ectx.fillStyle = col; ectx.fillRect(x, y, w, h);
        if (r.chance(0.5)) { // cortina/sombra parcial
          ectx.fillStyle = 'rgba(0,0,0,0.6)'; ectx.fillRect(x, y, w, h * r.range(0.2, 0.5));
          ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x, y, w, h * 0.3);
        }
      }
      ctx.strokeStyle = kind === 'old' ? '#3c2e24' : '#2a2d30'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
      rctx.fillStyle = '#1a1a1a'; rctx.fillRect(x, y, w, h);
      if (kind !== 'office') { // parapeito
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 4, y + h, w + 8, 6);
      }
    }
    if (kind === 'office') { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, j * ch, size, 4); }
  }
  // escorridos de sujeira
  for (let i = 0; i < 30; i++) {
    const x = r.range(0, size), y = r.range(0, size), len = r.range(20, 120);
    const g = ctx.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, 'rgba(20,15,10,0.35)'); g.addColorStop(1, 'rgba(20,15,10,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, r.range(2, 6), len);
  }
  return { map: c, emissive: e, rough: ro };
}

/* -------------------------------------------------------- grafites */
const GRAFFITI_FONTS = ['Impact, "Arial Black", sans-serif', '"Arial Black", Impact, sans-serif', 'Georgia, serif', '"Trebuchet MS", sans-serif', '"Courier New", monospace'];
const LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';
const PALETTES = [
  ['#ff2d55', '#ffd60a', '#0a84ff'], ['#30d158', '#64d2ff', '#ff375f'], ['#ff9f0a', '#bf5af2', '#ffffff'],
  ['#5ac8fa', '#ffffff', '#ff3b30'], ['#ffd60a', '#ff2d55', '#1c1c1e'], ['#00e5ff', '#ff00aa', '#ffee00'],
  ['#ff6b00', '#1de9b6', '#ffffff'], ['#b388ff', '#ffff8d', '#ff5252'],
];

/** Desenha uma peça de grafite original (letras inventadas + formas) em ctx. */
export function drawGraffiti(ctx, w, h, r) {
  const pal = r.pick(PALETTES);
  const n = r.int(3, 5);
  let word = '';
  for (let i = 0; i < n; i++) word += LETTERS[r.int(0, LETTERS.length - 1)];
  const font = r.pick(GRAFFITI_FONTS);
  const fs = h * r.range(0.45, 0.7);
  ctx.save();
  ctx.translate(w * 0.5 + r.range(-w * 0.08, w * 0.08), h * 0.55 + r.range(-h * 0.05, h * 0.05));
  ctx.rotate(r.range(-0.12, 0.12));
  ctx.font = `bold ${fs}px ${font}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sx = r.range(0.9, 1.35);
  ctx.scale(sx, 1);
  // sombra 3D
  const depth = r.int(6, 14);
  ctx.fillStyle = r.pick(['#111', '#1b0b2b', '#0b1b2b']);
  for (let i = depth; i > 0; i--) ctx.fillText(word, i * 1.2, i * 1.2);
  // contorno grosso
  ctx.lineJoin = 'round';
  ctx.lineWidth = fs * 0.14; ctx.strokeStyle = '#111';
  ctx.strokeText(word, 0, 0);
  // preenchimento gradiente
  const g = ctx.createLinearGradient(-w * 0.4, -fs * 0.5, w * 0.4, fs * 0.5);
  g.addColorStop(0, pal[0]); g.addColorStop(0.5, pal[1]); g.addColorStop(1, pal[2]);
  ctx.fillStyle = g; ctx.fillText(word, 0, 0);
  // brilho interno
  ctx.lineWidth = fs * 0.03; ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.strokeText(word, -fs * 0.03, -fs * 0.03);
  ctx.restore();
  // escorridos
  ctx.save();
  for (let i = 0; i < r.int(6, 14); i++) {
    const x = r.range(w * 0.2, w * 0.8), y = r.range(h * 0.5, h * 0.8), len = r.range(10, h * 0.25);
    ctx.strokeStyle = r.pick(pal); ctx.lineWidth = r.range(2, 5); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
  }
  // formas: estrelas, setas, círculos, respingos
  for (let i = 0; i < r.int(2, 5); i++) {
    const x = r.range(w * 0.05, w * 0.95), y = r.range(h * 0.1, h * 0.9), s = r.range(h * 0.05, h * 0.16);
    ctx.fillStyle = r.pick(pal); ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
    const kind = r.int(0, 2);
    ctx.beginPath();
    if (kind === 0) { for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5, rr = k % 2 ? s * 0.45 : s; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); }
    else if (kind === 1) { ctx.arc(x, y, s * 0.6, 0, Math.PI * 2); }
    else { ctx.moveTo(x - s, y); ctx.lineTo(x + s * 0.3, y); ctx.lineTo(x + s * 0.3, y - s * 0.5); ctx.lineTo(x + s, y + s * 0.1); ctx.lineTo(x + s * 0.3, y + s * 0.7); ctx.lineTo(x + s * 0.3, y + s * 0.2); ctx.lineTo(x - s, y + s * 0.2); ctx.closePath(); }
    ctx.fill(); ctx.stroke();
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = r.pick(pal); ctx.globalAlpha = r.range(0.3, 0.9);
    ctx.beginPath(); ctx.arc(r.range(0, w), r.range(0, h), r.range(1, 4), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // tag pequena (assinatura)
  ctx.font = `italic ${h * 0.09}px "Comic Sans MS", "Brush Script MT", cursive`;
  ctx.fillStyle = r.pick(pal); ctx.textAlign = 'left';
  ctx.fillText(word.toLowerCase() + ' ' + r.int(1, 99), r.range(w * 0.05, w * 0.6), r.range(h * 0.85, h * 0.95));
  ctx.restore();
}

/** Parede (tijolo ou concreto) com grafite por cima. */
export function graffitiWall(baseCanvas, w, h, r) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const tiles = Math.max(1, Math.round(w / h));
  for (let i = 0; i < tiles; i++) ctx.drawImage(baseCanvas, i * (w / tiles), 0, w / tiles, h);
  const pieces = r.int(1, 2);
  for (let k = 0; k < pieces; k++) {
    ctx.save();
    const pw = (w / pieces) * r.range(0.7, 0.95);
    ctx.translate(k * (w / pieces) + r.range(0, w / pieces - pw), h * r.range(0.05, 0.2));
    ctx.globalAlpha = 0.92;
    drawGraffiti(ctx, pw, h * 0.75, r);
    ctx.restore();
  }
  // tags pequenas espalhadas
  for (let i = 0; i < r.int(2, 5); i++) {
    ctx.save(); ctx.globalAlpha = 0.8;
    ctx.font = `italic bold ${h * r.range(0.07, 0.12)}px "Brush Script MT", "Comic Sans MS", cursive`;
    ctx.fillStyle = r.pick(['#111', '#fff', '#ff2d55', '#0a84ff', '#ffd60a']);
    ctx.translate(r.range(0, w), r.range(h * 0.6, h * 0.95)); ctx.rotate(r.range(-0.2, 0.2));
    let t = ''; for (let k = 0; k < r.int(3, 6); k++) t += LETTERS[r.int(0, LETTERS.length - 1)];
    ctx.fillText(t.toLowerCase(), 0, 0);
    ctx.restore();
  }
  // desgaste do grafite: ruído apaga partes, base reaparece por baixo
  const wear = genPixels(w >> 3, h >> 3, (u, v, o) => { const n = fbm(u * 4 + 5, v + 2, 4, 4); o[0] = o[1] = o[2] = 255; o[3] = smoothstep(0.6, 0.72, n) * 140; });
  ctx.globalCompositeOperation = 'destination-out'; ctx.drawImage(wear, 0, 0, w, h);
  ctx.globalCompositeOperation = 'destination-over';
  for (let i = 0; i < tiles; i++) ctx.drawImage(baseCanvas, i * (w / tiles), 0, w / tiles, h);
  ctx.globalCompositeOperation = 'source-over';
  // sujeira na base da parede
  const g = ctx.createLinearGradient(0, h * 0.7, 0, h);
  g.addColorStop(0, 'rgba(20,16,12,0)'); g.addColorStop(1, 'rgba(20,16,12,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  return c;
}

/* ------------------------------------------------------------ placas */
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

/** Placa de estação (marca inventada "LVM", linha 9). */
export function stationSign(w, h, name) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#10243f'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#c8102e'; ctx.fillRect(0, 0, w, h * 0.12);
  ctx.beginPath(); ctx.arc(h * 0.55, h * 0.58, h * 0.3, 0, Math.PI * 2); ctx.fillStyle = '#c8102e'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `bold ${h * 0.38}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('9', h * 0.55, h * 0.6);
  ctx.textAlign = 'left'; ctx.font = `bold ${h * 0.34}px Arial, sans-serif`;
  ctx.fillText(name.toUpperCase(), h * 1.05, h * 0.6);
  ctx.font = `${h * 0.14}px Arial, sans-serif`; ctx.fillStyle = '#9fb3c8';
  ctx.fillText('LVM · LINHA VERMELHA METROPOLITANA', h * 1.08, h * 0.88);
  return c;
}

/** Placa de aviso listrada. */
export function warningSign(w, h, text) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#f5c400'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#111';
  for (let x = -h; x < w + h; x += h * 0.5) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h * 0.25, 0); ctx.lineTo(x + h * 0.25 - h * 0.3, h * 0.18); ctx.lineTo(x - h * 0.3, h * 0.18); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#111'; ctx.font = `bold ${h * 0.34}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h * 0.62);
  ctx.strokeStyle = '#111'; ctx.lineWidth = h * 0.05; ctx.strokeRect(h * 0.025, h * 0.025, w - h * 0.05, h - h * 0.05);
  return c;
}

/** Anúncio inventado (outdoor). */
export function adPoster(w, h, r) {
  const ads = [
    { t: 'CAFÉ TRILHO', s: 'o expresso da manhã', bg: ['#4a2c1a', '#8a5a3a'], fg: '#ffe8c8' },
    { t: 'RÁDIO NOVE', s: '99.9 FM · a cidade acordada', bg: ['#1b1f3b', '#5b2aa6'], fg: '#ffffff' },
    { t: 'FESTIVAL NÉON', s: 'sexta · pátio norte', bg: ['#ff2d55', '#ff9f0a'], fg: '#111' },
    { t: 'CORRA MAIS', s: 'tênis mola · pise leve', bg: ['#0a84ff', '#30d158'], fg: '#fff' },
    { t: 'VIADUTO VIVO', s: 'arte urbana 24h', bg: ['#111', '#444'], fg: '#ffd60a' },
    { t: 'SUCO AURORA', s: 'gelado como o amanhecer', bg: ['#ff7a00', '#ffd000'], fg: '#2b1200' },
  ];
  const ad = r.pick(ads);
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, ad.bg[0]); g.addColorStop(1, ad.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 12; i++) { ctx.fillStyle = `rgba(255,255,255,${r.range(0.03, 0.12)})`; ctx.beginPath(); ctx.arc(r.range(0, w), r.range(0, h), r.range(h * 0.1, h * 0.6), 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = ad.fg; ctx.font = `bold ${h * 0.3}px "Arial Black", Impact, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(ad.t, w * 0.06, h * 0.42);
  ctx.font = `${h * 0.13}px Arial, sans-serif`; ctx.fillText(ad.s, w * 0.065, h * 0.7);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
  return c;
}

/** Letreiro néon (texto emissivo). */
export function neonSign(w, h, text, color) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.font = `bold ${h * 0.6}px "Arial Rounded MT Bold", "Trebuchet MS", Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = color; ctx.shadowBlur = h * 0.25;
  ctx.strokeStyle = color; ctx.lineWidth = h * 0.06; ctx.strokeText(text, w / 2, h / 2);
  ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = h * 0.02; ctx.strokeText(text, w / 2, h / 2);
  return c;
}

/** Silhueta de skyline distante, com janelas acesas (alpha). */
export function skylineStrip(w, h, r) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const e = makeCanvas(w, h), ectx = e.getContext('2d');
  ctx.clearRect(0, 0, w, h); ectx.fillStyle = '#000'; ectx.fillRect(0, 0, w, h);
  let x = 0;
  while (x < w) {
    const bw = r.range(w * 0.01, w * 0.035), bh = h * r.range(0.15, 0.85);
    const shade = r.int(18, 40);
    ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 8})`;
    ctx.fillRect(x, h - bh, bw, bh);
    if (r.chance(0.3)) { ctx.fillRect(x + bw * 0.3, h - bh - h * 0.08, bw * 0.1, h * 0.08); } // antena
    const cols = Math.max(1, Math.floor(bw / 9)), rows = Math.max(1, Math.floor(bh / 12));
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (r.chance(0.35)) {
        const warm = r.chance(0.7);
        ectx.fillStyle = warm ? '#ffcf8a' : '#bfe1ff';
        ectx.fillRect(x + 2 + i * 9, h - bh + 3 + j * 12, 4, 6);
      }
    }
    x += bw + r.range(0, w * 0.004);
  }
  return { map: c, emissive: e };
}

/* ---------------------------------------------------------- sprites */
export function spriteSoft(size = 64) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return c;
}
export function spriteSpark(size = 64) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,240,200,0.9)'); g.addColorStop(0.5, 'rgba(255,160,60,0.25)'); g.addColorStop(1, 'rgba(255,120,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return c;
}
export function spriteStreak(w = 32, h = 128) {
  const c = makeCanvas(w, h), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,0.8)'); g.addColorStop(0.7, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(w * 0.47, 0, w * 0.06, h);
  return c;
}
export function spriteSmoke(size = 128, r) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = size / 2 + r.range(-size * 0.2, size * 0.2), y = size / 2 + r.range(-size * 0.2, size * 0.2), rad = r.range(size * 0.12, size * 0.3);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  }
  return c;
}
export function spriteLeaf(size = 32) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  ctx.translate(size / 2, size / 2); ctx.rotate(0.6);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, size * 0.42, size * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-size * 0.4, 0); ctx.lineTo(size * 0.4, 0); ctx.stroke();
  return c;
}
export function spriteRing(size = 64) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = size * 0.06;
  ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2); ctx.stroke();
  return c;
}

/** Textura de pele/roupa simples com ruído de tecido. */
export function fabricSet(size, tint, seed = 20) {
  const b = hexToRgb(tint);
  const color = genPixels(size, size, (u, v, o) => {
    const n = vnoise(u * 256, v * 256 + seed, 256); const w = Math.sin(u * 400) * Math.sin(v * 400) * 0.05;
    const t = 0.9 + (n - 0.5) * 0.25 + w;
    o[0] = b[0] * t; o[1] = b[1] * t; o[2] = b[2] * t;
  });
  const height = genPixels(size, size, (u, v, o) => { const n = vnoise(u * 256, v * 256 + seed, 256); o[0] = o[1] = o[2] = (0.5 + (n - 0.5) * 0.4 + Math.sin(u * 400) * Math.sin(v * 400) * 0.2) * 255; });
  return { map: color, normal: heightToNormal(height, 0.8) };
}

/** Flare do sol (sprite para o passe final). */
export function spriteFlare(size = 256) {
  const c = makeCanvas(size, size), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,250,235,1)'); g.addColorStop(0.08, 'rgba(255,240,200,0.8)'); g.addColorStop(0.3, 'rgba(255,200,120,0.15)'); g.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    const lg = ctx.createLinearGradient(0, 0, size * 0.5, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0.5)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, -1.5, size * 0.5, 3);
  }
  return c;
}
