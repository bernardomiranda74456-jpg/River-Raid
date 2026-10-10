# Pickleball Forever 🥒🏓

Jogo de pickleball para celular, um jogador contra a CPU, em português, inglês
e espanhol, com regras oficiais, feito em HTML5 Canvas puro
(sem dependências) e portado para Swift Playgrounds/SpriteKit.

## Como abrir

**Web (qualquer celular):** abra `pickleball/index.html` — funciona direto do
arquivo ou servido por HTTP. Funciona offline.

**Arquivo único:** `pickleball/pickleball-single.html` tem tudo embutido (HTML,
CSS e JS num arquivo só, ~91 KB). É o jeito mais fácil de mandar para um
celular ou iPad: AirDrop, e-mail ou qualquer serviço de arquivos, e abrir no
navegador. Regenere com `node build-single.js` dentro de `pickleball/`.

**iPhone (app nativo):** `../PickleballForever.swiftpm` embala a mesma página num app
de verdade. Como compilar e publicar: `../COMO-PUBLICAR-NO-IPHONE.md`.

## Modos

| Modo | Como funciona |
| --- | --- |
| Simples | Você contra a CPU |
| Duplas | Você + parceiro CPU contra dois CPUs |

Sempre um jogador humano. Idioma em português, inglês ou espanhol, escolhido
pelas bandeiras na tela principal; na primeira vez o jogo segue o idioma do
aparelho.

Dificuldade: **Fácil** (golpe automático, faltas assistidas) e **Pro** (você
golpeia, faltas assistidas). Partidas de 5 ou 11 pontos, melhor de 1 ou de 3
sets, sempre com 2 de vantagem. Na tela seguinte você monta o seu jogador:
cabelo curto ou comprido com rabo de cavalo, cor do cabelo (loiro, castanho,
preto), tom de pele (claro, dourado, moreno, escuro), cor da camisa (amarela,
azul, verde, branca) e cor da saia ou do short (marinho, branco, azul,
vermelho), com o boneco desenhado ao vivo pelo próprio jogo. Cabelo comprido
veste saia; cabelo curto veste short. A parceira é uma mulher de pele escura; a dupla
adversária, um homem de pele clara e uma mulher de pele escura.

## Controles

- **Zona de golpe:** um retângulo translúcido à esquerda da tela, marcado
  "GOLPE". Em pé ele é alto e estreito e deixa a faixa de baixo da tela livre;
  deitado é quase quadrado e encosta na base. O que decide é onde o toque
  **começa**: dentro da zona é golpe, em qualquer outro ponto é movimento.
- **Mover:** arraste o dedo em qualquer ponto fora da zona; o jogador segue o
  dedo, e um arrasto rápido é uma corrida.
- **Golpear:** um deslize para cima dentro da zona. O comprimento é a força e
  a cor do traço é o medidor: verde curto, laranja no fundo, rosa na linha,
  vermelho fora. A zona é a régua, um eixo por vez: um deslize até a borda de
  cima cai na linha de fundo, e até a borda do lado também; só passando da zona
  a bola sai. Em pé um deslize lateral ganha força bem mais depressa que um
  para cima.
- **Direção:** a inclinação do deslize. Reto é em frente, deitado é todo para
  o lado.
- **Lob:** deslize em arco para cima. Arco em C joga para a esquerda, C
  invertido para a direita.
- **Slice:** deslize para baixo. A bola cai na cozinha do adversário; para
  baixo e para a esquerda vai para a esquerda, e vice-versa.
- **Sacar:** deslize para cima. O saque sai por baixo, na diagonal, e precisa
  passar da linha da cozinha.
- **Teclado (desktop):** setas para mover, `espaço` drive, `W` lob, `Q`/`E`
  dinks para os lados.

## Regras implementadas

- Quadra oficial de 6,10 m × 13,41 m, rede de 86 cm no centro e 91 cm nos postes.
- Saque por baixo, na diagonal, para a caixa de saque correta; cair na cozinha
  ou na linha da cozinha é falta. Saque na fita que cai bom continua em jogo.
- **Regra dos dois quiques:** o saque tem que quicar e a devolução também.
- **Cozinha (zona de não-voleio):** proibido voleio com **qualquer parte do
  jogador** dentro ou na linha. O jogador não é um ponto: a pegada considera a
  base dos pés e cresce com a corrida e com o esticão, então voleiar rente à
  linha é falta como na quadra. A zona termina nas linhas laterais, e a regra do
  impulso (entrar logo após o voleio) também vale.
- **Saque com os pés no lugar:** atrás da linha de fundo e na metade correta.
- **Só o recebedor da diagonal devolve o saque**; se o parceiro devolver, é falta.
- **Pontuação por saque:** só quem saca pontua; nas duplas os dois parceiros
  sacam antes do rodízio e o jogo começa em 0-0-2. Placar dito
  *sacador–recebedor–número do sacador*.
- Bola fora, na rede, dois quiques e ponto de virada de saque implementados.

## Câmera

Em tela larga (iPad e celular deitado) a câmera copia o ângulo de transmissão:
**3,8 m de altura, 17 m atrás da linha de fundo, 9° de inclinação**. Os números
saíram de medir quadros de transmissão da PPA — linha de fundo próxima ocupando
66% da largura, proporção perto/longe de 2,2 e a quadra deitada e larga. O jogo
reproduz 66% e 2,22.

