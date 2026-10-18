// "Subida do Monte Agulha" — tema da fase 1 (montanha). Manhã, brilhante, 150 bpm, dó maior.
import { INST } from './instruments.js';
const { lead, arpMaj, arpMin, bass, pluck } = INST;
// Padrões de 1 compasso (16 linhas). Melodia principal:
const A1 = 'E5 . . G5 A5 . G5 . E5 . . . C5 . D5 .';
const A2 = 'D5 . . . B4 . D5 . G5 . . . == . . .';
const A3 = 'A5 . . G5 E5 . C5 . A4 . . . C5 . D5 .';
const A4 = 'F5 . E5 . D5 . C5 . D5 . . . == . . .';
const A6 = 'D5 . . . B4 . D5 . G5 . A5 . B5 . . .';
const A7 = 'C6 . . B5 A5 . G5 . F5 . . . E5 . D5 .';
const A8 = 'C5 . . . == . . . D5 . . . == . . .';
const B1 = 'A4 . . B4 C5 . B4 . A4 . . . E5 . . .';
const B2 = 'F5 . . E5 D5 . C5 . A4 . . . C5 . D5 .';
const B3 = 'E5 . . . G5 . . . E5 . D5 . C5 . . .';
const B4 = 'D5 . . . B4 . . . G4 . . . == . . .';
const B6 = 'F5 . . G5 A5 . G5 . F5 . . . E5 . D5 .';
const B7 = 'B4 . . C5 D5 . E5 . F5 . . . D5 . . .';
const B8 = 'G5 . . . == . . . G4 . A4 . B4 . . .';
// Acompanhamento (arpejos) e baixo por acorde
const arp = (n, i) => `${n}:${i} . . ${n} . . ${n} . ${n} . . ${n} . . ${n} .`;
const bs = (r, o, w1, w2) => `${r}:bass . ${o} . ${r} . ${o} . ${r} . ${o} . ${w1} . ${w2} .`;
const C = { A: arp('C4', 'arpMaj'), B: bs('C3', 'C4', 'G2', 'B2') };
const G = { A: arp('G3', 'arpMaj'), B: bs('G2', 'G3', 'B2', 'D3') };
const Am = { A: arp('A3', 'arpMin'), B: bs('A2', 'A3', 'E2', 'G2') };
const F = { A: arp('F3', 'arpMaj'), B: bs('F2', 'F3', 'C3', 'E3') };
const DR = 'K . h . S . h . K . h K S . h h';
const DRfill = 'K . h . S . h . K . S . S S S O';
const bar = (mel, ch, dr = DR) => ({ A: mel, B: ch.A, C: ch.B, N: dr });

export const mountain = {
  name: 'Subida do Monte Agulha', speed: 6, rpb: 4, loop: true, loopStart: 0,
  instruments: { lead, arpMaj, arpMin, bass, pluck },
  patterns: {
    a1: bar(A1, C), a2: bar(A2, G), a3: bar(A3, Am), a4: bar(A4, F, DRfill),
    a5: bar(A1, C), a6: bar(A6, G), a7: bar(A7, F), a8: bar(A8, G, DRfill),
    b1: bar(B1, Am), b2: bar(B2, F), b3: bar(B3, C), b4: bar(B4, G, DRfill),
    b5: bar(B1, Am), b6: bar(B6, F), b7: bar(B7, G), b8: bar(B8, G, DRfill),
  },
  order: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'],
};
// Primeiro token de cada canal precisa de instrumento: garantimos abaixo.
mountain.patterns.a1.A = mountain.patterns.a1.A.replace('E5', 'E5:lead');
