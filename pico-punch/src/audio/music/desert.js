// "Ruínas de Areia" — deserto/ruínas. Lá frígio dominante (A Bb C# D E F G), 150 bpm, toms na percussão.
// Motivo: A4 → Bb4–C#5 (segunda aumentada) → D5, voltando C#5–Bb4 — serpente de areia.
import { INST } from './instruments.js';
import { rhy, seq, bar } from './lib.js';
const { lead, arpMaj, arpMin, bass } = INST;
// Acorde "frígio": tônica, 3ª maior, 5ª e a 2ª menor como pontada
const arpPhr = { env: 'arp', arp: [0, 4, 7, 1], hd: { wave: 'square', cutoff: 2600, detune: 6, level: 0.4, reverb: 0.3, delay: 0.12 } };
const D1 = 'A4:lead . . . Bb4 . C#5 . D5 . . . C#5 . Bb4 .';
const D2 = 'A4:lead . . . == . . . E5 . D5 . C#5 . D5 .';
const D3 = 'E5:lead . . . F5 . E5 . D5 . . . C#5 . D5 .';
const D4 = 'Bb4:lead . . . == . . . A4 . . . == . . .';
const D7 = 'E5:lead . . . F5 . G5 . A5 . . . G5 . F5 .';
const D8 = 'E5:lead . . . == . . . F5 . E5 . == . . .';
const D9 = 'A5:lead . . . F5 . A5 . D6 . . . C#6 . D6 .';
const D10 = 'Bb5:lead . . . A5 . G5 . F5 . . . G5 . A5 .';
const D11 = 'D6:lead . . . C#6 . Bb5 . A5 . . . G5 . F5 .';
const D12 = 'E5:lead . . . F5 . E5 . C#5 . . . == . . .';
const D16 = 'Bb4:lead . . . A4 . . . G4 . . . == . . .';
const R = 'x..x.x..x..x.x..'; // 3-2-3 3-2-3
const A = rhy(R, 'A3', 'arpMaj'), Ap = rhy(R, 'A3', 'arpPhr'), Dm = rhy(R, 'D4', 'arpMin'), F = rhy(R, 'F3', 'arpMaj'), Gm = rhy(R, 'G3', 'arpMin'), Bb = rhy(R, 'Bb3', 'arpMaj');
const BbA = 'Bb3:arpMaj . . Bb3 . Bb3 . . A3:arpPhr . . A3 . A3 . .';
const bs = (notes) => seq(R, notes, 'bass');
const bA = bs(['A2', 'A2', 'A3', 'A2', 'Bb2', 'A2']);
const bA2 = bs(['A2', 'A3', 'A2', 'A2', 'G3', 'A3']);
const bDm = bs(['D3', 'D3', 'A2', 'D3', 'F3', 'E3']);
const bF = bs(['F3', 'F3', 'C3', 'F3', 'E3', 'D3']);
const bGm = bs(['G3', 'G3', 'D3', 'G3', 'Bb2', 'A2']);
const bBb = bs(['Bb2', 'Bb2', 'F3', 'Bb2', 'D3', 'C#3']);
const bBbA = bs(['Bb2', 'Bb2', 'F3', 'A2', 'A2', 'A3']);
const P = 'K . t . S . . t K . t . S . t t';
const Pc = 'C . t . S . . t K . t . S . t t';
const Pf = 'K . t . S . t . T . T . t t t t';
const Pb = 'K . t t S . t . K . t t S . T .';
const Pend = 'K . t . S . t . T . T . T t S O';

export const desert = {
  name: 'Ruínas de Areia', speed: 6, rpb: 4, loop: true, loopStart: 0,
  instruments: { lead, arpPhr, arpMaj, arpMin, bass },
  patterns: {
    d1: bar(D1, A, bA, Pc), d2: bar(D2, Ap, bA2, P), d3: bar(D3, Dm, bDm, P), d4: bar(D4, BbA, bBbA, Pf),
    d5: bar(D1, A, bA, P), d6: bar(D2, Ap, bA2, P), d7: bar(D7, F, bF, P), d8: bar(D8, Ap, bA, Pf),
    d9: bar(D9, Dm, bDm, Pc), d10: bar(D10, Gm, bGm, Pb), d11: bar(D11, Bb, bBb, Pb), d12: bar(D12, Ap, bA2, Pf),
    d13: bar(D1, A, bA, Pc), d14: bar(D2, Ap, bA2, P), d15: bar(D3, Dm, bDm, P), d16: bar(D16, BbA, bBbA, Pend),
  },
  order: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', 'd10', 'd11', 'd12', 'd13', 'd14', 'd15', 'd16'],
};
