# Versões

Cada versão implementada vira um arquivo único jogável com o número no nome,
`pickleball-v<N>.html`, e uma etiqueta `v<N>` na tela de título. O número vive
num lugar só, a constante `VERSION` em `build-single.js`: mudar ela renomeia o
arquivo e carimba a tela. Cada versão também ganha uma tag no git.

## v38

Patrocínio no piso só nas cozinhas. Os dois logos que ficavam na parte azul
da quadra, onde a bola cai, saíram. Os das cozinhas se deslocaram para os
lados, de forma simétrica vista da câmera: o de cima (atrás da rede) 4 ft
para a esquerda, o de baixo 4 ft para a direita, os dois ainda inteiros
dentro dos 20 ft da faixa.

## v37

A CPU ganha corpo: reação com piso humano, duas marchas e velocidade por
direção. E o anel de quique para de mudar de cor no ar.

- **Reação.** A cada golpe do adversário a CPU levava de 0,04 a 0,36 s para ler
  a bola (a difícil, 0,04–0,16 s: mais rápida que qualquer humano). Agora o
  piso é **0,25 s** para todas, e o teto é o que muda com a dificuldade:
  fácil 0,70 s, normal 0,50 s, difícil 0,40 s (`ai.js`, `REACT_MIN`;
  `match.js`, `SKILL.react`). Medido em partida: mín 0,23 · mediana
  0,48 / 0,36 / 0,31 · máx 0,68 / 0,48 / 0,38 s.
- **Duas marchas.** Reposicionar é um deslize a 60% da velocidade máxima; só
  uma bola para jogar liga o sprint (`p.chasing`, `cpuPace`).
- **Direção.** A CPU está sempre de frente para a rede: para a frente 100%,
  de lado 80%, de costas 65%. Só a CPU; o polegar do jogador não mudou.
  Medido (difícil): corrida frente 12,9 · lado 11,0 · costas 8,9 ft/s.
- **Anel de quique.** O ponto previsto era recalculado a cada quadro por uma
  amostragem grossa (1/120 s) que derivava em polegadas ao longo do voo; perto
  de uma linha o anel piscava entre branco e vermelho. Agora o quique é
  calculado uma vez por voo, com o passo do próprio motor (1/300 s), e fica
  fixo até a bola quicar ou tocar a rede. Em 3.424 voos: 5 trocas antes, todas
  a menos de 6 in da linha; zero depois.

**Efeito na dificuldade**, medido com um jogador substituto fixo (anda pelo
alvo da IA, reage na hora, golpe automático), 12 partidas por linha:

| | Simples antes → depois | Duplas antes → depois |
|---|---|---|
| Fácil | 62% → 88% | 62% → 64% |
| Normal | 51% → 79% | 49% → 54% |
| Difícil | 18% → 51% | 30% → 30% |

Em duplas quase não muda. Em simples fica bem mais fácil, porque uma CPU
sozinha cobre a quadra inteira e as três mudanças se somam: com o deslize a
75% ou 90% fica em 75/63/40 e 77/68/36. A calibração da dificuldade de simples
é uma decisão à parte.

## v36

A rede e a bola passam a ser desenhadas **em pé, na escala do chão**, como os
bonecos e o juiz já eram.

Medindo o jogo contra uma foto de transmissão: as dimensões da quadra estão
exatas e os bonecos têm 30% da largura da quadra onde pisam, como um homem de
6 ft (a foto dá 31%). O que estava fora era a rede em retrato: 0,099 da largura
da quadra em vez de 2,83 ÷ 20 = 0,142, porque ela era projetada pela câmera
inclinada (43° olhando para baixo) enquanto os bonecos eram desenhados na
altura cheia — a rede batia no joelho do juiz.

- `Cam.up(x, h, z)`: o ponto no chão pela câmera, e a altura em pés vezes a
  escala desse ponto. Rede, fita, malha, postes, bola, rastro e a bola na mão
  do sacador usam isso agora.
- Rede ÷ largura da quadra: **0,142** em retrato e deitado.
- Rede ÷ juiz ao lado dela: 0,527 (real 2,83 ÷ 5,64 = 0,50).
- Uma bola a 2,5 ft aparece abaixo da fita e a 3,3 ft acima, nas duas
  orientações.

A câmera não mudou: baixá-la ao ângulo da TV faria a metade da quadra virar uma
faixa de 100 px num celular em pé.

