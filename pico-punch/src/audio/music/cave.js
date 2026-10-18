// "Caverna Brasa" — caverna com lava. Ré dórico, ~129 bpm (speed 7), baixo pesado, ostinato grave e "gotas".
// Motivo: D5 … F5–E5–D5 (suspiro descendente) respondido por A4 … C5–B4 (o B natural dórico pinça).
import { INST } from './instruments.js';
import { rhy, seq, bar } from './lib.js';
const { lead, arpMin, arpMaj } = INST;
const drip = { env: 'echo', hd: { wave: 'sine', cutoff: 5000, detune: 3, level: 0.5, reverb: 0.6, delay: 0.42 } };
const ost = { env: [9, 8, 7, 6, 5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 2], rel: [2, 0], hd: { wave: 'pulse12', cutoff: 1800, detune: 4, level: 0.4, reverb: 0.3, delay: 0.2 } };
const heavy = { env: 'bass', hd: { wave: 'saw', cutoff: 520, sub: true, level: 1, reverb: 0.08, delay: 0 } };
const C1 = 'D5:lead . . . . . F5 . E5 . . . D5 . . .';
const C2 = 'A4:lead . . . . . . == D6:drip . . . C5:lead . B4 .';
const C3 = 'A4:lead . . . . . C5 . D5 . . . F5 . . .';
const C4 = 'E5:lead . . . . . D5 . B4 . . . == A6:drip . .';
const C7 = 'G5:lead . . . . . F5 . E5 . . . C5 . . .';
const C8 = 'E5:lead . . . C#5 . . . A4 . . . == E6:drip . .';
const B1 = 'F5:lead . . . A5 . . . C6 . . . A5 . F5 .';
const B2 = 'G5:lead . . . . . B5 . D6 . . . B5 . G5 .';
const B3 = 'A5:lead . . . C6 . . . E6 . . . D6 . C6 .';
const B4 = 'C#6:lead . . . A5 . . . E5 . . . == . . .';
const C16 = 'E5:lead . . . C#5 . . . A4 . . . C#5 . . .';
// Ostinato em colcheias (volume baixo) e arpejos na ponte
const EIG = 'x.x.x.x.x.x.x.x.', TRE = 'x..x..x.x..x..x.';
const o = (notes) => seq(EIG, notes, 'ost');
const oDm = o(['D4', 'A3', 'D4', 'F4', 'D4', 'A3', 'D4', 'C4']);
const oF = o(['F4', 'C4', 'F4', 'A4', 'F4', 'C4', 'F4', 'E4']);
const oG = o(['G4', 'D4', 'G4', 'B4', 'G4', 'D4', 'G4', 'F4']);
const oC = o(['C4', 'G3', 'C4', 'E4', 'C4', 'G3', 'C4', 'B3']);
const oA = o(['A3', 'E4', 'A3', 'C#4', 'A3', 'E4', 'A3', 'G4']);
const aF = rhy(TRE, 'F3', 'arpMaj'), aG = rhy(TRE, 'G3', 'arpMaj'), aAm = rhy(TRE, 'A3', 'arpMin'), aA = rhy(TRE, 'A3', 'arpMaj');
const HV = 'x...x...x..x..x.';
const bs = (notes) => seq(HV, notes, 'bass');
const bDm = bs(['D3', 'D3', 'D3', 'A2', 'C3']), bDm2 = bs(['D3', 'D3', 'D3', 'F3', 'E3']);
const bF = bs(['F3', 'F3', 'F3', 'C3', 'E3']), bG = bs(['G3', 'G3', 'G3', 'D3', 'F3']);
const bC = bs(['C3', 'C3', 'C3', 'G3', 'B2']), bA = bs(['A2', 'A2', 'A2', 'E3', 'G3']), bAend = bs(['A2', 'A2', 'A2', 'C#3', 'E3']);
const bAm = bs(['A2', 'A2', 'A2', 'G3', 'E3']);
const K = 'K . . t S . . . K . t . S . . T';
const Kc = 'C . . t S . . . K . t . S . . T';
const Kf = 'K . . t S . . . T . T . t t T T';
const Kb = 'K . t . S . . t K . t . S . T t';
const Kend = 'K . . t S . t . T . T . t t S O';

export const cave = {
  name: 'Caverna Brasa', speed: 7, rpb: 4, loop: true, loopStart: 0,
  instruments: { lead, drip, ost, arpMin, arpMaj, bass: heavy },
  patterns: {
    c1: bar(C1, oDm, bDm, Kc), c2: bar(C2, oDm, bDm2, K), c3: bar(C3, oF, bF, K), c4: bar(C4, oG, bG, Kf),
    c5: bar(C1, oDm, bDm, K), c6: bar(C2, oDm, bDm2, K), c7: bar(C7, oC, bC, K), c8: bar(C8, oA, bA, Kf),
    b1: bar(B1, aF, bF, Kc), b2: bar(B2, aG, bG, Kb), b3: bar(B3, aAm, bAm, Kb), b4: bar(B4, aA, bA, Kf),
    c13: bar(C1, oDm, bDm, Kc), c14: bar(C2, oDm, bDm2, K), c15: bar(C3, oF, bF, K), c16: bar(C16, oA, bAend, Kend),
  },
  order: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'b1', 'b2', 'b3', 'b4', 'c13', 'c14', 'c15', 'c16'],
};
