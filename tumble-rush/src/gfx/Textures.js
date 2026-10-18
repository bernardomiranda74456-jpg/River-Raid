/**
 * Procedural texture generation on 2D canvas. Everything in the game
 * (concrete, brushed metal, rubber, wood, painted plastic, rock, patterns)
 * is generated here at startup, so the project has zero external assets.
 */
import * as THREE from 'three';

// ---------- small deterministic PRNG ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value noise field (size x size) with fBm octaves, values in 0..1. */
export function noiseField(size, scale = 8, octaves = 4, seed = 1, persistence = 0.5) {
  const out = new Float32Array(size * size);
  let amp = 1, freq = scale, total = 0;
  const rnd = mulberry32(seed);
  for (let o = 0; o < octaves; o++) {
    const n = Math.max(1, Math.round(freq));
    const grid = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) grid[i] = rnd();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * n; const y0 = Math.floor(fy); const ty = fy - y0; const sy = ty * ty * (3 - 2 * ty); const y1 = (y0 + 1) % n;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * n; const x0 = Math.floor(fx); const tx = fx - x0; const sx = tx * tx * (3 - 2 * tx); const x1 = (x0 + 1) % n;
        const a = grid[y0 * n + x0], b = grid[y0 * n + x1], c = grid[y1 * n + x0], d = grid[y1 * n + x1];
        const v = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
        out[y * size + x] += v * amp;
      }
    }
    total += amp; amp *= persistence; freq *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function canvas(size) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }

/** Turns a height field into a tangent-space normal map canvas. */
export function normalFromHeight(h, size, strength = 2) {
  const c = canvas(size); const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
      const u = h[((y - 1 + size) % size) * size + x], dn = h[((y + 1) % size) * size + x];
      let nx = (l - r) * strength, ny = (u - dn) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0); return c;
}

/** Writes a scalar field (0..1) to a grayscale canvas (used for roughness / AO maps). */
export function grayFromField(f, size, lo = 0, hi = 1) {
  const c = canvas(size); const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
  for (let i = 0; i < size * size; i++) { const v = Math.max(0, Math.min(1, lo + (hi - lo) * f[i])) * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0); return c;
}

