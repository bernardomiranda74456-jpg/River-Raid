// "Vila Caramelo" — vila/loja. Valsa tranquila em fá maior, ~129 bpm (speed 7, 3 tempos = 12 linhas).
// Motivo: A4–C5–F5 (arpejo que sobe) e respira em E5… C5 D5 — caixinha de música.
import { INST } from './instruments.js';
import { rhy, seq, bar } from './lib.js';
const { bell, leadSoft, bassSoft } = INST;
const STRUM = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
const SHD = { wave: 'pulse12', cutoff: 3200, detune: 7, level: 0.4, reverb: 0.3, delay: 0.12 };
const strumMaj = { env: STRUM, rel: [0], arp: [0, 4, 7], hd: SHD };
const strumMin = { env: STRUM, rel: [0], arp: [0, 3, 7], hd: SHD };
const strumDom = { env: STRUM, rel: [0], arp: [0, 4, 7, 10], hd: SHD };
// Melodia (12 linhas por compasso de 3/4)
const V1 = 'A4:bell . . . C5 . . . F5 . . .';
const V2 = 'E5:bell . . . . . . . C5 . D5 .';
const V3 = 'F5:bell . . . D5 . . . Bb4 . . .';
const V4 = 'C5:bell . . . . . . . Bb4 . G4 .';
const V7 = 'G5:bell . . . F5 . E5 . D5 . . .';
const V8 = 'F5:bell . . . . . . . A4 . C5 .';
const V16 = 'F5:bell . . . . . . . E5 . G4 .';
const B1 = 'D5:lead . . . F5 . . . A5 . . .';
const B2 = 'G5:lead . . . E5 . . . C5 . . .';
const B3 = 'D5:lead . . . F5 . . . Bb5 . . .';
const B4 = 'A5:lead . . . G5 . . . E5 . . .';
const B5 = 'G5:lead . . . A5 . . . Bb5 . . .';
const B6 = 'A5:lead . . . . . . . G5 . . .';
const B7 = 'F5:lead . . . E5 . . . D5 . . .';
const B8 = 'C5:lead . . . . . . . Bb4 . G4 .';
// "pá-pá" nos tempos 2 e 3
const PAH = '....x...x...';
const F = rhy(PAH, 'F4', 'strumMaj'), Bb = rhy(PAH, 'Bb3', 'strumMaj'), C7 = rhy(PAH, 'C4', 'strumDom');
const Dm = rhy(PAH, 'D4', 'strumMin'), Am = rhy(PAH, 'A3', 'strumMin'), Gm = rhy(PAH, 'G3', 'strumMin');
const GmC7 = '. . . . G3:strumMin . . . C4:strumDom . . .';
// Baixo: "um" no tempo 1 (tônica/quinta alternadas); caminhadas no fim das frases
const oom = (n) => rhy('x...........', n, 'bass');
const walk = (a, b, c) => seq('x...x...x...', [a, b, c], 'bass');
const W = 'K . . . h . . . h . . .';
const Ws = 'K . . . s . . . h . . .';
const Wf = 'K . . . s . . . s . s .';
const Wc = 'C . . . h . . . h . . .';

export const village = {
  name: 'Vila Caramelo', speed: 7, rpb: 3, loop: true, loopStart: 0,
  instruments: { bell, lead: leadSoft, strumMaj, strumMin, strumDom, bass: bassSoft },
  patterns: {
    v1: bar(V1, F, oom('F3'), Wc), v2: bar(V2, F, oom('C3'), W), v3: bar(V3, Bb, oom('Bb2'), W), v4: bar(V4, C7, walk('C3', 'E3', 'G3'), Wf),
    v5: bar(V1, F, oom('F3'), W), v6: bar(V2, F, oom('C3'), W), v7: bar(V7, GmC7, walk('G3', 'C3', 'E3'), Ws), v8: bar(V8, F, walk('F3', 'A2', 'C3'), Wf),
    b1: bar(B1, Dm, oom('D3'), Wc), b2: bar(B2, Am, oom('A2'), W), b3: bar(B3, Bb, oom('Bb2'), W), b4: bar(B4, C7, walk('C3', 'G3', 'E3'), Wf),
    b5: bar(B5, Gm, oom('G3'), Ws), b6: bar(B6, C7, oom('C3'), W), b7: bar(B7, Dm, oom('D3'), Ws), b8: bar(B8, C7, walk('C3', 'E3', 'G3'), Wf),
    v9: bar(V1, F, oom('F3'), Wc), v10: bar(V2, F, oom('C3'), W), v11: bar(V3, Bb, oom('Bb2'), W), v12: bar(V4, C7, walk('C3', 'E3', 'G3'), Wf),
    v13: bar(V1, F, oom('F3'), W), v14: bar(V2, F, oom('C3'), W), v15: bar(V7, GmC7, walk('G3', 'C3', 'E3'), Ws), v16: bar(V16, C7, walk('C3', 'E3', 'G3'), Wf),
  },
  order: ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'v9', 'v10', 'v11', 'v12', 'v13', 'v14', 'v15', 'v16'],
};
