// Grafo de cena compartilhado pelos modos HD e retrô: tiles (com culling por coluna), decoração,
// entidades (views sincronizadas com interpolação), partículas e HUD.
import { Container, Sprite, Graphics } from 'pixi.js';
import { TILE, T, isSolidType } from '../world/tilemap.js';
import { BitmapLine } from './text.js';

const ANIM_TILES = new Set([T.WATER_TOP, T.LAVA]);

export class Scene {
  constructor(bank, particles) {
    this.bank = bank; this.particles = particles;
    this.root = new Container(); this.bg = new Container(); this.world = new Container();
    this.tileLayer = new Container(); this.decorLayer = new Container(); this.backLayer = new Container(); this.midLayer = new Container(); this.frontLayer = new Container();
    this.shadowLayer = new Container(); this.fxLayer = particles.container; this.hud = new Container(); this.overlay = new Container();
    this.world.addChild(this.decorLayer, this.tileLayer, this.shadowLayer, this.backLayer, this.midLayer, this.frontLayer, this.fxLayer);
    this.root.addChild(this.bg, this.world, this.hud, this.overlay);
    this.views = new Map(); this.level = null; this.tileSprites = null; this.columns = []; this.animTiles = []; this.animT = 0; this.mapVersion = -1;
    this.textViews = new Map(); this.decorSprites = [];
    this.flashG = new Graphics(); this.overlay.addChild(this.flashG); this.retro = true;
  }
  setLevel(level) {
    this.level = level; this.clearLevel(); const map = level.map; this.theme = level.theme;
    this.tileSprites = new Array(map.w * map.h).fill(null); this.columns = Array.from({ length: map.w }, () => []);
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) { this._makeTile(x, y); const d = map.decor[y * map.w + x]; if (d) this._makeDecor(x, y, d); }
    this.mapVersion = map.version;
  }
  clearLevel() {
    this.tileLayer.removeChildren(); this.decorLayer.removeChildren(); this.backLayer.removeChildren(); this.midLayer.removeChildren(); this.frontLayer.removeChildren(); this.shadowLayer.removeChildren();
    this.views.clear(); this.textViews.clear(); this.animTiles.length = 0; this.decorSprites.length = 0; this.particles.clear();
  }
  _makeTile(x, y) {
    const map = this.level.map; const i = y * map.w + x; const t = map.tiles[i];
    let s = this.tileSprites[i];
    if (t === T.EMPTY || t === T.HIDDEN || t === T.WALL) { if (s) { s.visible = false; } return; }
    if (!s) { s = new Sprite(); s.x = x * TILE; s.y = y * TILE; this.tileLayer.addChild(s); this.tileSprites[i] = s; this.columns[x].push(s); s.tileInfo = { x, y, type: 0, mask: 0, alt: false }; }
    s.visible = true; s.tileInfo.type = t; s.tileInfo.mask = isSolidType(t) ? map.exposure(x, y) : 0; s.tileInfo.alt = t === T.SOLID_ALT || t === T.ICE;
    this._applyTileTexture(s);
    if (ANIM_TILES.has(t)) { if (!this.animTiles.includes(s)) this.animTiles.push(s); }
  }
  _applyTileTexture(s, frame = 0) {
    const ti = s.tileInfo; const variant = (ti.x * 7 + ti.y * 13) % 3; s.texture = this.bank.tile(this.theme, ti.type, ti.mask, ti.alt, frame, variant); s.scale.set(this.bank.invScale);
    s.normalTexture = this.bank.tileNormal(this.theme, ti.type, ti.mask, ti.alt, frame, variant); s.diffuseTexture = s.texture;
  }
  _makeDecor(x, y, name) {
    const s = new Sprite(this.bank.decor(this.theme, name)); s.x = x * TILE; s.y = y * TILE; s.scale.set(this.bank.invScale); s.decorName = name; s.anchor.set(0, 0); s.tileY = y; s.tileX = x;
    s.normalTexture = this.bank.decorNormal(this.theme, name); s.diffuseTexture = s.texture; this.decorLayer.addChild(s); this.decorSprites.push(s); this.columns[x].push(s);
  }
  /** Reaplica texturas após troca de modo. */
  refreshMode() {
    if (!this.level) return;
    for (const s of this.tileSprites) if (s) this._applyTileTexture(s, 0);
    for (const s of this.decorSprites) { s.anchor.set(0, 0); s.y = s.tileY * TILE; s.skew.x = 0; s.__anch = false; s.texture = this.bank.decor(this.theme, s.decorName); s.normalTexture = this.bank.decorNormal(this.theme, s.decorName); s.diffuseTexture = s.texture; s.scale.set(this.bank.invScale); }
    for (const v of this.views.values()) v.frameKey = null;
  }
  _updateChangedTiles() {
    const map = this.level.map; if (map.version === this.mapVersion) return;
    const ch = map.changed;
    for (let i = 0; i < ch.length; i += 2) { const x = ch[i], y = ch[i + 1]; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (map.inBounds(x + dx, y + dy)) this._makeTile(x + dx, y + dy); }
    ch.length = 0; this.mapVersion = map.version;
  }
  /** Sincroniza sprites com o estado do jogo. alpha: interpolação; retro: arredonda posições. */
  sync(level, alpha, retro, dt) {
    this.retro = retro; this.level = level; this._updateChangedTiles();
    this.animT += dt; const af = Math.floor(this.animT * 2.5) % 2;
    if (af !== this._lastAf) { this._lastAf = af; for (const s of this.animTiles) this._applyTileTexture(s, af); }
    // culling por coluna
    const cam = level.camera; const cx = cam.renderX(alpha), cy = cam.renderY(alpha);
    const c0 = Math.max(0, Math.floor(cx / TILE) - 1), c1 = Math.min(level.map.w - 1, Math.ceil((cx + cam.viewW / cam.zoom) / TILE) + 1);
    if (c0 !== this._c0 || c1 !== this._c1) {
      for (let x = 0; x < this.columns.length; x++) { const vis = x >= c0 && x <= c1; for (const s of this.columns[x]) s.renderable = vis; }
      this._c0 = c0; this._c1 = c1;
    }
    // entidades
    const seen = this._seen || (this._seen = new Set()); seen.clear();
    for (const e of level.entities) {
      if (e.type === 'text') { this._syncText(e, alpha, retro); seen.add(e.id); continue; }
      let v = this.views.get(e.id);
      if (!v) { v = this._makeView(e); this.views.set(e.id, v); }
      seen.add(e.id); this._syncView(v, e, alpha, retro);
    }
    for (const [id, v] of this.views) if (!seen.has(id)) { v.sprite.destroy(); if (v.shadow) v.shadow.destroy(); this.views.delete(id); }
    for (const [id, v] of this.textViews) if (!seen.has(id)) { v.destroy(); this.textViews.delete(id); }
    this.particles.render(alpha, retro);
    // câmera → transformação do mundo
    const z = cam.zoom; let wx = -cx * z, wy = -cy * z; if (retro) { wx = Math.round(wx); wy = Math.round(wy); }
    this.world.scale.set(z); this.world.x = wx; this.world.y = wy; this.camX = cx; this.camY = cy;
  }
  _makeView(e) {
    const s = new Sprite(); s.anchor.set(0.5, 1); const layer = e.layer === 'back' ? this.backLayer : e.layer === 'front' ? this.frontLayer : this.midLayer; layer.addChild(s);
    let shadow = null;
    if (e.shadow) { shadow = new Sprite(this.particles.tex.soft); shadow.anchor.set(0.5); shadow.tint = 0x000000; shadow.alpha = 0.3; this.shadowLayer.addChild(shadow); }
    return { sprite: s, shadow, frameKey: null, art: null };
  }
  _syncView(v, e, alpha, retro) {
    const s = v.sprite; const bank = this.bank;
    const key = e.art + '|' + e.frame;
    if (key !== v.frameKey) { v.frameKey = key; s.texture = bank.sprite(e.art, e.frame); s.normalTexture = bank.normal(e.art, e.frame); s.diffuseTexture = s.texture; const sz = bank.spriteSize(e.art); v.w = sz.w; v.h = sz.h; }
    let x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha;
    // âncora do sprite: base central do hitbox + offset da arte
    const ax = x + e.w / 2 + (e.ox + v.w / 2) - (e.ox !== undefined ? 0 : 0);
    let sx = x + e.w / 2, sy = y + e.h; // base central do hitbox
    // ox/oy posicionam o canto superior esquerdo da arte relativo ao hitbox: converter para base central
    sx = x + e.ox + v.w / 2; sy = y + e.oy + v.h;
    if (retro) { sx = Math.round(sx); sy = Math.round(sy); }
    s.x = sx; s.y = sy; s.rotation = e.rotation; s.alpha = e.alpha;
    const inv = bank.invScale; s.scale.set((e.flip ? -1 : 1) * inv * e.scaleX, inv * e.scaleY);
    s.visible = e.visible && !(e.invuln > 0 && e.state !== 'dead' && Math.floor(e.invuln * 16) % 2 === 1);
    if (e.hitFlash > 0) s.tint = 0xffffff; // (tint branco = sem efeito; flash real via filtro no HD)
    s.tint = e.hitFlash > 0 ? 0xff8080 : 0xffffff; s.entity = e;
    // movimento secundário no HD: inclinação com a velocidade e leve "arrasto" do cabelo/roupa ao mudar de direção
    if (!retro && e.type === 'hero') { const lean = e.onGround && e.state === 'normal' ? -e.vx * 0.0012 * (e.flip ? -1 : 1) : 0; v.lean = v.lean === undefined ? 0 : v.lean + (lean - v.lean) * 0.2; s.skew.x = v.lean * (e.flip ? -1 : 1); } else s.skew.x = 0;
    if (v.shadow) {
      const sh = v.shadow; sh.visible = s.visible && !retro;
      if (sh.visible) { // sombra no chão abaixo da entidade
        const map = this.level.map; let gy = y + e.h; let found = false;
        for (let k = 0; k < 8; k++) { const ty = Math.floor((y + e.h + k * TILE) / TILE); if (isSolidType(map.get(Math.floor((x + e.w / 2) / TILE), ty)) || map.get(Math.floor((x + e.w / 2) / TILE), ty) === T.PLATFORM) { gy = ty * TILE; found = true; break; } }
        const dist = Math.max(0, gy - (y + e.h)); const f = found ? Math.max(0.25, 1 - dist / 90) : 0;
        sh.x = x + e.w / 2; sh.y = gy; sh.scale.set((e.w / 16) * 1.1 * f + 0.3, 0.32 * f + 0.08); sh.alpha = 0.32 * f;
      }
    }
  }
  _syncText(e, alpha, retro) {
    let v = this.textViews.get(e.id);
    if (!v) { v = new BitmapLine(e.text, { tint: 0xffff55, shadow: true, align: 'center' }); this.frontLayer.addChild(v); this.textViews.set(e.id, v); }
    let x = e.px + (e.x - e.px) * alpha, y = e.py + (e.y - e.py) * alpha; if (retro) { x = Math.round(x); y = Math.round(y); }
    v.x = x; v.y = y - 8; v.alpha = e.life < 0.3 ? e.life / 0.3 : 1;
  }
}
