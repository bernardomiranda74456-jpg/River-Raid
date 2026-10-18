# PICO PUNCH — Punhos de Vantura

Jogo de plataforma 2D para navegador, inspirado nas **mecânicas** dos jogos de plataforma 8-bit de
1986: soco gigante que quebra blocos e derrota inimigos, sacos de dinheiro, lojas com itens e veículos,
natação, escalada e duelos de pedra-papel-tesoura antes dos chefes. Herói, mundo, inimigos, nomes,
arte, fases e trilha sonora são **100% originais** (nenhuma arte, texto ou melodia de terceiros).

Dois modos gráficos, alternáveis a qualquer momento com **TAB**, sem interromper o jogo:

| | HD Remaster | Retrô |
|---|---|---|
| Resolução | nativa (16:9, arte independente de resolução) | 256×192, escala por inteiro, câmera travada no pixel |
| Cores | 24 bits + iluminação dinâmica | paleta Master System (64 cores, 2 bits/canal), 16 de fundo + 16 de sprites |
| Luz | sol direcional com sombras projetadas, luzes pontuais com oclusão, AO, normal maps | — |
| Fundo | parallax em 6+ camadas, ciclo de cor por fase | 2–3 camadas pixel art |
| Shaders | água (refração/cáusticas), lava emissiva, calor no deserto, folhagem ao vento | — |
| Pós | bloom, color grading por fase, vinheta, aberração cromática em impactos, CRT opcional | CRT opcional (scanlines, curvatura, máscara, bleed) |
| Música | as mesmas composições arranjadas (PeriodicWave, filtros, sub-baixo, bateria, reverb/delay) | emulação do SN76489 (3 tons + ruído LFSR) |

## Como rodar

**Arquivo único (como `enduro.html`)**: abra `pico-punch.html`, na raiz do repositório, com duplo clique —
não precisa de servidor. Ele é gerado a partir deste diretório por `node tools/build-single.mjs`
(esbuild empacota `src/` + Pixi; as fases JSON e o AudioWorklet do PSG vão embutidos). Sempre que editar
`src/` ou `levels/`, rode o build de novo (`npm run build:single`).

**Projeto em módulos** (desenvolvimento):

Projeto estático (HTML + ES modules); qualquer servidor de arquivos serve:

```bash
cd pico-punch
npx serve .            # ou: python -m http.server 8787 / node tools/serve.mjs "$PWD" 8787
# abra http://localhost:3000 (serve) ou http://localhost:8787
```

O Pixi.js 8.22.0 está vendorizado em `vendor/pixi.min.mjs` (cópia do pacote npm). Para usar o CDN,
troque o importmap em `index.html` por `https://cdn.jsdelivr.net/npm/pixi.js@8.22.0/dist/pixi.min.mjs`.
Precisa de WebGL2. O áudio só inicia após o primeiro toque/tecla (política dos navegadores).

Parâmetros de URL úteis para desenvolvimento: `?level=3` (abre a fase 3), `?mode=hd|retro`, `?crt=1`,
`?bot=1` (bot de teste), `?fast=4` (acelera o tempo), `?file=levels/test-arena.json` (fase avulsa).

## Controles

| Ação | Teclado | Gamepad | Celular |
|---|---|---|---|
| Mover | ← → / A D | analógico / d-pad | direcional virtual |
| Pular (altura variável) | Z / Espaço | A / X | PULO |
| Socar (↑ soca para cima; ↓ no ar soca para baixo) | X / K | B / Y | SOCO |
| Agachar / descer de plataforma (↓ + pulo) | ↓ / S | d-pad ↓ | direcional ↓ |
| Nadar (braçada) | pulo dentro d'água | | |
| Escalar | ↑ ↓ em escadas/trepadeiras | | |
| Entrar na loja | ↑ na porta | | |
| Duelo | ← pedra · ↑ papel · → tesoura | | |
| Moto | corre sozinha; pulo salta; ← → ajusta velocidade | | |
| Helipé | segure pulo para subir; soco atira | | |
| Pausa | Esc / Enter / P | Start | II |
| HD ↔ Retrô | TAB | Select | HD/8b |

Teclas remapeáveis em **Opções → Controles**. Volumes de música e efeitos, modo gráfico, CRT e o
limite de 8 sprites por linha ficam salvos em `localStorage`, junto com o progresso (fases
desbloqueadas, dinheiro, vidas, melhores tempos e placares).

## Jogo

