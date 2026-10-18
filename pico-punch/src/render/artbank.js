// Banco de texturas por modo. Retrô: atlases pixel art (nearest). HD: texturas procedurais 6× + normal maps.
import { Texture, Rectangle } from 'pixi.js';
import { PixelAtlas } from './pixelart.js';
import { SPRITE_PAL, TILE_PALS } from './palette.js';
import { HERO_FRAMES } from './art/hero.js';
import { ENEMY_ART, BOSS_ART } from './art/enemies.js';
import { ITEM_ART } from './art/items.js';
import { TILE_ART, groundTile } from './art/tiles.js';
import { T } from '../world/tilemap.js';

export const HD_SCALE = 6;

export class ArtBank {
  constructor() {
    this.mode = 'retro'; this.retro = { sprites: {}, tiles: {} }; this.hd = null; this.theme = 'mountain';
    this._buildRetroSprites();
  }
  _buildRetroSprites() {
    const S = this.retro.sprites;
    S.hero = new PixelAtlas(HERO_FRAMES, SPRITE_PAL);
    for (const k in ENEMY_ART) S[k] = new PixelAtlas(ENEMY_ART[k], SPRITE_PAL);
    for (const k in BOSS_ART) S[k] = new PixelAtlas(BOSS_ART[k], SPRITE_PAL);
    for (const k in ITEM_ART) S[k] = new PixelAtlas(ITEM_ART[k], SPRITE_PAL);
  }
  /** Garante os tiles do tema no modo retrô (gera sob demanda, com cache). */
  _retroTiles(theme) {
    if (this.retro.tiles[theme]) return this.retro.tiles[theme];
    const pal = TILE_PALS[theme] || TILE_PALS.mountain; const frames = {};
    for (let m = 0; m < 16; m++) { frames['g' + m] = groundTile(theme, m, false); frames['a' + m] = groundTile(theme, m, true); }
    for (const k in TILE_ART) frames[k] = TILE_ART[k];
    const atlas = new PixelAtlas(frames, pal); this.retro.tiles[theme] = atlas; return atlas;
  }
  get invScale() { return this.mode === 'retro' ? 1 : 1 / HD_SCALE; }
  /** Textura de um sprite (art, frame). */
  sprite(art, frame) {
    if (this.mode === 'hd' && this.hd) { const t = this.hd.sprite(art, frame); if (t) return t; }
    const a = this.retro.sprites[art]; return a ? a.texture(frame) : Texture.WHITE;
  }
  normal(art, frame) { return this.hd ? this.hd.normal(art, frame) : null; }
  spriteSize(art) { const a = this.retro.sprites[art]; return a ? { w: a.w, h: a.h } : { w: 16, h: 16 }; }
  /** Textura de um tile por tipo e máscara de autotile. */
  tile(theme, type, mask = 0, alt = false, animFrame = 0, variant = 0) {
    const key = this.tileKey(type, mask, alt, animFrame);
    if (this.mode === 'hd' && this.hd) { const t = this.hd.tile(theme, this.hdKey(key, variant)); if (t) return t; }
    return this._retroTiles(theme).texture(key);
  }
  hdKey(key, variant) { return variant && (key[0] === 'g' || key[0] === 'a') && key.length <= 3 ? key + 'v' + variant : key; }
  tileNormal(theme, type, mask, alt, animFrame, variant = 0) { return this.hd ? this.hd.tileNormal(theme, this.hdKey(this.tileKey(type, mask, alt, animFrame), variant)) : null; }
  tileKey(type, mask, alt, animFrame) {
    switch (type) {
      case T.SOLID: return 'g' + mask; case T.SOLID_ALT: return 'a' + mask; case T.ICE: return 'a' + mask;
      case T.PLATFORM: return 'platform'; case T.BRIDGE: return 'bridge'; case T.STAR: return 'starBlock'; case T.QBLOCK: return 'qBlock';
      case T.ROCK: return 'rockBlock'; case T.USED: return 'usedBlock'; case T.LADDER: return 'ladder'; case T.VINE: return 'vine';
      case T.SPIKE: return 'spike'; case T.WATER_TOP: return animFrame ? 'waterTop1' : 'waterTop0'; case T.WATER: return 'water';
      case T.LAVA: return animFrame ? 'lava1' : 'lava0'; default: return 'pebble';
    }
  }
  decor(theme, name) { if (this.mode === 'hd' && this.hd) { const t = this.hd.tile(theme, name); if (t) return t; } return this._retroTiles(theme).texture(name); }
  decorNormal(theme, name) { return this.hd ? this.hd.tileNormal(theme, name) : null; }
}
