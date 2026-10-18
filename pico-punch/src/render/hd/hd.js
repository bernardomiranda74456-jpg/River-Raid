// Renderizador HD: passes (fundo+mundo difuso → RT; normais do mundo → RT; iluminação; bloom;
// grading; CRT opcional) e HUD por cima sem iluminação. Também coleta luzes e aplica folhagem/vento.
import { Container, Sprite, RenderTexture } from 'pixi.js';
import { HDArt } from '../hdart.js';
import { LightingFilter, LIGHT_PRESETS } from './lighting.js';
import { BloomFilter, GradeFilter, GRADE_PRESETS, CrtFilter } from './postfx.js';
import { HDParallax } from './parallax-hd.js';
import { RETRO_H } from '../retro/retro.js';
import { TILE } from '../../world/tilemap.js';

const FOLIAGE = new Set(['bush', 'flower', 'tuft', 'seaweed0', 'seaweed1', 'cactus', 'mushroom']);
const DECOR_LIGHTS = { torchWall: { r: 1, g: 0.65, b: 0.3, radius: 70, intensity: 1.1, flicker: 0.25, dy: 4 }, crystal: { r: 0.8, g: 0.6, b: 1, radius: 60, intensity: 0.8, flicker: 0.08, dy: 8 }, window: { r: 1, g: 0.85, b: 0.5, radius: 40, intensity: 0.5, flicker: 0, dy: 6 }, mushroom: { r: 1, g: 0.5, b: 0.5, radius: 24, intensity: 0.25, flicker: 0.05, dy: 8 } };

