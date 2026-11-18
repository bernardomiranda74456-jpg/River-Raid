/**
 * Convites: código curto + link. O link https só existe se EXPO_PUBLIC_INVITE_BASE_URL
 * estiver configurado (precisa de domínio com AASA/assetlinks para abrir o app direto).
 * O esquema ritmo://join/CODIGO funciona em qualquer build com o app instalado.
 */
export const APP_SCHEME = 'ritmo';

export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Códigos têm 8 caracteres alfanuméricos (gerados pelo servidor sem 0/O/1/I/L). */
export function isInviteCode(value: string): boolean {
  return /^[A-Z0-9]{8}$/.test(normalizeInviteCode(value));
}

/** Extrai um código de convite de um texto colado (link ou código solto, "ABCD-2345" aceito). */
export function extractInviteCode(text: string): string | null {
  const m = text.match(/join\/([A-Za-z0-9]{4}-?[A-Za-z0-9]{4})(?![A-Za-z0-9])/);
  if (m) return normalizeInviteCode(m[1]);
  const trimmed = text.trim();
  return /^[A-Za-z0-9]{4}[- ]?[A-Za-z0-9]{4}$/.test(trimmed) ? normalizeInviteCode(trimmed) : null;
}

export function inviteLinks(code: string, opts: { baseUrl?: string } = {}) {
  const scheme = `${APP_SCHEME}://join/${code}`;
  const base = (opts.baseUrl ?? '').replace(/\/+$/, '');
  const https = base ? `${base}/join/${code}` : null;
  return { scheme, https };
}

export function buildInviteMessage(args: {
  groupName: string;
  code: string;
  startsOn: string; // dd/mm/aaaa
  endsOn: string;
  baseUrl?: string;
  testflightUrl?: string;
  playUrl?: string;
}): string {
  const links = inviteLinks(args.code, { baseUrl: args.baseUrl });
  const lines = [
    `Bora treinar junto? Entre no desafio "${args.groupName}" no Ritmo 💪`,
    `Período: ${args.startsOn} a ${args.endsOn}`,
    '',
    `Código do grupo: ${args.code}`,
  ];
  if (links.https) lines.push(`Link: ${links.https}`);
  lines.push(`Com o app instalado, abra: ${links.scheme}`);
  if (args.testflightUrl || args.playUrl) {
    lines.push('', 'Ainda não tem o app?');
    if (args.testflightUrl) lines.push(`iPhone (TestFlight): ${args.testflightUrl}`);
    if (args.playUrl) lines.push(`Android (Google Play): ${args.playUrl}`);
  }
  lines.push('', 'Depois de instalar, toque em "Entrar com código" e digite o código acima.');
  return lines.join('\n');
}

export function whatsappUrl(message: string): string {
  return `whatsapp://send?text=${encodeURIComponent(message)}`;
}
