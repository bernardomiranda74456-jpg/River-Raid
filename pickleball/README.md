# Pickleball 🥒🏓

Jogo de pickleball para celular, com regras oficiais, feito em HTML5 Canvas puro
(sem dependências) e portado para Swift Playgrounds/SpriteKit.

## Como abrir

**Web (qualquer celular):** abra `pickleball/index.html` — funciona direto do
arquivo ou servido por HTTP. Funciona offline.

**Arquivo único:** `pickleball/pickleball-single.html` tem tudo embutido (HTML,
CSS e JS num arquivo só, ~91 KB). É o jeito mais fácil de mandar para um
celular ou iPad: AirDrop, e-mail ou qualquer serviço de arquivos, e abrir no
navegador. Regenere com `node build-single.js` dentro de `pickleball/`.

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

## Câmera

A câmera fica atrás da linha de fundo e é enquadrada para caber **a quadra
inteira na largura da linha de fundo** — nas duplas, os dois parceiros precisam
estar na tela ao mesmo tempo. O retrato usa uma câmera mais alta e mais afastada
(12,8 m de altura, 17,7 m atrás) porque tem menos largura disponível; a paisagem
usa uma mais baixa, que preenche melhor o quadro. O enquadramento vertical conta
o espaço de corrida atrás das duas linhas de fundo, então nenhum jogador é
cortado no topo nem embaixo.

## Jogadores

Cada jogador é um boneco articulado desenhado por quadro: cabeça com cabelo (quatro
estilos), tronco com gola e manga, dois braços e duas pernas resolvidos por
**cinemática inversa de dois ossos**, tênis, meia e raquete na mão dominante.
Tom de pele, cabelo e cor da raquete são fixos por jogador.

A animação sai do estado do jogo, não de um loop solto:

- **corrida** com passada e balanço de braço proporcionais à velocidade, mais
  inclinação do tronco na direção do movimento;
- **preparação**: quando a bola vem na sua direção o jogador arma a raquete
  (`prep` cresce conforme o tempo até o contato encurta);
- **golpe em três tempos** — armado, contato e finalização — com o tronco
  girando, forehand e backhand distintos e movimentos próprios para saque,
  smash e dink;
- **contato no ponto certo**: a raquete vai até onde a bola realmente estava no
  instante da tacada;
- **agachamento** proporcional à altura da bola: bola baixa se pega dobrando o
  joelho, e a mão nunca passa do alcance do braço.

Custo medido: 0,66 ms por quadro para a cena inteira (0,31 ms nos quatro jogadores).

## Física

Bola de plástico de 2,9 pol e 0,8 oz: gravidade, arrasto quadrático (a bola
"morre" no ar, como no jogo real), efeito Magnus leve, quique com restituição de
0,58 e a rede com fita (bolas na fita podem passar). Os golpes são resolvidos
numericamente contra o arrasto, então cada tacada realmente chega ao alvo
escolhido — drives saem a ~38 mph, dinks a ~15 mph.

## Versão nativa (Pickleball.swiftpm)

`Pickleball.swiftpm/` é a mesma simulação portada para Swift, com a quadra, a
física, as regras e a IA idênticas às da versão web. A tela é desenhada com
SpriteKit (câmera fixa, cenário construído uma vez e só os atores atualizados
por quadro), os menus são SwiftUI e o toque é multitoque nativo — dois dedos
funcionam ao mesmo tempo, e no modo "um contra o outro" cada metade da tela é
uma cena com a perspectiva do seu jogador.

Diferenças em relação à web: sem áudio sintetizado (usa vibração/haptics), sem
rastro da bola e os jogadores ainda usam o desenho simples anterior — o boneco
articulado descrito abaixo existe só na versão web por enquanto. Abra a pasta no Swift Playgrounds (iPad) ou no Xcode e rode em
um dispositivo/simulador iOS 15.2+.

## Testes

```
node test/rules.test.js
```

29 testes sem dependência nenhuma cobrindo o regulamento: geometria e faltas do
saque, regra dos dois quiques (incluindo o terceiro golpe), cozinha e regra do
impulso, pontuação por saque, rodízio 0-0-2 das duplas, troca de lado dos
parceiros, vitória com 2 de vantagem, bola dentro/fora e sanidade da física.

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
  build-single.js   empacota tudo num arquivo só
  test/rules.test.js  testes do regulamento

Pickleball.swiftpm/
  Sources/Court.swift, Physics.swift, Shots.swift, Match.swift, AI.swift
                    porte direto do núcleo de simulação
  Sources/GameScene.swift   render SpriteKit + toque multitoque
  Sources/GameModel.swift   estado, laço e haptics
  Sources/ContentView.swift menus SwiftUI
```
