# Versões

Cada versão implementada vira um arquivo único jogável com o número no nome,
`pickleball-v<N>.html`, e uma etiqueta `v<N>` na tela de título. O número vive
num lugar só, a constante `VERSION` em `build-single.js`: mudar ela renomeia o
arquivo e carimba a tela. Cada versão também ganha uma tag no git.

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
