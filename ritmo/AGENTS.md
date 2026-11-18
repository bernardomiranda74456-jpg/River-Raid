# Ritmo — notas para agentes e pessoas

App Expo (SDK 58, Expo Router, rotas em `src/app`) + Supabase. Leia o `README.md` antes de mudar o backend.

Regras do projeto:
- Interface em português do Brasil. Identidade: azul-petróleo (`Brand.petrol`) + verde-lima (`Brand.lime`) em `src/constants/theme.ts`.
- Pontos oficiais só no servidor (`public.create_workout`). O app mostra prévia com `calcPoints` (mesma regra).
- Nunca edite `factors` da tabela ativa: crie uma versão nova em `factor_tables`.
- Toda escrita sensível vai por RPC `security definer`; tabelas têm RLS. Novas tabelas precisam de política + teste em `supabase/tests/`.
- Antes de concluir: `npm run typecheck && npm run lint && npm test && npm run test:db`.
- `npx expo install` precisa de acesso a `api.expo.dev`; sem rede use `npm install pacote@<versão de expo/bundledNativeModules.json>`.
