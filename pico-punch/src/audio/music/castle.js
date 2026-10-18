// "Castelo Kazmar" — castelo final. Lá menor harmônica, 150 bpm, pedal de lá no baixo, pulsos em colcheias.
// Motivo: E5–A5–C6–B5–A5 (salto heroico que recua) e o G#5 suspenso — ameaça no alto da torre.
import { INST } from './instruments.js';
import { rhy, seq, bar } from './lib.js';
const { lead, arpMin, arpMaj, bass } = INST;
const pulse = { env: [11, 10, 9, 8, 7, 6, 6, 5, 5, 5], rel: [3, 0], arp: [0, 3, 7], hd: { wave: 'square', cutoff: 2400, detune: 8, level: 0.38, reverb: 0.35, delay: 0.12 } };
const pulseMaj = { ...pulse, arp: [0, 4, 7] };
const K1 = 'E5:lead . . . A5 . . . C6 . . . B5 . A5 .';
const K2 = 'G#5:lead . . . == . . . E5 . . . == . . .';
const K3 = 'F5:lead . . . A5 . . . D6 . . . C6 . B5 .';
const K4 = 'C6:lead . . . B5 . . . G#5 . . . E5 . . .';
const K7 = 'F5:lead . . . A5 . . . D6 . . . E6 . F6 .';
const K8 = 'E6:lead . . . D6 . . . C6 . . . B5 . . .';
const B1 = 'D6:lead . . . A5 . D6 . F6 . . . E6 . D6 .';
const B2 = 'C6:lead . . . A5 . C6 . E6 . . . D6 . C6 .';
const B3 = 'D6:lead . . . Bb5 . . . F5 . . . G5 . A5 .';
const B4 = 'G#5:lead . . . == . . . B5 . . . == . . .';
const B6 = 'C6:lead . . . A5 . C6 . E6 . . . F6 . E6 .';
const B7 = 'D6:lead . C6 . B5 . A5 . G#5 . . . B5 . . .';
const B8 = 'E6:lead . . . == . . . == . . . B5 . . .';
const EIG = 'x.x.x.x.x.x.x.x.', GAL = 'x.xxx.xxx.xxx.xx';
const Am = rhy(EIG, 'A3', 'pulse'), E = rhy(EIG, 'E4', 'pulseMaj'), Dm = rhy(EIG, 'D4', 'pulse'), Bb = rhy(EIG, 'Bb3', 'pulseMaj');
const Amg = rhy(GAL, 'A3', 'pulse'), Eg = rhy(GAL, 'E4', 'pulseMaj'), Dmg = rhy(GAL, 'D4', 'pulse');
const bs = (notes) => seq(EIG, notes, 'bass');
const pA = bs(['A2', 'A2', 'A2', 'A2', 'A2', 'A2', 'A3', 'A2']);
const pAE = bs(['A2', 'A2', 'A2', 'A2', 'E3', 'E3', 'E3', 'E3']);
const pAEd = bs(['A2', 'A2', 'E3', 'E3', 'E3', 'E3', 'E3', 'E3']);
const pD = bs(['D3', 'D3', 'D3', 'D3', 'D3', 'D3', 'A2', 'D3']);
const pBb = bs(['Bb2', 'Bb2', 'Bb2', 'Bb2', 'Bb2', 'Bb2', 'F3', 'Bb2']);
const pE = bs(['E3', 'E3', 'E3', 'E3', 'E3', 'E3', 'B2', 'E3']);
const pEend = bs(['E3', 'E3', 'E3', 'E3', 'E3', 'E3', 'G#3', 'B2']);
const R = 'K . h . S . h . K . h . S . h h';
const Rc = 'C . h . S . h . K . h . S . h h';
const Rf = 'K . h . S . h . K . T T S . t t';
const Rb = 'K . h . S . h . K . h . S . T T';
const Rend = 'K . S . K . S . T T t t S S S O';

export const castle = {
  name: 'Castelo Kazmar', speed: 6, rpb: 4, loop: true, loopStart: 0,
  instruments: { lead, pulse, pulseMaj, arpMin, arpMaj, bass },
  patterns: {
    k1: bar(K1, Am, pA, Rc), k2: bar(K2, E, pA, R), k3: bar(K3, Dm, pA, R), k4: bar(K4, E, pAE, Rf),
    k5: bar(K1, Am, pA, R), k6: bar(K2, E, pA, R), k7: bar(K7, Dm, pA, R), k8: bar(K8, E, pAEd, Rf),
    b1: bar(B1, Dm, pD, Rc), b2: bar(B2, Am, pA, Rb), b3: bar(B3, Bb, pBb, Rb), b4: bar(B4, E, pE, Rf),
    b5: bar(B1, Dmg, pD, Rc), b6: bar(B6, Amg, pA, Rb), b7: bar(B7, Eg, pE, Rb), b8: bar(B8, Eg, pEend, Rend),
  },
  order: ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'],
};
