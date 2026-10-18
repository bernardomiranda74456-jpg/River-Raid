# Formato de música (src/audio/music/*.js)

Tracker de 4 canais: `A` (tom 0, melodia), `B` (tom 1, harmonia/arpejos), `C` (tom 2, baixo), `N` (ruído/bateria).
Ticks a 60 Hz; `speed` = ticks por linha (6 → 150 bpm com `rpb: 4`; 5 → 180; 7 → ~129; `[6,7]` alterna → ~138).

```js
import { INST } from './instruments.js';
export const forest = {
  name: 'Nome original', speed: 6, rpb: 4, loop: true, loopStart: 0,
  instruments: { lead: INST.lead, arpMaj: INST.arpMaj, bass: INST.bass },
  patterns: { a1: { A: 'E5:lead . . G5 ...', B: 'C4:arpMaj . . C4 ...', C: 'C3:bass . C4 .', N: 'K . h . S . h .' } },
  order: ['a1', 'a2'],
};
```

* Tokens separados por espaço; `|` é ignorado; `tok*4` repete. Cada token = 1 linha (semicolcheia com rpb 4).
* Nota: `C4`, `F#3`, `Bb4`; sufixos: `:inst` (troca instrumento), `v12` (volume 0–15; pode combinar: `C4:bassv10`). `.` sustenta, `==` solta.
* Alcance do PSG: A2 (~109 Hz) a B6. Notas mais graves sobem uma oitava automaticamente no modo retrô (no HD o sub-oscilador toca a oitava real).
* Bateria (canal N): `K` bumbo, `k` bumbo leve, `S` caixa, `s` caixa leve, `H` chimbal, `h` chimbal leve, `O` chimbal aberto, `C` prato, `T` tom, `t` tom agudo.
* Todos os canais de um padrão devem ter o mesmo número de linhas (os mais curtos são preenchidos com `.`).
* O primeiro token de cada canal na primeira ocorrência deve indicar o instrumento (`E5:lead`).
* Instrumentos (`INST`): lead, leadSoft, leadBright, pluck, bell, arpMaj, arpMin, arpSus, arpMaj7, arpDom, arpDim, padMaj, padMin, organ, bass, bassShort, bassSoft, stab, echo. Pode definir novos: `{ env: 'pluck'|[níveis 0-15 por tick], rel: [...], arp: [0,4,7], arpSpeed: 1, vib: { delay, rate, depth }, slide: 0, hd: { wave, cutoff, detune, sub, level, reverb, delay, pan } }`.
* Registre a faixa em `src/audio/music/index.js` (`SONGS`).
* Renderize e analise: `node tools/render-audio.mjs nome retro,hd` → `audio-preview/nome-{retro,hd}.wav/.png`
  (duração do loop, picos < 0.95, nenhum silêncio indevido, emenda do loop). Olhe o PNG (forma de onda + espectro).

Diretrizes de composição: melodias cantáveis com motivo claro repetido e variado (AABA), baixo em colcheias
com oitavas, arpejos rápidos (instrumento arp) como "acorde" no canal B, bateria sempre ativa nos temas de fase,
loops de 20–40 s sem emenda audível (último compasso deve conduzir ao primeiro).
