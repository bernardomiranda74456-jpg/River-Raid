/**
 * Variáveis públicas do app (prefixo EXPO_PUBLIC_ é embutido no bundle).
 * Nunca coloque chaves administrativas (service_role) aqui.
 *
 * No navegador (versão web para iPad/iPhone sem build nativo), a URL e a
 * publishable key também podem ser informadas na tela de configuração e
 * ficam salvas no próprio navegador (localStorage).
 */
import { Platform } from 'react-native';

const WEB_KEYS = { url: 'ritmo.supabaseUrl', key: 'ritmo.supabaseKey' } as const;

function readWeb(name: string): string {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(name) ?? '';
  } catch {
    return '';
  }
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || readWeb(WEB_KEYS.url);
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || readWeb(WEB_KEYS.key);

export const env = {
  supabaseUrl: url,
  supabasePublishableKey: publishableKey,
  /** Base https opcional para links de convite (ex.: https://ritmo.exemplo.com). */
  inviteBaseUrl: process.env.EXPO_PUBLIC_INVITE_BASE_URL ?? '',
  /** Links de instalação do piloto, incluídos na mensagem de convite. */
  testflightUrl: process.env.EXPO_PUBLIC_TESTFLIGHT_URL ?? '',
  playUrl: process.env.EXPO_PUBLIC_PLAY_URL ?? '',
  isConfigured: Boolean(url && publishableKey),
  /** Config veio de variáveis de build (não editável na tela). */
  fromBuild: Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL),
  canConfigureAtRuntime: Platform.OS === 'web',
};

/** Salva a configuração no navegador e recarrega a página para recriar o cliente. */
export function saveWebConfig(supabaseUrl: string, key: string) {
  if (Platform.OS !== 'web') return;
  localStorage.setItem(WEB_KEYS.url, supabaseUrl.trim().replace(/\/+$/, ''));
  localStorage.setItem(WEB_KEYS.key, key.trim());
  window.location.reload();
}

export function clearWebConfig() {
  if (Platform.OS !== 'web') return;
  localStorage.removeItem(WEB_KEYS.url);
  localStorage.removeItem(WEB_KEYS.key);
  window.location.reload();
}
