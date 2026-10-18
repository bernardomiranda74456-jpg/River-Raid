// "Lago Espelho" — fase aquática. Flutuante, 100 bpm (speed 9), dó maior com acordes maj7 e arpejos ondulantes.
// Motivo: G5 que desce suave (E5–D5–E5) e sobe ao A5 — como uma ondinha que vai e volta.
import { INST } from './instruments.js';
import { rhy, seq, bar } from './lib.js';
const { leadSoft, bassSoft, bell } = INST;
const HD = { wave: 'sine', cutoff: 3400, detune: 5, level: 0.52, reverb: 0.5, delay: 0.28 };
// Arpejos ondulantes: sobem e descem o acorde (2 ticks por nota)
const waveMaj7 = { env: 'arp', arp: [0, 4, 7, 11, 12, 11, 7, 4], arpSpeed: 2, hd: HD };
const waveMin7 = { env: 'arp', arp: [0, 3, 7, 10, 12, 10, 7, 3], arpSpeed: 2, hd: HD };
const waveSus = { env: 'arp', arp: [0, 5, 7, 10, 12, 10, 7, 5], arpSpeed: 2, hd: HD };
const M1 = 'G5:lead . . . . . E5 . . . D5 . . . E5 .';
const M2 = 'A5:lead . . . . . . . G5 . . . E5 . . .';
const M3 = 'C6:lead . . . . . B5 . . . G5 . . . E5 .';
const M4 = 'F5:lead . . . . . . . E5 . . . == . G6:bell .';
const M5 = 'B5:lead . . . . . G5 . . . A5 . . . B5 .';
const M6 = 'C6:lead . . . . . . . E6 . . . D6 . . .';
const M7 = 'C6:lead . . . A5 . . . F5 . . . A5 . . .';
const M8 = 'D6:lead . . . . . B5 . . . A5 . . == E6:bell .';
const M11 = 'F5:lead . . . . . A5 . . . C6 . . . D6 .';
const M12 = 'E6:lead . . . D6 . . . B5 . . . A5 . D6:bell .';
const HALF = 'x.......x.......', BEAT = 'x...x...x...x...';
const w = (n, i, m = HALF) => rhy(m, n, i);
const BS = 'x.......x.....x.';
const bs = (notes) => seq(BS, notes, 'bass');
const W = 'k . . . h . . . s . . . h . . .';
const Wc = 'C . . . h . . . s . . . h . . .';
const Wf = 'k . . . h . . . s . . . h . O .';
const Wb = 'k . . h h . . . s . . h h . . .';
const Wend = 'k . . . h . . . s . . h s . O .';

export const water = {
  name: 'Lago Espelho', speed: 9, rpb: 4, loop: true, loopStart: 0,
  instruments: { lead: leadSoft, waveMaj7, waveMin7, waveSus, bass: bassSoft, bell },
  patterns: {
    m1: bar(M1, w('C4', 'waveMaj7'), bs(['C3', 'C3', 'E3']), Wc),
    m2: bar(M2, w('F3', 'waveMaj7'), bs(['F3', 'F3', 'C3']), W),
    m3: bar(M3, w('A3', 'waveMin7'), bs(['A2', 'A2', 'E3']), W),
    m4: bar(M4, w('F3', 'waveMaj7'), bs(['F3', 'F3', 'D3']), Wf),
    m5: bar(M5, w('E4', 'waveMin7', BEAT), bs(['E3', 'E3', 'B2']), Wb),
    m6: bar(M6, w('A3', 'waveMin7', BEAT), bs(['A2', 'A2', 'C3']), Wb),
    m7: bar(M7, w('D4', 'waveMin7', BEAT), bs(['D3', 'D3', 'F3']), Wb),
    m8: bar(M8, w('G3', 'waveSus', BEAT), bs(['G3', 'D3', 'B2']), Wf),
    m9: bar(M1, w('C4', 'waveMaj7'), bs(['C3', 'C3', 'E3']), Wc),
    m10: bar(M2, w('F3', 'waveMaj7'), bs(['F3', 'F3', 'C3']), W),
    m11: bar(M11, w('D4', 'waveMin7'), bs(['D3', 'D3', 'A2']), W),
    m12: bar(M12, w('G3', 'waveSus'), bs(['G3', 'D3', 'B2']), Wend),
  },
  order: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10', 'm11', 'm12'],
};
