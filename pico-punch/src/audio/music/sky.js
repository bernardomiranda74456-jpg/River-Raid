// "Céu de Vantura" — fase de helicóptero. 150 bpm, ré maior, leve e ascendente; galope suave no baixo.
// Motivo: D5–F#5–A5–D6 (decolagem em arpejo) coroado por C#6–A5.
import { INST } from './instruments.js';
import { rhy, seq, bar } from './lib.js';
const { leadBright, arpMaj, arpMin, bass } = INST;
const S1 = 'D5:lead . . . F#5 . A5 . D6 . . . C#6 . A5 .';
const S2 = 'B5:lead . . . A5 . . . E5 . . . F#5 . G5 .';
const S3 = 'F#5:lead . . . B5 . D6 . F#6 . . . E6 . D6 .';
const S4 = 'E6:lead . . . D6 . B5 . A5 . . . G5 . E5 .';
const S7 = 'B5:lead . . . D6 . E6 . G6 . . . F#6 . E6 .';
const S8 = 'F#6:lead . . . == . . . E6 . . . == . . .';
const B1 = 'G5:lead . . . B5 . . . E6 . . . D6 . B5 .';
const B2 = 'C#6:lead . . . A5 . . . E5 . . . G5 . A5 .';
const B3 = 'F#5:lead . . . A5 . D6 . F#6 . . . E6 . D6 .';
const B4 = 'B5:lead . . . == . . . A5 . B5 . C#6 . D6 .';
const B5 = 'E6:lead . . . D6 . B5 . G5 . . . A5 . B5 .';
const B6 = 'C#6:lead . . . E6 . . . A5 . . . == . . .';
const B7 = 'B5:lead . . . D6 . . . E6 . . . F#6 . G6 .';
const B8 = 'A6:lead . . . == . . . E6 . . . C#6 . A5 .';
const S12 = 'E6:lead . . . D6 . B5 . A5 . . . == . . .';
const Q = 'x...x...x...x...', TRE = 'x..x..x.x..x..x.';
const D = (m = Q) => rhy(m, 'D4', 'arpMaj'), A = (m = Q) => rhy(m, 'A3', 'arpMaj'), Bm = (m = Q) => rhy(m, 'B3', 'arpMin');
const G = (m = Q) => rhy(m, 'G3', 'arpMaj'), Em = (m = Q) => rhy(m, 'E4', 'arpMin');
const GA = 'G3:arpMaj . . . G3 . . . A3 . . . A3 . . .';
const GAL = 'x.xxx.xxx.xxx.xx';
const gal = (r, o, x, y) => seq(GAL, [r, r, o, r, r, o, r, r, o, r, x, y], 'bass');
const gD = gal('D3', 'A2', 'D3', 'C#3'), gA = gal('A2', 'E3', 'A2', 'A3'), gBm = gal('B2', 'F#3', 'B2', 'A2');
const gG = gal('G3', 'D3', 'G3', 'F#3'), gEm = gal('E3', 'B2', 'E3', 'E3'), gGA = seq(GAL, ['G3', 'G3', 'D3', 'G3', 'G3', 'D3', 'A2', 'A2', 'E3', 'A2', 'C#3', 'E3'], 'bass');
const gA2 = gal('A2', 'E3', 'C#3', 'E3');
const R = 'K . h . s . h . K . h . s . h O';
const Rc = 'C . h . s . h . K . h . s . h .';
const Rf = 'K . h . s . h . K . S . S . S O';
const Rb = 'K . h . S . h . K . h . S . h O';
const Rend = 'K . h . S . h . K . S S S . S O';

export const sky = {
  name: 'Céu de Vantura', speed: 6, rpb: 4, loop: true, loopStart: 0,
  instruments: { lead: leadBright, arpMaj, arpMin, bass },
  patterns: {
    s1: bar(S1, D(), gD, Rc), s2: bar(S2, A(), gA, R), s3: bar(S3, Bm(), gBm, R), s4: bar(S4, GA, gGA, Rf),
    s5: bar(S1, D(), gD, R), s6: bar(S2, A(), gA, R), s7: bar(S7, G(), gG, R), s8: bar(S8, A(), gA, Rf),
    b1: bar(B1, Em(TRE), gEm, Rc), b2: bar(B2, A(TRE), gA, Rb), b3: bar(B3, D(TRE), gD, Rb), b4: bar(B4, Bm(TRE), gBm, Rf),
    b5: bar(B5, G(TRE), gG, Rb), b6: bar(B6, A(TRE), gA, Rb), b7: bar(B7, G(TRE), gG, Rb), b8: bar(B8, A(TRE), gA2, Rf),
    s9: bar(S1, D(), gD, Rc), s10: bar(S2, A(), gA, R), s11: bar(S3, Bm(), gBm, R), s12: bar(S12, GA, gGA, Rend),
  },
  order: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 's9', 's10', 's11', 's12'],
};