* **Pico**, herói de punhos enormes das ilhas flutuantes de **Vantura**, persegue o **Vizir Kazmar**,
  que roubou o Coração de Sol.
* 10 fases desenhadas à mão: Monte Agulha (escalada), Bosque Sussurro (chefe Rã-Rei Bufo), Lago
  Espelho (natação), Vila Caramelo (loja), Ruínas de Areia (chefe Escorpião Dunar), Estrada do Trovão
  (moto), Céu de Vantura (helicóptero a pedal), Caverna Brasa (lava, chefe Morcegão Brasa), Cidade
  Lanterna (noite) e Castelo Kazmar (chefe final).
* Blocos: estrela (saco de dinheiro), interrogação (item ou surpresa — às vezes um fantasma que
  persegue você), escondidos (cabeçada por baixo) e de pedra (só veículos quebram).
* Loja: Motoca Trovão, Helipé, Barquinho, Pulseira de Raio (soco dispara raio, 30 cargas), Capa
  Planadora, Cápsula Estelar (invencibilidade), Fantasminha Amigo (orbita e derrota inimigos), Vida
  Extra e Olho Mágico (revela a escolha do adversário no duelo). Capa, fantasma e pulseira se perdem
  ao morrer.
* **Duelo de Mãos**: melhor de 3 antes de cada chefe. O adversário tem *tells*: no segundo tempo da
  contagem ele se inclina para a esquerda (pedra), balança (papel) ou treme (tesoura); além disso,
  tende a jogar o que vence a sua última escolha. Perder o duelo custa uma vida.
* Fim de fase: Pico devora um pastel (gag original) enquanto toca o jingle; depois, placar com tempo,
  pontos e dinheiro. Checkpoints (sinos), vidas, continue e salvamento automático.

### As dez fases

| # | Fase | Tema / hora | Tamanho | Destaques |
|---|---|---|---|---|
| 1 | Monte Agulha | montanha, manhã | 48×44 | escalada vertical com escadas, neve no cume, rolões |
| 2 | Bosque Sussurro | floresta, dia | 224×14 | dois andares, pontes, trepadeiras; chefe Rã-Rei Bufo |
| 3 | Lago Espelho | lago, dia | 200×16 | natação, caverna submersa, gruta de águas-vivas, barco opcional |
| 4 | Vila Caramelo | vila, entardecer | 180×12 | loja, casas de passagem, cofre de pedra (moto) |
| 5 | Ruínas de Areia | deserto, entardecer | 230×14 | templos, calor tremulando (HD); chefe Escorpião Dunar |
| 6 | Estrada do Trovão | estrada, dia | 320×12 | moto em auto-corrida, fileiras de blocos de pedra, buracos |
| 7 | Céu de Vantura | céu, dia | 260×16 | Helipé entre ilhas flutuantes, drones, torres de blocos |
| 8 | Caverna Brasa | caverna | 220×16 | lava, morcegos, cristais luminosos; chefe Morcegão Brasa |
| 9 | Cidade Lanterna | cidade, noite | 240×14 | prédios em corte, escadas, guardas com escudo, drones |
| 10 | Castelo Kazmar | castelo | 260×16 | ameias, masmorra, fantasmas, lava; chefe final Vizir Kazmar |

## Arquitetura

```
index.html                 importmap, canvas único, botões de toque
src/main.js                Game: Pixi.Application, loop fixo 60 Hz + interpolação, estados, troca de modo
src/core/                  loop.js (timestep fixo), input.js (teclado/gamepad/toque, remapeável),
                           save.js (localStorage), math.js (RNG determinístico), bot.js (bot de teste)
src/world/                 tilemap.js (JSON ASCII → grid, autotiling), physics.js (AABB, mão única,
                           escadas), level.js (regras: blocos, dinheiro, vidas, checkpoints, meta),
                           camera.js (look-ahead, zonas, zoom, shake), entities/ (hero, enemies, boss,
                           items/efeitos/projéteis, vehicles)
src/render/                palette.js (SMS), pixelart.js (matrizes → texturas), art/ (toda a pixel art
                           original: herói composto por partes, inimigos, chefes, itens, tiles por tema,
                           fonte 8×8), artbank.js (texturas por modo), scene.js (grafo compartilhado:
                           tiles com culling por coluna, views de entidades, sombras, partículas),
                           hud.js, text.js (fonte bitmap), particles.js (pool), parallax.js (retrô),
                           retro/ (RenderTexture 256×192, limite de sprites por linha),
                           hdart.js (arte HD: EPX ×4 → ×6, sombreamento, normal maps; solo Worley),
                           hd/ (hd.js renderizador por passes, lighting.js, postfx.js, parallax-hd.js)
src/audio/                 psg-worklet.js (SN76489 em AudioWorklet), psg.js (wrapper + fallback),
                           sequencer.js (tracker: padrões, instrumentos, lookahead), hdsynth.js
                           (arranjo HD), sfx.js (efeitos PSG), audio.js (mixer, ducking, troca de modo),
                           music/ (faixas como dados)
src/ui/                    ui.js (título, seleção, opções, pausa, resultados), shop.js, duel.js, story.js
levels/*.json              fases (ASCII), tools/levelN.py (geradores validados)
test/e2e.mjs               Playwright: bot atravessa a fase, valida colisões e fim de fase, console limpo
tools/                     serve.mjs, shot.mjs, probe.mjs, eval.mjs, texdump.mjs, render-audio.mjs,
                           render.html (OfflineAudioContext → WAV + análise), lint-level.mjs
```

