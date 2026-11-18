export type Factor = {
  id: string;
  code: string;
  modality: string;
  modality_label: string;
  variant_label: string;
  factor: number;
  provisional: boolean;
  sort_order: number;
};

export type FactorTable = { version: string; published_at: string; factors: Factor[] };

/** Atalhos da tela de registro (ordem de exibição) e faixa sugerida de cada um. */
export const SHORTCUTS: { modality: string; label: string; icon: string; defaultCode: string }[] = [
  { modality: 'corrida', label: 'Corrida', icon: 'walk', defaultCode: 'corrida_630_730' },
  { modality: 'musculacao', label: 'Musculação', icon: 'barbell', defaultCode: 'musculacao_8_15' },
  { modality: 'ciclismo', label: 'Ciclismo', icon: 'bicycle', defaultCode: 'ciclismo_20kmh' },
  { modality: 'caminhada', label: 'Caminhada', icon: 'footsteps', defaultCode: 'caminhada_5kmh' },
];

export const MODALITY_ICONS: Record<string, string> = {
  corrida: 'walk',
  musculacao: 'barbell',
  ciclismo: 'bicycle',
  caminhada: 'footsteps',
  natacao: 'water',
  circuito: 'fitness',
  eliptico: 'fitness',
  pilates: 'body',
  futebol: 'football',
  zumba: 'musical-notes',
  surfe: 'boat',
  sup: 'boat',
  beach_tennis: 'tennisball',
  pickleball: 'tennisball',
};

/** Rótulo do que a pessoa escolhe dentro da modalidade (ritmo, velocidade, intensidade). */
export function variantPrompt(modality: string): string {
  switch (modality) {
    case 'corrida': return 'Ritmo (min/km)';
    case 'ciclismo': return 'Velocidade';
    case 'caminhada': return 'Velocidade';
    case 'natacao': return 'Estilo e ritmo';
    case 'musculacao': return 'Intensidade';
    case 'surfe': return 'Tipo de sessão';
    case 'beach_tennis': return 'Formato';
    default: return 'Variação';
  }
}

export function groupByModality(factors: Factor[]): { modality: string; label: string; items: Factor[] }[] {
  const map = new Map<string, { modality: string; label: string; items: Factor[] }>();
  for (const f of [...factors].sort((a, b) => a.sort_order - b.sort_order)) {
    const g = map.get(f.modality) ?? { modality: f.modality, label: f.modality_label, items: [] };
    g.items.push(f);
    map.set(f.modality, g);
  }
  return [...map.values()];
}
