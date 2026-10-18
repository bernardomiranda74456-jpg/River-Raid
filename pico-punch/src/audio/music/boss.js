// "Punho de Ferro" — chefe. 180 bpm (speed 5), mi menor com cromatismo; ostinato de baixo E–E–E–G–E–E–Bb–B.
// Motivo: E5–G5–Bb5 (trítono) que escorrega A5–G5–F#5–F5 — o chefe avançando.
import { INST } from './instruments.js';
import { rhy, seq, bar } from './lib.js';
const { leadBright, arpMin, arpMaj, arpDim, arpDom } = INST;
const growl = { env: 'bassShort', hd: { wave: 'saw', cutoff: 1200, sub: true, level: 0.82, reverb: 0.05, delay: 0 } };
const O1 = 'E5:lead . . G5 . . Bb5 . A5 . G5 . F#5 . F5 .';
const O2 = 'E5:lead . . . == . . . B4 . C5 . C#5 . D5 .';
const O3 = 'E5:lead . . G5 . . Bb5 . B5 . . . D6 . C#6 .';
const O4 = 'C6:lead . . . B5 . . . Bb5 . A5 . G#5 . G5 .';
const O7 = 'E5:lead . . G5 . . Bb5 . B5 . D6 . E6 . F6 .';
const O8 = 'E6:lead . . . Eb6 . D6 . C#6 . C6 . B5 . Bb5 .';
const B1 = 'G5:lead . . . C6 . . . B5 . . . Bb5 . A5 .';
const B2 = 'G#5:lead . . . G5 . . . == . . . F#5 . G5 .';
const B3 = 'F5:lead . . . Bb5 . . . A5 . . . Ab5 . G5 .';
const B4 = 'F#5:lead . . . == . . . D#5 . E5 . F5 . F#5 .';
const B6 = 'G#5:lead . . . G5 . . . Bb5 . . . B5 . C6 .';
const B7 = 'D6:lead . . . C#6 . . . C6 . . . B5 . Bb5 .';
const B8 = 'B5:lead . . . A5 . G5 . F#5 . . . D#5 . F#5 .';
const TRE = 'x..x..x.x..x..x.', OFF = '..x...x...x...x.';
const Em = (m = TRE) => rhy(m, 'E4', 'arpMin'), Dim = (m = TRE) => rhy(m, 'Bb3', 'arpDim'), C = (m = TRE) => rhy(m, 'C4', 'arpMaj');
const Bb = (m = TRE) => rhy(m, 'Bb3', 'arpMaj'), Bd = (m = TRE) => rhy(m, 'B3', 'arpDom'), DimE = (m = TRE) => rhy(m, 'E4', 'arpDim');
const EIG = 'x.x.x.x.x.x.x.x.';
const ost = (r, o3, t1, t2) => seq(EIG, [r, r, r, o3, r, r, t1, t2], 'bass');
const oE = ost('E3', 'G3', 'Bb2', 'B2'), oC = ost('C3', 'Eb3', 'F#3', 'G3'), oBb = ost('Bb2', 'Db3', 'E3', 'F3'), oB = ost('B2', 'D3', 'F3', 'F#3');
const oEend = seq(EIG, ['E3', 'E3', 'E3', 'G3', 'E3', 'Bb2', 'B2', 'D#3'], 'bass');
const R = 'K . K . S . h . K . K . S . h .';
const Rc = 'C . K . S . h . K . K . S . h .';
const Rf = 'K . K . S . h . K . S . T T t t';
const Rb = 'K . h K S . h . K . h K S . h O';
const Rend = 'K . K . S . K . T T t t S S S O';

export const boss = {
  name: 'Punho de Ferro', speed: 5, rpb: 4, loop: true, loopStart: 0,
  instruments: { lead: leadBright, arpMin, arpMaj, arpDim, arpDom, bass: growl },
  patterns: {
    o1: bar(O1, Em(), oE, Rc), o2: bar(O2, Em(), oE, R), o3: bar(O3, Em(), oE, R), o4: bar(O4, Dim(), oE, Rf),
    o5: bar(O1, Em(), oE, R), o6: bar(O2, Em(), oE, R), o7: bar(O7, Em(), oE, R), o8: bar(O8, DimE(), oEend, Rf),
    b1: bar(B1, C(OFF), oC, Rc), b2: bar(B2, C(OFF), oC, Rb), b3: bar(B3, Bb(OFF), oBb, Rb), b4: bar(B4, Bd(OFF), oB, Rf),
    b5: bar(B1, C(OFF), oC, Rc), b6: bar(B6, C(OFF), oC, Rb), b7: bar(B7, Bb(OFF), oBb, Rb), b8: bar(B8, Bd(), oB, Rend),
  },
  order: ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'],
};
