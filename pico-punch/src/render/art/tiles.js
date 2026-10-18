// Kit de tiles 16×16 por tema. Letras: paleta de fundo do tema (TILE_PALS).
// Semântica das letras temáticas: R preenchimento, q escuro, Q realce, g/G superfície (grama/areia),
// d/D terra sob a superfície, s céu, c acento, b água. Reservadas: k w y o m r.
import { compose, recolor } from '../pixelart.js';

// ----- Preenchimentos internos (rocha/terra/tijolo) ----------------------------------------
const FILL = {
  rock: [
    'RRRRRRRqRRRRRRRR', 'RRQRRRRqRRRRQRRR', 'RRRRRRRRqRRRRRRR', 'qqRRRRRRRqRRRRqq',
    'RRqqRRRRRRRRRqRR', 'RRRRqRRRQRRRRRRR', 'RRRRRqqRRRRRRRRR', 'RRRRRRRRRqqqRRRR',
    'RQRRRRRRRRRRqRRR', 'RRRRRRRRRRRRRqRR', 'RRRRqRRRRRRRRRRR', 'RRRqRRRRRRQRRRRR',
    'RRqRRRRRqqRRRRRR', 'RRRRRRRqRRRqqRRR', 'RRRRRRRRRRRRRRqR', 'RqqRRRRRRRRRRRRR',
  ],
  dirt: [
    'dddddddDdddddddd', 'ddDdddddddddDddd', 'dddddddddddddddd', 'ddddDddddddddddd',
    'dddddddddDDddddd', 'dDdddddddddddddd', 'ddddddDddddddDdd', 'dddddddddddddddd',
    'ddDddddddddddddd', 'dddddddDdddddddd', 'dddddddddddddDdd', 'dddDdddddddddddd',
    'ddddddddddDddddd', 'dDdddddddddddddd', 'ddddddDddddddddd', 'dddddddddddDdddd',
  ],
  brick: [
    'RRRRRRRqRRRRRRRq', 'RQRRRRRqRQRRRRRq', 'RRRRRRRqRRRRRRRq', 'qqqqqqqqqqqqqqqq',
    'RRRqRRRRRRRqRRRR', 'RRRqRQRRRRRqRQRR', 'RRRqRRRRRRRqRRRR', 'qqqqqqqqqqqqqqqq',
    'RRRRRRRqRRRRRRRq', 'RQRRRRRqRQRRRRRq', 'RRRRRRRqRRRRRRRq', 'qqqqqqqqqqqqqqqq',
    'RRRqRRRRRRRqRRRR', 'RRRqRQRRRRRqRQRR', 'RRRqRRRRRRRqRRRR', 'qqqqqqqqqqqqqqqq',
  ],
  sand: [
    'dddddddddddddddd', 'ddddDddddddddDdd', 'dddddddddddddddd', 'dDdddddddDdddddd',
    'dddddddddddddddd', 'dddddddDdddddddd', 'ddddDddddddddddd', 'dddddddddddddDdd',
    'dddddddddddddddd', 'ddDdddddddDddddd', 'dddddddddddddddd', 'dddddddDdddddddd',
    'ddddDddddddddddd', 'dddddddddddddDdd', 'dDdddddddddddddd', 'dddddddddDdddddd',
  ],
  metal: [
    'QRRRRRRRRRRRRRRq', 'RRRRRRRRRRRRRRRq', 'RRqRRRRRRRRRRqRq', 'RRRRRRRRRRRRRRRq',
    'RRRRRRRRRRRRRRRq', 'RRRRRRRRRRRRRRRq', 'RRRRRRRRRRRRRRRq', 'qqqqqqqqqqqqqqqq',
    'QRRRRRRRRRRRRRRq', 'RRRRRRRRRRRRRRRq', 'RRqRRRRRRRRRRqRq', 'RRRRRRRRRRRRRRRq',
    'RRRRRRRRRRRRRRRq', 'RRRRRRRRRRRRRRRq', 'RRRRRRRRRRRRRRRq', 'qqqqqqqqqqqqqqqq',
  ],
};
// Superfície (topo exposto): grama / areia / neve / telhado etc. (5 linhas)
const TOP = {
  grass: ['.g.gg..g.gg.g.g.', 'gggggggggggggggg', 'gGggggGgggggGggg', 'GGGGgGGGGGgGGGGG', 'dDdddDddddDddddD'],
  snow:  ['.w.ww..w.ww.w.w.', 'wwwwwwwwwwwwwwww', 'wwwwcwwwwwwcwwww', 'cccccccccccccccc', 'RqRRRRqRRRRRqRRR'],
  sand:  ['..d..dd...d..d..', 'dddddddddddddddd', 'ddDdddddDddddDdd', 'dddddddddddddddd', 'DdddDddddDdddDdd'],
  stone: ['QQQQQQQQQQQQQQQQ', 'RRRRRRRRRRRRRRRR', 'RqRRRqRRRRqRRRqR', 'RRRRRRRRRRRRRRRR', 'qqqqqqqqqqqqqqqq'],
  moss:  ['.g..g.g..g..g.g.', 'gGgggGggggGgggGg', 'GGGGGGGGGGGGGGGG', 'RqRRRRqRRRRRqRRR', 'RRRRRRRRRRRRRRRR'],
  ember: ['.r..rr...r..r.r.', 'rrrrrrrrrrrrrrrr', 'qrqqrqqqrqqqqrqq', 'qqqqqqqqqqqqqqqq', 'RqRRRRqRRRRRqRRR'],
  pave:  ['QQQQQQQQQQQQQQQQ', 'RRRRRRRQRRRRRRRQ', 'RRRRRRRqRRRRRRRq', 'qqqqqqqqqqqqqqqq', 'RRRqRRRRRRRqRRRR'],
};