export class HDRenderer {
  constructor(game) {
    this.game = game; this.app = game.app; this.hdArt = new HDArt(); game.bank.hd = this.hdArt;
    this.lighting = new LightingFilter(); this.bloom = new BloomFilter(); this.grade = new GradeFilter(); this.crt = new CrtFilter();
    this.worldRoot = new Container(); this.hudRoot = new Container(); this.stage = new Container();
    this.litSprite = new Sprite(); this.stage.addChild(this.litSprite, this.hudRoot);
    this.lights = []; this.time = 0; this.aberr = 0; this.lastShake = 0; this.resize();
  }
  resize() {
    const r = this.app.renderer; const w = r.width, h = r.height; // lógicas (CSS)
    if (this.rtDiffuse) { this.rtDiffuse.destroy(true); this.rtNormal.destroy(true); }
    this.rtDiffuse = RenderTexture.create({ width: w, height: h, resolution: r.resolution, antialias: false, scaleMode: 'linear' });
    this.rtNormal = RenderTexture.create({ width: w, height: h, resolution: r.resolution, antialias: false, scaleMode: 'linear' });
    this.litSprite.texture = this.rtDiffuse; this.litSprite.width = w; this.litSprite.height = h; this.lighting.setNormal(this.rtNormal);
    this.lighting.u.uScreen[0] = w; this.lighting.u.uScreen[1] = h; // uInputSize do Pixi é lógico this.cssW = w; this.cssH = h; this.crt.resize(w * r.resolution, h * r.resolution); this.crt.setLines(RETRO_H);
    this.updateFilters();
  }
  updateFilters() {
    const s = this.game.save.settings; const f = [this.lighting]; if (!s.reduceFx) f.push(this.bloom); f.push(this.grade);
    this.litSprite.filters = f; this.stage.filters = s.crtHD ? [this.crt] : null; this.lighting.u.uQuality = s.reduceFx ? 0 : 1;
  }
  makeParallax(theme, viewW, viewH, time) { return new HDParallax(theme, viewW, viewH, this.timeFor(theme, time)); }
  timeFor(theme, time) { if (theme === 'cave') return 'cave'; if (theme === 'city') return 'city'; if (theme === 'castle') return 'castle'; if (theme === 'lake' && time === 'underwater') return 'underwater'; return time || 'day'; }
  /** Troca de textura para o passe de normais. */
  _swap(scene, toNormal) {
    const walk = (c) => { for (const s of c.children) { if (s.children && s.children.length && !s.texture) { walk(s); continue; } if (s.normalTexture) { s.texture = toNormal ? s.normalTexture : s.diffuseTexture; } else if (toNormal && s.texture && !s.isBitmapLine) { s.__wasVisible = s.visible; s.visible = false; } else if (!toNormal && s.__wasVisible !== undefined) { s.visible = s.__wasVisible; s.__wasVisible = undefined; } } };
    walk(scene.tileLayer); walk(scene.decorLayer); walk(scene.backLayer); walk(scene.midLayer); walk(scene.frontLayer);
    scene.shadowLayer.visible = !toNormal; scene.fxLayer.visible = !toNormal;
    for (const v of scene.textViews.values()) v.visible = !toNormal;
  }
  collectLights(scene, level) {
    const L = this.lights; if (!this.lightPool) { this.lightPool = []; for (let i = 0; i < 16; i++) this.lightPool.push({ x: 0, y: 0, radius: 0, intensity: 0, r: 1, g: 1, b: 1 }); }
    let n = 0; const take = (x, y, radius, intensity, r, g, b) => { if (n >= 16) return; const o = this.lightPool[n++]; o.x = x; o.y = y; o.radius = radius; o.intensity = intensity; o.r = r; o.g = g; o.b = b; };
    const cam = level.camera; const x0 = scene.camX - 100, x1 = scene.camX + cam.viewW / cam.zoom + 100, y0 = scene.camY - 100, y1 = scene.camY + cam.viewH / cam.zoom + 100; const t = this.time;
    const h = level.hero; if (h.fist.active) take(h.fist.x + h.fist.w / 2, h.fist.y + h.fist.h / 2, 40, 0.6, 1, 0.95, 0.8);
    for (const e of level.entities) { if (!e.light || !e.visible) continue; if (e.cx < x0 || e.cx > x1 || e.cy < y0 || e.cy > y1) continue; const l = e.light; const fl = l.flicker ? 1 + Math.sin(t * 23 + e.id) * l.flicker : 1; take(e.cx, e.cy, l.radius, l.intensity * fl, l.r, l.g, l.b); if (n >= 12) break; }
    for (const s of scene.decorSprites) { const d = DECOR_LIGHTS[s.decorName]; if (!d || !s.renderable) continue; const x = s.x + 8, y = s.tileY * TILE + d.dy; if (x < x0 || x > x1 || y < y0 || y > y1) continue; const fl = 1 + Math.sin(t * 19 + s.x) * d.flicker; take(x, y, d.radius, d.intensity * fl, d.r, d.g, d.b); if (n >= 14) break; }
    // lava: agrupa tiles de lava visíveis em até 2 luzes largas
    const map = level.map; const tx0 = Math.max(0, Math.floor(x0 / TILE)), tx1 = Math.min(map.w - 1, Math.ceil(x1 / TILE)), ty0 = Math.max(0, Math.floor(y0 / TILE)), ty1 = Math.min(map.h - 1, Math.ceil(y1 / TILE));
    let lx = 0, ly = 0, lc = 0; for (let ty = ty0; ty <= ty1; ty += 2) for (let tx = tx0; tx <= tx1; tx += 2) if (map.get(tx, ty) === 14) { lx += tx; ly += ty; lc++; }
    if (lc > 0 && n < 16) take((lx / lc) * TILE + 8, (ly / lc) * TILE, 120 + Math.min(120, lc * 6), 0.8 + Math.sin(t * 5) * 0.1, 1, 0.45, 0.1);
    L.length = 0; for (let i = 0; i < n; i++) L.push(this.lightPool[i]);
    this.lighting.setLights(L);
  }
  foliage(scene, level, dt) {
    const h = level.hero; const t = this.time;
    for (const s of scene.decorSprites) { if (!FOLIAGE.has(s.decorName) || !s.renderable) continue; const wind = Math.sin(t * 1.7 + s.x * 0.05) * 0.06 + Math.sin(t * 3.1 + s.x * 0.11) * 0.03; let bend = 0; const dx = h.cx - (s.x + 8); if (Math.abs(dx) < 14 && h.bottom > s.y && h.y < s.y + 16) bend = -Math.sign(dx || 1) * 0.25 * (1 - Math.abs(dx) / 14); if (!s.__anch) { s.__anch = true; s.anchor.set(0, 1); s.y = (s.tileY + 1) * TILE; } s.skew.x = wind + bend; }
  }
  render(scene, alpha, dt) {
    const g = this.game; const r = this.app.renderer; const level = g.level; this.time += dt;
    if (!level) { // título/menus: fundo parallax + camadas de UI, sem iluminação
      const hs = g.hdScale; this.worldRoot.scale.set(hs); if (scene.bg.parent !== this.worldRoot) this.worldRoot.addChild(scene.bg, scene.world); scene.bg.visible = true; scene.world.visible = false;
      r.render({ container: this.worldRoot, target: this.rtDiffuse, clear: true, clearColor: [0, 0, 0, 1] }); scene.world.visible = true;
      this.litSprite.filters = [this.grade]; this.grade.setPreset(GRADE_PRESETS.sunset); this.grade.u.uAberr = 0; this.grade.u.uFlash = 0; this.grade.u.uUnderwater = 0;
      this.hudRoot.removeChildren(); this.hudRoot.addChild(scene.hud, scene.overlay, g.menuLayer); this.hudRoot.scale.set(hs); r.render({ container: this.stage }); this.updateFilters(); return; }
    const hs = g.hdScale; this.worldRoot.scale.set(hs); if (scene.bg.parent !== this.worldRoot) this.worldRoot.addChild(scene.bg, scene.world);
    this.foliage(scene, level, dt);
    // uniformes de câmera e preset de luz
    const cam = level.camera; const u = this.lighting.u; u.uCam[0] = scene.camX; u.uCam[1] = scene.camY; u.uScalePx = hs * cam.zoom; u.uTime = this.time;
    const tkey = this.timeFor(level.theme, level.json.time); const lp = this.debugLight || LIGHT_PRESETS[tkey] || LIGHT_PRESETS.day; u.uAmbient.set(lp.ambient); u.uSunDir.set(lp.sunDir); u.uSunColor.set(lp.sun); u.uShadow = lp.shadow; u.uBgTint.set(lp.bg); u.uWaterTint.set(lp.water);
    this.lighting.updateTileInfo(level.map); this.collectLights(scene, level);
    const gp = GRADE_PRESETS[level.theme === 'desert' ? 'desert' : tkey] || GRADE_PRESETS.day; this.grade.setPreset(gp); const gu = this.grade.u; gu.uTime = this.time;
    // aberração cromática em impactos (decai)
    if (cam.shakeT > 0 && cam.shakeA > this.lastShake) this.aberr = Math.min(1, cam.shakeA * 0.5); this.lastShake = cam.shakeT > 0 ? cam.shakeA : 0; this.aberr = Math.max(0, this.aberr - dt * 4); gu.uAberr = this.aberr; gu.uFlash = level.flashA * 0.6;
    gu.uUnderwater = level.hero.inWater && level.hero.state === 'swim' ? 1 : 0;
    // passe 1: difuso (fundo + mundo)
    scene.bg.visible = true; r.render({ container: this.worldRoot, target: this.rtDiffuse, clear: true, clearColor: [0, 0, 0, 1] });
    // passe 2: normais (só o mundo)
    scene.bg.visible = false; this._swap(scene, true); r.render({ container: this.worldRoot, target: this.rtNormal, clear: true, clearColor: [0.5, 0.5, 0, 0] }); this._swap(scene, false); scene.bg.visible = true;
    // passe 3: iluminação + pós (filtros no sprite) + HUD
    this.hudRoot.removeChildren(); this.hudRoot.addChild(scene.hud, scene.overlay, g.menuLayer); this.hudRoot.scale.set(hs);
    r.render({ container: this.stage });
  }
  /** Devolve os containers ao grafo retrô. */
  detach(scene) { if (scene.bg.parent === this.worldRoot) { scene.root.addChildAt(scene.bg, 0); scene.root.addChildAt(scene.world, 1); } if (scene.hud.parent === this.hudRoot) { scene.root.addChild(scene.hud, scene.overlay, this.game.menuLayer); } }
}
