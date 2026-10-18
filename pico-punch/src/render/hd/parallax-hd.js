// Fundos HD em 6+ camadas por tema e hora do dia: céu (gradiente, sol/lua, estrelas), nuvens,
// montanhas/prédios distantes com névoa, colinas/árvores, vegetação próxima e banda de neblina.
import { Container, Sprite, TilingSprite, Texture, CanvasSource, Graphics } from 'pixi.js';
import { makeCanvas } from '../pixelart.js';
import { Rng } from '../../core/math.js';

const TW = 1024; // largura periódica das camadas
const tex = (c) => new Texture({ source: new CanvasSource({ resource: c, scaleMode: 'linear', alphaMode: 'premultiply-alpha-on-upload', addressModeU: 'repeat', addressModeV: 'clamp-to-edge' }) });
const SKY = {
  morning: { top: '#2f6fc4', mid: '#79b4ee', bot: '#ffd8a8', sun: '#fff1b0', sunPos: [0.18, 0.22], haze: 'rgba(255,220,180,' },
  day: { top: '#2b7ee0', mid: '#7cc2ff', bot: '#d6efff', sun: '#ffffff', sunPos: [0.3, 0.12], haze: 'rgba(200,230,255,' },
  sunset: { top: '#2a2560', mid: '#c95a6a', bot: '#ffb36a', sun: '#ffd080', sunPos: [0.8, 0.52], haze: 'rgba(255,160,110,' },
  night: { top: '#040716', mid: '#121a3e', bot: '#263564', sun: '#e8ecff', sunPos: [0.75, 0.2], haze: 'rgba(40,60,120,', stars: true },
  cave: { top: '#07040a', mid: '#140b18', bot: '#2a1630', sun: null, haze: 'rgba(60,30,70,' },
  underwater: { top: '#04203f', mid: '#0b5a93', bot: '#1d8cc0', sun: null, haze: 'rgba(60,150,200,' },
  castle: { top: '#0b0718', mid: '#2a1a40', bot: '#4a2a58', sun: '#d8d0ff', sunPos: [0.2, 0.18], haze: 'rgba(70,40,90,', stars: true },
  city: { top: '#06061c', mid: '#1b1240', bot: '#3a2050', sun: null, haze: 'rgba(90,40,110,', stars: true },
};
function profileLayer(w, h, color, fn, rng, opts = {}) {
  const c = makeCanvas(w, h); const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, color); grad.addColorStop(1, opts.bottom || color); ctx.fillStyle = grad;
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 2) ctx.lineTo(x, fn(x / w) * h);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  if (opts.after) opts.after(ctx, fn);
  return c;
}
const periodic = (seed, octs = [[3, 0.5], [7, 0.25], [13, 0.12], [29, 0.06]]) => { const ph = octs.map((_, i) => seed * (i + 1) * 1.7); return (u) => { let v = 0; octs.forEach(([f, a], i) => { v += Math.sin(u * Math.PI * 2 * f + ph[i]) * a; }); return v; }; };

