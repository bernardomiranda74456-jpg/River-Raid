# Versões

Cada versão implementada vira um arquivo único jogável com o número no nome,
`pickleball-v<N>.html`, e uma etiqueta `v<N>` na tela de título. O número vive
num lugar só, a constante `VERSION` em `build-single.js`: mudar ela renomeia o
arquivo e carimba a tela. Cada versão também ganha uma tag no git.

## v13

Saque de lado. O sacador gira o corpo para ficar de perfil para a rede, ombro
sem raquete à frente, pés alinhados na profundidade e não na largura, raquete
baixa atrás e a mão da bola estendida à frente. Só depois de bater na bola ele
volta a ficar de frente, na postura de espera.

A bola passou a ser ordenada em profundidade junto com os jogadores do seu lado
da rede, pela posição na quadra. Uma bola atrás de um jogador fica escondida por
ele em vez de pintada por cima. A bola na mão do sacador de perto, que está um
passo à frente dele, some atrás do corpo, como deve; a do sacador de longe, que
está de frente para a câmera, continua visível.

## v12

Postura de saque. Quem vai sacar fica como um sacador de verdade: raquete
recolhida atrás do quadril com a face para o chão, mão livre estendida à frente
segurando a bola na altura da cintura, pés em passada com o pé do lado sem
raquete à frente. A mão livre é desenhada exatamente onde a partida guarda a
bola, então a bola fica na mão e não perto dela. Vale para os dois lados da
quadra, humano ou CPU.

Se o sacador humano levar mais de três segundos, ele começa a quicar a bola na
quadra, uma vez a cada 0,8 s, com o som do quique, até sacar. A CPU saca em
menos de um segundo e por isso nunca chega a quicar.

## v11

Retrato calibrado como uso principal. A câmera do celular em pé sobe de 40 para
48 pés e chega mais perto (de 50 para 44 pés atrás), então a quadra lê mais de
cima e ocupa mais da altura da tela em vez da torcida. A largura passa a caber
três pés além de cada lateral, ajustados dois pés atrás da linha de fundo, e a
quadra fica com 73% da largura (era 82%, sem lateral nenhuma). A relação
perto/longe cai de 1,80 para 1,67. A paisagem não muda.

## v10

A v9 arruinou o retrato: o ajuste de largura com os cinco pés de folga lateral,
feito no recuo de perto, encolhia a quadra a um selo no celular em pé, e a
torcida tomava a tela. O retrato volta a ajustar a própria quadra, agora com
dois pés de folga de cada lado para a lateral aparecer sem a quadra encolher. A
paisagem continua exatamente como na v9.

## v9

A câmera sobe um pouco (de 20 para 24 pés, um pouco mais perto) para a quadra
ser vista mais de cima, e a largura passa a ser ajustada onde uma bola larga é
realmente jogada: no chão, no recuo de perto, incluindo os cinco pés além da
linha lateral. O acompanhamento lateral da câmera cai de 25% para 6% da posição
do jogador, então as laterais além da quadra ficam visíveis dos dois lados
independentemente de onde o jogador está. No iPad a quadra ocupa 59% da
largura, entre a v7 e a v8, com mais céu sobre a linha de fundo distante e mais
chão fora das linhas.

## v8

Ligeiramente mais afastada que a v7: a linha de fundo de perto passa de 60% para
56% da largura de uma tela larga. Nada mais muda.

## v7

A v6 afastou demais. Esta volta ao enquadramento da v5 e só recua um pouco: a
linha de fundo de perto passa a ocupar 60% da largura de uma tela larga, em vez
dos 66% da v5. A câmera volta a acompanhar o jogador de lado, como na v5. As
quatro quinas da quadra ficam dentro da tela em todas as proporções, mesmo com o
jogador encostado na lateral.

## v6

A câmera passou a enquadrar a **área de jogo inteira**, e não só a quadra. Um
jogador pode perseguir a bola cinco pés além da linha lateral e quatro e meio
atrás da linha de fundo, e nada disso vale se acontecer fora da tela. No iPad a
quadra passa a ocupar 56% da largura em vez de 66%.

