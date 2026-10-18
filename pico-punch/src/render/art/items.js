// Itens, blocos-entidade e objetos (16×16 salvo indicação). Paleta de sprites.
export const ITEM_ART = {
  moneybag: {
    f0: ['................', '......kk........', '.....kyyk.......', '....kyyyyk......', '...kkkyykkk.....', '...kyyyyyyyk....', '..kyyyyyyyyyk...', '..kyyykkkyyyk...', '..kyykykykyyk...', '..kyyykkkyyyk...', '..kyyyykyyyyk...', '..kyyykkkyyyk...', '...kyyykyyyk....', '...kkyyyyykk....', '.....kkkkk......', '................'],
    f1: ['................', '................', '......kk........', '.....kyyk.......', '....kyyyyk......', '...kkkyykkk.....', '...kyyyyyyyk....', '..kyyyyyyyyyk...', '..kyyykkkyyyk...', '..kyykykykyyk...', '..kyyykkkyyyk...', '..kyyyykyyyyk...', '..kyyykkkyyyk...', '...kkyyyyykk....', '.....kkkkk......', '................'],
  },
  bigbag: { // saco grande (vale mais)
    f0: ['......kkk.......', '.....kwwwk......', '....kwwwwwk.....', '...kkkkwkkkk....', '..kwwwwwwwwwk...', '.kwwwwwwwwwwwk..', '.kwwwwkkkkwwwk..', 'kwwwwkwkwkwwwwk.', 'kwwwwkkkkkwwwwk.', 'kwwwwwwkwwwwwwk.', 'kwwwwwkkkwwwwwk.', 'kwwwwkwkwkwwwwk.', '.kwwwwkkkwwwwk..', '.kwwwwwwwwwwwk..', '..kkkkkkkkkkk...', '................'],
  },
  heart: {
    f0: ['................', '................', '................', '...kkk....kkk...', '..krrrk..krrrk..', '.krwrrrkkrrrrrk.', '.krrrrrrrrrrrrk.', '.krrrrrrrrrrrrk.', '..krrrrrrrrrrk..', '...krrrrrrrrk...', '....krrrrrrk....', '.....krrrrk.....', '......krrk......', '.......kk.......', '................', '................'],
  },
  pastel: { // o lanche de fim de fase
    f0: ['................', '................', '................', '.........kkk....', '.......kkyyyk...', '.....kkyyyoyyk..', '...kkyyyoyyyyk..', '.kkyyyoyyyyyyk..', 'kyyyyyyyyyyyyk..', 'kyyyoyyyyyyykk..', '.kyyyyyyyykk....', '..kyyyyykk......', '...kyykk........', '....kk..........', '................', '................'],
  },
  star: { f0: ['................', '.......k........', '......kyk.......', '......kyk.......', '.....kyyyk......', '.kkkkkyyykkkkk..', '.kyyyyyyyyyyyk..', '..kyyyyyyyyyk...', '...kyyyyyyyk....', '....kyyyyyk.....', '....kyyyyyk.....', '...kyykkkyyk....', '...kykk.kkyk....', '...kk.....kk....', '................', '................'] },
  bracelet: { f0: ['................', '................', '....kkkkkkk.....', '...kyyyyyyyk....', '..kykkkkkkkyk...', '..kyk.....kyk...', '..kyk..b..kyk...', '..kyk.bwb.kyk...', '..kyk..b..kyk...', '..kyk.....kyk...', '..kykkkkkkkyk...', '...kyyyyyyyk....', '....kkkkkkk.....', '................', '................', '................'] },
  cape: { f0: ['................', '....kkkkkkk.....', '...krrrrrrrk....', '..krrrrrrrrrk...', '..krrrrrrrrrk...', '..krrrrrrrrrrk..', '..krrrrrrrrrrk..', '.krrrrrrrrrrrk..', '.krrrrrrrrrrrrk.', '.krrrrrrrrrrrrk.', 'krrrrrrrrrrrrrk.', 'krrrrrrrrrrrrrrk', 'krrrrrrrrrrrrrrk', 'kkkkkkkkkkkkkkkk', '................', '................'] },
  capsule: { f0: ['................', '................', '......kkkk......', '.....kbbbbk.....', '....kbbwbbbk....', '....kbwbbbbk....', '....kbbbbbbk....', '....kkkkkkkk....', '....kyyyyyyk....', '....kyyyyyyk....', '....kyyyyyyk....', '.....kyyyyk.....', '......kkkk......', '................', '................', '................'] },
  ghostbuddy: { f0: ['................', '.....wwwwww.....', '...wwwwwwwwww...', '..wwwkwwwwkwww..', '..wwwkwwwwkwww..', '.wwwwwwwwwwwwww.', '.wwwwwwwkkwwwww.', '.wwwwwwwwwwwwww.', '.wwwwwwwwwwwwww.', '..ww.wwww.www...', '................', '................', '................', '................', '................', '................'] },
  eye: { f0: ['................', '................', '................', '......kkkk......', '....kkwwwwkk....', '...kwwwkkwwwk...', '..kwwwkbbkwwwk..', '..kwwkbkbbkwwk..', '..kwwkbbbbkwwk..', '...kwwwkkwwwk...', '....kkwwwwkk....', '......kkkk......', '................', '................', '................', '................'] },
  moto: { f0: ['................', '................', '.......rrr......', '......rrrrr..k..', '......rrrrrkkk..', '.....rrrrrrkk...', '....rrrrrrrrr...', '...kkkrrrrrkkk..', '..kAAkkkkkkkAAk.', '.kAaaAkkkkkAaaAk', '.kAaaAkkkkkAaaAk', '.kAAAAk...kAAAAk', '..kAAk.....kAAk.', '...kk.......kk..', '................', '................'] },
  heli: { f0: ['................', '....kkkkkkkkk...', '........k.......', '........k.......', '......kkkkk.....', '.....kbbbbbk....', '....kbbwbbbbk...', '....kbbbbbbbk...', '.....kbbbbbkkkk.', '......kkkkk..k..', '.....kkk.kkk....', '....kk.....kk...', '...kk.......kk..', '..kkkkkkkkkkkkk.', '................', '................'] },
  boat: { f0: ['................', '................', '................', '........k.......', '.......kwk......', '.......kwwk.....', '.......kwwwk....', '.......kwwwwk...', '.......kwwwwwk..', '.......kkkkkkk..', 'kkkkkkkkkkkkkkkk', 'kmmmmmmmmmmmmmmk', '.kmmmmmmmmmmmmk.', '..kmmmmmmmmmmk..', '...kkkkkkkkkk...', '................'] },
  life: { f0: ['................', '................', '.....o.oo.o.....', '....oooooooo....', '....gggggggg....', '....ssssssss....', '....skssssks....', '....ssssssss....', '.....sssskk.....', '.....ssssss.....', '....wwwwwwww....', '....wwoooooww...', '....bbbbbbbb....', '................', '................', '................'] },
  // Projetil do bracelete (8×8 em 16×16)
  bolt: { f0: ['................', '................', '................', '................', '......bb........', '....bbwwbb......', '...bwwwwwwb.....', '....bbwwbb......', '......bb........', '................', '................', '................', '................', '................', '................', '................'],
          f1: ['................', '................', '................', '................', '.....bb.........', '...bbwwbbb......', '..bwwwwwwwb.....', '...bbwwbbb......', '.....bb.........', '................', '................', '................', '................', '................', '................', '................'] },
  // Explosão de bloco (cacos) e "pop" de inimigo
  pop0: { f0: ['................', '................', '................', '......w.w.......', '.....w...w......', '......w.w.......', '....w..w..w.....', '......w.w.......', '.....w...w......', '......w.w.......', '................', '................', '................', '................', '................', '................'] },
  pop1: { f0: ['................', '....w.......w...', '.....w.....w....', '................', '..w...........w.', '................', '.....w...w......', '.......w........', '.....w...w......', '................', '..w...........w.', '................', '.....w.....w....', '....w.......w...', '................', '................'] },
  // Marcador de checkpoint (sino) — 2 estados
  bell: { off: ['.......kk.......', '......kaak......', '.....kaaaak.....', '.....kaaaak.....', '....kaaaaaak....', '....kaaaaaak....', '....kaaaaaak....', '...kaaaaaaaak...', '...kaaaaaaaak...', '..kaaaaaaaaaak..', '..kkkkkkkkkkkk..', '......kaak......', '.......kk.......', '................', '................', '................'],
          on:  ['.......kk.......', '......kyyk......', '.....kyyyyk.....', '.....kywyyk.....', '....kyyyyyyk....', '....kyyyyyyk....', '....kyyyyyyk....', '...kyyyyyyyyk...', '...kyyyyyyyyk...', '..kyyyyyyyyyyk..', '..kkkkkkkkkkkk..', '......kyyk......', '.......kk.......', '................', '................', '................'] },
  // Bandeira de fim de fase (16×32)
  flag: { f0: ['kk..............', 'kkrrrrrrrr......', 'kkrrwwrrrrrr....', 'kkrrwwrrrrrrrr..', 'kkrrrrrrrrrrrrr.', 'kkrrrrrrrrrrrr..', 'kkrrrrrrrrrr....', 'kkrrrrrrrr......', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kaak............', 'kaaak...........'],
          f1: ['kk..............', 'kkrrrrrrr.......', 'kkrrwwrrrrr.....', 'kkrrwwrrrrrrrr..', 'kkrrrrrrrrrrrr..', 'kkrrrrrrrrrrrrr.', 'kkrrrrrrrrrrr...', 'kkrrrrrrrrr.....', 'kkrrrrrr........', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kk..............', 'kaak............', 'kaaak...........'] },
  // Porta da loja (32×32)
  shop: { f0: [
    '................................', '......kkkkkkkkkkkkkkkkkkkk......', '.....kyyyyyyyyyyyyyyyyyyyyk.....', '....kyyrryyrryyrryyrryyrryyk....',
    '....kyyrryyrryyrryyrryyrryyk....', '....kkkkkkkkkkkkkkkkkkkkkkkk....', '....kwwwwwwwwwwwwwwwwwwwwwwk....', '....kwkkkkkwwkkkkwwkkkkkwwwk....',
    '....kwkwwwkwkwwwwkwkwwwkwwwk....', '....kwkwwwkwwkkkwwwkwkkkwwwk....', '....kwkkkkkwwwwwkwwkwwwwwwwk....', '....kwkwwwwwkkkkwwwkwwwwwwwk....',
    '....kwwwwwwwwwwwwwwwwwwwwwwk....', '....kkkkkkkkkkkkkkkkkkkkkkkk....', '....kmmmmmmmmkkkkkkmmmmmmmmk....', '....kmmmmmmmmkbbbbkmmmmmmmmk....',
    '....kmmddddmmkbbbbkmmddddmmk....', '....kmmddddmmkbbbbkmmddddmmk....', '....kmmddddmmkbbbbkmmddddmmk....', '....kmmddddmmkkkkkkmmddddmmk....',
    '....kmmddddmmkmmmmkmmddddmmk....', '....kmmddddmmkmmmmkmmddddmmk....', '....kmmddddmmkmmmmkmmddddmmk....', '....kmmddddmmkmmyykmmddddmmk....',
    '....kmmddddmmkmmmmkmmddddmmk....', '....kmmddddmmkmmmmkmmddddmmk....', '....kmmddddmmkmmmmkmmddddmmk....', '....kmmddddmmkmmmmkmmddddmmk....',
    '....kmmddddmmkmmmmkmmddddmmk....', '....kmmmmmmmmkmmmmkmmmmmmmmk....', '....kkkkkkkkkkkkkkkkkkkkkkkk....', '................................'] },
  // Porta comum (16×32)
  door: { f0: ['................', '....kkkkkkkk....', '...kmmmmmmmmk...', '..kmmmmmmmmmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmdddddymmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kmmddddddmmk..', '..kkkkkkkkkkkk..', '................'] },
  // Veículos jogáveis (32×24): moto e helicóptero; barco (32×16)
  motoRide: { f0: [
    '................................', '................................', '................................', '..............rrrrrr............',
    '.............rrrrrrrr....kk.....', '.............rrrrrrrrr..kkk.....', '............rrrrrrrrrrkkkk......', '...........rrrrrrrrrrrkk........',
    '..........rrrrrrrrrrrrr.........', '........kkkkrrrrrrrrrrkkkk......', '.......kAAAAkkkkkkkkkkAAAAk.....', '......kAaaaaAkkkkkkkkAaaaaAk....',
    '.....kAaaAAaaAkkkkkkAaaAAaaAk...', '.....kAaaAAaaAk....kAaaAAaaAk...', '.....kAaaaaaaAk....kAaaaaaaAk...', '......kAaaaaAk......kAaaaaAk....',
    '.......kAAAAk........kAAAAk.....', '........kkkk..........kkkk......', '................................', '................................',
    '................................', '................................', '................................', '................................'],
    f1: [
    '................................', '................................', '................................', '..............rrrrrr............',
    '.............rrrrrrrr....kk.....', '.............rrrrrrrrr..kkk.....', '............rrrrrrrrrrkkkk......', '...........rrrrrrrrrrrkk........',
    '..........rrrrrrrrrrrrr.........', '........kkkkrrrrrrrrrrkkkk......', '.......kAAAAkkkkkkkkkkAAAAk.....', '......kAaAaaAkkkkkkkkAaAaaAk....',
    '.....kAaaaAaaAkkkkkkAaaaAaaAk...', '.....kAAaaaaAAk....kAAaaaaAAk...', '.....kAaaAaaaAk....kAaaAaaaAk...', '......kAaaaaAk......kAaaaaAk....',
    '.......kAAAAk........kAAAAk.....', '........kkkk..........kkkk......', '................................', '................................',
    '................................', '................................', '................................', '................................'] },
  heliRide: { f0: [
    '....kkkkkkkkkkkkkkkkkkkkkkk.....', '...............kk...............', '...............kk...............', '..............kkkk..............',
    '............kkrrrrkk............', '...........krrrrrrrrk...........', '..........krrrrrrrrrrk..........', '..........krrrrrrrrrrk..........',
    '..........krrrrrrrrrrkkkkkkkk...', '..........krrrrrrrrrrk.....kk...', '...........krrrrrrrrkkkkkkkkkk..', '............kkkkkkkk........kk..',
    '..........kk..kk..kk............', '.........kk...kk...kk...........', '........kk....kk....kk..........', '.......kkkkkkkkkkkkkkkk.........',
    '................................', '................................', '................................', '................................',
    '................................', '................................', '................................', '................................'],
    f1: [
    '..........kkkkkkkkkkk...........', '...............kk...............', '...............kk...............', '..............kkkk..............',
    '............kkrrrrkk............', '...........krrrrrrrrk...........', '..........krrrrrrrrrrk..........', '..........krrrrrrrrrrk..........',
    '..........krrrrrrrrrrkkkkkkkk...', '..........krrrrrrrrrrk.....kk...', '...........krrrrrrrrkkkkkkkkkk..', '............kkkkkkkk........kk..',
    '..........kk..kk..kk............', '.........kk...kk...kk...........', '........kk....kk....kk..........', '.......kkkkkkkkkkkkkkkk.........',
    '................................', '................................', '................................', '................................',
    '................................', '................................', '................................', '................................'] },
  boatRide: { f0: [
    '................................', '................................', '................................', '................................',
    '................................', '................................', '................................', '................................',
    '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..', '.kmmmmmmmmmmmmmmmmmmmmmmmmmmmmk.', 'kmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmk', 'kmmmdddddddddddddddddddddddmmmmk',
    '.kmmmmmmmmmmmmmmmmmmmmmmmmmmmmk.', '..kmmmmmmmmmmmmmmmmmmmmmmmmmmk..', '...kkkkkkkkkkkkkkkkkkkkkkkkkk...', '................................'] },
  // Mãos do duelo (24×24): pedra, papel, tesoura
  handRock: { f0: [
    '........................', '........................', '.......kkkkkkk..........', '.....kkyyyyyyykk........', '....kyyyyyyyyyyyk.......', '...kyyyyyyyyyyyyyk......',
    '...kyyyyyyyyyyyyyk......', '..kyyyyyyyyyyyyyyyk.....', '..kyyyyyyyyyyyyyyyk.....', '..kyyykkkkkkkkkyyyk.....', '..kyyyykyyykyykyyyk.....', '..kyyyyyyyyyyyyyyyk.....',
    '..kyyyyyyyyyyyyyyyk.....', '..kyyykkkkkkkkkyyyk.....', '..kyyyyyyyyyyyyyyyk.....', '...kyyyyyyyyyyyyyk......', '...kyyyyyyyyyyyyyk......', '....kyyyyyyyyyyyk.......',
    '.....kkyyyyyyykk........', '.......kkkkkkk..........', '........................', '........................', '........................', '........................'] },
  handPaper: { f0: [
    '........................', '.......kk.kk.kk.........', '......kyykyykyyk........', '......kyykyykyyk.kk.....', '......kyykyykyykkyyk....', '......kyyyyyyyyyyyyk....',
    '......kyyyyyyyyyyyyk....', '......kyyyyyyyyyyyyk....', '...kkkkyyyyyyyyyyyyk....', '..kyyykyyyyyyyyyyyyk....', '..kyyyyyyyyyyyyyyyyk....', '..kyyyyyyyyyyyyyyyyk....',
    '...kyyyyyyyyyyyyyyyk....', '....kyyyyyyyyyyyyyk.....', '.....kyyyyyyyyyyyyk.....', '......kyyyyyyyyyyk......', '.......kyyyyyyyyyk......', '........kyyyyyyyk.......',
    '........kyyyyyyyk.......', '........kkkkkkkkk.......', '........................', '........................', '........................', '........................'] },
  handScissors: { f0: [
    '........................', '.....kk.........kk......', '....kyyk.......kyyk.....', '....kyyk......kyyk......', '....kyyk.....kyyk.......', '.....kyyk...kyyk........',
    '.....kyyk..kyyk.........', '......kyykkyyk..........', '......kyyyyyyk..........', '.......kyyyyyykkkk......', '....kkkkyyyyyyyyyyk.....', '...kyyykyyyyyyyyyyyk....',
    '...kyyyyyyyyyyyyyyyk....', '...kyyyyyyyyyyyyyyyk....', '....kyyyyyyyyyyyyyk.....', '.....kyyyyyyyyyyyyk.....', '......kyyyyyyyyyyk......', '.......kyyyyyyyyyk......',
    '........kyyyyyyyk.......', '........kkkkkkkkk.......', '........................', '........................', '........................', '........................'] },
};
