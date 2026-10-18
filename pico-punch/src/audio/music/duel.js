// "Pedra, Papel, Punho!" — duelo. 180 bpm (speed 5), ré menor, 8 compassos que sobem Dm→Gm→Bb→A e recomeçam.
// Motivo: nota repetida nervosa (D5 . . D5) + trinado curto F5–E5 — dedos tamborilando antes de escolher.
import { INST } from './instruments.js';
import { rhy, seq, bar } from './lib.js';
const { pluck, bassShort } = INST;
const TK = { wave: 'square', cutoff: 3200, detune: 6, level: 0.36, reverb: 0.2, delay: 0.1 };
const tickMin = { env: [13, 10, 7, 4, 1, 0], rel: [0], arp: [0, 3, 7], hd: TK };
const tickMaj = { env: [13, 10, 7, 4, 1, 0], rel: [0], arp: [0, 4, 7], hd: TK };
const U1 = 'D5:lead . . D5 . . F5 . E5 . . . D5 . C#5 .';
const U2 = 'D5:lead . A4 . D5 . . . F5 E5 F5 E5 D5 . . .';
const U3 = 'G5:lead . . G5 . . Bb5 . A5 . . . G5 . F#5 .';
const U4 = 'G5:lead . D5 . G5 . . . Bb5 A5 Bb5 A5 G5 . . .';
const U5 = 'Bb5:lead . . Bb5 . . D6 . C6 . . . Bb5 . A5 .';
const U6 = 'Bb5:lead . F5 . Bb5 . . . D6 C6 D6 C6 Bb5 . . .';
const U7 = 'C#6:lead . . C#6 . . E6 . D6 . . . C#6 . B5 .';
const U8 = 'A5:lead . . . G#5 . A5 . Bb5 . A5 . G#5 . A5 .';
const OFF16 = '.x.x.x.x.x.x.x.x';
const Dm = rhy(OFF16, 'D4', 'tickMin'), Gm = rhy(OFF16, 'G4', 'tickMin'), Bb = rhy(OFF16, 'Bb3', 'tickMaj'), A = rhy(OFF16, 'A3', 'tickMaj');
const EIG = 'x.x.x.x.x.x.x.x.';
const bs = (notes) => seq(EIG, notes, 'bass');
const bD1 = bs(['D3', 'D3', 'D3', 'D3', 'D3', 'D3', 'F3', 'E3']), bD2 = bs(['D3', 'D3', 'D3', 'D3', 'D3', 'D3', 'F3', 'F#3']);
const bG1 = bs(['G3', 'G3', 'G3', 'G3', 'G3', 'G3', 'Bb3', 'A3']), bG2 = bs(['G3', 'G3', 'G3', 'G3', 'G3', 'G3', 'F3', 'A2']);
const bBb1 = bs(['Bb2', 'Bb2', 'Bb2', 'Bb2', 'Bb2', 'Bb2', 'D3', 'C3']), bBb2 = bs(['Bb2', 'Bb2', 'Bb2', 'Bb2', 'Bb2', 'Bb2', 'C#3', 'E3']);
const bA1 = bs(['A2', 'A2', 'A2', 'A2', 'A2', 'A2', 'C#3', 'E3']), bA2 = bs(['A2', 'A2', 'A2', 'A2', 'A2', 'Bb2', 'B2', 'C#3']);
const R = 'K . h . S . h . K . h . S . h h';
const Rc = 'C . h . S . h . K . h . S . h h';
const Rf = 'K . h . S . h . K . S S S S S S';
const Rend = 'K . S . K . S . S S S S S S S O';

export const duel = {
  name: 'Pedra, Papel, Punho!', speed: 5, rpb: 4, loop: true, loopStart: 0,
  instruments: { lead: pluck, tickMin, tickMaj, bass: bassShort },
  patterns: {
    u1: bar(U1, Dm, bD1, Rc), u2: bar(U2, Dm, bD2, R), u3: bar(U3, Gm, bG1, R), u4: bar(U4, Gm, bG2, Rf),
    u5: bar(U5, Bb, bBb1, R), u6: bar(U6, Bb, bBb2, R), u7: bar(U7, A, bA1, R), u8: bar(U8, A, bA2, Rend),
  },
  order: ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'],
};
