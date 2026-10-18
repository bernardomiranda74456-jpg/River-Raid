// "Bosque Sussurro" — tema de fase (floresta). Saltitante, 150 bpm, ré maior, forma AABA.
// Motivo: salto de 4ª (A4→D5) + terça (F#5) que cai por graus — "pulinho de esquilo".
import { INST } from './instruments.js';
import { rhy, seq, bar } from './lib.js';
const { lead, arpMaj, arpMin, bass, pluck } = INST;
const L = 'lead';
// Melodia (16 linhas = 1 compasso)
const A1 = 'A4:lead . . D5 F#5 . E5 . D5 . . . A4 . B4 .';
const A2 = 'D5:lead . . . B4 . D5 . F#5 . . . E5 . D5 .';
const A3 = 'B4:lead . . D5 E5 . D5 . B4 . . . G4 . A4 .';
const A4 = 'B4:lead . . . == . . . F#4 . E4 . F#4 . G4 .';
const A7 = 'B4:lead . . D5 E5 . F#5 . G5 . . . F#5 . E5 .';
const A8 = 'D5:lead . . . == . . . A4 . B4 . C#5 . == .';
const B1 = 'E5:lead . . . G5 . E5 . B5 . . . A5 . G5 .';
const B2 = 'F#5:lead . . . D5 . F#5 . A5 . . . G5 . F#5 .';
const B3 = 'B5:lead . . A5 F#5 . D5 . F#5 . . . A5 . . .';
const B4 = 'G5:lead . . F#5 E5 . C#5 . E5 . . . == . . .';
const A12 = 'B4:lead . . . == . . . E5 . . . C#5 . B4 .';
// Harmonia: acordes em contratempo (seção A) e 3-3-2 (ponte)
const OFF = '..x.=.x.=.x.=.x.', TRE = 'x..x..x.x..x..x.';
const ch = (n, i, m = OFF) => rhy(m, n, i);
const D = (m) => ch('D4', 'arpMaj', m), Bm = (m) => ch('B3', 'arpMin', m), G = (m) => ch('G3', 'arpMaj', m), A = (m) => ch('A3', 'arpMaj', m), Em = (m) => ch('E4', 'arpMin', m);
// Baixo em colcheias (tônica/quinta + condução)
const B8 = 'x.x.x.x.x.x.x.x.';
const bs = (notes) => seq(B8, notes, 'bass');
const bD_Bm = bs(['D3', 'A2', 'D3', 'A2', 'D3', 'A2', 'C#3', 'B2']);
const bBm_G = bs(['B2', 'F#3', 'B2', 'F#3', 'B2', 'F#3', 'D3', 'F#3']);
const bG_A = bs(['G3', 'D3', 'G3', 'D3', 'G3', 'D3', 'F#3', 'E3']);
const bA_D = bs(['A2', 'E3', 'A2', 'E3', 'A2', 'E3', 'C#3', 'E3']);
const bA_Em = bs(['A2', 'E3', 'A2', 'E3', 'A2', 'E3', 'G3', 'F#3']);
const bEm_G = bs(['E3', 'B2', 'E3', 'B2', 'E3', 'B2', 'D3', 'F#3']);
const bG_Bm = bs(['G3', 'D3', 'G3', 'D3', 'G3', 'D3', 'A2', 'A3']);
const bBm_A = bs(['B2', 'F#3', 'B2', 'F#3', 'B2', 'F#3', 'D3', 'C#3']);
const bA_Dw = bs(['A2', 'E3', 'A2', 'E3', 'C#3', 'E3', 'G3', 'A3']);
// Bateria
const DR = 'K . h . S . h . K . h K S . h h';
const DRc = 'C . h . S . h . K . h K S . h h';
const DRf = 'K . h . S . h . K . S . S S S O';
const DRb = 'K . h . S . h O K . h . S . h h';
const DRend = 'K . h . S . h . K . S S S . S O';

export const forest = {
  name: 'Bosque Sussurro', speed: 6, rpb: 4, loop: true, loopStart: 0,
  instruments: { lead, arpMaj, arpMin, bass, pluck },
  patterns: {
    a1: bar(A1, D(), bD_Bm, DRc), a2: bar(A2, Bm(), bBm_G, DR), a3: bar(A3, G(), bG_A, DR), a4: bar(A4, A(), bA_D, DRf),
    a5: bar(A1, D(), bD_Bm, DR), a6: bar(A2, Bm(), bBm_G, DR), a7: bar(A7, G(), bG_A, DR), a8: bar(A8, A(), bA_Em, DRf),
    b1: bar(B1, Em(TRE), bEm_G, DRc), b2: bar(B2, G(TRE), bG_Bm, DRb), b3: bar(B3, Bm(TRE), bBm_A, DRb), b4: bar(B4, A(TRE), bA_Dw, DRf),
    a9: bar(A1, D(TRE), bD_Bm, DRc), a10: bar(A2, Bm(TRE), bBm_G, DRb), a11: bar(A3, G(TRE), bG_A, DR), a12: bar(A12, A(TRE), bA_D, DRend),
  },
  order: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'b1', 'b2', 'b3', 'b4', 'a9', 'a10', 'a11', 'a12'],
};