function drawTrees(ctx, w, baseFn, color, n, rng, kind = 'pine', scale = 1) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const u = (i + rng.next() * 0.6) / n; const x = u * w; const y = baseFn(u) * ctx.canvas.height + 4; const s = (0.7 + rng.next() * 0.6) * scale;
    if (kind === 'pine') { const hgt = 60 * s, wd = 26 * s; ctx.beginPath(); ctx.moveTo(x, y - hgt); ctx.lineTo(x + wd / 2, y - hgt * 0.55); ctx.lineTo(x + wd * 0.3, y - hgt * 0.55); ctx.lineTo(x + wd * 0.6, y - hgt * 0.25); ctx.lineTo(x + wd * 0.35, y - hgt * 0.25); ctx.lineTo(x + wd * 0.7, y); ctx.lineTo(x - wd * 0.7, y); ctx.lineTo(x - wd * 0.35, y - hgt * 0.25); ctx.lineTo(x - wd * 0.6, y - hgt * 0.25); ctx.lineTo(x - wd * 0.3, y - hgt * 0.55); ctx.lineTo(x - wd / 2, y - hgt * 0.55); ctx.closePath(); ctx.fill(); ctx.fillRect(x - 2 * s, y - 4, 4 * s, 8); }
    else if (kind === 'round') { const r = 22 * s; ctx.fillRect(x - 3 * s, y - r * 1.3, 6 * s, r * 1.3); ctx.beginPath(); ctx.arc(x, y - r * 1.4, r, 0, Math.PI * 2); ctx.arc(x - r * 0.7, y - r * 1.0, r * 0.75, 0, Math.PI * 2); ctx.arc(x + r * 0.7, y - r * 1.05, r * 0.8, 0, Math.PI * 2); ctx.fill(); }
    else if (kind === 'palm') { const hgt = 50 * s; ctx.fillRect(x - 2, y - hgt, 4, hgt); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 14 * s, y - hgt + Math.sin(a) * 6 * s, 16 * s, 5 * s, a, 0, Math.PI * 2); ctx.fill(); } }
    else if (kind === 'cactus') { const hgt = 30 * s; ctx.fillRect(x - 4 * s, y - hgt, 8 * s, hgt); ctx.fillRect(x - 14 * s, y - hgt * 0.7, 6 * s, hgt * 0.35); ctx.fillRect(x - 14 * s, y - hgt * 0.7, 14 * s, 5 * s); ctx.fillRect(x + 8 * s, y - hgt * 0.5, 6 * s, hgt * 0.3); ctx.fillRect(x + 4 * s, y - hgt * 0.5, 10 * s, 5 * s); }
  }
}
function drawBuildings(ctx, w, h, color, winColor, rng, density = 1, maxH = 0.7) {
  let x = 0; ctx.fillStyle = color;
  while (x < w) { const bw = 24 + rng.next() * 50; const bh = h * (0.25 + rng.next() * maxH); ctx.fillRect(x, h - bh, bw, bh); if (rng.next() < 0.3) ctx.fillRect(x + bw * 0.3, h - bh - 14, bw * 0.4, 14);
    ctx.fillStyle = winColor; for (let wy = h - bh + 8; wy < h - 6; wy += 11) for (let wx = x + 5; wx < x + bw - 6; wx += 9) if (rng.next() < 0.45 * density) ctx.fillRect(wx, wy, 4, 6); ctx.fillStyle = color; x += bw + 3 + rng.next() * 10; }
}
function drawCastleTowers(ctx, w, h, color, rng) {
  ctx.fillStyle = color; let x = 40;
  while (x < w) { const tw = 30 + rng.next() * 30, th = h * (0.3 + rng.next() * 0.45); ctx.fillRect(x, h - th, tw, th); ctx.beginPath(); ctx.moveTo(x - 4, h - th); ctx.lineTo(x + tw / 2, h - th - tw * 1.1); ctx.lineTo(x + tw + 4, h - th); ctx.fill(); for (let k = 0; k < 3; k++) ctx.fillRect(x + 6 + k * (tw / 3), h - th - 8, tw / 6, 8); x += tw + 60 + rng.next() * 120; }
}
function drawStalactites(ctx, w, h, color, rng, down = true) {
  ctx.fillStyle = color; let x = 0;
  while (x < w) { const sw = 10 + rng.next() * 30, sh = 30 + rng.next() * h * 0.5; ctx.beginPath(); if (down) { ctx.moveTo(x, 0); ctx.lineTo(x + sw, 0); ctx.lineTo(x + sw / 2, sh); } else { ctx.moveTo(x, h); ctx.lineTo(x + sw, h); ctx.lineTo(x + sw / 2, h - sh); } ctx.closePath(); ctx.fill(); x += sw * 0.7 + rng.next() * 20; }
}

