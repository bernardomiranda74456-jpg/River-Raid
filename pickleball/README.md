# Pickleball 🥒🏓

Jogo de pickleball para celular, com regras oficiais, feito em HTML5 Canvas puro
(sem dependências) e portado para Swift Playgrounds/SpriteKit.

## Como abrir

**Web (qualquer celular):** abra `pickleball/index.html` — funciona direto do
arquivo ou servido por HTTP. Funciona offline.

**iPad/iPhone (nativo):** abra `Pickleball.swiftpm` no Swift Playgrounds ou no Xcode.

## Modos

| Modo | Como funciona |
| --- | --- |
| Simples, 1 jogador | Você contra a CPU |
| Simples, 2 jogadores | Dois humanos no mesmo aparelho, tela dividida |
| Duplas, 1 jogador | Você + parceiro CPU contra dois CPUs |
| Duplas, 2 jogadores — juntos | Vocês dois na mesma dupla contra a CPU (uma tela só, cada metade da tela controla o parceiro daquele lado) |
| Duplas, 2 jogadores — um contra o outro | Cada humano com um parceiro CPU, tela dividida com a perspectiva de cada um |

Dificuldade: **Fácil** (golpe automático, faltas assistidas), **Normal**
(você golpeia, mas o jogo evita faltas de cozinha e de dois quiques) e
**Difícil** (regras aplicadas sem perdão, CPU forte). Partidas de 7, 11 ou 15
pontos, sempre com 2 de vantagem.

## Controles

- **Mover:** arraste o dedo em qualquer ponto da sua área de toque; o jogador
  segue o dedo.
- **Golpear:** um *flick* (deslize rápido) para cima. O comprimento define a
  profundidade e a velocidade define a potência:

  |  | curto | longo |
  | --- | --- | --- |
  | **rápido** | voleio firme | drive no fundo |
  | **lento** | dink na cozinha | lob por cima |

  A inclinação do flick define a direção lateral. Um segundo dedo pode golpear
  enquanto o primeiro continua movendo.
- **Sacar:** deslize para cima. O saque sai por baixo, na diagonal, e precisa
  passar da linha da cozinha.
- **Teclado (desktop):** setas para mover, `espaço` drive, `W` lob, `Q`/`E`
  dinks para os lados.

## Regras implementadas

- Quadra oficial de 6,10 m × 13,41 m, rede de 86 cm no centro e 91 cm nos postes.
- Saque por baixo, na diagonal, para a caixa de saque correta; cair na cozinha
  ou na linha da cozinha é falta. Saque na fita que cai bom continua em jogo.
- **Regra dos dois quiques:** o saque tem que quicar e a devolução também.
- **Cozinha (zona de não-voleio):** proibido voleio com o pé dentro ou na linha,
  incluindo a regra do impulso (entrar na cozinha logo após o voleio).
- **Pontuação por saque:** só quem saca pontua; nas duplas os dois parceiros
  sacam antes do rodízio e o jogo começa em 0-0-2. Placar dito
  *sacador–recebedor–número do sacador*.
- Bola fora, na rede, dois quiques e ponto de virada de saque implementados.

## Física

Bola de plástico de 2,9 pol e 0,8 oz: gravidade, arrasto quadrático (a bola
"morre" no ar, como no jogo real), efeito Magnus leve, quique com restituição de
0,58 e a rede com fita (bolas na fita podem passar). Os golpes são resolvidos
numericamente contra o arrasto, então cada tacada realmente chega ao alvo
escolhido — drives saem a ~38 mph, dinks a ~15 mph.

## Estrutura

```
pickleball/
  index.html        menus, HUD e CSS
  js/court.js       geometria oficial da quadra
  js/physics.js     voo da bola, quique e rede
  js/shots.js       solucionador de golpes (alvo + folga na rede)
  js/match.js       jogadores, regras, faltas e placar
  js/ai.js          CPU: posicionamento, tática e erros
  js/render.js      câmera em perspectiva atrás do jogador
  js/input.js       arrastar para mover, flick para golpear
  js/audio.js       sons sintetizados (sem arquivos)
  js/main.js        telas e laço principal
```
