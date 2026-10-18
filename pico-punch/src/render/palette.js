// Paleta do Master System: 64 cores, 2 bits por canal (valores 0..3 → 0,85,170,255).
// Cores são escritas como strings de 3 dígitos "rgb" (ex.: "320" = r3 g2 b0).
export const smsHex = (code) => {
  const r = +code[0] * 85, g = +code[1] * 85, b = +code[2] * 85;
  return (r << 16) | (g << 8) | b;
};
export const smsCss = (code) => `rgb(${+code[0] * 85},${+code[1] * 85},${+code[2] * 85})`;
export const smsRgb = (code) => [+code[0] * 85, +code[1] * 85, +code[2] * 85];
/** Quantiza uma cor 24 bits para a cor SMS mais próxima (usado no modo retrô para fundos gerados). */
export const quantize = (r, g, b) => `${Math.round(r / 85)}${Math.round(g / 85)}${Math.round(b / 85)}`;

/** Paleta de sprites (16 entradas, fixa no jogo inteiro — como o hardware). '.' é transparente. */
export const SPRITE_PAL = {
  '.': null,
  k: '000', // preto / contorno
  w: '333', // branco
  s: '321', // pele
  d: '210', // pele escura / couro / botas
  r: '300', // vermelho
  m: '200', // vinho
  o: '310', // laranja (cabelo)
  y: '330', // amarelo (luvas, dinheiro)
  g: '030', // verde
  G: '020', // verde escuro
  b: '023', // azul claro
  B: '012', // azul escuro
  p: '203', // roxo
  a: '222', // cinza
  A: '111', // cinza escuro
};

/**
 * Paletas de fundo por tema (16 entradas). Letras reservadas em todos os temas para blocos/itens:
 * k preto, w branco, y amarelo, o laranja, m marrom, r vermelho. As demais 10 variam por tema.
 */
export const TILE_PALS = {
  mountain: { '.': null, k: '000', w: '333', y: '330', o: '310', m: '210', r: '300',
    s: '123', /* céu */ R: '222', /* rocha */ q: '111', /* rocha escura */ Q: '332', /* rocha luz */
    g: '030', G: '020', d: '210', D: '100', c: '233', /* neve/azulado */ b: '023' },
  forest:   { '.': null, k: '000', w: '333', y: '330', o: '310', m: '210', r: '300',
    s: '133', R: '121', q: '010', Q: '231', g: '130', G: '020', d: '210', D: '100', c: '320', b: '023' },
  lake:     { '.': null, k: '000', w: '333', y: '330', o: '310', m: '210', r: '300',
    s: '233', R: '121', q: '010', Q: '232', g: '130', G: '021', d: '110', D: '010', c: '122', b: '023' },
  village:  { '.': null, k: '000', w: '333', y: '330', o: '310', m: '210', r: '300',
    s: '233', R: '331', q: '211', Q: '332', g: '130', G: '020', d: '210', D: '100', c: '322', b: '023' },
  desert:   { '.': null, k: '000', w: '333', y: '330', o: '310', m: '210', r: '300',
    s: '331', R: '321', q: '210', Q: '332', g: '220', G: '110', d: '320', D: '200', c: '311', b: '123' },
  road:     { '.': null, k: '000', w: '333', y: '330', o: '310', m: '210', r: '300',
    s: '223', R: '222', q: '111', Q: '333', g: '130', G: '020', d: '210', D: '100', c: '332', b: '023' },
  sky:      { '.': null, k: '000', w: '333', y: '330', o: '310', m: '210', r: '300',
    s: '123', R: '222', q: '111', Q: '333', g: '130', G: '020', d: '221', D: '110', c: '233', b: '023' },
  cave:     { '.': null, k: '000', w: '333', y: '330', o: '310', m: '210', r: '300',
    s: '101', R: '211', q: '100', Q: '322', g: '131', G: '020', d: '201', D: '100', c: '303', b: '013' },
  city:     { '.': null, k: '000', w: '333', y: '330', o: '310', m: '210', r: '300',
    s: '002', R: '122', q: '011', Q: '233', g: '031', G: '020', d: '112', D: '001', c: '313', b: '023' },
  castle:   { '.': null, k: '000', w: '333', y: '330', o: '310', m: '210', r: '300',
    s: '101', R: '222', q: '111', Q: '333', g: '130', G: '020', d: '211', D: '100', c: '213', b: '002' },
};
