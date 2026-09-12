# Versões

Cada versão implementada vira um arquivo único jogável com o número no nome,
`pickleball-v<N>.html`, e uma etiqueta `v<N>` na tela de título. O número vive
num lugar só, a constante `VERSION` em `build-single.js`: mudar ela renomeia o
arquivo e carimba a tela. Cada versão também ganha uma tag no git.

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