## v35

Quatro ajustes pedidos de uma vez.

- **Um desenho só.** O jogo não pergunta mais como os jogadores são desenhados:
  fica o boneco estilo Wii. Com isso saiu do renderizador a segunda figura
  inteira — pernas, braços, tronco, cabeça e cabelo da versão atlética, mais os
  corpos que ninguém desenhava. São 357 linhas a menos e 16 KB a menos no
  arquivo único. Seis quadros de uma partida de duplas e seis de simples, com o
  mesmo sorteio e o mesmo relógio, saíram **pixel por pixel idênticos** antes e
  depois, que é a prova de que só caiu código que não era mais alcançado.
- **Partida até 5 pontos** no lugar da de 7, com os mesmos dois de vantagem.
- **O segundo saque agora tem torcida.** Antes o juiz falava "second serve" no
  silêncio; agora as palmas respondem, como em qualquer outra bola.
- **A marca 3EMP fica dois segundos a mais.** A subida continua em 1,3 s e a
  parada passou de 1 s para 3 s, então a marca sai do ar aos 4,3 s.

Quem já tinha jogado com 7 pontos guardados no aparelho cai no padrão de 11; o
formato e a dificuldade que ele escolheu continuam como estavam.

## v34

Uma tela de entrada com a marca **3EMP** antes do menu.

- O logo nasce apagado e **sobe até o brilho cheio em 1,3 s**, com uma curva
  simétrica: começa devagar, cresce no meio e assenta no fim. Não há fade out —
  o menu entra com a marca no auge.
- Depois de 1 s parada a tela dá lugar ao menu principal. Quem já viu pode
  tocar em qualquer ponto e ir direto.
- Em aparelhos com "reduzir movimento" ligado a marca aparece inteira, sem
  animação.

O fundo é o mesmo gradiente escuro do resto do jogo, então o vermelho da marca
fica com contraste sem precisar de um cartão branco no meio do caminho.

## v33

Duas chamadas novas na voz do juiz: **Out** e **Net**. Elas entram no lugar de
Point, porque um juiz nomeia o que aconteceu antes de alguém pensar no placar.

- **Out** quando o rali acaba com a bola fora, no golpe ou no saque.
- **Net** quando a bola morre na fita. Só vale quando ela encostou mesmo na
  rede: uma bola que morre antes de chegar lá continua sendo Point, porque o
  juiz não cantaria "net" nesse caso.
- Qualquer outra falta, como dois quiques ou voleio na cozinha, continua sendo
  Point.

A troca vale só para o Point. Se quem sacava é que errou, o saque muda de mão e
a chamada continua sendo Second Serve ou Side Out, que é o que importa naquele
momento.

As duas falas somam 8 KB embutidos, na mesma voz das outras três.

## v32

Três mudanças no patrocínio.

**Tudo em branco.** Cada marca virou uma silhueta branca com fundo transparente
e os vazados abertos por dentro: o quadrado do TELERJ, as letras do Oi, as
colunas do BANK. Assim um arquivo só funciona no azul da quadra, no vermelho da
cozinha e no escuro do tapume, e nenhum logo fica numa plaquinha da própria cor.
De quebra ficaram menores: os quatro somam 25 KB, contra 36 KB coloridos.

**A faixa do alambrado virou patrocínio.** No lugar do nome do jogo entrou uma
faixa mais alta com quatro marcas. Ela precisou subir, porque o tapume que está
na frente é mais perto da câmera e por isso sobe mais na tela do que a própria
altura dele sugere, e estava cortando a faixa pela metade. No retrato as duas
faixas aparecem uma sobre a outra; na horizontal sobra pouca altura acima da
quadra e o tapume acaba sendo a superfície principal.

**Uma marca em cada cozinha.** Branco sobre o vermelho, que é o contraste mais
forte que a quadra tem. Em meia força, para a faixa continuar lendo como
cozinha e não como cartaz.

Com as seis marcas novas o custo por quadro foi de 1,63 para 2,04 ms, num
orçamento de 16. O arquivo único encolheu de 646 para 633 KB, porque a arte
branca comprime melhor que a colorida.

## v31

A quadra ganhou patrocínio, como teste, com os quatro logos enviados.

