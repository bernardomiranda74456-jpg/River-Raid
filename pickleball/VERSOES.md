# Versões

Cada versão implementada vira um arquivo único jogável com o número no nome,
`pickleball-v<N>.html`, e uma etiqueta `v<N>` na tela de título. O número vive
num lugar só, a constante `VERSION` em `build-single.js`: mudar ela renomeia o
arquivo e carimba a tela. Cada versão também ganha uma tag no git.

## v23

Duas mudanças grandes.

**Um jogador só.** O modo de dois no mesmo aparelho saiu inteiro: as opções
"Jogadores" e "Vocês dois vão…" sumiram da configuração, a tela dividida e o
modelo de toque de um dedo só foram removidos, e o passo do tutorial que
explicava esse modo também. O motor passou a ter um `humanIdx` em vez de dois
"slots", o que tirou um ramo de cada laço de entrada, de desenho e de nomes.
Em simples são dois jogadores em quadra, em duplas são quatro, e em ambos só
um é seu.

**Três idiomas, escolhidos por bandeira.** A tela principal ganhou três
bandeiras (Brasil, Estados Unidos e Espanha) logo abaixo dos botões. A escolha
vale para tudo: menus, tutorial, placar, avisos de regra e as chamadas de
ponto. Na primeira visita o jogo segue o idioma do próprio aparelho e cai no
inglês se for outro; depois disso vale o que foi escolhido, guardado no
aparelho.

Todo texto vive em `js/i18n.js`, uma tabela só com 114 chaves em cada idioma.
O tutorial é montado na hora a partir dela, rótulos dentro dos desenhos
inclusive, então trocar de idioma repinta os oito passos. Os testes conferem
que as três tabelas têm exatamente as mesmas chaves, sem buraco nem sobra.

## v22

O jogo agora se chama **Pickleball Forever**. A tela de entrada abre com o
logo no lugar da palavra escrita, dimensionado para caber no retrato e na
horizontal sem empurrar os botões. O título da página, a descrição, o letreiro
do fundo da quadra e o rodapé do placar seguem o novo nome.

O logo fica em `img/logo.png` (900 px de largura, fundo transparente, 212 KB)
e o montador de arquivo único passou a embutir imagens de `img/` como data
URI, então o arquivo baixado continua abrindo sozinho, sem internet.

## v21

Direção mais acentuada. A lateral do golpe deixou de ser "quantos pixels o
dedo andou para o lado" e passou a ser a inclinação do deslize: reto para
cima é zero, e um deslize deitado 70° ou mais em relação à vertical é tudo
para aquele lado, seja o deslize curto ou longo.

Na quadra, a inclinação vira o ângulo do golpe a partir de onde a bola está:
reto vai reto em frente (e não mais para o centro da quadra), e totalmente
para o lado vira a bola 30° para aquele lado, com uma curva que mantém as
inclinações pequenas suaves. O alvo para na linha lateral (9,0 ft do centro,
com 1 ft de folga), então a direção sozinha nunca põe a bola fora. O saque e
o modo cooperativo usam a mesma leitura. Tutorial atualizado.

## v20

Polegar de movimento mais sensível e mais rápido (solução 2). A velocidade do
jogador continua seguindo a velocidade do polegar, mas a resposta deixou de
ser uma reta com teto alto:

- A leitura é o arrasto acumulado no quadro misturado com uma memória curta
  (45 ms), então a corrida não gagueja com a taxa de 60 Hz do toque e o
  jogador para poucos quadros depois do dedo parar.
- A resposta é uma curva com ganho forte no deslize lento (para os ajustes
  finos ao lado da bola) e "corrida total" quando o polegar anda a 34% da
  altura da tela por segundo (era 50%). Zona morta pequena (4%) para o tremor
  de um dedo parado não mexer o boneco.
- Medido no retrato (tela de 844 px): um arrasto calmo de 80 px/s rendia
  3,3 ft/s e agora rende 5,5; a 140 px/s foi de 4,1 para 8,6; a 200 px/s de
  4,1 para 11,1. A velocidade máxima (14,52 ft/s) não mudou, então o
  equilíbrio com a CPU é o mesmo.

Correção que apareceu na medição: o polegar direito (movimento) ainda passava
pelo detector de deslize do modo cooperativo, então um arrasto rápido virava
"golpe", travava a corrida por 260 ms e, ao soltar, podia até sacar. Agora o
polegar de movimento só move.