### Loop e estado

Estado de jogo (entidades, tilemap, câmera) é independente do renderizador. `GameLoop` acumula tempo
real e executa `update(1/60)` em passo fixo (até 5 por frame, com `timeScale` para testes); o render
recebe `alpha` e interpola posições (`px/py → x/y`). Unidades de mundo = pixels do modo retrô
(tile = 16). Não há alocação no loop quente: partículas, luzes e listas de entidades usam pools e
compactação in-place.

### Renderização nos dois modos

O grafo de cena é o mesmo. `ArtBank` devolve texturas conforme o modo: no retrô, atlases pixel art
(nearest) e a cena é renderizada numa `RenderTexture` 256×192 ampliada por inteiro; no HD, texturas
procedurais 6× com normal maps (R,G = normal; B = emissivo; A = cobertura). O renderizador HD faz:
(1) fundo + mundo difuso → RT; (2) mundo com texturas de normais → RT; (3) filtro de iluminação
(sol com sombras raymarched no mapa de tiles, luzes pontuais com oclusão, AO, água, especular,
emissivos); (4) bloom (downsample + blur separável); (5) grading/vinheta/aberração/calor; (6) CRT
opcional; HUD por cima sem luz. Trocar de modo troca texturas, filtros e o backend de áudio.

### Áudio

`PsgProcessor` emula o SN76489: contadores de 10 bits a 223,7 kHz, saída quadrada por canal, ruído
com LFSR de 16 bits (taps 0 e 3, branco/periódico, taxas /16 /32 /64 ou acoplado ao tom 2), atenuação
em 16 passos de 2 dB, filtro de caixa para anti-alias e passa-altas para DC. Eventos chegam com tempo
absoluto e são aplicados por amostra. O `Sequencer` roda ticks a 60 Hz agendados com lookahead de
160 ms no relógio do `AudioContext` (um `setInterval` só acorda o agendador), com macros de volume,
arpejos, vibrato e slides por instrumento. `HDSynth` recebe os mesmos eventos e toca com
`PeriodicWave`, dois osciladores destunados, filtro com envelope, sub-baixo, bateria sintetizada,
reverb por convolução e delay sincronizado ao andamento. Efeitos sonoros são sequências de frames
PSG numa segunda instância do chip; o motor dos veículos usa um canal contínuo com pitch pela
velocidade. Jingles tocam numa terceira instância com *ducking* da música.

## Como adicionar uma fase

1. Copie `tools/level1.py`, desenhe o mapa em ASCII (legenda em `docs/LEVELS.md`), gere o JSON em
   `levels/` e registre em `src/levels.js`.
2. `node tools/lint-level.mjs levels/minha-fase.json` e `node test/e2e.mjs <n> retro 5` (com `botPath`).
3. Novos temas: paleta em `src/render/palette.js`, receita de solo em `src/render/art/tiles.js`,
   aparência HD em `src/render/hdart.js` (`THEME_LOOK`) e fundo em `parallax.js`/`hd/parallax-hd.js`.

## Como adicionar uma música

1. Crie `src/audio/music/nome.js` no formato do tracker (`docs/MUSIC.md`) e registre em `index.js`.
2. `node tools/render-audio.mjs nome retro,hd` gera `audio-preview/nome-{retro,hd}.wav/.png` com
   análise (pico, silêncios, emenda do loop).
