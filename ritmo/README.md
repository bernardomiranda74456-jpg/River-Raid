# Ritmo

App para iPhone e iPad (iOS/iPadOS) para desafios de treino entre amigos: grupo privado, check-in manual com foto, feed por dia, ranking com fatores por modalidade, chat do grupo e convite pelo WhatsApp.

- **App:** Expo SDK 58 · React Native 0.88 · TypeScript · Expo Router. O código é multiplataforma, mas o projeto está configurado só para iOS/iPadOS (`platforms: ["ios"]`, iPad em tela cheia, retrato).
- **Backend:** Supabase (Auth por código de e-mail, Postgres com RLS, Storage privado, Realtime)
- **Pontuação oficial no servidor:** `pontos = round(minutos × fator)` por check-in, tabela de fatores versionada

> Status de execução (18/11/2026): testes SQL (102 asserções) e testes Jest (33) passam; `tsc` e ESLint limpos; bundle iOS gerado com `expo export`. Nada foi executado em simulador nem em aparelho físico neste ambiente (sem Xcode aqui). Veja [O que falta de você](#o-que-falta-de-você).

## Sumário

1. [Estrutura](#estrutura)
2. [Rodar localmente](#rodar-localmente)
3. [Configurar o backend (Supabase hospedado)](#configurar-o-backend-supabase-hospedado)
4. [Testes](#testes)
5. [Regras de pontuação](#regras-de-pontuação)
6. [Segurança e acesso por grupo](#segurança-e-acesso-por-grupo)
7. [Gerar versões beta (EAS)](#gerar-versões-beta-eas)
8. [Distribuir o piloto pelo TestFlight](#distribuir-o-piloto-pelo-testflight)
9. [Roteiro de aceitação](docs/roteiro-aceitacao.md)
10. [O que falta de você](#o-que-falta-de-você)

## Estrutura

```
ritmo/
├── app.json, eas.json           # config do app e perfis de build/submit
├── .env.example                 # variáveis públicas do app (sem chaves reais)
├── src/
│   ├── app/                     # rotas (Expo Router)
│   │   ├── (auth)/login, verify # e-mail + nome → código de 6 dígitos
│   │   ├── (tabs)/              # Feed · Ranking · Registrar · Chat · Grupo
│   │   ├── join/[code]          # link de convite ritmo://join/CODIGO
│   │   ├── groups/              # listar, criar, entrar com código, editar
│   │   ├── workout/[id]         # foto, legenda, conta dos pontos, curtidas, comentários
│   │   └── participant/[userId] # treinos que compõem a pontuação no período
│   ├── lib/                     # supabase, api, scoring, dates, invite, photos
│   ├── providers/               # sessão e grupo ativo
│   └── components/              # UI (azul-petróleo + verde-lima)
├── supabase/
│   ├── migrations/              # esquema, RPCs, RLS, fatores v1, storage
│   ├── seed.sql                 # dados fictícios (4 contas, 1 grupo, treinos, chat)
│   ├── templates/magic_link.html# e-mail com o código OTP
│   ├── tests/                   # testes SQL (pontuação, idempotência, RLS, fotos)
│   └── config.toml              # Supabase local
├── scripts/db-test.sh           # roda os testes SQL em um Postgres local
└── docs/roteiro-aceitacao.md
```

## Rodar localmente

Pré-requisitos: Node 22+, npm, Docker (para o Supabase local) e, para rodar no iPhone/iPad, o app **Expo Go** (App Store) ou um *development build* (veja [EAS](#gerar-versões-beta-eas)).

```bash
cd ritmo
npm install

# 1) Backend local (Postgres + Auth + Storage + Realtime + Mailpit)
npx supabase start            # imprime API URL, publishable key e a URL do Mailpit
npx supabase db reset         # aplica migrações + seed.sql

# 2) Variáveis do app
cp .env.example .env          # cole a API URL e a publishable key do passo 1
#   no aparelho físico troque 127.0.0.1 pelo IP da sua máquina na rede local

# 3) App
npx expo start                # leia o QR code com a câmera do iPhone/iPad (abre no Expo Go)
```

Os e-mails de login locais aparecem no **Mailpit** (`http://127.0.0.1:54324`). O template em `supabase/templates/magic_link.html` envia o código de 6 dígitos em vez de link mágico. O seed cria `ana@ritmo.dev` (organizadora), `bruno@ritmo.dev`, `carla@ritmo.dev` no grupo **SUPERA26** e `dani@ritmo.dev` fora do grupo; faça login pelo app com esses e-mails e pegue o código no Mailpit.

> O app funciona no Expo Go para desenvolvimento. Para TestFlight use os builds do EAS.

## Configurar o backend (Supabase hospedado)

1. Crie um projeto em [supabase.com](https://supabase.com) (região `sa-east-1`, São Paulo).
2. Vincule e aplique as migrações:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-do-projeto>
   npx supabase db push          # cria tabelas, RPCs, RLS, bucket privado e fatores v1
   ```
   Não rode `seed.sql` no projeto de produção.
3. **Auth → Email Templates → Magic Link:** cole o conteúdo de `supabase/templates/magic_link.html` (assunto: “Seu código de acesso ao Ritmo”). Sem isso o e-mail traz um link, não o código.
4. **Auth → SMTP personalizado (obrigatório para o piloto):** o serviço de e-mail padrão do Supabase é limitado a poucos envios por hora e só para membros do projeto. Configure um SMTP (Resend, Brevo, Postmark; todos têm plano grátis) em *Project Settings → Auth → SMTP*. Depois ajuste o limite em *Auth → Rate Limits → Emails* (ex.: 30/h).
5. **Auth → Providers → Email:** mantenha *Enable email provider* ligado; *Confirm email* pode ficar desligado (o código OTP já confirma).
6. Copie *Project URL* e a *publishable key* (`sb_publishable_…`) de *Project Settings → API Keys* para o `.env` (desenvolvimento) e para as variáveis do EAS (builds):
   ```bash
   npx eas-cli env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co --environment production --environment preview --environment development --visibility plaintext
   npx eas-cli env:create --scope project --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_... --environment production --environment preview --environment development --visibility plaintext
   ```
   A chave secreta (`service_role`/`sb_secret_…`) **nunca** entra no app; ela fica só em `supabase/.env` (ignorado pelo git) para scripts de servidor.
7. Realtime: as tabelas `messages`, `workout_comments`, `workout_likes` e `workouts` entram na publicação `supabase_realtime` pela própria migração.

## Testes

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint (regras do Expo + React Compiler)
npm test              # Jest: pontuação, ranking/empates, datas no fuso, convite, fatores
npm run test:db       # testes SQL em um Postgres local (não precisa do stack Supabase)
npm run export:check  # bundle iOS com Metro, sem Xcode
```

`npm run test:db` espera um PostgreSQL acessível (`PGHOST`, `PGUSER`, `PGPASSWORD`; padrão `localhost/postgres/postgres`). Ele cria o banco `ritmo_test`, aplica stubs mínimos dos esquemas `auth`/`storage`, as migrações, o seed e os arquivos `supabase/tests/*.sql`, que impersonam usuários (`set role authenticated` + claims JWT) para exercitar RLS e políticas de fotos. Para rodar os mesmos testes no Supabase local: `npx supabase start && PGPORT=54322 npm run test:db`.

Casos cobertos (entre outros): 30 min caminhada 5 km/h = 30; 30 min corrida 6:30–7:30 = 84; 40 min pedal 20 km/h = 100; 45 min pickleball duplas = 50; reenvio com o mesmo `client_id` conta uma vez; data fora do desafio/futura e duração inválida são rejeitadas; quem está fora do grupo não vê grupo, treinos, chat, perfis nem fotos (mesmo com o caminho exato do arquivo); remoção pelo organizador exige motivo e some do ranking; empates recebem a mesma posição (1, 1, 3).

## Regras de pontuação

- `pontos = round(minutos × fator)` por check-in (inteiro mais próximo; `.5` arredonda para cima). O ranking soma os pontos dos treinos não removidos no período.
- O app mostra a **prévia** ao lado do botão *Publicar*; o valor **oficial** é calculado em `public.create_workout` (Postgres), que grava `factor_value`, `factor_code` e `factor_table_version` no treino.
- Tabela **v1** com 30 fatores em `supabase/migrations/20261118000100_factors_v1.sql` (referência: caminhada 5 km/h = 1,00; beach tennis marcado como provisório). Para ajustar: insira uma nova linha em `factor_tables` (ex.: `v2`), copie/edite os fatores e troque `is_active`; o histórico mantém a versão usada.
- Validações no servidor: participação no grupo, modalidade/faixa da tabela ativa, duração 1–600 min, data dentro do desafio e não futura (no fuso do grupo, padrão `America/Sao_Paulo`), caminho da foto na pasta da própria pessoa.
- Idempotência: cada envio tem um `client_id` gerado no app; `create_workout` devolve o treino existente em caso de reenvio, e a foto é gravada com `upsert` no mesmo caminho.
- Ranking: `public.group_ranking(grupo, 'challenge' | '7d')`; os últimos 7 dias são `hoje-6 … hoje` no fuso do grupo. Empates recebem a mesma posição e a próxima é pulada.

## Segurança e acesso por grupo

- Todas as tabelas têm RLS. Leitura exige participação no grupo (`is_group_member`); escrita de treinos/grupos só por RPC `security definer` com checagens explícitas; curtidas, comentários e chat só por participantes e no próprio nome.
- Fotos ficam no bucket **privado** `workout-photos` em `<grupo>/<usuário>/<client_id>.jpg`. Políticas em `storage.objects` permitem ler apenas a quem participa do grupo da primeira pasta e gravar só na própria pasta. Sem política não há acesso: ter o endereço do arquivo não serve, e URLs assinadas só são geradas para quem passa pela política de leitura (expiram em 1 h).
- Organizador = quem criou o grupo (`group_members.role = 'organizer'`). Só ele edita o grupo e remove check-ins (`remove_workout`, motivo obrigatório, registro mantido com `removed_at/removed_by/removal_reason`).
- A chave pública (`publishable`) vai no bundle; a secreta nunca. O arquivo `.env` e `supabase/.env` estão no `.gitignore`.

## Gerar versões beta (EAS)

```bash
npm install -g eas-cli
eas login
eas init                       # cria o projeto no Expo e grava extra.eas.projectId em app.json

# Development build (inclui expo-dev-client; usa o Metro da sua máquina)
npm run build:dev              # para iPhone/iPad registrados (conta Apple Developer)
npm run build:sim              # para o Simulador do Xcode

# Preview interno (ad hoc, sem App Store): instala em até 100 aparelhos registrados
npm run build:preview

# Produção (TestFlight / App Store), versão incrementada automaticamente
npm run build:prod
```

Variáveis: os builds leem `EXPO_PUBLIC_*` das variáveis do EAS por ambiente (`eas env:create`, passo 6 do backend). Para builds locais, `.env` basta.

Identificador já definido: `com.ritmo.app` (`bundleIdentifier`), esquema `ritmo://`. Troque se quiser outro.

## Distribuir o piloto pelo TestFlight

1. Conta no [Apple Developer Program](https://developer.apple.com/programs) (US$ 99/ano).
2. `npm run build:prod` (o EAS cria certificado e perfil de provisionamento; faça login com seu Apple ID quando pedir).
3. `eas submit --platform ios` → cria/seleciona o app no App Store Connect e envia o build. Preencha `submit.production.ios.ascAppId` no `eas.json` com o *Apple ID* do app (App Store Connect → App Information) para os próximos envios.
4. No App Store Connect → TestFlight: aguarde o processamento (10–15 min), responda o questionário de criptografia (já marcado `ITSAppUsesNonExemptEncryption=false`), crie um grupo de testadores **externos** (até 10.000 pessoas, só e-mail; a primeira versão passa por uma revisão leve) ou **internos** (até 100, membros da equipe), e ative o **link público** do TestFlight.
5. Cole o link público em `EXPO_PUBLIC_TESTFLIGHT_URL` (variável do EAS); ele passa a sair na mensagem de convite do WhatsApp.
6. O mesmo build serve para iPhone e iPad: o app é universal, roda em tela cheia no iPad, em retrato.

### Links de convite

- O código de 8 caracteres sempre funciona: *Entrar com código*. O app também lê um código ou link copiado da área de transferência.
- `ritmo://join/CODIGO` abre o app quando instalado (links de esquema não são clicáveis no WhatsApp; o código está na mensagem).
- Para links `https://seu-dominio/join/CODIGO` clicáveis que abrem o app, configure `EXPO_PUBLIC_INVITE_BASE_URL`, troque `ritmo.example.com` em `app.json` (`associatedDomains`) pelo seu domínio e hospede o arquivo `apple-app-site-association` nesse domínio. Pendente de um domínio seu.

## O que falta de você

| Item | Por quê | Onde |
|---|---|---|
| Projeto Supabase hospedado + `db push` | banco compartilhado entre os aparelhos | seção *Configurar o backend* |
| SMTP personalizado no Supabase | o e-mail padrão não entrega código para amigos | Auth → SMTP |
| Template *Magic Link* com `{{ .Token }}` | login por código de 6 dígitos | Auth → Email Templates |
| Conta Expo + `eas init` | builds em nuvem; grava `projectId` em `app.json` | `eas init` |
| Apple Developer Program | TestFlight e builds para aparelho | `npm run build:prod` / `npm run submit:ios` |
| Link do TestFlight e domínio (opcional) | mensagem de convite completa e links https | variáveis do EAS |

## Fechamento desta entrega

- **Executado neste ambiente:** migrações + seed + 102 asserções SQL (PostgreSQL 16 local com stubs de `auth`/`storage`), 33 testes Jest, `tsc`, ESLint, `expo export` (bundle iOS).
- **Não executado aqui:** Simulador e iPhone/iPad físicos (sem Xcode neste container; o Supabase local via Docker também não pôde ser iniciado por bloqueio de rede). O [roteiro de aceitação](docs/roteiro-aceitacao.md) descreve o que validar em um iPad e um iPhone com três contas.
- **Depende de distribuição:** TestFlight, SMTP e domínio de links (tabela acima).
