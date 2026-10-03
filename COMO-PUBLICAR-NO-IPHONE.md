# Pickleball Forever no iPhone: como compilar e publicar

O app para iPhone está em `PickleballForever.swiftpm`. Ele é um envelope
nativo (Swift) em volta do mesmo jogo que roda no navegador: a página
`Sources/Resources/index.html` é gravada ali por `pickleball/build-single.js`
a cada versão, então o app é sempre a mesma build que foi testada.

Nada aqui foi compilado ainda: o pacote foi escrito sem Xcode à mão. A primeira
abertura no Xcode é o momento de ver se algo precisa de ajuste, e qualquer erro
que aparecer eu corrijo.

## O que você precisa

- Um **Mac** com o **Xcode** mais recente (grátis, na Mac App Store).
- Um **iPhone** com iOS 16 ou mais novo e um cabo.
- Para publicar na App Store: uma conta no **Apple Developer Program**
  (US$ 99 por ano, em developer.apple.com). Para só instalar no seu iPhone,
  a conta Apple comum basta, mas o app expira em 7 dias e precisa ser
  reinstalado.

## 1. Abrir e rodar no seu iPhone

1. Baixe o repositório (ou o zip `PickleballForever.swiftpm.zip`) no Mac.
2. Dê dois cliques em `PickleballForever.swiftpm`. O Xcode abre o pacote como
   um app.
3. Na barra lateral, clique no pacote e abra **App Settings**. Em **Team**,
   escolha a sua equipe (sua conta Apple). Se o Xcode reclamar que o
   *bundle identifier* já está em uso, troque `br.com.3emp.pickleballforever`
   por outro, por exemplo `br.com.3emp.pickleball2`. Ele precisa ser único no
   mundo.
4. Conecte o iPhone pelo cabo. No iPhone: **Ajustes → Privacidade e Segurança
   → Modo Desenvolvedor**, ligue e reinicie (o iOS pede isso uma vez).
5. No topo do Xcode, escolha o seu iPhone como destino e aperte **▶ Run**.
   Na primeira vez o iPhone pede para confiar no desenvolvedor: **Ajustes →
   Geral → VPN e Gerenciamento de Dispositivo**, toque no seu nome e em
   **Confiar**.

Se tudo estiver certo o jogo abre em tela cheia, a logo da 3EMP aparece e a
música do menu entra sozinha quando ela fecha: no app o som é liberado desde
o primeiro quadro, sem o toque que o Safari exige.

## 2. Publicar na App Store

### Antes, em appstoreconnect.apple.com

1. **Meus Apps → + → Novo App.** Plataforma iOS, nome **Pickleball Forever**,
   idioma principal português (Brasil), o *bundle identifier* do passo 1.3
   (ele aparece na lista depois que você roda o app uma vez pelo Xcode), SKU
   qualquer texto único, por exemplo `pickleball-forever-1`.
2. **Informações do app:** categoria **Jogos → Esportes**. Classificação
   etária: responda ao questionário; o jogo não tem violência, apostas nem
   conteúdo adulto, então sai como **4+**.
3. **Privacidade do App:** o jogo não coleta nada, não tem conta, não usa
   internet. Marque **Não coletamos dados**. A Apple exige um link de
   **política de privacidade** mesmo assim: uma página simples dizendo que o
   app não coleta dados, hospedada em qualquer lugar (o GitHub Pages do
   repositório serve).
4. **Capturas de tela:** obrigatórias para iPhone de 6,7" (1290 × 2796) e de
   6,5" (1284 × 2778 ou 1242 × 2688). Tire no simulador do Xcode
   (⌘S salva a imagem) ou no próprio iPhone. De 3 a 10 imagens: o menu, uma
   partida em pé, uma deitada, o tutorial.
5. **Descrição, palavras-chave, URL de suporte.** A URL de suporte pode ser a
   mesma página da política de privacidade.

### Depois, no Xcode

6. Em **App Settings**, confira **Version** (`1.0`) e **Build** (`47`). A cada
   envio novo o Build precisa subir (48, 49…).
7. No topo, mude o destino para **Any iOS Device (arm64)**.
8. **Product → Archive.** Quando terminar, abre o *Organizer*: clique em
   **Distribute App → App Store Connect → Upload**, aceite os padrões.
9. Na pergunta sobre **criptografia** (export compliance), o app não usa
   criptografia própria: responda **Não**.

### De volta ao App Store Connect

10. Em alguns minutos a build aparece em **TestFlight**. Dali você pode
    instalar no seu iPhone e em até 100 pessoas por e-mail, sem revisão.
11. Para a loja: na aba do app, em **Build**, selecione a build enviada,
    preencha o que faltar e clique em **Enviar para Revisão**. A Apple costuma
    responder em 1 a 2 dias.

## 3. Versões novas

Cada versão nova do jogo que eu gerar já atualiza
`PickleballForever.swiftpm/Sources/Resources/index.html`. No Mac:

1. Baixe o repositório atualizado.
2. Abra o pacote, suba o **Build** em App Settings.
3. **Product → Archive → Distribute**, e selecione a build nova no App Store
   Connect.

## O que o envelope nativo faz

- Tela cheia, sem barra de status e sem a barra do navegador.
- Som liberado sem toque (`mediaTypesRequiringUserActionForPlayback = []`).
- Sem rolagem, sem elástico nas bordas e sem zoom na página.
- A tela não apaga sozinha no meio da partida.
- Retrato e as duas posições deitadas; só iPhone (sem iPad, para não exigir
  capturas de tela de iPad na loja).
- Idioma, som e configuração da partida ficam guardados no aparelho, como no
  navegador.