export function toTexture(c, { srgb = false, repeat = 1, anisotropy = 8, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = anisotropy; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
  return t;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ======================= material texture sets =======================

/** Concrete: warm-gray base, grime clouds, speckles, hairline cracks, pitted normal. */
export function concreteSet(size, seed = 11) {
  const rnd = mulberry32(seed);
  const grime = noiseField(size, 3, 5, seed);
  const fine = noiseField(size, 24, 3, seed + 1);
  const c = canvas(size); const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
  const h = new Float32Array(size * size); const rough = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const g = grime[i], f = fine[i];
    const base = 0.58 + (g - 0.5) * 0.22 + (f - 0.5) * 0.10;
    const r = base * 1.0, gg = base * 0.97, b = base * 0.92;
    d[i * 4] = clamp01(r) * 255; d[i * 4 + 1] = clamp01(gg) * 255; d[i * 4 + 2] = clamp01(b) * 255; d[i * 4 + 3] = 255;
    h[i] = 0.5 + (f - 0.5) * 0.6 + (g - 0.5) * 0.3;
    rough[i] = 0.75 + (g - 0.5) * 0.3 + (f - 0.5) * 0.15;
  }
  ctx.putImageData(img, 0, 0);
  // speckles
  for (let i = 0; i < size * size * 0.004; i++) {
    const x = rnd() * size, y = rnd() * size; const v = rnd() < 0.5 ? 30 : 230; ctx.fillStyle = `rgba(${v},${v},${v},${0.25 + rnd() * 0.3})`; ctx.fillRect(x, y, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  // hairline cracks
  ctx.strokeStyle = 'rgba(40,36,32,0.55)'; ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    let x = rnd() * size, y = rnd() * size; ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < 14; s++) { x += (rnd() - 0.5) * size * 0.08; y += (rnd() - 0.5) * size * 0.08; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  return { map: c, normal: normalFromHeight(h, size, 1.8), roughness: grayFromField(rough, size) };
}

/** Brushed metal: horizontal micro-streaks in roughness and normal, some scratches on the color map. */
export function brushedMetalSet(size, seed = 21, tint = [0.78, 0.80, 0.83]) {
  const rnd = mulberry32(seed);
  const c = canvas(size); const ctx = c.getContext('2d');
  ctx.fillStyle = `rgb(${tint[0] * 255},${tint[1] * 255},${tint[2] * 255})`; ctx.fillRect(0, 0, size, size);
  const h = new Float32Array(size * size); const rough = new Float32Array(size * size);
  const streak = new Float32Array(size);
  for (let y = 0; y < size; y++) streak[y] = rnd();
  const smear = noiseField(size, 2, 3, seed + 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x; const s = streak[y] * 0.5 + streak[(y + 1) % size] * 0.25 + streak[(y + size - 1) % size] * 0.25;
      h[i] = 0.5 + (s - 0.5) * 0.35 + (rnd() - 0.5) * 0.05;
      rough[i] = 0.32 + (s - 0.5) * 0.22 + (smear[i] - 0.5) * 0.3;
    }
  }
  // fine streak lines on the color map (slight darkening)
  for (let i = 0; i < size * 1.5; i++) { const y = rnd() * size; const a = 0.03 + rnd() * 0.07; ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, y, size, 1); }
  for (let i = 0; i < size * 0.7; i++) { const y = rnd() * size; ctx.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.06})`; ctx.fillRect(0, y, size, 1); }
  // scratches
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const x = rnd() * size, y = rnd() * size, len = 10 + rnd() * size * 0.25, ang = (rnd() - 0.5) * 0.5;
    ctx.strokeStyle = `rgba(255,255,255,${0.15 + rnd() * 0.3})`; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.stroke();
  }
  return { map: c, normal: normalFromHeight(h, size, 0.9), roughness: grayFromField(rough, size) };
}

/** Rubber: dark matte with raised knobs pattern (diamond-plate-like) and dust. */
export function rubberSet(size, seed = 31, color = [0.14, 0.14, 0.15]) {
  const rnd = mulberry32(seed);
  const c = canvas(size); const ctx = c.getContext('2d');
  const dust = noiseField(size, 4, 4, seed);
  const img = ctx.createImageData(size, size); const d = img.data; const h = new Float32Array(size * size); const rough = new Float32Array(size * size);
  const cell = size / 16;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x; const du = dust[i];
    const cx = (x % cell) / cell - 0.5, cy = (y % cell) / cell - 0.5; const r = Math.hypot(cx, cy);
    const knob = clamp01((0.28 - r) * 8); // round knob
    h[i] = 0.4 + knob * 0.5 + (rnd() - 0.5) * 0.04;
    const shade = 1 + (du - 0.5) * 0.35 + knob * 0.12;
    d[i * 4] = clamp01(color[0] * shade) * 255; d[i * 4 + 1] = clamp01(color[1] * shade) * 255; d[i * 4 + 2] = clamp01(color[2] * shade) * 255; d[i * 4 + 3] = 255;
    rough[i] = 0.85 + (du - 0.5) * 0.2 - knob * 0.1;
  }
  ctx.putImageData(img, 0, 0);
  return { map: c, normal: normalFromHeight(h, size, 2.5), roughness: grayFromField(rough, size) };
}

/** Wood planks: grain stripes distorted by noise, plank seams, knots. */
export function woodSet(size, seed = 41, planks = 6) {
  const rnd = mulberry32(seed);
  const c = canvas(size); const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
  const h = new Float32Array(size * size); const rough = new Float32Array(size * size);
  const warp = noiseField(size, 3, 3, seed);
  const plankTone = []; for (let p = 0; p < planks; p++) plankTone.push(0.85 + rnd() * 0.3);
  const plankShift = []; for (let p = 0; p < planks; p++) plankShift.push(rnd() * 100);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x; const p = Math.floor((x / size) * planks); const px = (x / size) * planks - p;
    const grain = Math.sin((y / size) * 60 + warp[i] * 9 + plankShift[p]) * 0.5 + 0.5;
    const g2 = Math.sin((y / size) * 190 + warp[i] * 20) * 0.5 + 0.5;
    const seam = (px < 0.02 || px > 0.98) ? 0.55 : 1;
    const tone = plankTone[p] * seam * (0.78 + grain * 0.22 + g2 * 0.05);
    const r = 0.62 * tone, g = 0.42 * tone, b = 0.25 * tone;
    d[i * 4] = clamp01(r) * 255; d[i * 4 + 1] = clamp01(g) * 255; d[i * 4 + 2] = clamp01(b) * 255; d[i * 4 + 3] = 255;
    h[i] = seam < 1 ? 0.2 : 0.5 + grain * 0.18 + g2 * 0.06;
    rough[i] = 0.62 + grain * 0.2 - (seam < 1 ? 0.1 : 0);
  }
  ctx.putImageData(img, 0, 0);
  // knots
  for (let k = 0; k < 4; k++) {
    const x = rnd() * size, y = rnd() * size, r = 6 + rnd() * 10; const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, 'rgba(60,35,15,0.9)'); g.addColorStop(0.6, 'rgba(90,55,25,0.5)'); g.addColorStop(1, 'rgba(90,55,25,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  return { map: c, normal: normalFromHeight(h, size, 1.6), roughness: grayFromField(rough, size) };
}

/** Painted plastic / coated panel: flat color with subtle mottling, grime in a vignette, scratches and roughness variation. */
export function paintedSet(size, seed = 51, color = [0.9, 0.3, 0.2], { edgeDirt = 0.25, scratches = 20 } = {}) {
  const rnd = mulberry32(seed);
  const c = canvas(size); const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
  const mottle = noiseField(size, 5, 4, seed); const fine = noiseField(size, 40, 2, seed + 7);
  const h = new Float32Array(size * size); const rough = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x; const m = mottle[i], f = fine[i];
    const ex = Math.min(x, size - x) / size, ey = Math.min(y, size - y) / size; const edge = clamp01(1 - Math.min(ex, ey) * 10) * edgeDirt;
    const shade = 1 + (m - 0.5) * 0.12 - edge * 0.5;
    d[i * 4] = clamp01(color[0] * shade) * 255; d[i * 4 + 1] = clamp01(color[1] * shade) * 255; d[i * 4 + 2] = clamp01(color[2] * shade) * 255; d[i * 4 + 3] = 255;
    h[i] = 0.5 + (f - 0.5) * 0.08 + (m - 0.5) * 0.04 - edge * 0.3;
    rough[i] = 0.42 + (m - 0.5) * 0.25 + edge * 0.35 + (f - 0.5) * 0.1;
  }
  ctx.putImageData(img, 0, 0);
  ctx.lineWidth = 1;
  for (let i = 0; i < scratches; i++) {
    const x = rnd() * size, y = rnd() * size, len = 8 + rnd() * size * 0.18, ang = rnd() * Math.PI;
    ctx.strokeStyle = `rgba(255,255,255,${0.12 + rnd() * 0.25})`; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.stroke();
  }
  return { map: c, normal: normalFromHeight(h, size, 1.2), roughness: grayFromField(rough, size) };
}

/** Volcanic rock: dark, high-contrast lumps with glowing-ash speckles baked as slight warm tint. */
export function rockSet(size, seed = 61) {
  const rnd = mulberry32(seed);
  const c = canvas(size); const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
  const big = noiseField(size, 3, 6, seed, 0.55); const fine = noiseField(size, 30, 2, seed + 2);
  const h = new Float32Array(size * size); const rough = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const b = big[i], f = fine[i]; const ridged = 1 - Math.abs(b * 2 - 1);
    const tone = 0.10 + ridged * 0.16 + (f - 0.5) * 0.06;
    d[i * 4] = clamp01(tone * 1.05) * 255; d[i * 4 + 1] = clamp01(tone * 0.95) * 255; d[i * 4 + 2] = clamp01(tone * 0.9) * 255; d[i * 4 + 3] = 255;
    h[i] = ridged * 0.8 + (f - 0.5) * 0.2; rough[i] = 0.82 + (f - 0.5) * 0.2;
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < size * size * 0.002; i++) { ctx.fillStyle = `rgba(255,120,40,${0.1 + rnd() * 0.2})`; ctx.fillRect(rnd() * size, rnd() * size, 1, 1); }
  return { map: c, normal: normalFromHeight(h, size, 4.0), roughness: grayFromField(rough, size) };
}

/** Hazard stripes (yellow/black) used on hammers and spinner hubs. */
export function hazardStripes(size = 256) {
  const c = canvas(size); const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2c02c'; ctx.fillRect(0, 0, size, size); ctx.fillStyle = '#1a1a1a';
  const w = size / 4;
  for (let i = -2; i < 6; i++) { ctx.beginPath(); ctx.moveTo(i * w, 0); ctx.lineTo(i * w + w / 2, 0); ctx.lineTo(i * w + w / 2 - size, size); ctx.lineTo(i * w - size, size); ctx.closePath(); ctx.fill(); }
  // grime
  const g = noiseField(size, 4, 3, 5); const img = ctx.getImageData(0, 0, size, size); const d = img.data;
  for (let i = 0; i < size * size; i++) { const s = 0.85 + g[i] * 0.3; d[i * 4] *= s; d[i * 4 + 1] *= s; d[i * 4 + 2] *= s; }
  ctx.putImageData(img, 0, 0); return c;
}

/** Skin pattern atlas: 4x2 grid of grayscale masks (0 = color A, 1 = color B). */
export function patternAtlas(size = 1024) {
  const c = canvas(size); const ctx = c.getContext('2d'); const cell = size / 4;
  const draw = (ix, iy, fn) => { ctx.save(); ctx.beginPath(); ctx.rect(ix * cell, iy * cell, cell, cell); ctx.clip(); ctx.translate(ix * cell, iy * cell); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cell, cell); ctx.fillStyle = '#fff'; fn(cell); ctx.restore(); };
  draw(0, 0, () => {}); // 0: solid
  draw(1, 0, (s) => { for (let i = 0; i < 8; i += 2) ctx.fillRect(0, i * s / 8, s, s / 8); }); // 1: stripes
  draw(2, 0, (s) => { for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) { ctx.beginPath(); ctx.arc((x + 0.5 + (y % 2) * 0.5) * s / 6, (y + 0.5) * s / 6, s / 22, 0, Math.PI * 2); ctx.fill(); } }); // 2: dots
  draw(3, 0, (s) => { for (let i = -1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0, i * s / 4); ctx.lineTo(s / 2, i * s / 4 + s / 4); ctx.lineTo(s, i * s / 4); ctx.lineTo(s, i * s / 4 + s / 8); ctx.lineTo(s / 2, i * s / 4 + s / 4 + s / 8); ctx.lineTo(0, i * s / 4 + s / 8); ctx.closePath(); ctx.fill(); } }); // 3: chevrons
  draw(0, 1, (s) => { for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) if ((x + y) % 2 === 0) ctx.fillRect(x * s / 6, y * s / 6, s / 6, s / 6); }); // 4: checker
  draw(1, 1, (s) => { ctx.fillRect(0, s * 0.5, s, s * 0.5); }); // 5: two-tone (lower half)
  draw(2, 1, (s) => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.18 : s * 0.4; const a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); }); // 6: star
  draw(3, 1, (s) => { ctx.fillRect(0, 0, s, s * 0.2); ctx.fillRect(0, s * 0.4, s, s * 0.2); ctx.fillRect(0, s * 0.8, s, s * 0.2); ctx.globalCompositeOperation = 'xor'; ctx.fillRect(s * 0.4, 0, s * 0.2, s); }); // 7: plaid
  return c;
}

/** Cartoon eye: white sclera, colored iris, pupil and a highlight. */
export function eyeTexture(size = 256, iris = '#2d7bd6') {
  const c = canvas(size); const ctx = c.getContext('2d'); const cx = size / 2, cy = size / 2;
  ctx.fillStyle = '#fbfbfb'; ctx.fillRect(0, 0, size, size);
  const g = ctx.createRadialGradient(cx, cy, size * 0.02, cx, cy, size * 0.3); g.addColorStop(0, iris); g.addColorStop(0.8, iris); g.addColorStop(1, '#0a0a14');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#06060a'; ctx.beginPath(); ctx.arc(cx, cy, size * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(cx - size * 0.09, cy - size * 0.1, size * 0.06, 0, Math.PI * 2); ctx.fill();
  return c;
}

/** Soft radial sprite used for particles (dust / embers / sparks / glow). */
export function softSprite(size = 64, hard = 0.0) {
  const c = canvas(size); const ctx = c.getContext('2d'); const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(hard, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, size, size); return c;
}

/** Confetti sprite: a square (we tint per-particle). */
export function squareSprite(size = 32) { const c = canvas(size); const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(4, 4, size - 8, size - 8); return c; }

/** Cloud sprite: blobby soft shape. */
export function cloudSprite(size = 256, seed = 3) {
  const rnd = mulberry32(seed); const c = canvas(size); const ctx = c.getContext('2d');
  for (let i = 0; i < 14; i++) {
    const x = size * (0.25 + rnd() * 0.5), y = size * (0.35 + rnd() * 0.3), r = size * (0.12 + rnd() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}