**A parede do fundo.** Atrás da linha de fundo adversária, na frente do
alambrado, entrou um tapume escuro de 5,6 pés de altura com quatro placas.
É o que aparece na foto de jogo real: a barreira que separa a quadra da
arquibancada e carrega os patrocínios.

**As marcas no chão.** Dentro das linhas ficaram duas, bem apagadas, uma em
cada meia quadra, para nunca serem confundidas com a bola ou com uma linha.
Fora das linhas, onde não há nada em jogo, ficam quatro em força total: uma de
cada lado da quadra, uma atrás da sua linha de fundo e uma junto à parede. As
de quadra são desenhadas por baixo das linhas, como tinta de verdade.

**Como isso é desenhado.** Não há mapeamento de textura no Canvas 2D, mas
nesta câmera todo ponto à mesma profundidade divide a mesma escala. Então uma
faixa fina de um plano vira uma faixa na tela com largura constante: o desenho
fatia a arte em uma faixa a cada quatro pixels de tela, até vinte e duas, e a perspectiva sai de graça. As bordas
das faixas são calculadas uma vez e compartilhadas, porque sobrepô-las pintava
cada emenda duas vezes e isso aparecia como listras claras assim que a arte
era desenhada com transparência.

Custa 0,26 ms por quadro, de 1,37 para 1,63. Os logos vão embutidos em PNG com
fundo recortado, somando 36 KB. A posição de
cada um foi conferida contra a largura real do quadro em cada profundidade, no
retrato e na horizontal, para nenhum ficar cortado na borda da tela.

## v30

O juiz passou a falar. No fim de cada rali sai uma das três chamadas oficiais,
na voz escolhida:

- **Point**, quando quem sacava ganhou o ponto.
- **Second Serve**, quando quem sacava perdeu sendo o primeiro sacador da
  dupla, e o saque passa para o parceiro.
- **Side Out**, quando o saque passa para os adversários. Em simples só
  existem Point e Side Out, porque só há um sacador de cada lado.

A chamada não é escolhida por um caso à parte: ela sai dos mesmos três ramos
que já moviam o saque, então a voz nunca pode discordar do placar.

A ordem é a da quadra: o juiz chama e a plateia responde. A palma entra 0,38 s
depois da fala. No Second Serve não há palma nenhuma, porque ninguém pontuou.
O bipe que marcava o ponto virou reserva, e só toca se o navegador não
conseguir decodificar a fala.

As três falas vão embutidas no arquivo, em MP3 mono de 48 kbps, somando 18 KB.
Ficam em inglês nos três idiomas, que é como esses termos são chamados em
quadra no mundo todo.

## v29

O golpe de perto da rede com a bola no alto virou smash de verdade, com o
movimento de braço por cima, e a regra é a altura da bola.

Medi qual é a trajetória mais rápida que ainda passa a rede e cai dentro, para
cada altura de contato. O ângulo de saída vira de "para cima" para "para
baixo" entre 2,8 e 3,2 pés, que é a altura da rede. Abaixo disso não existe
paulada: para passar a rede a bola tem que subir, e subindo ela chega mansa.
Por isso a porta do smash abre em 3,4 pés, que é a primeira altura com folga
de verdade, e só a até 11 pés da rede.

O que muda na prática, com um golpe laranja a 3 pés da rede: com a bola a 3
pés de altura sai o golpe rasteiro de sempre, a 34 km/h, chegando em 515 ms.
Com a bola a 3,6 pés sai o smash, a 57 km/h, chegando em 300 ms. O adversário
tem quase metade do tempo.

O risco é o que você espera: o alvo continua sendo o da cor do deslize, então
puxar demais manda a bola para fora igual. E um toque leve numa bola alta
continua sendo bola curta, não vira paulada sem querer.

A CPU já tinha esse golpe e o jogador não. Agora os dois usam a mesma altura:
a da CPU subiu de 3,1 para 3,4 pés, porque a 3,1 ela ainda estava batendo numa
bola em que não dá para bater para baixo. O passo do tutorial sobre o smash foi
reescrito nos três idiomas.

## v28

O parceiro da CPU passou a julgar direito a bola que vai sair. Antes ele
voleava a bola longa com a mesma taxa de erro de um adversário, o que jogava
fora um ponto que o time já tinha ganhado. Agora, assim que a bola está
claramente fora, ele deixa passar: a partir de meio pé além da linha ele
deixa em 90% das vezes e a partir de um pé em todas. Só a bola que cai a
poucos centímetros da linha ainda o engana. Ele também não corre mais para
voleá-la, fica olhando.

