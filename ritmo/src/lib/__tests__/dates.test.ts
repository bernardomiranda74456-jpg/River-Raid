import { addDays, challengeStatus, dayLabel, diffDays, formatBrDate, isValidIsoDate, parseBrDate, todayInTz } from '@/lib/dates';

describe('fuso do grupo', () => {
  test('todayInTz usa America/Sao_Paulo: 23h UTC ainda é o mesmo dia; 02h UTC é o dia anterior', () => {
    expect(todayInTz('America/Sao_Paulo', new Date('2026-11-18T23:30:00Z'))).toBe('2026-11-18');
    expect(todayInTz('America/Sao_Paulo', new Date('2026-11-19T02:30:00Z'))).toBe('2026-11-18');
    expect(todayInTz('America/Sao_Paulo', new Date('2026-11-19T03:30:00Z'))).toBe('2026-11-19');
  });
  test('outro fuso', () => {
    expect(todayInTz('Europe/Lisbon', new Date('2026-11-19T02:30:00Z'))).toBe('2026-11-19');
  });
});

describe('datas ISO e BR', () => {
  test('addDays e diffDays', () => {
    expect(addDays('2026-11-18', 27)).toBe('2026-12-15');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(diffDays('2026-11-18', '2026-12-15')).toBe(27);
  });
  test('parseBrDate valida', () => {
    expect(parseBrDate('18/11/2026')).toBe('2026-11-18');
    expect(parseBrDate('1/2/2026')).toBe('2026-02-01');
    expect(parseBrDate('31/02/2026')).toBeNull();
    expect(parseBrDate('2026-11-18')).toBeNull();
  });
  test('formatBrDate', () => {
    expect(formatBrDate('2026-11-18')).toBe('18/11/2026');
  });
  test('isValidIsoDate', () => {
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
  });
});

describe('rótulos do feed', () => {
  test('Hoje, Ontem e dia da semana', () => {
    expect(dayLabel('2026-11-18', '2026-11-18')).toBe('Hoje');
    expect(dayLabel('2026-11-17', '2026-11-18')).toBe('Ontem');
    expect(dayLabel('2026-11-11', '2026-11-18')).toBe('quarta, 11 nov');
  });
});

describe('status do desafio', () => {
  test('antes, durante e depois', () => {
    expect(challengeStatus('2026-11-20', '2026-12-17', '2026-11-18')).toBe('upcoming');
    expect(challengeStatus('2026-11-10', '2026-12-07', '2026-11-18')).toBe('active');
    expect(challengeStatus('2026-10-01', '2026-10-28', '2026-11-18')).toBe('finished');
  });
});
