// Tilemap: carrega JSON com camadas ASCII desenhadas à mão e expõe consultas de colisão.
export const TILE = 16;
export const T = {
  EMPTY: 0, SOLID: 1, SOLID_ALT: 2, PLATFORM: 3, STAR: 4, QBLOCK: 5, ROCK: 6, HIDDEN: 7, USED: 8,
  LADDER: 9, VINE: 10, SPIKE: 11, WATER_TOP: 12, WATER: 13, LAVA: 14, BRIDGE: 15, WALL: 16, ICE: 17,
};
/** Caractere do mapa → tipo de tile. */
export const MAP_LEGEND = {
  '.': T.EMPTY, ' ': T.EMPTY, '#': T.SOLID, '%': T.SOLID_ALT, '=': T.PLATFORM, 'S': T.STAR, '?': T.QBLOCK,
  'R': T.ROCK, 'H': T.HIDDEN, 'U': T.USED, '|': T.LADDER, 'V': T.VINE, '^': T.SPIKE, '~': T.WATER_TOP,
  'w': T.WATER, 'L': T.LAVA, 'b': T.BRIDGE, 'X': T.WALL, 'I': T.ICE,
};
/** Caractere do mapa → entidade (coordenadas em tiles; âncora: canto inferior esquerdo do tile). */
export const ENTITY_LEGEND = {
  P: 'spawn', E: 'flag', C: 'checkpoint', D: 'shop', '$': 'moneybag', '&': 'bigbag', '*': 'heart',
  h: 'hopper', v: 'bird', o: 'roller', c: 'scorpion', t: 'bat', f: 'fish', j: 'jelly', g: 'ghost',
  n: 'knight', e: 'bee', u: 'slug', r: 'drone', a: 'crab', B: 'boss', M: 'moto', K: 'heli', O: 'boat', G: 'gate',
};
export const DECOR_LEGEND = {
  b: 'bush', f: 'flower', t: 'tuft', p: 'pebble', m: 'mushroom', c: 'crystal', s: 'skull', w: 'window', W: 'windowDark',
  k: 'cactus', T: 'torchWall', n: 'banner', i: 'pillar', F: 'fence', a: 'seaweed0', A: 'seaweed1', o: 'coral', g: 'gear', S: 'sign',
};

export const isSolidType = (t) => t === T.SOLID || t === T.SOLID_ALT || t === T.STAR || t === T.QBLOCK || t === T.ROCK || t === T.USED || t === T.WALL || t === T.ICE;
export const isOneWayType = (t) => t === T.PLATFORM || t === T.BRIDGE;
export const isClimbType = (t) => t === T.LADDER || t === T.VINE;
export const isWaterType = (t) => t === T.WATER || t === T.WATER_TOP;
export const isBreakableType = (t) => t === T.STAR || t === T.QBLOCK || t === T.HIDDEN;
export const isHazardType = (t) => t === T.SPIKE || t === T.LAVA;

export class Tilemap {
  constructor(json) {
    this.json = json;
    const rows = json.map;
    this.h = rows.length; this.w = Math.max(...rows.map((r) => r.length));
    this.tiles = new Uint8Array(this.w * this.h);
    this.decor = new Array(this.w * this.h).fill(null);
    this.entities = [];
    this.spawn = { x: 1, y: this.h - 2 };
    for (let y = 0; y < this.h; y++) {
      const row = rows[y];
      for (let x = 0; x < this.w; x++) {
        const ch = row[x] ?? '.';
        if (ch in MAP_LEGEND) this.tiles[y * this.w + x] = MAP_LEGEND[ch];
        else if (ch in ENTITY_LEGEND) {
          const type = ENTITY_LEGEND[ch];
          if (type === 'spawn') this.spawn = { x, y }; else this.entities.push({ type, x, y });
        }
      }
    }
    if (json.decor) for (let y = 0; y < Math.min(json.decor.length, this.h); y++) {
      const row = json.decor[y];
      for (let x = 0; x < Math.min(row.length, this.w); x++) { const ch = row[x]; if (ch in DECOR_LEGEND) this.decor[y * this.w + x] = DECOR_LEGEND[ch]; }
    }
    for (const e of json.entities || []) this.entities.push({ ...e });
    this.pixelW = this.w * TILE; this.pixelH = this.h * TILE;
    this.version = 0; // incrementa quando um tile muda (para o renderer atualizar)
    this.changed = [];
  }
  inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h; }
  get(tx, ty) { if (tx < 0 || tx >= this.w) return T.WALL; if (ty < 0) return T.EMPTY; if (ty >= this.h) return T.EMPTY; return this.tiles[ty * this.w + tx]; }
  set(tx, ty, t) { if (!this.inBounds(tx, ty)) return; this.tiles[ty * this.w + tx] = t; this.version++; this.changed.push(tx, ty); }
  getAt(px, py) { return this.get(Math.floor(px / TILE), Math.floor(py / TILE)); }
  isSolid(tx, ty) { return isSolidType(this.get(tx, ty)); }
  /** Bitmask de exposição para autotiling: 1 cima, 2 direita, 4 baixo, 8 esquerda. */
  exposure(tx, ty) {
    let m = 0;
    if (!this.isSolid(tx, ty - 1) && ty - 1 >= 0) m |= 1;
    if (!this.isSolid(tx + 1, ty)) m |= 2;
    if (!this.isSolid(tx, ty + 1) && ty + 1 < this.h) m |= 4;
    if (!this.isSolid(tx - 1, ty)) m |= 8;
    return m;
  }
  /** Itera tiles em um retângulo de mundo (px). cb(tx, ty, type) — retorna true para interromper. */
  forRect(x, y, w, h, cb) {
    const x0 = Math.floor(x / TILE), y0 = Math.floor(y / TILE), x1 = Math.floor((x + w - 0.001) / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { if (cb(tx, ty, this.get(tx, ty))) return true; }
    return false;
  }
  anyInRect(x, y, w, h, pred) { return this.forRect(x, y, w, h, (tx, ty, t) => pred(t, tx, ty)); }
}

export async function loadLevel(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar fase: ${url}`);
  return res.json();
}