O adversário continua errando essa leitura na taxa antiga, porque o erro dele
é uma chance sua de ponto.

De quebra, a chamada passou a usar o pouso exato em vez do traço compartilhado
da previsão, que é amostrado de 1/120 s e errava o quique em até três
polegadas. Justamente a faixa em que essa decisão se decide.

## v27

Correção da postura do juiz. Na v26 ele foi desenhado de frente para a câmera,
ou seja, olhando para o fundo da quadra, que não é onde um juiz fica. Agora o
corpo está de perfil, de frente para a rede, olhando para o outro lado da
quadra, como na posição real.

Com o corpo de lado, o desenho mudou inteiro: tronco em perfil, com o peito
para a frente e as costas retas, uma perna atrás da outra em tom mais escuro,
o braço do outro lado do corpo por trás, os pés apontando para a rede e a
faixa verde aparecendo só na frente do peito.

A cabeça continua seguindo a bola, mas agora ela gira a partir do perfil: com
a bola na altura da rede ele fica de perfil puro, com nariz e aba do boné
apontados para a quadra e um olho à vista; com a bola vindo para perto ele
vira o rosto para a câmera e aparecem os dois olhos; com a bola no fundo
adversário ele vira de costas e o rosto desaparece.

O braço do sinal também mudou: sobe para cima e para a frente, sobre a quadra,
em vez de subir colado ao corpo, onde a cabeça o escondia.

## v26

Entrou um juiz em quadra. Ele fica em pé ao lado do poste da rede, fora da
quadra, na linha da rede, de uniforme escuro com a faixa verde do jogo no
peito e boné.

A cabeça acompanha a bola o rali inteiro. Como ele está de lado para a câmera,
o comprimento da quadra é a esquerda e a direita dele: com a bola no fundo da
quadra adversária a cabeça vira para um lado, com a bola vindo para perto vira
para o outro, e a aba do boné gira junto. Os olhos somem quando a cabeça passa
dos três quartos de volta, como acontece de verdade. Entre os pontos, sem bola
viva, ele olha para quem vai sacar.

O sinal de início do ponto é o braço. Passado meio segundo da preparação do
saque, ele levanta o braço e segura: é a autorização para sacar. No instante
em que a bola sai o braço desce.

O juiz tem um esqueleto próprio, separado do dos jogadores: sem raquete, sem
ciclo de corrida e com uma cabeça que gira muito mais.

## v25

As CPUs ganharam peso na arrancada. Até aqui todo mundo em quadra saltava para
a velocidade máxima na mesma rampa de 0,21 s; agora a rampa da CPU depende da
dificuldade: 0,35 s no fácil, 0,29 s no normal e 0,24 s no difícil para chegar
a 90% do topo. O jogador continua exatamente como estava, em 0,21 s.

Para isso não virar um presente, o platô de cada CPU sobe na medida exata para
que uma perseguição de um segundo cubra o mesmo chão de antes: 7,4% no fácil,
3,9% no normal e 1,6% no difícil. O efeito fica todo no meio segundo inicial.
Numa bola longa, que é quando a CPU ganha ou perde o ponto por alcance, nada
mudou.

Onde o jogador sente a diferença, no nível normal, é na troca de direção: a
CPU cobre 39% menos chão nos primeiros 0,3 s de uma virada e 17% menos em
0,5 s, voltando a empatar em um segundo. Numa arrancada parada a perda é bem
menor, de 9% em 0,3 s. É o peso de quem estava indo para um lado e tem que ir
para o outro.

## v24

Na hora de sacar o jogador fica preso na faixa em que o saque é legal, em vez
de sair de lá e levar falta de pé. Enquanto espera para sacar ele só anda para
a esquerda e para a direita: o dedo empurrando para frente ou para trás não
tem efeito, a profundidade fica fixa um passo atrás da linha de fundo, e o
lado a que ele tem direito é o único onde pode andar, entre a linha do meio
(com 0,65 ft de folga, para não pisar nela) e a linha lateral.

Assim que a bola sai no saque a trava some e o jogador volta a andar em
qualquer direção. Quem está recebendo nunca é travado. A trava vale também
para a CPU, que já ficava parada, e agora não tem como derivar.

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
