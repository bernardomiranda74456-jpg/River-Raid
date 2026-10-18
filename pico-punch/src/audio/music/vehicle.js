// "Estrada do Trovão" — fase de veículo. 180 bpm (speed 5), lá menor, baixo galopante, forma A A B A C.
// Motivo: arpejo A4–C5–E5–A5 disparado e queda G5–E5 — "acelerador no fundo".
import { INST } from './instruments.js';
import { rhy, seq, bar } from './lib.js';
const { lead, arpMaj, arpMin, bassShort, stab } = INST;
const V1 = 'A4:lead . . . C5 . E5 . A5 . . . G5 . E5 .';
const V2 = 'F5:lead . E5 . C5 . . . A4 . . . C5 . D5 .';
const V3 = 'E5:lead . . . D5 . E5 . G5 . . . F5 . D5 .';
const V4 = 'E5:lead . . . == . . . B4 . . . G#4 . B4 .';
const V7 = 'E5:lead . . . G5 . A5 . B5 . . . A5 . G5 .';
const V8 = 'A5:lead . . . == . . . E5 . . . == . . .';
const B1 = 'C6:lead . . . B5 . C6 . G5 . . . E5 . G5 .';
const B2 = 'B5:lead . . . A5 . B5 . D6 . . . B5 . G5 .';
const B3 = 'A5:lead . . . G5 . A5 . C6 . . . A5 . F5 .';
const B4 = 'G#5:lead . . . E5 . . . B5 . . . == . . .';
const V12 = 'E5:lead . . . == . . . G#5 . . . B5 . == .';
const C1 = 'D5:lead . . . F5 . A5 . D6 . . . C6 . A5 .';
const C2 = 'C6:lead . . . A5 . E5 . A5 . . . == . . .';
const C3 = 'F5:lead . . . A5 . C6 . F6 . . . E6 . C6 .';
const C4 = 'E6:lead . D6 . B5 . G#5 . E5 . . . == . . .';
const OFF = '..x...x...x...x.', TRE = 'x..x..x.x..x..x.', EIG = 'x.x.x.x.x.x.x.x.';
const Am = (m = OFF) => rhy(m, 'A3', 'arpMin'), F = (m = OFF) => rhy(m, 'F3', 'arpMaj'), G = (m = OFF) => rhy(m, 'G3', 'arpMaj');
const E = (m = OFF) => rhy(m, 'E4', 'arpMaj'), C = (m = OFF) => rhy(m, 'C4', 'arpMaj'), Dm = (m = OFF) => rhy(m, 'D4', 'arpMin');
// Galope: colcheia + duas semicolcheias
const GAL = 'x.xxx.xxx.xxx.xx';
const gal = (r, o, x, y) => seq(GAL, [r, r, o, r, r, o, r, r, o, r, x, y], 'bass');
const gAm = gal('A2', 'A3', 'A2', 'G3'), gAm2 = gal('A2', 'A3', 'A3', 'A2');
const gF = gal('F3', 'C3', 'F3', 'F3'), gG = gal('G3', 'D3', 'G3', 'G3'), gE = gal('E3', 'B2', 'E3', 'E3');
const gC = gal('C3', 'C4', 'C3', 'B2'), gDm = gal('D3', 'A2', 'D3', 'C3'), gE2 = gal('E3', 'B2', 'G#3', 'B2');
const R = 'K . h . S . h . K . h . S . h .';
const Rc = 'C . h . S . h . K . h . S . h .';
const Rf = 'K . h . S . h . K . S S S S O .';
const Rb = 'K . h . S . h h K . h . S . O .';
const Rend = 'K . h . S . h . K . S . S S S O';

export const vehicle = {
  name: 'Estrada do Trovão', speed: 5, rpb: 4, loop: true, loopStart: 0,
  instruments: { lead, arpMaj, arpMin, bass: bassShort, stab },
  patterns: {
    v1: bar(V1, Am(), gAm, Rc), v2: bar(V2, F(), gF, R), v3: bar(V3, G(), gG, R), v4: bar(V4, E(), gE, Rf),
    v5: bar(V1, Am(), gAm, R), v6: bar(V2, F(), gF, R), v7: bar(V7, G(), gG, R), v8: bar(V8, E(), gE, Rf),
    b1: bar(B1, C(TRE), gC, Rc), b2: bar(B2, G(TRE), gG, Rb), b3: bar(B3, F(TRE), gF, Rb), b4: bar(B4, E(TRE), gE, Rf),
    v9: bar(V1, Am(), gAm, Rc), v10: bar(V2, F(), gF, R), v11: bar(V3, G(), gG, R), v12: bar(V12, E(), gE, Rf),
    c1: bar(C1, Dm(EIG), gDm, Rc), c2: bar(C2, Am(EIG), gAm2, Rb), c3: bar(C3, F(EIG), gF, Rb), c4: bar(C4, E(EIG), gE2, Rend),
  },
  order: ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'b1', 'b2', 'b3', 'b4', 'v9', 'v10', 'v11', 'v12', 'c1', 'c2', 'c3', 'c4'],
};
