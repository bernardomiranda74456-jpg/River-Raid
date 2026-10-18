// "Punhos de Vantura" — tela de título. Fanfarra heroica, 140 bpm (speed 6.4 ≈ alternância 6/7).
import { INST } from './instruments.js';
const { leadBright, arpMaj, arpMin, arpSus, bass, stab, padMaj } = INST;
export const title = {
  name: 'Punhos de Vantura (título)', speed: [6, 7], rpb: 4, loop: true, loopStart: 2,
  instruments: { lead: leadBright, arpMaj, arpMin, arpSus, bass, stab, padMaj },
  patterns: {
    i1: { A: 'C5:lead . . . C5 . . . C5 . . . G5 . . .', B: 'C4:padMaj . . . . . . . . . . . . . . .', C: 'C3:bass . . . . . . . C3 . . . . . . .', N: 'K . . . . . . . K . . . . . . .' },
    i2: { A: 'E5 . . . == . . . D5 . E5 . F5 . G5 .', B: 'F3:padMaj . . . . . . . G3 . . . . . . .', C: 'F2 . . . . . . . G2 . . . . . . .', N: 'K . . . S . . . K . . . S . S S' },
    m1: { A: 'A5 . . . == . G5 . E5 . . . C5 . D5 .', B: 'F3:arpMaj . . F3 . . F3 . F3 . . F3 . . F3 .', C: 'F2:bass . F3 . F2 . F3 . F2 . F3 . C3 . E3 .', N: 'K . h . S . h . K . h K S . h h' },
    m2: { A: 'E5 . . . == . . . G5 . A5 . B5 . . .', B: 'C4:arpMaj . . C4 . . C4 . C4 . . C4 . . C4 .', C: 'C3 . C4 . C3 . C4 . C3 . C4 . G2 . B2 .', N: 'K . h . S . h . K . h K S . h h' },
    m3: { A: 'C6 . . . B5 . A5 . G5 . . . E5 . G5 .', B: 'A3:arpMin . . A3 . . A3 . A3 . . A3 . . A3 .', C: 'A2 . A3 . A2 . A3 . A2 . A3 . E2 . G2 .', N: 'K . h . S . h . K . h K S . h h' },
    m4: { A: 'D5 . . . == . . . G5 . F5 . D5 . . .', B: 'G3:arpSus . . G3 . . G3 . G3:arpMaj . . G3 . . G3 .', C: 'G2 . G3 . G2 . G3 . G2 . G3 . B2 . D3 .', N: 'K . h . S . h . K . S . S S S O' },
    m5: { A: 'A5 . . . == . G5 . E5 . . . C5 . D5 .', B: 'F3:arpMaj . . F3 . . F3 . F3 . . F3 . . F3 .', C: 'F2 . F3 . F2 . F3 . F2 . F3 . C3 . E3 .', N: 'K . h . S . h . K . h K S . h h' },
    m6: { A: 'E5 . . . == . . . G5 . A5 . C6 . . .', B: 'C4:arpMaj . . C4 . . C4 . C4 . . C4 . . C4 .', C: 'C3 . C4 . C3 . C4 . C3 . C4 . G2 . B2 .', N: 'K . h . S . h . K . h K S . h h' },
    m7: { A: 'D6 . . . C6 . B5 . A5 . . . G5 . A5 .', B: 'D4:arpMin . . D4 . . D4 . D4 . . D4 . . D4 .', C: 'D3 . D4 . D3 . D4 . D3 . D4 . A2 . C3 .', N: 'K . h . S . h . K . h K S . h h' },
    m8: { A: 'G5 . . . == . . . == . . . G4 . B4 .', B: 'G3:arpMaj . . G3 . . G3 . G3 . . G3 . . G3 .', C: 'G2 . G3 . G2 . G3 . G2 . G3 . G2 . G3 .', N: 'K . h . S . h . K . S . S S S O' },
  },
  order: ['i1', 'i2', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'],
};
