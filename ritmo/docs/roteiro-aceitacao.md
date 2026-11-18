# Roteiro de aceitação do piloto

Pré-requisitos: backend hospedado configurado (migrações aplicadas, SMTP e template de e-mail com código) e o app instalado em **dois aparelhos Apple**, por exemplo um **iPad** e um **iPhone** (TestFlight, build interno ou Expo Go). Três e-mails diferentes: **A** (organizadora), **B** (convidado) e **C** (fora do grupo).

Marque cada passo com ✔/✘ e anote o aparelho.

## 1. Conta e grupo (conta A, iPad)

1. Abrir o app → tela *Ritmo*. Informar nome e e-mail de A → *Receber código*.
2. E-mail com 6 dígitos chega em até 1 min. Digitar → entra em *Seus grupos* vazio.
3. *Criar grupo* → nome, início hoje, fim em 27 dias → abre a aba **Grupo** com o código de 8 caracteres.
4. *Convidar pelo WhatsApp* abre o WhatsApp com a mensagem (código, período e, se configurados, link do TestFlight). Enviar para B.
5. Fechar e reabrir o app → continua logada e no mesmo grupo.

## 2. Convite e check-in com foto (conta B, iPhone)

6. Instalar o app pelo link do TestFlight da mensagem (ou já instalado). Abrir → login com nome e e-mail de B → código.
7. *Entrar com código* já sugere o código copiado do WhatsApp; confirmar → abre o **Feed** do grupo de A.
   - Alternativa: tocar em `ritmo://join/CODIGO` em um app que abra esquemas (ex.: Notas) → entra direto.
8. Aba **Registrar**: atalho *Corrida* → faixa *6:30–7:30 /km* → 30 min → foto da galeria ou câmera → legenda. A prévia mostra **84 pts** e o botão diz *Publicar · 84 pts*.
9. Publicar → tela *Treino publicado! +84 pts*.
10. Teste de queda de conexão: ativar modo avião, registrar outro treino → aparece erro com *Tentar de novo*; desligar o modo avião e tocar em *Tentar de novo* → publica **uma vez só** (confira no feed que não duplicou).

## 3. Interação (conta A, iPad)

11. Feed → o treino de B aparece sob *Hoje* com foto, duração e **84 pts**. Puxar para atualizar se necessário.
12. Tocar no treino → foto, legenda e a conta: *30 min × 2,80 = 84 pontos (tabela v1)*.
13. Curtir (coração) e comentar → B abre o treino e vê curtida e comentário.
14. Aba **Chat** → enviar mensagem → aparece no iPhone em poucos segundos (realtime) ou em até 20 s (fallback).
15. Aba **Ranking**: A e B com a mesma lista; a posição de cada um aparece em destaque no topo. Alternar *Desafio* / *Últimos 7 dias*. Tocar em B → lista o treino de 84 pts.
16. Filtro *Meus treinos* no feed mostra só os treinos da conta atual.

## 4. Remoção pelo organizador (conta A)

17. Abrir o treino de B → *Remover check-in (organizador)* → motivo obrigatório → confirmar.
18. Treino fica marcado *Removido* com o motivo; **Ranking** de A e de B deixa de contar os 84 pts.
19. Conta B não vê o botão de remover em treinos de A.

## 5. Isolamento (conta C, qualquer aparelho)

20. Login com e-mail de C → *Seus grupos* vazio. Entrar com um código errado → *Convite não encontrado*.
21. Criar um grupo próprio → o feed, ranking e chat de C não mostram nada do grupo de A.
22. (Opcional, técnico) Com a publishable key e o JWT de C, chamar `storage/v1/object/sign/workout-photos/<grupo-de-A>/<usuário-B>/<arquivo>.jpg` → 4xx; a foto não é acessível fora do grupo.

## 6. Persistência

23. Em ambos os aparelhos: forçar o fechamento do app, reabrir → sessão, grupo, feed, ranking e chat voltam sem novo login.
24. Sair da conta (Grupo → Você → Editar → Sair) e entrar de novo → tudo recuperado do servidor.

## Resultado

| Passo | iPad (A) | iPhone (B) | Observações |
|---|---|---|---|
| 1–5 | | | |
| 6–10 | | | |
| 11–16 | | | |
| 17–19 | | | |
| 20–22 (C) | | | |
| 23–24 | | | |
