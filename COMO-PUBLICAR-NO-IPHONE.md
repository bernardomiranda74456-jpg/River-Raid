# Pickleball Forever no iPhone: como compilar e publicar

O app para iPhone está em `PickleballForever.swiftpm`. Ele é um envelope
nativo (Swift) em volta do mesmo jogo que roda no navegador: a página
`Sources/Resources/index.html` é gravada ali por `pickleball/build-single.js`
a cada versão, então o app é sempre a mesma build que foi testada.

Nada aqui foi compilado ainda: o pacote foi escrito sem Xcode à mão. A primeira
abertura no Xcode é o momento de ver se algo precisa de ajuste, e qualquer erro
que aparecer eu corrijo.

## O que você precisa

Dois caminhos, escolha um:

- **iPad com Swift Playgrounds** (grátis, na App Store, iPadOS 16 ou mais
  novo). Abre o pacote, compila e roda no próprio iPad, e com conta de
  desenvolvedor envia para a App Store dali mesmo. Sem Mac.
- **Mac com Xcode** (grátis, na Mac App Store) e um iPhone com cabo.

Para publicar na App Store, por qualquer caminho: uma conta no **Apple
Developer Program** (US$ 99 por ano, em developer.apple.com). Para só testar,
a conta Apple comum basta.

## 1a. No iPad, com Swift Playgrounds

1. Salve `PickleballForever.swiftpm.zip` no app **Arquivos** e toque nele para
   descompactar. Aparece a pasta `PickleballForever.swiftpm`.
2. Toque na pasta: ela abre no **Swift Playgrounds** (ou segure, Compartilhar,
   Swift Playgrounds). O projeto passa a aparecer em *Meus Playgrounds*.
3. Toque em **▶ Executar**, no canto superior esquerdo. O Playgrounds compila
   e o jogo abre em tela cheia no iPad.
4. Para publicar: toque no nome do app no topo, **Configurações do App**.
   Entre com sua conta de desenvolvedor em **Equipe**, confira nome, versão e
   build, e use **Enviar para o App Store Connect**. O resto é a seção 2
   abaixo, feita no navegador.

Pelo iPad o app roda no iPad. Para vê-lo num iPhone, envie ao App Store
Connect e instale pelo **TestFlight**, que não exige revisão.

## 1b. No Mac, com Xcode e o iPhone no cabo

1. Baixe o repositório (ou o zip `PickleballForever.swiftpm.zip`) no Mac.
2. Dê dois cliques em `PickleballForever.swiftpm`. O Xcode abre o pacote como
   um app.
3. Na barra lateral, clique no pacote e abra **App Settings**. Em **Team**,
   escolha a sua equipe (sua conta Apple). Se o Xcode reclamar que o
   *bundle identifier* já está em uso, troque `br.com.3emp.pickleballforever`
   por outro, por exemplo `br.com.3emp.pickleball2`. Ele precisa ser único no
   mundo. (Sem conta de desenvolvedor o app instalado expira em 7 dias e
   precisa ser reinstalado.)
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
4. **Capturas de tela:** obrigatórias para iPhone de 6,7" (1290 × 2796), de
   6,5" (1284 × 2778 ou 1242 × 2688) e, como o app aceita iPad, para iPad de
   13" (2064 × 2752). Tire no simulador do Xcode (⌘S salva a imagem) ou no
   próprio aparelho. De 3 a 10 imagens por tamanho: o menu, uma partida em pé,
   uma deitada, o tutorial.
5. **Descrição, palavras-chave, URL de suporte.** A URL de suporte pode ser a
   mesma página da política de privacidade.

### Depois, o envio

No **iPad**: Configurações do App → **Enviar para o App Store Connect**.

No **Xcode**:

6. Em **App Settings**, confira **Version** (`1.0`) e **Build** (`47`). A cada
   envio novo o Build precisa subir (48, 49…).
7. No topo, mude o destino para **Any iOS Device (arm64)**.
8. **Product → Archive.** Quando terminar, abre o *Organizer*: clique em
   **Distribute App → App Store Connect → Upload**, aceite os padrões.

Nos dois casos, na pergunta sobre **criptografia** (export compliance), o app
não usa criptografia própria: responda **Não**.

### De volta ao App Store Connect

10. Em alguns minutos a build aparece em **TestFlight**. Dali você pode
    instalar no seu iPhone e em até 100 pessoas por e-mail, sem revisão.
11. Para a loja: na aba do app, em **Build**, selecione a build enviada,
    preencha o que faltar e clique em **Enviar para Revisão**. A Apple costuma
    responder em 1 a 2 dias.

## 3. Versões novas

Cada versão nova do jogo que eu gerar já atualiza
`PickleballForever.swiftpm/Sources/Resources/index.html`. No Mac:

1. Baixe o repositório atualizado (ou o zip novo).
2. Abra o pacote, suba o **Build** em App Settings.
3. Envie de novo (iPad: Enviar para o App Store Connect; Xcode: Product →
   Archive → Distribute) e selecione a build nova no App Store Connect.

## O que o envelope nativo faz

- Tela cheia, sem barra de status e sem a barra do navegador.
- Som liberado sem toque (`mediaTypesRequiringUserActionForPlayback = []`).
- Sem rolagem, sem elástico nas bordas e sem zoom na página.
- A tela não apaga sozinha no meio da partida.
- iPhone e iPad. Retrato e as duas posições deitadas; no iPad também de
  cabeça para baixo.
- Idioma, som e configuração da partida ficam guardados no aparelho, como no
  navegador.
