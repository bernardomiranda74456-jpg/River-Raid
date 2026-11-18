/**
 * Variáveis públicas do app (prefixo EXPO_PUBLIC_ é embutido no bundle).
 * Nunca coloque chaves administrativas (service_role) aqui.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const env = {
  supabaseUrl: url,
  supabasePublishableKey: publishableKey,
  /** Base https opcional para links de convite (ex.: https://ritmo.exemplo.com). */
  inviteBaseUrl: process.env.EXPO_PUBLIC_INVITE_BASE_URL ?? '',
  /** Links de instalação do piloto, incluídos na mensagem de convite. */
  testflightUrl: process.env.EXPO_PUBLIC_TESTFLIGHT_URL ?? '',
  playUrl: process.env.EXPO_PUBLIC_PLAY_URL ?? '',
  isConfigured: Boolean(url && publishableKey),
};