/** Tema → receita de solo */
export const THEME_GROUND = {
  mountain: { fill: 'rock', top: 'grass', high: 'snow' },
  forest: { fill: 'dirt', top: 'grass' },
  lake: { fill: 'rock', top: 'moss' },
  village: { fill: 'brick', top: 'pave' },
  desert: { fill: 'sand', top: 'sand' },
  road: { fill: 'rock', top: 'pave' },
  sky: { fill: 'rock', top: 'grass' },
  cave: { fill: 'rock', top: 'ember' },
  city: { fill: 'metal', top: 'pave' },
  castle: { fill: 'brick', top: 'stone' },
};

/**
 * Gera o tile de solo para um tema dado o bitmask de exposição (1 cima, 2 direita, 4 baixo, 8 esquerda).
 * `alt` troca a superfície (ex.: neve nas alturas da montanha).
 */
export function groundTile(theme, mask, alt = false) {
  const rec = THEME_GROUND[theme] || THEME_GROUND.mountain;
  let rows = FILL[rec.fill].slice();
  if (mask & 1) { const top = TOP[alt && rec.high ? rec.high : rec.top]; rows = compose(16, 16, [{ rows, x: 0, y: 0 }, { rows: top, x: 0, y: 0 }]); }
  const grid = rows.map((r) => r.split(''));
  if (mask & 8) for (let y = 0; y < 16; y++) { grid[y][0] = 'q'; if (y % 3 === 1) grid[y][1] = 'q'; }
  if (mask & 2) for (let y = 0; y < 16; y++) { grid[y][15] = 'q'; if (y % 3 === 2) grid[y][14] = 'q'; }
  if (mask & 4) for (let x = 0; x < 16; x++) { grid[15][x] = 'q'; if (x % 4 === 2) grid[14][x] = 'q'; }
  if ((mask & 1) && (mask & 8)) grid[0][0] = '.'; // cantos arredondados no topo
  if ((mask & 1) && (mask & 2)) grid[0][15] = '.';
  return grid.map((r) => r.join(''));
}