O ponto mais largo na tela é a cabeça de um jogador no canto de perto do recuo,
e é nele que a largura é ajustada. Antes o ajuste era feito na linha de fundo,
que é mais distante e mais estreita, e por isso os extremos escapavam: no iPad os
cantos da área de jogo caíam a 44 pixels fora de cada lado.

A câmera também deixou de acompanhar o jogador de lado. Com a área inteira em
quadro, seguir alguém para o lado só empurrava o outro lado para fora. Com o
enquadramento fixo, nenhum ponto da área de jogo sai da tela em nenhuma
proporção de tela nem com o jogador em qualquer posição.

## v5

O número do sacador vira contagem de bolas: **uma bola é o primeiro sacador da
dupla, duas bolas é o segundo**. Uma contagem se lê mais rápido que um dígito, e
é a mesma bola que o jogador está prestes a bater. Em simples aparece sempre uma.
O tutorial passou a mostrar e explicar as duas bolinhas.

Também consertei um teste instável: os dois testes de força colocavam o jogador
longe da bola, então o espalhamento do contato ruim às vezes jogava para fora um
golpe laranja que deveria cair dentro. Eles passaram a medir o mapa de força sem
o espalhamento por cima.

## v4

A velocidade extra passa a ser sua, e não de todo mundo. A v3 subiu a constante
que a CPU também usa, então a quadra encolhia para os dois e a diferença entre
vocês continuava a mesma. Agora a base da CPU volta aos 13,2 pés por segundo e o
jogador humano fica nos 14,52.

No nível normal, você corre a 14,52 contra 11,83 do rival, ou seja, 23% mais
rápido. Antes da v3 a vantagem era de 12%. No difícil ela fica em 14% e no fácil
em 32%.

A conta de "quão rápido estou indo", que alimenta a passada da animação, a
inclinação do corpo e a pegada dos pés na cozinha, passou a usar o teto de cada
jogador em vez da constante comum. Correndo a fundo, todo mundo lê como a fundo.

## v3

Jogador 10% mais rápido: a velocidade de corrida sobe de 13,2 para 14,52 pés por
segundo. A CPU acompanha, porque a velocidade dela é uma fração da mesma
constante, então o equilíbrio entre vocês não muda: o que muda é que a quadra
inteira ficou menor para os dois. Medido em dez partidas simuladas, o rali
continua na casa dos quatorze golpes e os pontos que acabavam em dois quiques
caíram de 29% para 23%.

## v2

Os controles refeitos. A tela de cada jogador se divide em duas: o lado direito
corre, o lado esquerdo golpeia, e nada é lido como as duas coisas.

- O deslize esquerdo carrega força e direção juntos. O comprimento é a força e o
  quanto foi para o lado é o quanto a bola abre.
- O traçado do dedo aparece na tela e muda de cor pelo comprimento, do verde
  claro ao vermelho escuro. Laranja cai bem funda, rosa pinta a linha de fundo e
  vermelho já saiu.
- Lob é um arco acentuado. O lado do arco é o lado do lob e o tamanho do arco é a
  profundidade.
- O smash deixou de ser um acidente: ele só existe contra um lob pego no alto e
  antes do quique. Baixou, é rebatida normal.
- O saque usa o mesmo deslize, com força e direção. Um toque ainda saca fraco.
- Duas pessoas dividindo uma tela no modo "jogar juntos" continuam no esquema da
  v1, porque lá as duas metades já são os dois jogadores.

Calibrado para o nível normal. O nível fácil ainda vai ser simplificado.

## v1

Primeira versão nomeada. O jogo como ficou depois de:

- Câmera entre a transmissão de TV e o Super Tennis, com o placar reservando
  seu espaço no topo de cada viewport.
- Bonecos estilo Wii em ready position, com braços e raquete escondidos pelo
  corpo quando o jogador é visto de costas.
- Alcance dependente da altura da bola, que é o que faz o quique aparecer antes
  do golpe.
- Marca branca de onde a bola caiu, além do anel de onde ela vai cair.
- Rastro da bola na cor da família do golpe.
- Placar com o número do sacador em disco e o nome de quem saca aceso.
- Tutorial de oito passos com volta ao menu em todos eles.

Comandos desta versão: um dedo só, arrastar move e um deslize para cima golpeia,
com velocidade e comprimento escolhendo entre drive, voleio, lob e bola curta.
É justamente o que estamos redesenhando para a v2.
