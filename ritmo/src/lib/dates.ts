/**
 * Datas no fuso do grupo (padrão America/Sao_Paulo). Treinos guardam só a data (YYYY-MM-DD).
 */
export const DEFAULT_TZ = 'America/Sao_Paulo';

export function todayInTz(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(now); // en-CA produz YYYY-MM-DD
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function diffDays(fromIso: string, toIso: string): number {
  const a = Date.UTC(...splitIso(fromIso));
  const b = Date.UTC(...splitIso(toIso));
  return Math.round((b - a) / 86_400_000);
}

function splitIso(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y, m - 1, d];
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "18/11/2026" → "2026-11-18" (ou null se inválido). */
export function parseBrDate(value: string): string | null {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return isValidIsoDate(iso) ? iso : null;
}

export function formatBrDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Cabeçalho de dia no feed: "Hoje", "Ontem", "terça, 11 nov". */
export function dayLabel(iso: string, todayIso: string): string {
  const diff = diffDays(iso, todayIso);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  const [y, m, d] = splitIso(iso);
  const dt = new Date(Date.UTC(y, m, d));
  return `${WEEKDAYS[dt.getUTCDay()]}, ${d} ${MONTHS[m]}`;
}

export function formatTime(isoTimestamp: string, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(isoTimestamp));
}

export function formatDateTime(isoTimestamp: string, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(isoTimestamp));
}

/** Situação do desafio em relação a hoje. */
export function challengeStatus(startsOn: string, endsOn: string, todayIso: string): 'upcoming' | 'active' | 'finished' {
  if (todayIso < startsOn) return 'upcoming';
  if (todayIso > endsOn) return 'finished';
  return 'active';
}
