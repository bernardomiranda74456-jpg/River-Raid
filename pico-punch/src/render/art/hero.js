// PICO — herói original. Sprite 24×24 (âncora: base central). Composto por partes para animar.
// Letras: paleta de sprites (SPRITE_PAL). Virado para a direita; a esquerda usa flip.
import { compose } from '../pixelart.js';

// Cabeça 12×10 — cabelo laranja espetado, bandana verde, olhos grandes.
const HEAD = {
  normal: [
    '...o.oo.o...',
    '..oooooooo..',
    '.oooooooooo.',
    '.gggggggggg.',
    'gssssssssssg',
    '.sskssskss..',
    '.sskwsskws..',
    '.ssssssssss.',
    '..ssssskss..',
    '...ssssss...',
  ],
  blink: [
    '...o.oo.o...',
    '..oooooooo..',
    '.oooooooooo.',
    '.gggggggggg.',
    'gssssssssssg',
    '.sssssssss..',
    '.sskkssskk..',
    '.ssssssssss.',
    '..ssssskss..',
    '...ssssss...',
  ],
  hurt: [
    '...o.oo.o...',
    '..oooooooo..',
    '.oooooooooo.',
    '.gggggggggg.',
    'gssssssssssg',
    '.skskssksk..',
    '.ssksssskss.',
    '.ssssssssss.',
    '..sskkkkss..',
    '...ssssss...',
  ],
  open: [ // boca aberta (comendo / grito)
    '...o.oo.o...',
    '..oooooooo..',
    '.oooooooooo.',
    '.gggggggggg.',
    'gssssssssssg',
    '.sskssskss..',
    '.sskwsskws..',
    '.sssskkksss.',
    '..sskmmmks..',
    '...sskkks...',
  ],
  full: [ // bochechas cheias
    '...o.oo.o...',
    '..oooooooo..',
    '.oooooooooo.',
    '.gggggggggg.',
    'gssssssssssg',
    'ssskssskssss',
    'ssskwsskwsss',
    'ssssssssssss',
    '.sssssksssss',
    '..ssssssss..',
  ],
  happy: [
    '...o.oo.o...',
    '..oooooooo..',
    '.oooooooooo.',
    '.gggggggggg.',
    'gssssssssssg',
    '.sskssskss..',
    '.sssssssss..',
    '.ssskssskss.',
    '..sssskkss..',
    '...ssssss...',
  ],
};
// Tronco 10×7: camisa branca com faixa laranja; sem braços (as luvas são peças separadas).
const TORSO = [
  '.wwwwwwww.',
  'wwwwoooowww',
  'wwwooooowww',
  'wwwwwwwwww',
  '.wwwwwwww.',
  '.bbbbbbbb.',
  '.bbbbbbbb.',
].map((r) => r.slice(0, 10));
// Luva 6×6 — punho gigante amarelo com contorno.
const FIST = ['.kkkk.', 'kyyyyk', 'kyyyyk', 'kyyykk', 'kyyyyk', '.kkkk.'];
const FIST_OPEN = ['.kkkk.', 'kyyyyk', 'kykyyk', 'kyyyyk', 'kykyyk', '.kkkk.'];
// Pernas 10×7 (shorts azuis já no tronco). Pernas de pele e botas marrons.
const LEGS = {
  stand: ['..ss..ss..', '..ss..ss..', '..ss..ss..', '.ddd..ddd.', '.dddd.dddd', '.kkkk.kkkk', '..........'],
  walk0: ['..ss..ss..', '.ss....ss.', '.ss....ss.', 'ddd....ddd', 'dddd..dddd', 'kkkk..kkkk', '..........'],
  walk1: ['..ssss....', '..ssss....', '..ss.ss...', '..dd.ddd..', '.ddd.dddd.', '.kkk.kkkk.', '..........'],
  walk2: ['..ss..ss..', '..ss..ss..', '..ss..ss..', '.ddd..ddd.', '.dddd.dddd', '.kkkk.kkkk', '..........'],
  walk3: ['...ssss...', '....ss....', '...ss.s...', '..ddd.dd..', '.dddd.ddd.', '.kkkk.kkk.', '..........'],
  jump: ['..ss..ss..', '.ss....ss.', 'ddd....ddd', 'dddd..dddd', 'kkkk..kkkk', '..........', '..........'],
  fall: ['..ss..ss..', '..ss..ss..', '.ss....ss.', '.ddd..ddd.', 'dddd..dddd', 'kkkk..kkkk', '..........'],
  crouch: ['.ddd..ddd.', 'dddd..dddd', 'kkkk..kkkk', '..........', '..........', '..........', '..........'],
  climb0: ['..ss..ss..', '.ss....ss.', '.ss....ss.', 'ddd....ddd', 'dddd..dddd', 'kkkk..kkkk', '..........'],
  swim0: ['..ss..ss..', '..ss...ss.', '..dd....dd', '..ddd..ddd', '..kkk..kkk', '..........', '..........'],
  swim1: ['..ss..ss..', '..ss.ss...', '..dd.dd...', '..ddd.ddd.', '..kkk.kkk.', '..........', '..........'],
  dead: ['..ss..ss..', '.ss....ss.', 'ddd....ddd', 'dddd..dddd', 'kkkk..kkkk', '..........', '..........'],
};
const PASTEL = ['.yyyy.', 'yooooy', 'yooooy', '.yyyy.']; // lanche: pastel dourado

