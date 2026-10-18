// "Amanhecer em Vantura" — abertura/história. Épico e esperançoso, ~129 bpm (speed 7), dó maior, 16 compassos.
// Motivo: E5 … G5–C6 (ascensão em três passos) respondido por B5 … A5–G5 — o sol nascendo sobre a vila.
import { INST } from './instruments.js';
import { rhy, seq, bar } from './lib.js';
const { padMaj, padMin, arpMaj, arpMin, bass } = INST;
const horn = { env: 'soft', vib: { delay: 14, rate: 5, depth: 0.25 }, hd: { wave: 'bright', cutoff: 3200, detune: 9, reverb: 0.42, delay: 0.26, level: 0.6 } };
const P1 = 'E5:lead . . . . . . . G5 . . . C6 . . .';
const P2 = 'B5:lead . . . . . . . == . . . A5 . G5 .';
const P3 = 'A5:lead . . . . . . . E5 . . . G5 . . .';
const P4 = 'F5:lead . . . . . . . == . . . E5 . D5 .';
const P6 = 'D6:lead . . . . . . . == . . . B5 . G5 .';
const P7 = 'A5:lead . . . . . . . C6 . . . F6 . . .';
const P8 = 'E6:lead . . . D6 . . . B5 . . . G5 . . .';
const B1 = 'C6:lead . . . . . . . B5 . . . A5 . . .';
const B2 = 'G5:lead . . . . . . . == . . . E5 . G5 .';
const B3 = 'A5:lead . . . . . . . C6 . . . D6 . . .';
const B4 = 'E6:lead . . . . . . . == . . . D6 . C6 .';
const B5 = 'D6:lead . . . . . . . F6 . . . E6 . D6 .';
const B6 = 'B5:lead . . . . . . . D6 . . . G5 . A5 .';
const B7 = 'C6:lead . . . . . . . == . . . G5 . . .';
const B8 = 'A5:lead . . . G5 . . . F5 . . . D5 . . .';
const WH = 'x...............', HALF = 'x.......x.......', TRE = 'x..x..x.x..x..x.';
const pad = (n, i, m = WH) => rhy(m, n, i);
const HB = 'x.......x.....x.', EIG = 'x.x.x.x.x.x.x.x.';
const bs = (notes, m = HB) => seq(m, notes, 'bass');
const O1 = 'K . . . . . . . S . . . . . . .';
const Oc = 'C . . . . . . . S . . . . . . .';
const O2 = 'K . . . h . . . S . . . h . . .';
const Of = 'K . . . T . t . S . . . T . t .';
const O3 = 'K . h . S . h . K . h . S . h h';
const O3c = 'C . h . S . h . K . h . S . h h';
const Oend = 'K . . . S . . . T . T . t t t t';

export const opening = {
  name: 'Amanhecer em Vantura', speed: 7, rpb: 4, loop: true, loopStart: 0,
  instruments: { lead: horn, padMaj, padMin, arpMaj, arpMin, bass },
  patterns: {
    p1: bar(P1, pad('C4', 'padMaj'), bs(['C3', 'C3', 'E3']), Oc), p2: bar(P2, pad('G3', 'padMaj'), bs(['G3', 'D3', 'B2']), O1),
    p3: bar(P3, pad('A3', 'padMin'), bs(['A2', 'A2', 'C3']), O1), p4: bar(P4, pad('F3', 'padMaj'), bs(['F3', 'F3', 'G3']), Of),
    p5: bar(P1, pad('C4', 'padMaj'), bs(['C3', 'C3', 'E3']), O2), p6: bar(P6, pad('G3', 'padMaj'), bs(['G3', 'D3', 'B2']), O2),
    p7: bar(P7, pad('F3', 'padMaj'), bs(['F3', 'F3', 'E3']), O2), p8: bar(P8, pad('G3', 'padMaj', HALF), bs(['G3', 'G3', 'B2']), Of),
    b1: bar(B1, pad('A3', 'padMin'), bs(['A2', 'A2', 'G3']), O3c), b2: bar(B2, pad('E4', 'padMin'), bs(['E3', 'E3', 'D3']), O3),
    b3: bar(B3, pad('F3', 'padMaj'), bs(['F3', 'F3', 'G3']), O3), b4: bar(B4, pad('C4', 'padMaj'), bs(['C3', 'C3', 'C3']), Of),
    b5: bar(B5, pad('D4', 'arpMin', TRE), bs(['D3', 'D3', 'D3', 'D3', 'D3', 'D3', 'F3', 'A3'], EIG), O3c),
    b6: bar(B6, pad('G3', 'arpMaj', TRE), bs(['G3', 'G3', 'G3', 'G3', 'D3', 'D3', 'B2', 'D3'], EIG), O3),
    b7: bar(B7, pad('C4', 'arpMaj', TRE), bs(['C3', 'C3', 'C3', 'C3', 'E3', 'E3', 'G3', 'E3'], EIG), O3),
    b8: bar(B8, pad('G3', 'padMaj', HALF), bs(['G3', 'G3', 'B2'], HB), Oend),
  },
  order: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'],
};
