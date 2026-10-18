// Jingles curtos (tocam uma vez): fim de fase, item, vida extra, game over.
import { INST } from './instruments.js';
const { lead, leadBright, bell, arpMaj, arpMin, bass, stab, pluck } = INST;

export const clear = {
  name: 'Lanche Merecido (fim de fase)', speed: 5, rpb: 4, loop: false,
  instruments: { lead: leadBright, arpMaj, bass, stab },
  patterns: {
    p1: { A: 'G5:lead . . . G5 . . . A5 . . . B5 . . .  C6 . . . == . . . E5 . F5 . G5 . . .',
          B: 'C4:arpMaj . . . . . . . F3 . . . . . . .  C4 . . . . . . . G3 . . . . . . .',
          C: 'C3:bass . . . C3 . . . F2 . . . F2 . . .  C3 . . . C3 . . . G2 . . . G2 . . .',
          N: 'K . . . S . . . K . . . S . . . K . . . S . . . K . K . S . . .' },
    p2: { A: 'A5 . . . B5 . . . C6 . . . == . . .  C6 . . . == . . . == . . . == . . .',
          B: 'F3:arpMaj . . . G3 . . . C4 . . . . . . .  C4 . . . . . . . . . . . . . . .',
          C: 'F2:bass . . . G2 . . . C3 . . . . . . .  C3 . . . . . . . == . . . . . . .',
          N: 'K . . . S . . . K . . . C . . . . . . . . . . . . . . . . . . .' },
  },
  order: ['p1', 'p2'],
};
export const item = {
  name: 'Item!', speed: 4, rpb: 4, loop: false, instruments: { bell, arpMaj },
  patterns: { p: { A: 'E5:bell . G5 . C6 . E6 . G6 . . . == . . .', B: 'C5:arpMaj . . . . . . . == . . . . . . .', C: '', N: '' } }, order: ['p'],
};
export const oneUp = {
  name: 'Vida extra', speed: 4, rpb: 4, loop: false, instruments: { lead: leadBright, arpMaj },
  patterns: { p: { A: 'C5:lead . E5 . G5 . C6 . E6 . G6 . C7 . == .', B: 'C4:arpMaj . . . . . . . E4 . . . . . . .', C: '', N: '. . . . . . . . . . . . . . . .' } }, order: ['p'],
};
export const gameover = {
  name: 'Game Over', speed: 8, rpb: 4, loop: false, instruments: { lead: INST.leadSoft, arpMin, bass: INST.bassSoft },
  patterns: {
    p: { A: 'E5:lead . . . D5 . . . C5 . . . B4 . . .  A4 . . . == . . . G#4 . . . A4 . . .  == . . . . . . . . . . . . . . .',
         B: 'A3:arpMin . . . . . . . F3 . . . . . . .  E3 . . . . . . . E3 . . . . . . .  A3 . . . . . . . == . . . . . . .',
         C: 'A2:bass . . . . . . . F2 . . . . . . .  E2 . . . . . . . E2 . . . . . . .  A2 . . . . . . . == . . . . . . .',
         N: 'K . . . . . . . . . . . . . . .  T . . . . . . . t . . . . . . .  K . . . . . . . . . . . . . . .' },
  }, order: ['p'],
};
export const victory = {
  name: 'Coração de Sol (vitória final)', speed: 5, rpb: 4, loop: true, loopStart: 2,
  instruments: { lead: leadBright, arpMaj, arpMin, bass, pluck },
  patterns: {
    i1: { A: 'C5:lead . . . E5 . . . G5 . . . C6 . . .', B: 'C4:arpMaj . . . . . . . . . . . . . . .', C: 'C3:bass . . . . . . . C3 . . . . . . .', N: 'C . . . . . . . . . . . . . . .' },
    i2: { A: 'B5 . . . == . . . G5 . A5 . B5 . . .', B: 'G3:arpMaj . . . . . . . . . . . . . . .', C: 'G2 . . . . . . . G2 . . . . . . .', N: 'K . . . S . . . K . . . S . . .' },
    v1: { A: 'C6 . . . == . . . G5 . A5 . B5 . C6 .', B: 'C4:arpMaj . . C4 . . C4 . C4 . . C4 . . C4 .', C: 'C3 . C4 . C3 . C4 . C3 . C4 . G2 . B2 .', N: 'K . h . S . h . K . h K S . h h' },
    v2: { A: 'D6 . . . == . . . B5 . C6 . D6 . . .', B: 'G3:arpMaj . . G3 . . G3 . G3 . . G3 . . G3 .', C: 'G2 . G3 . G2 . G3 . G2 . G3 . B2 . D3 .', N: 'K . h . S . h . K . h K S . h h' },
    v3: { A: 'E6 . . D6 C6 . B5 . A5 . . . C6 . . .', B: 'A3:arpMin . . A3 . . A3 . A3 . . A3 . . A3 .', C: 'A2 . A3 . A2 . A3 . A2 . A3 . E2 . G2 .', N: 'K . h . S . h . K . h K S . h h' },
    v4: { A: 'B5 . . . G5 . . . == . . . E5 . F5 . ', B: 'F3:arpMaj . . F3 . . F3 . G3 . . G3 . . G3 .', C: 'F2 . F3 . F2 . F3 . G2 . G3 . G2 . G3 .', N: 'K . h . S . h . K . S . S S S O' },
  },
  order: ['i1', 'i2', 'v1', 'v2', 'v3', 'v4'],
};