// ----- Tiles fixos -------------------------------------------------------------------------
export const TILE_ART = {
  platform: [ // plataforma de mão única (tábuas)
    'mmmmmmmmmmmmmmmm', 'yooooooooooooooy', 'mooooomoooooomoo', 'mmmmmmmmmmmmmmmm',
    '..kk........kk..', '..kk........kk..', '..kk........kk..', '..kk........kk..',
    '................', '................', '................', '................',
    '................', '................', '................', '................',
  ],
  starBlock: [
    'kkkkkkkkkkkkkkkk', 'kyyyyyyyyyyyyyyk', 'kyywyyyyyyyyyyok', 'kywyyyyykyyyyyok',
    'kyyyyyykkkyyyyok', 'kyyyykkkkkkkyyok', 'kyyyyykkkkkyyyok', 'kyyyyykkkkkyyyok',
    'kyyyyykkykkyyyok', 'kyyyyykk.kkyyyok', 'kyyyyyyyyyyyyyok', 'kyyyyyyyyyyyyyok',
    'kyoooooooooooook', 'kyoooooooooooook', 'koooooooooooooook', 'kkkkkkkkkkkkkkkk',
  ].map((r) => r.replace(/\./g, 'y')),
  qBlock: [
    'kkkkkkkkkkkkkkkk', 'kwwwwwwwwwwwwwwk', 'kwccccccccccccwk', 'kwcccckkkkccccwk',
    'kwccckkcckkcccwk', 'kwccckkcckkcccwk', 'kwccccccckkcccwk', 'kwcccccckkccccwk',
    'kwccccckkcccccwk', 'kwccccckkcccccwk', 'kwccccccccccccwk', 'kwccccckkcccccwk',
    'kwccccckkcccccwk', 'kwccccccccccccwk', 'kwwwwwwwwwwwwwwk', 'kkkkkkkkkkkkkkkk',
  ],
  usedBlock: [
    'kkkkkkkkkkkkkkkk', 'kmmmmmmmmmmmmmmk', 'kmddddddddddddmk', 'kmdmdddddddddmdk',
    'kmddddddddddddmk', 'kmddddddddddddmk', 'kmdddmddddmdddmk', 'kmdddmddddmdddmk',
    'kmddddddddddddmk', 'kmddddddddddddmk', 'kmdddmmmmmmdddmk', 'kmddddddddddddmk',
    'kmdmdddddddddmdk', 'kmddddddddddddmk', 'kmmmmmmmmmmmmmmk', 'kkkkkkkkkkkkkkkk',
  ],
  rockBlock: [ // pedra que só veículo quebra
    '....kkkkkkkk....', '..kkRRRRRRRRkk..', '.kRRQQRRRRRRRRk.', 'kRRQQRRRRRRRRRRk',
    'kRQQRRRRRRRRqRRk', 'kRRRRRRRRRRRqqRk', 'kRRRRRqRRRRRRqRk', 'kRRRRqqRRRRRRRRk',
    'kRRRRRqRRRRRRRRk', 'kRRRRRRRRRqRRRRk', 'kqRRRRRRRRqqRRRk', 'kqqRRRRRRRRqRRqk',
    'kqqqRRRRRRRRRqqk', '.kqqqRRRRRRqqqk.', '..kkqqqqqqqqkk..', '....kkkkkkkk....',
  ],
  ladder: [
    '..mm........mm..', '..mm........mm..', '..mmmmmmmmmmmm..', '..mmoooooooomm..',
    '..mm........mm..', '..mm........mm..', '..mm........mm..', '..mmmmmmmmmmmm..',
    '..mmoooooooomm..', '..mm........mm..', '..mm........mm..', '..mm........mm..',
    '..mmmmmmmmmmmm..', '..mmoooooooomm..', '..mm........mm..', '..mm........mm..',
  ],
  vine: [
    '....gG......g...', '...gGg.....gGg..', '....G.......G...', '....G..gG...G...',
    '....G.gGg...G...', '....G..G....G...', '..gG.G.G....G...', '.gGg.G.G...gGg..',
    '..G..G.G....G...', '..G..G.G....G...', '..G..G.G.gG.G...', '..G..G.GgGg.G...',
    '..G..G.G.G..G...', '..G..G.G.G..G...', '..G..G.G.G..G...', '..G..G.G.G..G...',
  ],
  spike: [
    '................', '................', '................', '................',
    '.......w........', '.......w........', '...w..wQw..w....', '...w..wQw..w....',
    '..wQw.wQw.wQw...', '..wQw.wQwwwQw...', '.wwQwwwQwwwQww..', '.wwQwwwQwwwQww..',
    'wwwQwwwQwwwQwww.', 'kkkkkkkkkkkkkkkk', 'kqqqqqqqqqqqqqqk', 'kkkkkkkkkkkkkkkk',
  ],
  waterTop0: ['................', '................', '....ww......w...', 'bbbbbbwwbbbbbbww', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb'],
  waterTop1: ['................', '................', '.w......ww......', 'wwbbbbbbbbwwbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb', 'bbbbbbbbbbbbbbbb'],
  water: Array(16).fill('bbbbbbbbbbbbbbbb'),
  lava0: ['rrrrrrrrrrrrrrrr', 'rrryrrrrrrryrrrr', 'rryoyrrrrryoyrrr', 'rrryrrrrrrryrrrr', 'rrrrrrrooorrrrrr', 'rrrrrrroyorrrrrr', 'rrrrrrrooorrrrrr', 'rrrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr', 'rrroorrrrrrrrrrr', 'rroyyorrrrrrrrrr', 'rrroorrrrrrroorr', 'rrrrrrrrrrrroyor', 'rrrrrrrrrrrrorrr', 'rrrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr'],
  lava1: ['rrrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr', 'rrrrrrrooorrrrrr', 'rrrrrrroyorrrrrr', 'rrryrrrooorrrrrr', 'rryoyrrrrrrryrrr', 'rrryrrrrrrryoyrr', 'rrrrrrrrrrrryrrr', 'rrrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr', 'rrroorrrrrrroorr', 'rroyyorrrrrroyor', 'rrroorrrrrrrorrr', 'rrrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr', 'rrrrrrrrrrrrrrrr'],
  bridge: ['mmmmmmmmmmmmmmmm', 'mooooooooooooooo', 'mmmmmmmmmmmmmmmm', 'k...k...k...k...', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................'],
  // decorações
  bush: ['................', '................', '......gggg......', '....ggGgggGg....', '...gGgggggggg...', '..ggggGggggGgg..', '..gGggggggggggg.', '.ggggggGgggGggg.', '.gGgggGgggggggg.', '..ggggggGgggGg..', '..GGgGGGGgGGGG..', '...GGGGGGGGGG...', '................', '................', '................', '................'],
  flower: ['................', '................', '................', '................', '......r.........', '.....rwr........', '......r..y......', '......G.ywy.....', '......G..y......', '.....GG..G......', '..r...G..G......', '.rwr..G.GG......', '..r..GG.G.......', '..G..G..G.......', '..GGGG..G.......', '................'],
  tuft: ['................', '................', '................', '................', '................', '................', '................', '................', '................', '......g.........', '..g...g..g......', '..g..gg..g.g....', '.gg..gg.gg.g....', '.ggg.ggggg.gg...', '.ggg.ggggggg....', '................'],
  pebble: ['................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '................', '......QRR.......', '.....QRRRq......', '....RRRRqq.k....', '....qqqqqq.k....', '................'],
  mushroom: ['................', '................', '................', '................', '................', '................', '.....rrrr.......', '....rwrrwr......', '...rrrrrrrr.....', '...rwrrrrwr.....', '...kkkkkkkk.....', '.....wwww.......', '.....wwww.......', '.....wwww.......', '....wwwwww......', '................'],
  crystal: ['................', '................', '.......c........', '......ccc.......', '......cwc.......', '.....ccwcc......', '.....cccwc......', '....ccccwcc.....', '....ccccccc.....', '...cccccccc.c...', '...ccccccccccc..', '..cccccccccccc..', '..cccccccccccc..', '.kkkkkkkkkkkkkk.', '................', '................'],
  skull: ['................', '................', '................', '................', '................', '......wwww......', '.....wwwwww.....', '.....wkwwkw.....', '.....wwwwww.....', '......wkkw......', '......wwww......', '......w.w.......', '................', '................', '................', '................'],
  window: ['................', 'kkkkkkkkkkkkkkkk', 'kyyyyyykkyyyyyyk', 'kyyyyyykkyyyyyyk', 'kyyyywykkyyyyyyk', 'kyyyyyykkyyyyyyk', 'kkkkkkkkkkkkkkkk', 'kyyyyyykkyyyyyyk', 'kyyyyyykkyyyyyyk', 'kyyyyyykkyyyyyyk', 'kyyyyyykkyyyyyyk', 'kkkkkkkkkkkkkkkk', '................', '................', '................', '................'],
  windowDark: ['................', 'kkkkkkkkkkkkkkkk', 'kqqqqqqkkqqqqqqk', 'kqqqqqqkkqqqqqqk', 'kqqqqqqkkqqqqqqk', 'kqqqqqqkkqqqqqqk', 'kkkkkkkkkkkkkkkk', 'kqqqqqqkkqqqqqqk', 'kqqqqqqkkqqqqqqk', 'kqqqqqqkkqqqqqqk', 'kqqqqqqkkqqqqqqk', 'kkkkkkkkkkkkkkkk', '................', '................', '................', '................'],
  cactus: ['................', '......gg........', '.....gGgg.......', '.....gGgg.......', '.....gGgg.......', '.gg..gGgg..gg...', 'gGgg.gGgg.gGgg..', 'gGgg.gGgg.gGgg..', 'gGgggGGgggGgg...', '.gGgggGgggGg....', '..gGgGGggGg.....', '.....gGgg.......', '.....gGgg.......', '.....gGgg.......', '.....gGgg.......', '.....gGgg.......'],
  torchWall: ['................', '................', '.......y........', '......yoy.......', '.....yooor......', '.....rooor......', '......rrr.......', '......mmm.......', '......mmm.......', '......mmm.......', '......mmm.......', '.....kmmmk......', '.....kkkkk......', '................', '................', '................'],
  banner: ['kkkkkkkkkkkkkkkk', 'krrrrrrrrrrrrrrk', 'krrrrrrrrrrrrrrk', 'krrryyyyyyyyrrrk', 'krrryrrrrrryrrrk', 'krrryrryyrryrrrk', 'krrryrryyrryrrrk', 'krrryrrrrrryrrrk', 'krrryyyyyyyyrrrk', 'krrrrrrrrrrrrrrk', '.krrrrrrrrrrrrk.', '..krrrrrrrrrrk..', '...krrrrrrrrk...', '....krrrrrrk....', '.....krrrrk.....', '......kkkk......'],
  pillar: ['QQQQQQQQQQQQQQQQ', 'qRRRRRRRRRRRRRRq', '..qRRRRRRRRRRq..', '..qRQRRRRRRQRq..', '..qRQRRRRRRQRq..', '..qRQRRRRRRQRq..', '..qRQRRRRRRQRq..', '..qRQRRRRRRQRq..', '..qRQRRRRRRQRq..', '..qRQRRRRRRQRq..', '..qRQRRRRRRQRq..', '..qRQRRRRRRQRq..', '..qRQRRRRRRQRq..', '..qRRRRRRRRRRq..', 'qRRRRRRRRRRRRRRq', 'QQQQQQQQQQQQQQQQ'],
  fence: ['................', '................', '................', '................', '.mm..........mm.', '.mm..........mm.', 'mmmmmmmmmmmmmmmm', '.mm..........mm.', '.mm..........mm.', '.mm..........mm.', 'mmmmmmmmmmmmmmmm', '.mm..........mm.', '.mm..........mm.', '.mm..........mm.', '.mm..........mm.', '................'],
  seaweed0: ['................', '................', '.....g..........', '....gG....g.....', '....gG...gG.....', '.....gG..gG.....', '.....gG.gG......', '....gG..gG......', '....gG...gG.....', '.....gG..gG.....', '.....gG..gG.....', '....gG..gG......', '....gG..gG......', '.....gG..gG.....', '.....gG..gG.....', '.....gG..gG.....'],
  seaweed1: ['................', '................', '......g.........', '.....gG..g......', '.....gG..gG.....', '....gG...gG.....', '....gG....gG....', '.....gG...gG....', '.....gG..gG.....', '....gG...gG.....', '....gG...gG.....', '.....gG..gG.....', '.....gG...gG....', '....gG....gG....', '....gG...gG.....', '.....gG..gG.....'],
  coral: ['................', '................', '................', '................', '................', '.......o........', '..r...oyo..r....', '.ror..oyo.ror...', '.ror...o..ror...', '..r.r..o...r....', '..rror.o..rr....', '...ror.o..rr....', '...rr..o.rr.....', '....rr.o.rr.....', '.....rrorr......', '......rrr.......'],
  gear: ['................', '................', '......kk........', '...kk.kk.kk.....', '...kkkRRkkk.....', '....kRQRRk......', '..kkRRkkRRkk....', '..kkRkqqkRkk....', '..kkRkqqkRkk....', '..kkRRkkRRkk....', '....kRRRRk......', '...kkkRRkkk.....', '...kk.kk.kk.....', '......kk........', '................', '................'],
  sign: ['................', '................', '................', '..mmmmmmmmmmmm..', '..myyyyyyyyyym..', '..mykykykykyym..', '..myyyyyyyyyym..', '..mykykykykyym..', '..myyyyyyyyyym..', '..mmmmmmmmmmmm..', '.......mm.......', '.......mm.......', '.......mm.......', '.......mm.......', '.......mm.......', '................'],
};
// Blocos escondidos revelados usam o mesmo visual de "usedBlock"; ponte usa platform.
export const TILE_NAMES = Object.keys(TILE_ART);
export { recolor };
