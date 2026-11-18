/**
 * Regra de pontuação (espelho da função SQL public.calc_points).
 * pontos = minutos × fator, arredondado para o inteiro mais próximo por check-in.
 * O app só mostra uma prévia; o valor oficial vem do servidor.
 */
export function calcPoints(durationMin: number, factor: number): number {
  if (!Number.isFinite(durationMin) || !Number.isFinite(factor) || durationMin <= 0 || factor <= 0) return 0;
  // Elimina ruído de ponto flutuante (ex.: 30 × 2.8 = 84.00000000000001) antes de arredondar.
  const cents = Math.round(durationMin * factor * 100);
  return Math.round(cents / 100);
}

export function formatFactor(factor: number): string {
  return factor.toFixed(2).replace('.', ',');
}

export function formatPoints(points: number): string {
  return `${points} ${points === 1 ? 'ponto' : 'pontos'}`;
}

/** Texto da conta exibido ao abrir um treino: "30 min × 2,80 = 84 pontos". */
export function explainPoints(durationMin: number, factor: number, points: number): string {
  return `${durationMin} min × ${formatFactor(factor)} = ${formatPoints(points)}`;
}

export type RankingRow = {
  user_id: string;
  display_name: string;
  points: number;
  workouts: number;
  minutes: number;
  rank: number;
  tied: boolean;
};

/** Reconstrói posições (1, 1, 3) e empates a partir dos pontos; útil se o servidor não enviar. */
export function rankRows<T extends { points: number }>(rows: T[]): (T & { rank: number; tied: boolean })[] {
  const sorted = [...rows].sort((a, b) => b.points - a.points);
  const counts = new Map<number, number>();
  for (const r of sorted) counts.set(r.points, (counts.get(r.points) ?? 0) + 1);
  let rank = 0;
  let lastPoints: number | null = null;
  return sorted.map((r, i) => {
    if (lastPoints === null || r.points !== lastPoints) rank = i + 1;
    lastPoints = r.points;
    return { ...r, rank, tied: (counts.get(r.points) ?? 0) > 1 };
  });
}

export function ordinal(rank: number): string {
  return `${rank}º`;
}