3. Use o nome em `"music"` da fase ou em `audio.music.play('nome')`.

## Testes

```bash
node tools/serve.mjs "$PWD" 8787 &
node test/e2e.mjs 1 retro 5          # bot atravessa a fase 1; PASS exige meta + 0 violações + console limpo
PP_URL=file://$PWD/../pico-punch.html node test/e2e.mjs 1 retro 5   # mesmo teste sobre o arquivo único
node test/run-all.mjs 5              # as 10 fases em sequência (fases de chefe: chegar ao duelo conta)
node tools/make-screenshots.mjs      # conjunto final em screenshots/ (aceita um regex: "hd|chefe")
node tools/render-audio.mjs          # todas as faixas → audio-preview/ (WAV 22 kHz + PNG de análise)
node tools/render-audio.mjs sfx      # todos os efeitos num único WAV
node tools/lint-level.mjs levels/l2-bosque-sussurro.json
node tools/colorcount.mjs screenshots/l1-monte-agulha-retro.png   # cores distintas (≤ 32 no retrô)
```

Resultado da última suíte (Chromium headless, `fast=5`): as 10 fases concluídas pelo bot com 0 violações
de colisão e console limpo; fases 2, 5, 8 e 10 terminam no duelo (o bot não joga pedra-papel-tesoura).
O bot é um jogador heurístico — o número de mortes dele não mede a dificuldade para humanos.

As capturas finais são jogadas em retrô (rápido mesmo com GL por software) e, para as versões HD, o modo é
trocado no instante da foto — o mesmo TAB que o jogador tem; isso prova que a troca preserva a cena inteira.

O ambiente de desenvolvimento só tem Chromium (software GL); o jogo usa apenas WebGL2, Web Audio e
AudioWorklet padrão, com fallback para `OscillatorNode` onde o worklet não existir.

## Propriedade intelectual

Tudo neste diretório foi criado do zero para este projeto: personagens (Pico, Vizir Kazmar, Rã-Rei Bufo,
Escorpião Dunar, Morcegão Brasa), mundo (Vantura), nomes de itens e veículos, pixel art, texturas,
fases e as 19 composições/efeitos sintetizados. Nenhum sprite, texto, mapa ou melodia de terceiros foi
reproduzido; apenas as *mecânicas* clássicas do gênero serviram de inspiração. Biblioteca: Pixi.js (MIT).

## Decisões de design registradas

* **Uma vida por toque** (clássico) suavizada por checkpoints frequentes, veículos que absorvem um
  golpe e cápsula de invencibilidade.
* **Blocos escondidos só por cabeçada**: socar o ar não revela (evita que apareçam no meio de um pulo).
* **Topo de escada é chão**: evita o "degrau fantasma" ao sair de escadas.
* **Alcance grave do PSG**: o SN76489 não desce de ~109 Hz; notas mais graves sobem uma oitava no
  retrô, enquanto o HD toca a oitava real com sub-oscilador.
* **HD mostra mais largura** (16:9) com a mesma altura de 12 tiles; as fases são desenhadas pensando
  nos dois enquadramentos. Em janelas estreitas (celular em pé) o HD passa a caber pela largura: a vista
  nunca tem menos de 256×192 de mundo, mapas mais baixos que a vista ficam centralizados com faixas pretas
  e os menus são centralizados verticalmente.
* **Arte HD derivada da pixel art** (EPX + sombreamento + normal maps) para manter identidade entre
  os modos; solo (Worley periódico), lava, fundos e efeitos são procedurais. As texturas HD de uma
  fase são pré-geradas na abertura (íris) para não engasgar na primeira aparição de cada sprite.
* **Perder o duelo** custa uma vida e recomeça da entrada da arena; morrer na luta reabre o portão e
  o duelo se repete.
* **Chefes têm tells aprendíveis** e tendem a jogar a mão que vence a sua última escolha.
* **Menus retrô sem alpha**: o SMS não mistura cores, então painéis são opacos em cor da paleta, o véu do
  título é malha xadrez de 1 px e "esmaecer" vira cintilação (`src/ui/panelfx.js`); partículas não usam
  blend aditivo no retrô. Toda captura retrô de `screenshots/` tem ≤ 20 cores, todas da paleta de 64.
* **Fundos retrô** usam 2–3 camadas (o hardware original não tinha parallax de verdade; é a liberdade
  que o "modo remaster" não precisa, mas o retrô ainda mantém 32 cores e 256×192).
