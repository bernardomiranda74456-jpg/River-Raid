// "Cidade Lanterna" — cidade noturna. Funk/synthwave 8-bit, 150 bpm, lá menor; baixo sincopado, acordes de 7ª.
// Motivo: E5 → G5 → A5 (salto cool) e queda C6–B5–A5 — neon piscando.
import { INST } from './instruments.js';
import { rhy, seq, bar } from './lib.js';
const { leadBright, bassShort } = INST;
const CH = [14, 13, 11, 9, 7, 5, 3, 1, 0];
const CHD = { wave: 'pulse25', cutoff: 3000, detune: 10, level: 0.45, reverb: 0.25, delay: 0.16 };
const chM7 = { env: CH, rel: [0], arp: [0, 3, 7, 10], hd: CHD };
const chMaj7 = { env: CH, rel: [0], arp: [0, 4, 7, 11], hd: CHD };
const chDom = { env: CH, rel: [0], arp: [0, 4, 7, 10], hd: CHD };
const funkBass = { env: 'bassShort', hd: { wave: 'saw', cutoff: 1100, sub: true, level: 0.95, reverb: 0.05, delay: 0 } };
const M1 = 'E5:lead . . G5 . . A5 . . . C6 . B5 . A5 .';
const M2 = '. . . . F5:lead . . . A5 . G5 . F5 . D5 .';
const M3 = 'E5:lead . . G5 . . A5 . . . C6 . D6 . C6 .';
const M4 = 'B5:lead . . . . . G5 . A5 . . . == . . .';
const M7 = 'E5:lead . . G5 . . A5 . . . C6 . E6 . D6 .';
const M8 = 'C6:lead . . B5 . . G5 . . . E5 . . . == .';
const B1 = 'C6:lead . . . A5 . C6 . F6 . . . E6 . C6 .';
const B2 = 'D6:lead . . . B5 . D6 . G6 . . . F6 . D6 .';
const B3 = 'E6:lead . . . C6 . . . A5 . . . G5 . A5 .';
const B4 = 'B5:lead . . . == . . . G5 . A5 . B5 . C6 .';
const B6 = 'D6:lead . . . B5 . D6 . G6 . . . E6 . D6 .';
const B7 = 'G#5:lead . . . B5 . . . E6 . . . D6 . B5 .';
const B8 = 'G#5:lead . . . A5 . B5 . == . . . == . . .';
const FK = '...x..x...x....x', FK2 = 'x..x..x...x..x..';
const Am7 = rhy(FK, 'A3', 'chM7'), Dm7 = rhy(FK, 'D4', 'chM7'), Fmaj7 = rhy(FK, 'F3', 'chMaj7'), Em7 = rhy(FK, 'E4', 'chM7');
const G7 = rhy(FK, 'G3', 'chDom'), E7 = rhy(FK2, 'E4', 'chDom');
const Fb = rhy(FK2, 'F3', 'chMaj7'), Gb = rhy(FK2, 'G3', 'chDom'), Amb = rhy(FK2, 'A3', 'chM7');
const FB = 'x..x..x.x..x..x.';
const fb = (notes) => seq(FB, notes, 'bass');
const fAm = fb(['A2', 'A2', 'A3', 'A2', 'G3', 'A3']), fDm = fb(['D3', 'D3', 'A2', 'D3', 'C3', 'D3']);
const fF = fb(['F3', 'F3', 'C3', 'F3', 'E3', 'F3']), fEm = fb(['E3', 'E3', 'B2', 'E3', 'D3', 'E3']);
const fG = fb(['G3', 'G3', 'D3', 'G3', 'F3', 'G3']), fE = fb(['E3', 'E3', 'B2', 'E3', 'D3', 'E3']);
const fEend = fb(['E3', 'E3', 'B2', 'E3', 'G#3', 'B2']);
const F1 = 'K . h h S . h . . K h . S . h h';
const F2 = 'K . h . S . h K . . h . S . h O';
const Ff = 'K . h . S . h . K . S . S S h O';
const Fc = 'C . h h S . h . . K h . S . h h';
const Fend = 'K . h . S . h K . K S . S S s O';

export const city = {
  name: 'Cidade Lanterna', speed: 6, rpb: 4, loop: true, loopStart: 0,
  instruments: { lead: leadBright, chM7, chMaj7, chDom, bass: funkBass },
  patterns: {
    m1: bar(M1, Am7, fAm, Fc), m2: bar(M2, Dm7, fDm, F2), m3: bar(M3, Fmaj7, fF, F1), m4: bar(M4, Em7, fEm, Ff),
    m5: bar(M1, Am7, fAm, F1), m6: bar(M2, Dm7, fDm, F2), m7: bar(M7, Fmaj7, fF, F1), m8: bar(M8, G7, fG, Ff),
    b1: bar(B1, Fb, fF, Fc), b2: bar(B2, Gb, fG, F2), b3: bar(B3, Amb, fAm, F1), b4: bar(B4, Amb, fAm, Ff),
    b5: bar(B1, Fb, fF, F1), b6: bar(B6, Gb, fG, F2), b7: bar(B7, E7, fE, F1), b8: bar(B8, E7, fEend, Fend),
  },
  order: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'],
};
