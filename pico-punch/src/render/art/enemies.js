// Inimigos originais (16×16, 2+ frames, virados para a esquerda — flip para a direita).
export const ENEMY_ART = {
  // Saltão — criatura redonda azul que pula.
  hopper: {
    f0: ['......bbbb......', '....bbbbbbbb....', '...bbbbbbbbbb...', '..bbwkbbbbwkbb..', '..bbkkbbbbkkbb..', '.bbbbbbbbbbbbbb.', '.bbbBBBBBBBBbbb.', '.bbbbbbbbbbbbbb.', '..bbbbbbbbbbbb..', '..bbbkkkkkkbbb..', '...bbbbbbbbbb...', '....BB....BB....', '...BBB....BBB...', '..BBBB....BBBB..', '................', '................'],
    f1: ['................', '................', '......bbbb......', '....bbbbbbbb....', '...bbbbbbbbbb...', '..bbwkbbbbwkbb..', '..bbkkbbbbkkbb..', '.bbbbbbbbbbbbbb.', '.bbbBBBBBBBBbbb.', '.bbbbbbbbbbbbbb.', '..bbbbkkkkbbbb..', '...bbbbbbbbbb...', '..BBBBBBBBBBBB..', '.BBBB......BBBB.', '................', '................'],
  },
  // Gralha — ave roxa que mergulha.
  bird: {
    f0: ['................', '..pp............', '.pppp...........', 'ppwkppp.........', 'pkkpppppp.......', '.yypppppppppp...', '..yppppppppppppp', '....ppppppppppp.', '.....pppppppp...', '......pppp......', '.......pp.......', '................', '................', '................', '................', '................'],
    f1: ['................', '..pp............', '.pppp...........', 'ppwkppp.........', 'pkkpppppp.......', '.yypppppppp.....', '..ypppppppppp...', '....ppppppppppp.', '.....pppppppppp.', '......pppppppp..', '.......ppppp....', '........ppp.....', '.........p......', '................', '................', '................'],
  },
  // Rolão — pedra viva que rola ladeira abaixo.
  roller: {
    f0: ['.....aaaaaa.....', '...aaaaaaaaaa...', '..aaAaaaaaaaaa..', '.aaaaaaaaaaAaaa.', '.aaaaawkaaaaaaa.', 'aaaaaakkaaaaaaaa', 'aaAaaaaaaaaaAaaa', 'aaaaaaaaaaaaaaaa', 'aaaaaaaakkaaaaaa', 'aaaaaaakkkkaaaaa', '.aaAaaaaaaaaaaa.', '.aaaaaaaaaAaaaa.', '..aaaaaaaaaaaa..', '...aaaaaaaaaa...', '.....aaaaaa.....', '................'],
    f1: ['.....aaaaaa.....', '...aaaaaaaaaa...', '..aaaaaaaAaaaa..', '.aaAaaaaaaaaaaa.', '.aaaaaaaaaaaaaa.', 'aaaaaaaaaaaaAaaa', 'aaaaaaakkaaaaaaa', 'aaaAaaawkaaaaaaa', 'aaaaaaaaaaaaaaaa', 'aaaaaaaaaaAaaaaa', '.aaaaakkkkaaaaa.', '.aAaaaaaaaaaaaa.', '..aaaaaaaaaaaa..', '...aaaaaaaaaa...', '.....aaaaaa.....', '................'],
  },
  // Escorpião das dunas.
  scorpion: {
    f0: ['................', '................', '..........oo....', '.........oo.o...', '.........o..o...', '.........oo.....', '..oooooooooo....', '.owkooooooooo...', '.okkoooooooooo..', '..ooooooooooooo.', '.o..o..o..o..o..', 'o..o..o..o..o...', '................', '................', '................', '................'],
    f1: ['................', '..........oo....', '.........oo.o...', '.........o..o...', '.........oo.....', '.........oo.....', '..oooooooooo....', '.owkooooooooo...', '.okkoooooooooo..', '..ooooooooooooo.', '..o..o..o..o..o.', '.o..o..o..o..o..', '................', '................', '................', '................'],
  },
  // Morcego da caverna.
  bat: {
    f0: ['................', '................', '................', 'p.............p.', 'pp...........pp.', 'ppp..ppppp..ppp.', 'pppppprkrpppppp.', '.ppppprkrppppp..', '..ppppppppppp...', '....ppppppp.....', '......ppp.......', '......p.p.......', '................', '................', '................', '................'],
    f1: ['................', '................', '................', '................', '................', '.....ppppp......', '....pprkrpp.....', '..ppppprkrpppp..', 'pppppppppppppppp', 'pp...ppppp...pp.', 'p....ppppp....p.', '......p.p.......', '................', '................', '................', '................'],
  },
  // Peixe-dente.
  fish: {
    f0: ['................', '................', '................', '......gggg......', '....gggggggg....', '..wkggggggggg.G.', '.kkgggggggggGGG.', '.wwwwggggggggGG.', '..gggggggggggG..', '....gggggggg..G.', '......gggg......', '................', '................', '................', '................', '................'],
    f1: ['................', '................', '................', '......gggg......', '....gggggggg..G.', '..wkgggggggggGG.', '.kkgggggggggGGG.', '.wwwwggggggggG..', '..ggggggggggg...', '....gggggggg....', '......gggg..G...', '................', '................', '................', '................', '................'],
  },
  // Água-viva.
  jelly: {
    f0: ['................', '.....pppppp.....', '...pppppppppp...', '..pppwkppppwkp..', '..pppkkppppkkp..', '.pppppppppppppp.', '.pppppppppppppp.', '..pppppppppppp..', '...p.p..p..p.p..', '...p.p..p..p.p..', '..p..p..p..p..p.', '..p..p.p..p...p.', '.p..p..p..p...p.', '................', '................', '................'],
    f1: ['................', '................', '.....pppppp.....', '...pppppppppp...', '..pppwkppppwkp..', '..pppkkppppkkp..', '.pppppppppppppp.', '.pppppppppppppp.', '..pppppppppppp..', '...pp.pp.pp.pp..', '...p..p..p..p...', '..p..p..p..p....', '.p..p..p..p.....', '................', '................', '................'],
  },
  // Fantasma (surpresa ruim do bloco "?"), persegue o herói.
  ghost: {
    f0: ['.....wwwwww.....', '...wwwwwwwwww...', '..wwwwwwwwwwww..', '.wwwkkwwwwkkwww.', '.wwwkkwwwwkkwww.', '.wwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwww', 'wwwwwwkkkkwwwwww', 'wwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwww', 'ww.wwww.wwww.www', 'w...ww...ww...ww', '................', '................'],
    f1: ['................', '.....wwwwww.....', '...wwwwwwwwww...', '..wwwwwwwwwwww..', '.wwwkkwwwwkkwww.', '.wwwkkwwwwkkwww.', '.wwwwwwwwwwwwww.', 'wwwwwwwwwwwwwwww', 'wwwwwwkkkkwwwwww', 'wwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwww', 'wwwwwwwwwwwwwwww', 'www.wwww.wwww.ww', 'ww...ww...ww...w', '................', '................'],
  },
  // Guarda de armadura do castelo (com escudo na frente — só o soco por trás ou pulo).
  knight: {
    f0: ['.....aaaaaa.....', '....aaaaaaaa....', '....akkkkkka....', '....aaaaaaaa....', '...rraaaaaarr...', '..rrraaaaaarrr..', '.rrrraaaaaaaaaa.', '.rrrraaaaaaaaaa.', '.rrrraaaaaaaaaa.', '..rrraaaaaaaaa..', '...rraaaaaaaa...', '.....AA..AA.....', '.....AA..AA.....', '....AAA..AAA....', '................', '................'],
    f1: ['.....aaaaaa.....', '....aaaaaaaa....', '....akkkkkka....', '....aaaaaaaa....', '...rraaaaaarr...', '..rrraaaaaarrr..', '.rrrraaaaaaaaaa.', '.rrrraaaaaaaaaa.', '.rrrraaaaaaaaaa.', '..rrraaaaaaaaa..', '...rraaaaaaaa...', '....AA....AA....', '...AA......AA...', '..AAA......AAA..', '................', '................'],
  },
  // Abelhão.
  bee: {
    f0: ['................', '....ww..ww......', '...wwwwwwww.....', '....wwwwww......', '..yyyykkyyyyk...', '.ywkyykkyyyykk..', '.ykkyyykyyyyyk..', '.yyyykkyyyykk...', '..yyyykkyyyk....', '...kyyyyyyk.....', '....kkkkkk......', '................', '................', '................', '................', '................'],
    f1: ['................', '................', '....wwwwwww.....', '...wwwwwwwwww...', '..yyyykkyyyyk...', '.ywkyykkyyyykk..', '.ykkyyykyyyyyk..', '.yyyykkyyyykk...', '..yyyykkyyyk....', '...kyyyyyyk.....', '....kkkkkk......', '................', '................', '................', '................', '................'],
  },
  // Lesma de lava.
  slug: {
    f0: ['................', '................', '................', '................', '................', '...rr...........', '..rrrrr.........', '.rwkrrrrr.......', '.rkkrrrrrrrrrr..', '.rrrrrrrooorrrr.', '..rrrrroyyyorrr.', '..rrrrrroyorrrr.', '..rrrrrrrorrrrr.', '...rrrrrrrrrrr..', '....rrrrrrrrr...', '................'],
    f1: ['................', '................', '................', '................', '................', '................', '...rr...........', '..rrrrr.........', '.rwkrrrrrr......', '.rkkrrrrrrrrrrr.', '.rrrrrrrooorrrr.', '..rrrrroyyyorrr.', '..rrrrrroyorrrrr', '..rrrrrrrorrrrrr', '....rrrrrrrrrr..', '................'],
  },
  // Drone da cidade.
  drone: {
    f0: ['................', '..kk........kk..', '.kaak......kaak.', '..kk...kk...kk..', '..aaaaaaaaaaaa..', '.aaaaaaaaaaaaaa.', 'aaarkaaaaaaaaaaa', 'aaakkaaaaaaaaaaa', '.aaaaaaaaaaaaaa.', '..aaaaAAAAaaaa..', '...aaaaaaaaaa...', '.....AA..AA.....', '................', '................', '................', '................'],
    f1: ['................', '.kaak......kaak.', '..kk........kk..', '..kk...kk...kk..', '..aaaaaaaaaaaa..', '.aaaaaaaaaaaaaa.', 'aaarkaaaaaaaaaaa', 'aaakkaaaaaaaaaaa', '.aaaaaaaaaaaaaa.', '..aaaaAAAAaaaa..', '...aaaaaaaaaa...', '....AA....AA....', '................', '................', '................', '................'],
  },
  // Caranguejo da estrada.
  crab: {
    f0: ['................', '................', '................', '................', '.rr..........rr.', 'r..r........r..r', '.rrr..rrrr..rrr.', '..r..rrrrrr..r..', '..r.rrwkkwrr.r..', '..rrrrkkkkrrrr..', '...rrrrrrrrrr...', '..r.r.rrrr.r.r..', '.r..r......r..r.', '................', '................', '................'],
    f1: ['................', '................', '................', '................', 'rr............rr', 'r..r........r..r', '.rrr..rrrr..rrr.', '..r..rrrrrr..r..', '..r.rrwkkwrr.r..', '..rrrrkkkkrrrr..', '...rrrrrrrrrr...', '...r.r.rr.r.r...', '..r..r....r..r..', '................', '................', '................'],
  },
};