Em tela estreita isso não funciona (a quadra viraria uma tira fina), então o
retrato mantém uma câmera mais alta e enquadra pela largura total da linha de
fundo — nas duplas os dois parceiros têm que caber juntos na tela. O
enquadramento vertical conta o espaço de corrida atrás das duas linhas de fundo,
então nenhum jogador é cortado.

O placar é um painel de transmissão no canto superior: faixa de título, uma
linha por dupla com nome e caixa de placar na cor do time, indicador de quem
saca e rodapé com a chamada oficial (sacador-recebedor-número).

## Torcida

Cerca de 500 torcedores sentados em sete fileiras, cada um com camisa e tom de
pele próprios, respirando de leve entre os pontos. **A cada ponto eles
comemoram**: levantam, pulam e erguem os braços numa *ola* que atravessa a
arquibancada, mais forte quanto mais longo foi o rally, e mais longa ainda no
fim da partida. O som acompanha — ruído de multidão que cresce e cai, com palmas
espalhadas por cima.

O estádio se ajusta à câmera por projeção inversa: o jogo calcula quanto de tela
sobra acima do fundo da quadra e divide essa faixa entre alambrado e
arquibancada. Sem isso, em paisagem o alambrado encostava no topo e a torcida
ficava inteira fora do quadro.

Custo: 0,62 ms por quadro para a torcida inteira, desenhada em lote por cor.

## Jogadores

Cada jogador é um boneco articulado desenhado por quadro: cabeça com cabelo (quatro
estilos), tronco com gola e manga, dois braços e duas pernas resolvidos por
**cinemática inversa de dois ossos**, tênis, meia e raquete na mão dominante.
Tom de pele, cabelo e cor da raquete são fixos por jogador.

A animação sai do estado do jogo, não de um loop solto:

- **corrida com o corpo virado**: o jogador gira até 66° na direção em que
  corre, e a passada é decomposta entre o que sobra de deslocamento lateral e o
  que vira profundidade — é isso que separa uma corrida de um andar de lado;
- ombros giram mais que o quadril, e o braço livre bombeia contra as pernas,
  passando à frente do corpo na ida e atrás na volta;
- **preparação**: quando a bola vem na sua direção o jogador arma a raquete
  (`prep` cresce conforme o tempo até o contato encurta);
- **golpe em três tempos** — armado, contato e finalização — com o tronco
  girando, forehand e backhand distintos e movimentos próprios para saque,
  smash e dink;
- **contato no ponto certo**: a raquete vai até onde a bola realmente estava no
  instante da tacada;
- **agachamento** proporcional à altura da bola: bola baixa se pega dobrando o
  joelho, e a mão nunca passa do alcance do braço.

Cada segmento é uma cápsula com faixa de luz e de sombra, o que dá volume
cilíndrico aos membros; camisa, cabeça e ombros têm gradiente próprio.

Custo medido: 0,83 ms por quadro para a cena inteira (0,49 ms nos quatro jogadores).

## Física

Bola de plástico de 2,9 pol e 0,8 oz: gravidade, arrasto quadrático (a bola
"morre" no ar, como no jogo real), efeito Magnus leve, quique com restituição de
0,58 e a rede com fita (bolas na fita podem passar). Os golpes são resolvidos
numericamente contra o arrasto, então cada tacada realmente chega ao alvo
escolhido — drives saem a ~38 mph, dinks a ~15 mph.

## App para iPhone (PickleballForever.swiftpm)

`../PickleballForever.swiftpm/` é um envelope nativo em Swift em volta do jogo
web: uma `WKWebView` em tela cheia carrega `Sources/Resources/index.html`, que é
a mesma página de `pickleball-v<N>.html`, gravada ali por `build-single.js` a
cada build. Não há segunda implementação do jogo: o que roda no app é o que foi
testado no navegador. O envelope libera o som sem toque, desliga rolagem, zoom e
barra de status, e mantém a tela acesa. Passo a passo de compilação e envio para
a App Store em `../COMO-PUBLICAR-NO-IPHONE.md`.

## Testes

```
node test/rules.test.js
```

38 testes sem dependência nenhuma cobrindo o regulamento: geometria e faltas do
saque (incluindo pé na linha e metade errada), regra dos dois quiques (incluindo
o terceiro golpe), cozinha com pegada dos pés e regra do impulso, recebedor
correto, pontuação por saque, rodízio 0-0-2 das duplas, troca de lado dos
parceiros, vitória com 2 de vantagem, bola dentro/fora e sanidade da física.

Há também uma auditoria que roda partidas inteiras e conta violações reais
(voleios na cozinha, golpes duplos, saques irregulares): hoje zero em ~530
voleios por rodada.

### O que não é modelado

Bola que acerta o corpo do jogador (hoje ela atravessa), contato do jogador com
a rede (é impedido, não vira falta) e as exigências de empunhadura do saque
(contato abaixo da cintura e cabeça da raquete abaixo do punho), que são
garantidas pela construção do golpe.

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

../PickleballForever.swiftpm/
  Package.swift               o app (nome, ícone, orientações, versão)
  Sources/App.swift           entrada SwiftUI, tela cheia
  Sources/GameView.swift      a WKWebView que carrega o jogo
  Sources/Resources/index.html  a página do jogo, gravada pelo build
  Assets.xcassets/AppIcon     ícone 1024 × 1024
```