export class HDParallax {
  constructor(theme, viewW, viewH, time = 'day') {
    this.root = new Container(); this.layers = []; this.viewW = viewW; this.viewH = viewH; this.theme = theme; this.time = time;
    const sky = SKY[time] || SKY.day; const rng = new Rng(101 + theme.length);
    // 1. céu
    const sc = makeCanvas(64, 512); const sctx = sc.getContext('2d'); const g = sctx.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, sky.top); g.addColorStop(0.55, sky.mid); g.addColorStop(1, sky.bot); sctx.fillStyle = g; sctx.fillRect(0, 0, 64, 512);
    this.sky = new Sprite(tex(sc)); this.root.addChild(this.sky);
    // estrelas
    if (sky.stars) { const st = makeCanvas(TW, 300); const c = st.getContext('2d'); for (let i = 0; i < 160; i++) { const a = 0.4 + rng.next() * 0.6; c.fillStyle = `rgba(255,255,255,${a})`; const s = rng.next() < 0.15 ? 2.5 : 1.3; c.fillRect(rng.next() * TW, rng.next() * 300, s, s); } this.stars = new TilingSprite({ texture: tex(st), width: viewW + 64, height: 300 }); this.root.addChild(this.stars); }
    // sol / lua com halo
    if (sky.sun) { const sun = makeCanvas(256, 256); const c = sun.getContext('2d'); const nightish = time === 'night' || time === 'castle';
      for (let i = 12; i >= 1; i--) { const r = 20 + i * 9; c.fillStyle = nightish ? `rgba(200,210,255,${0.025})` : `rgba(255,230,160,${0.035})`; c.beginPath(); c.arc(128, 128, r, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = sky.sun; c.beginPath(); c.arc(128, 128, nightish ? 16 : 24, 0, Math.PI * 2); c.fill();
      if (nightish) { c.globalCompositeOperation = 'destination-out'; c.beginPath(); c.arc(134, 122, 13, 0, Math.PI * 2); c.fill(); c.globalCompositeOperation = 'source-over'; }
      this.sun = new Sprite(tex(sun)); this.sun.anchor.set(0.5); this.root.addChild(this.sun); this.sunPos = sky.sunPos; }
    const addTiling = (canvas, factor, yOff = 0, alpha = 1) => { const ts = new TilingSprite({ texture: tex(canvas), width: viewW + 64, height: canvas.height }); ts.alpha = alpha; this.root.addChild(ts); this.layers.push({ ts, factor, h: canvas.height, yOff }); return ts; };
    const H = 220; const haze = (a) => sky.haze + a + ')';
    // 2. nuvens distantes
    if (!['cave', 'underwater', 'city'].includes(time) && theme !== 'cave') {
      const cl = makeCanvas(TW, 200); const c = cl.getContext('2d');
      for (let i = 0; i < 7; i++) { const x = rng.next() * TW, y = 40 + rng.next() * 60, s = 0.3 + rng.next() * 0.5; c.fillStyle = time === 'sunset' ? 'rgba(255,200,170,0.8)' : time === 'night' ? 'rgba(120,135,190,0.45)' : 'rgba(255,255,255,0.85)'; for (const ox of [-TW, 0, TW]) for (let k = 0; k < 6; k++) { c.beginPath(); c.ellipse(ox + x + (k - 3) * 22 * s, y + Math.sin(k * 1.7) * 6 * s, 28 * s, 14 * s + Math.cos(k) * 4 * s, 0, 0, Math.PI * 2); c.fill(); } }
      this.clouds = addTiling(cl, 0.06, 0, 0.95); this.clouds2 = addTiling(cl, 0.12, 50, 0.35);
    }
    // 3–5. silhuetas por tema (cores escurecem e saturam ao se aproximar; longe mistura com névoa)
    const far = (col, fn, after) => addTiling(profileLayer(TW, H, col, fn, rng, { after, bottom: col }), 0.18, 0);
    const mid = (col, fn, after) => addTiling(profileLayer(TW, H, col, fn, rng, { after, bottom: col }), 0.38, 30);
    const near = (col, fn, after) => addTiling(profileLayer(TW, H, col, fn, rng, { after, bottom: col }), 0.6, 60);
    const t = time; const P = (base, amp, seed) => { const f = periodic(seed); return (u) => base - amp * f(u); };
    const pal = this.palette(theme, t);
    switch (theme) {
      case 'mountain': far(pal.far, P(0.55, 0.3, 1), (c, fn) => { for (let x = 0; x < TW; x += 2) { const y = fn(x / TW) * H; const cap = H * 0.36; if (y < cap) { const hgt = Math.min(22, (cap - y) * 0.5 + 4); const g2 = c.createLinearGradient(0, y, 0, y + hgt); g2.addColorStop(0, 'rgba(255,255,255,0.85)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g2; c.fillRect(x, y, 2, hgt); } } }); mid(pal.mid, P(0.72, 0.16, 2), (c, fn) => drawTrees(c, TW, fn, pal.midTree, 28, rng, 'pine', 0.8)); near(pal.near, P(0.86, 0.1, 3), (c, fn) => drawTrees(c, TW, fn, pal.nearTree, 14, rng, 'pine', 1.2)); break;
      case 'forest': far(pal.far, P(0.6, 0.18, 4)); mid(pal.mid, P(0.78, 0.1, 5), (c, fn) => drawTrees(c, TW, fn, pal.midTree, 40, rng, 'round', 1.0)); near(pal.near, P(0.92, 0.06, 6), (c, fn) => drawTrees(c, TW, fn, pal.nearTree, 22, rng, 'round', 1.6)); break;
      case 'lake': far(pal.far, P(0.6, 0.22, 7)); mid(pal.mid, P(0.8, 0.08, 8), (c, fn) => drawTrees(c, TW, fn, pal.midTree, 24, rng, 'round', 0.9)); near(pal.near, P(0.95, 0.03, 9)); break;
      case 'village': far(pal.far, P(0.6, 0.2, 10)); mid(pal.mid, P(0.8, 0.08, 11), (c, fn) => { drawTrees(c, TW, fn, pal.midTree, 18, rng, 'round', 0.8); c.fillStyle = pal.house; for (let i = 0; i < 7; i++) { const u = (i + 0.3) / 7, x = u * TW, y = fn(u) * H; c.fillRect(x - 16, y - 22, 32, 22); c.beginPath(); c.moveTo(x - 20, y - 22); c.lineTo(x, y - 40); c.lineTo(x + 20, y - 22); c.fill(); c.fillStyle = pal.window; c.fillRect(x - 4, y - 16, 8, 8); c.fillStyle = pal.house; } }); near(pal.near, P(0.94, 0.04, 12)); break;
      case 'desert': far(pal.far, P(0.62, 0.14, 13), (c, fn) => { c.fillStyle = pal.midTree; for (let i = 0; i < 6; i++) { const u = (i + 0.5) / 6, x = u * TW, y = fn(u) * H; for (let k = 0; k < 3; k++) c.fillRect(x + k * 14, y - 30 + k * 4, 6, 30 - k * 4); c.fillRect(x - 4, y - 34, 40, 5); } }); mid(pal.mid, P(0.8, 0.1, 14)); near(pal.near, P(0.93, 0.05, 15), (c, fn) => drawTrees(c, TW, fn, pal.nearTree, 10, rng, 'cactus', 1.1)); break;
      case 'road': far(pal.far, P(0.58, 0.25, 16)); mid(pal.mid, P(0.78, 0.1, 17), (c, fn) => drawTrees(c, TW, fn, pal.midTree, 26, rng, 'round', 0.9)); near(pal.near, P(0.95, 0.03, 18), (c) => { c.fillStyle = pal.nearTree; for (let x = 60; x < TW; x += 240) { c.fillRect(x, H * 0.45, 5, H * 0.55); c.fillRect(x - 16, H * 0.47, 37, 4); } }); break;
      case 'sky': far(pal.far, P(0.9, 0.05, 19)); mid(pal.mid, (u) => 0.55 + 0.25 * Math.abs(Math.sin(u * Math.PI * 3)), (c, fn) => drawTrees(c, TW, fn, pal.midTree, 12, rng, 'round', 0.7)); break;
      case 'cave': addTiling(profileLayer(TW, H, pal.far, P(0.75, 0.2, 20), rng), 0.15, 0); { const st = makeCanvas(TW, 160); drawStalactites(st.getContext('2d'), TW, 160, pal.mid, rng, true); const ts = new TilingSprite({ texture: tex(st), width: viewW + 64, height: 160 }); this.root.addChild(ts); this.layers.push({ ts, factor: 0.3, h: 160, yOff: -(viewH - 160) }); } near(pal.near, P(0.9, 0.08, 21), (c, fn) => { c.fillStyle = pal.glow; for (let i = 0; i < 10; i++) { const u = rng.next(), x = u * TW, y = fn(u) * H; c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x, y - 22 - rng.next() * 16); c.lineTo(x + 6, y); c.fill(); } }); break;
      case 'city': { const b1 = makeCanvas(TW, 260); drawBuildings(b1.getContext('2d'), TW, 260, pal.far, pal.window, rng, 0.7, 0.75); addTiling(b1, 0.15, 0); const b2 = makeCanvas(TW, 220); drawBuildings(b2.getContext('2d'), TW, 220, pal.mid, pal.window2, rng, 1, 0.6); addTiling(b2, 0.32, 20); near(pal.near, P(0.95, 0.03, 22), (c) => { c.fillStyle = pal.glow; for (let x = 30; x < TW; x += 170) c.fillRect(x, H * 0.72, 40 + (x % 50), 6); }); } break;
      case 'castle': far(pal.far, P(0.55, 0.3, 23)); { const tc = makeCanvas(TW, 240); drawCastleTowers(tc.getContext('2d'), TW, 240, pal.mid, rng); addTiling(tc, 0.3, 10); } near(pal.near, P(0.92, 0.06, 24), (c, fn) => drawTrees(c, TW, fn, pal.nearTree, 16, rng, 'pine', 1.0)); break;
      default: far(pal.far, P(0.6, 0.2, 25)); mid(pal.mid, P(0.8, 0.1, 26)); near(pal.near, P(0.93, 0.05, 27));
    }
    // 6. neblina de profundidade (banda suave) sobre as camadas distantes e névoa rasteira
    const fog = makeCanvas(256, 160); const fc = fog.getContext('2d'); const fg = fc.createLinearGradient(0, 0, 0, 160); fg.addColorStop(0, haze(0)); fg.addColorStop(0.6, haze(0.35)); fg.addColorStop(1, haze(0.0)); fc.fillStyle = fg; fc.fillRect(0, 0, 256, 160);
    this.fog = addTiling(fog, 0.5, 90, theme === 'cave' || time === 'night' ? 0.5 : 0.7);
    // raios de luz subaquáticos
    if (time === 'underwater') { const sh = makeCanvas(TW, 400); const c = sh.getContext('2d'); for (let i = 0; i < 9; i++) { const x = rng.next() * TW; const grd = c.createLinearGradient(0, 0, 0, 400); grd.addColorStop(0, 'rgba(180,230,255,0.28)'); grd.addColorStop(1, 'rgba(180,230,255,0)'); c.fillStyle = grd; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 40, 0); c.lineTo(x + 140, 400); c.lineTo(x + 40, 400); c.fill(); } this.shafts = new TilingSprite({ texture: tex(sh), width: viewW + 64, height: 400 }); this.shafts.blendMode = 'add'; this.root.addChild(this.shafts); }
    this.resize(viewW, viewH);
  }
  palette(theme, t) {
    const night = t === 'night' || t === 'castle' || t === 'city'; const sunset = t === 'sunset';
    const base = {
      mountain: { far: '#5a78b0', mid: '#3d6e4a', midTree: '#2f5a3a', near: '#27492f', nearTree: '#1d3a24' },
      forest: { far: '#4f8a6a', mid: '#2f6b3d', midTree: '#255a31', near: '#1b4424', nearTree: '#143319' },
      lake: { far: '#5f8fb8', mid: '#3f7a66', midTree: '#2f6a50', near: '#2b5a48', nearTree: '#1e4435' },
      village: { far: '#6f94c4', mid: '#5c9a4e', midTree: '#3d7a35', near: '#3b6f2f', nearTree: '#2b5522', house: '#8a5a3a', window: '#ffd27a' },
      desert: { far: '#b98a62', mid: '#d6a86a', midTree: '#8a6440', near: '#c9924f', nearTree: '#4f6b32' },
      road: { far: '#6a86a8', mid: '#4b7a4e', midTree: '#3a6a3f', near: '#365a36', nearTree: '#3a3a3a' },
      sky: { far: '#9ab8e8', mid: '#6a8ec0', midTree: '#4f7a4a', near: '#ffffff', nearTree: '#ffffff' },
      cave: { far: '#1e1424', mid: '#2a1a30', midTree: '#2a1a30', near: '#120a16', nearTree: '#120a16', glow: 'rgba(255,120,80,0.75)' },
      city: { far: '#1a1838', mid: '#0f0e26', midTree: '#0f0e26', near: '#07061a', nearTree: '#07061a', window: 'rgba(255,220,140,0.9)', window2: 'rgba(140,220,255,0.9)', glow: 'rgba(255,80,200,0.8)' },
      castle: { far: '#2a2048', mid: '#1b1430', midTree: '#1b1430', near: '#100a20', nearTree: '#0a0616' },
    }[theme] || { far: '#5a78b0', mid: '#3d6e4a', midTree: '#2f5a3a', near: '#27492f', nearTree: '#1d3a24' };
    if (sunset && theme !== 'cave') return { ...base, far: '#6b4a7a', mid: '#4a3a52', midTree: '#3a2a40', near: '#2a1c2e', nearTree: '#1e1422' };
    if (night && theme !== 'city' && theme !== 'castle' && theme !== 'cave') return { ...base, far: '#1c2650', mid: '#141c3a', midTree: '#101830', near: '#0b1024', nearTree: '#080c1c' };
    return base;
  }
  resize(w, h) {
    this.viewW = w; this.viewH = h; this.sky.width = w; this.sky.height = h;
    for (const l of this.layers) { l.ts.width = w + 64; }
    if (this.stars) this.stars.width = w + 64; if (this.clouds) { this.clouds.width = w + 64; this.clouds2.width = w + 64; } if (this.shafts) this.shafts.width = w + 64;
    if (this.sun) { this.sun.x = w * this.sunPos[0]; this.sun.y = h * this.sunPos[1]; this.sun.scale.set(Math.max(0.5, h / 400)); }
  }
  update(camX, camY, t) {
    const vh = this.viewH; const yBase = camY * 0.08;
    for (const l of this.layers) { l.ts.tilePosition.x = -camX * l.factor; l.ts.y = vh - l.h + l.yOff + 20 - yBase * l.factor * 2; l.ts.x = -32; }
    if (this.clouds) { this.clouds.tilePosition.x = -camX * 0.05 - t * 6; this.clouds.y = 0 - yBase * 0.2; this.clouds2.tilePosition.x = -camX * 0.1 - t * 11; this.clouds2.y = 30 - yBase * 0.3; }
    if (this.stars) { this.stars.tilePosition.x = -camX * 0.02; this.stars.y = -yBase * 0.1; }
    if (this.sun) { this.sun.x = this.viewW * this.sunPos[0] - camX * 0.01; this.sun.y = this.viewH * this.sunPos[1] - yBase * 0.15; }
    if (this.fog) { this.fog.tilePosition.x = -camX * 0.5 + t * 3; this.fog.alpha = 0.55 + Math.sin(t * 0.3) * 0.1; }
    if (this.shafts) { this.shafts.tilePosition.x = -camX * 0.35 + Math.sin(t * 0.2) * 20; this.shafts.y = -yBase * 0.3; }
  }
}