// Chefes (32×32) — formas grandes com 2 frames.
export const BOSS_ART = {
  // Rã-Rei Bufo — sapo gigante com coroa.
  frogking: {
    f0: [
      '..........y....y....y...........', '..........yy..yyy..yy...........', '..........yyyyyyyyyyy...........', '..........yyyyyyyyyyy...........',
      '........gggggggggggggggg........', '......gggggggggggggggggggg......', '.....ggggwwkgggggggggwwkggg.....', '....gggggwkkggggggggwkkgggg.....',
      '....gggggwwwggggggggwwwggggg....', '...ggggggggggggggggggggggggg....', '...ggggggggggggggggggggggggg....', '...gggGGGGGGGGGGGGGGGGGGGggg....',
      '...gggGrrrrrrrrrrrrrrrrrGggg....', '...ggggGGGGGGGGGGGGGGGGGgggg....', '...gggggggggggggggggggggggggg...', '..gggggggggggggggggggggggggggg..',
      '..ggggggggggggggggggggggggggggg.', '..ggggggGGGGGGGGGGGGGGGGggggggg.', '..gggggGyyyyyyyyyyyyyyyyGgggggg.', '..gggggGyyyyyyyyyyyyyyyyGgggggg.',
      '..gggggGyyyyyyyyyyyyyyyyGgggggg.', '..gggggGyyyyyyyyyyyyyyyyGgggggg.', '..ggggggGGGGGGGGGGGGGGGGggggggg.', '..ggggggggggggggggggggggggggggg.',
      '.gggggggggggggggggggggggggggggg.', '.ggGGgggggggggggggggggggggggGGg.', 'gGGGGGggggggggggggggggggggGGGGGg', 'GGGGGGGgggggggggggggggggggGGGGGG',
      'GGGG.GGGgggggggggggggggggGGG.GGG', 'GGG...GGG.ggggggggggggg.GGG...GG', 'GG.....GG...............GG.....G', '................................',
    ],
    f1: null, // gerado em código (deslocamento)
  },
  // Escorpião Dunar.
  dunescorp: {
    f0: [
      '..................oooo..........', '.................oo..oo.........', '.................o....oo........', '.................o.....o........',
      '..................o..ooo........', '..................oo............', '...................oo...........', '...................oo...........',
      '....................oo..........', '....................oo..........', '....ooooooooooooooooooooo.......', '...ooooooooooooooooooooooo......',
      '..oooooooooooooooooooooooooo....', '.owwkooooooooooooooooooooooooo..', '.owkkoooooooooooooooooooooooooo.', '.okkkooooooooooooooooooooooooooo',
      '..oooooooooooooooooooooooooooooo', '..ooooooooooooooooooooooooooooo.', '...ooooooooooooooooooooooooooo..', '....ooooooooooooooooooooooooo...',
      '....o...o...o...o...o...o...o...', '...oo..oo..oo..oo..oo..oo..oo...', '...o...o...o...o...o...o...o....', '..oo..oo..oo..oo..oo..oo..oo....',
      '..o...o...o...o...o...o...o.....', '................................', '................................', '................................',
      '................................', '................................', '................................', '................................',
    ],
    f1: null,
  },
  // Morcegão Brasa.
  firebat: {
    f0: [
      '................................', '................................', 'p..............................p', 'pp............................pp',
      'ppp..........................ppp', 'pppp........................pppp', 'ppppp......................ppppp', 'pppppp....pppppppp........pppppp',
      'ppppppp..pppppppppppp....ppppppp', 'pppppppppppppppppppppppppppppppp', 'pppppppppppryrppppppryrppppppppp', 'ppppppppppprrrppppppprrrpppppppp',
      '.pppppppppppppppppppppppppppppp.', '..ppppppppppppppppppppppppppppp.', '...ppppppppppppppppppppppppppp..', '....pppppppppwwwwwwwwppppppppp..',
      '.....pppppppwkwwwwkwwpppppppp...', '......ppppppwwwwwwwwwppppppp....', '.......pppppppppppppppppppp.....', '........pppppppppppppppppp......',
      '..........pppppppppppppp........', '............pppp..pppp..........', '.............pp....pp...........', '................................',
      '................................', '................................', '................................', '................................',
      '................................', '................................', '................................', '................................',
    ],
    f1: null,
  },
  // Vizir Kazmar — chefe final: manto roxo, turbante, mãos enormes de pedra.
  vizier: {
    f0: [
      '............pppppppp............', '..........pppppppppppp..........', '.........ppppyyyypppppp.........', '.........pppyyrryyppppp.........',
      '..........ppyyrryyppppp.........', '...........ppyyyyppppp..........', '............ssssssss............', '...........sssssssssss..........',
      '...........swkssssswks..........', '...........skkssssskks..........', '...........ssssssssssss.........', '............ssskkkksss..........',
      '.............sssssss............', '..........pppppppppppppp........', '.........pppppppppppppppp.......', '........pppppppppppppppppp......',
      '.......ppppppppppppppppppp......', '......ppppppppppppppppppppp.....', '.....aaaaaappppppppppppaaaaaa...', '....aaaaaaaapppppppppppaaaaaaaa.',
      '....aaAaaaaapppppppppppaaaaAaaa.', '....aaaaaaaapppppppppppaaaaaaaa.', '....aaaaaaaapppppppppppaaaaaaaa.', '.....aaaaaappppppppppppaaaaaa...',
      '.......ppppppppppppppppppp......', '.......ppppppppppppppppppp......', '.......ppppppppppppppppppp......', '......ppppppppppppppppppppp.....',
      '......ppppppppppppppppppppp.....', '.....ppppppppppppppppppppppp....', '.....pppppppppppppppppppppp.....', '................................',
    ],
    f1: null,
  },
};
// Frames alternativos dos chefes: deslocam a matriz 1px para baixo (respiração) — gerado aqui.
for (const k in BOSS_ART) {
  const b = BOSS_ART[k];
  if (!b.f1) b.f1 = ['.'.repeat(32), ...b.f0.slice(0, 31)];
}
