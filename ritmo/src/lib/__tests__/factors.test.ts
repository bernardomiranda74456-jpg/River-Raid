import { SHORTCUTS, groupByModality, variantPrompt, type Factor } from '@/lib/factors';

const sample: Factor[] = [
  { id: '1', code: 'corrida_630_730', modality: 'corrida', modality_label: 'Corrida', variant_label: '6:30–7:30 /km', factor: 2.8, provisional: false, sort_order: 21 },
  { id: '2', code: 'corrida_731_800', modality: 'corrida', modality_label: 'Corrida', variant_label: '7:31–8:00 /km', factor: 2.55, provisional: false, sort_order: 20 },
  { id: '3', code: 'caminhada_5kmh', modality: 'caminhada', modality_label: 'Caminhada', variant_label: 'No plano, 5 km/h', factor: 1, provisional: false, sort_order: 10 },
];

test('agrupa por modalidade respeitando sort_order', () => {
  const groups = groupByModality(sample);
  expect(groups.map((g) => g.modality)).toEqual(['caminhada', 'corrida']);
  expect(groups[1].items.map((f) => f.code)).toEqual(['corrida_731_800', 'corrida_630_730']);
});

test('atalhos: Corrida, Musculação, Ciclismo e Caminhada nessa ordem', () => {
  expect(SHORTCUTS.map((s) => s.label)).toEqual(['Corrida', 'Musculação', 'Ciclismo', 'Caminhada']);
});

test('rótulo do seletor por modalidade', () => {
  expect(variantPrompt('corrida')).toBe('Ritmo (min/km)');
  expect(variantPrompt('ciclismo')).toBe('Velocidade');
  expect(variantPrompt('zumba')).toBe('Variação');
});
