# Duas soluções para a bola que é rebatida antes de quicar

O código em `js/` continua sendo a versão de base, sem nenhuma das duas
soluções. Cada variante existe como um patch aqui e como um HTML jogável na
pasta acima, com o nome da solução no arquivo e um selo na tela de título.

Para aplicar a que você escolher:

    git apply pickleball/variantes/solucao-1-regra-de-contato.patch
    git apply pickleball/variantes/solucao-2-alcance-por-altura.patch

## Solução 1 — regra de contato

Depois do quique ninguém pode golpear enquanto a bola ainda estiver subindo e
abaixo de 1,50 pé. A liberação também acontece no ápice, então um dink que
morre baixo nunca trava: o jogador o pega no topo do salto.

## Solução 2 — alcance por altura

O alcance deixa de ser um círculo e passa a depender da altura da bola. Uma
raquete na altura do peito não varre o chão a um braço de distância, então
para uma bola no tornozelo o alcance cai a 6% e só volta ao total perto de
1,3 pé. Quem quiser raspar a bola do chão precisa estar praticamente em cima
dela, e isso continua sendo possível.
