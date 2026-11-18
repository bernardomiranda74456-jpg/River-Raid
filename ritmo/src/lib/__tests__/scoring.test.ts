import { calcPoints, explainPoints, formatFactor, rankRows } from '@/lib/scoring';

describe('calcPoints (prévia; espelho de public.calc_points)', () => {
  test.each([
    [30, 1.0, 30, 'caminhada 5 km/h'],
    [30, 2.8, 84, 'corrida 6:30–7:30'],
    [40, 2.5, 100, 'pedal 20 km/h'],
    [45, 1.11, 50, 'pickleball duplas'],
    [10, 0.64, 6, 'pilates (6,4 → 6)'],
    [25, 0.89, 22, 'musculação (22,25 → 22)'],
    [5, 0.71, 4, 'surfe (3,55 → 4)'],
    [60, 1.36, 82, 'caminhada 6 km/h (81,6 → 82)'],
  ])('%i min × %f = %i (%s)', (min, factor, expected) => {
    expect(calcPoints(min, factor)).toBe(expected);
  });

  test('entradas inválidas rendem 0', () => {
    expect(calcPoints(0, 2.8)).toBe(0);
    expect(calcPoints(-5, 2.8)).toBe(0);
    expect(calcPoints(Number.NaN, 2.8)).toBe(0);
    expect(calcPoints(30, 0)).toBe(0);
  });

  test('ruído de ponto flutuante não altera o resultado', () => {
    expect(calcPoints(30, 2.8)).toBe(84);
    expect(calcPoints(45, 1.11)).toBe(50); // 49.95 em binário é 49.949999…
    expect(calcPoints(3, 1.15)).toBe(3); // 3.4499999… → 3
  });
});

describe('formatação', () => {
  test('fator com vírgula', () => {
    expect(formatFactor(2.8)).toBe('2,80');
    expect(formatFactor(1)).toBe('1,00');
  });
  test('explicação da conta', () => {
    expect(explainPoints(30, 2.8, 84)).toBe('30 min × 2,80 = 84 pontos');
    expect(explainPoints(1, 1, 1)).toBe('1 min × 1,00 = 1 ponto');
  });
});

describe('rankRows (empates)', () => {
  test('empate recebe a mesma posição e a próxima é pulada (1, 1, 3)', () => {
    const rows = rankRows([
      { name: 'A', points: 100 },
      { name: 'B', points: 120 },
      { name: 'C', points: 120 },
      { name: 'D', points: 10 },
    ]);
    expect(rows.map((r) => [r.name, r.rank, r.tied])).toEqual([
      ['B', 1, true],
      ['C', 1, true],
      ['A', 3, false],
      ['D', 4, false],
    ]);
  });
  test('lista vazia', () => {
    expect(rankRows([])).toEqual([]);
  });
});