## v19

A marca de onde a bola caiu passou a ter exatamente o raio da bola desenhada
(2,4× o raio real, com o mesmo mínimo de 3,5 px), em vez do círculo de 0,42 ft
que era maior que a bola. Assim a marca nunca cobre mais chão do que a bola
cobriu, e fica nítido se ela quicou dentro ou fora, em cima da linha inclusive.
O anel de onde a bola vai cair continua do tamanho de antes.

## v18

Bola maior. O raio desenhado passou de 1,25× para 2,4× o raio real da bola
(0,121 ft), com mínimo de 3,5 px em vez de 2 px, para ela continuar visível
quando está longe da câmera no retrato. O rastro colorido acompanha, já que é
desenhado a partir do mesmo raio, e a sombra no chão cresceu junto.

## v17

Correção de regra nas duplas: o motor só impedia o mesmo jogador de bater
duas vezes seguidas, não o parceiro. Quando um golpe saía fraco e não
atravessava, o companheiro rebatia de novo e a bola cruzava, ou seja, dois
golpes da mesma dupla enquanto a bola estava de um lado só.

Agora, depois de um golpe, ninguém da dupla pode tocar a bola até ela cruzar a
rede. A CPU deixa a bola cair e nem corre atrás dela; um humano que deslizar
para bater na bola do parceiro comete a falta "Dois golpes da mesma dupla"
(no nível difícil) ou recebe o aviso "Seu parceiro já bateu: a bola tem que
cruzar a rede!" e o golpe é descartado (regras assistidas dos níveis fácil e
normal). A bola fraca que quica no próprio campo continua sendo falta, e a
chamada agora distingue "Na rede" de "Não passou da rede".

## v16

Palmas pela metade. Num ponto comum a torcida toca de 1,3 a 1,8 s (era de
2,6 a 4,8 s), com fade de saída de 0,4 s, e cabe inteira na pausa entre
pontos: o próximo saque só pode sair 1,85 s depois do fim do ponto (1,25 s de
pausa mais 0,6 s até a CPU sacar), então as palmas sempre terminam antes.
Ralis longos já não tocam a gravação inteira; só o fim de partida recebe uma
ovação maior, de 4,8 s.

## v15

A torcida agora é uma gravação de verdade. Em vez de qualquer palma
sintetizada, o jogo toca o efeito sonoro pedido pelo autor, "[APLAUSOS] EFEITO
SONORO PARA EDIÇÃO" (canal SONORA TUBE, https://youtu.be/3sqk7dRqidY), cortado
para os 9,7 s em que há som, em mono a 22 kHz e MP3 de 48 kbps (58 KB). O
áudio vai embutido no próprio arquivo do jogo, então continua funcionando
offline e em arquivo único.

Como ele toca: num ponto comum entram entre 2,6 e 4,8 s da gravação (mais
tempo quanto maior o rali), começando de um instante levemente aleatório para
dois pontos seguidos não soarem idênticos, com um fade de saída de 0,7 s. Nos
pontos grandes (rali longo ou fim de partida) toca a gravação inteira, que já
cresce e morre sozinha. O volume acompanha a intensidade do ponto. Se o
navegador não conseguir decodificar o MP3, a torcida sintetizada da v14 entra
no lugar.

## v14

Som destravado no iPhone. O contexto de áudio era criado no toque, mas nunca era
retomado dentro de um toque, e o iOS só aceita a retomada dentro de um gesto do
usuário: o jogo ficava mudo do início ao fim. Agora todo toque na tela retoma o
áudio até ele reportar que está rodando, tocando um sample silencioso no mesmo
gesto, que é o destravamento clássico do WebKit. Voltar ao app depois de sair
também retoma o áudio.

A torcida a cada ponto ficou cheia: um rugido grave e um chiado de vozes que
sobem e descem juntos, entre 10 e 26 palmas espalhadas e, nos pontos grandes,
um ou dois assobios. O volume geral subiu de 0,5 para 0,7. A intensidade
continua crescendo com o tamanho do rali, e o fim de partida toca mais alto.

Lembrete de iOS: a chave lateral de silêncio do iPhone cala o áudio do
navegador. Com ela ligada, não há som nenhum, do jogo ou de qualquer página.

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