const W = 24, H = 24;
// Posições base: cabeça em (6,0), tronco em (7,10), pernas em (7,17). Luvas ao lado do tronco.
function frame({ head = 'normal', legs = 'stand', dy = 0, headDx = 0, headDy = 0, fists = 'idle', extra = [] }) {
  const parts = [];
  parts.push({ rows: LEGS[legs], x: 7, y: 17 + dy });
  parts.push({ rows: TORSO, x: 7, y: 10 + dy });
  const headPart = { rows: HEAD[head], x: 6 + headDx, y: 0 + dy + headDy };
  const raised = fists === 'up' || fists === 'punchUp' || fists === 'climb0' || fists === 'climb1';
  if (!raised) parts.push(headPart);
  const fl = { rows: FIST, x: 3, y: 12 + dy }, fr = { rows: FIST, x: 15, y: 12 + dy };
  switch (fists) {
    case 'idle': parts.push(fl, fr); break;
    case 'run': parts.push({ rows: FIST, x: 2, y: 11 + dy }, { rows: FIST, x: 16, y: 13 + dy }); break;
    case 'run2': parts.push({ rows: FIST, x: 4, y: 13 + dy }, { rows: FIST, x: 14, y: 11 + dy }); break;
    case 'anticipate': parts.push({ rows: FIST, x: 1, y: 11 + dy }, { rows: FIST, x: 12, y: 10 + dy }); break; // punho puxado
    case 'punch': parts.push({ rows: FIST, x: 5, y: 12 + dy }, { rows: FIST, x: 18, y: 10 + dy }); break; // estendido
    case 'punchUp': parts.push({ rows: FIST, x: 3, y: 12 + dy }, { rows: FIST, x: 11, y: -2 + dy }); break;
    case 'punchDown': parts.push({ rows: FIST, x: 3, y: 10 + dy }, { rows: FIST, x: 11, y: 19 + dy }); break;
    case 'up': parts.push({ rows: FIST_OPEN, x: 3, y: 2 + dy }, { rows: FIST_OPEN, x: 15, y: 2 + dy }); break;
    case 'climb0': parts.push({ rows: FIST_OPEN, x: 4, y: 2 + dy }, { rows: FIST_OPEN, x: 14, y: 8 + dy }); break;
    case 'climb1': parts.push({ rows: FIST_OPEN, x: 4, y: 8 + dy }, { rows: FIST_OPEN, x: 14, y: 2 + dy }); break;
    case 'swim0': parts.push({ rows: FIST_OPEN, x: 2, y: 9 + dy }, { rows: FIST_OPEN, x: 17, y: 7 + dy }); break;
    case 'swim1': parts.push({ rows: FIST_OPEN, x: 3, y: 13 + dy }, { rows: FIST_OPEN, x: 16, y: 12 + dy }); break;
    case 'none': break;
  }
  if (raised) parts.push(headPart);
  for (const e of extra) parts.push(e);
  return compose(W, H, parts);
}

export const HERO_FRAMES = {
  idle0: frame({}),
  idle1: frame({ head: 'blink' }),
  idle2: frame({ dy: 0, headDy: 1 }), // respiração
  walk0: frame({ legs: 'walk0', fists: 'run' }),
  walk1: frame({ legs: 'walk1', fists: 'idle', dy: -1 }),
  walk2: frame({ legs: 'walk2', fists: 'run2' }),
  walk3: frame({ legs: 'walk3', fists: 'idle', dy: -1 }),
  jump: frame({ legs: 'jump', fists: 'up', dy: 1 }),
  fall: frame({ legs: 'fall', fists: 'run' }),
  punch0: frame({ fists: 'anticipate', headDx: -1 }),
  punch1: frame({ fists: 'punch', headDx: 1 }),
  punchUp: frame({ fists: 'punchUp', legs: 'stand' }),
  punchDown: frame({ fists: 'punchDown', legs: 'jump', dy: -2 }),
  crouch: frame({ legs: 'crouch', dy: 4, fists: 'idle' }),
  crouchPunch: frame({ legs: 'crouch', dy: 4, fists: 'punch' }),
  climb0: frame({ legs: 'climb0', fists: 'climb0' }),
  climb1: frame({ legs: 'walk1', fists: 'climb1' }),
  swim0: frame({ legs: 'swim0', fists: 'swim0', dy: 2 }),
  swim1: frame({ legs: 'swim1', fists: 'swim1', dy: 2 }),
  hurt: frame({ head: 'hurt', legs: 'fall', fists: 'up', dy: 1 }),
  dead: frame({ head: 'hurt', legs: 'dead', fists: 'up', dy: 2 }),
  eat0: frame({ head: 'open', fists: 'none', extra: [{ rows: FIST_OPEN, x: 3, y: 12 }, { rows: PASTEL, x: 15, y: 6 }, { rows: FIST_OPEN, x: 16, y: 8 }] }),
  eat1: frame({ head: 'full', fists: 'none', extra: [{ rows: FIST_OPEN, x: 3, y: 12 }, { rows: FIST_OPEN, x: 15, y: 12 }] }),
  eat2: frame({ head: 'happy', fists: 'idle' }),
  victory: frame({ head: 'happy', fists: 'up', legs: 'jump', dy: -1 }),
  ride: frame({ legs: 'crouch', dy: 4, fists: 'run' }),
};
export const HERO_W = W, HERO_H = H;
