import { buildInviteMessage, extractInviteCode, inviteLinks, isInviteCode, normalizeInviteCode, whatsappUrl } from '@/lib/invite';

describe('código de convite', () => {
  test('normaliza caixa e separadores', () => {
    expect(normalizeInviteCode('abcd-2345')).toBe('ABCD2345');
    expect(normalizeInviteCode(' ab cd 23 45 ')).toBe('ABCD2345');
  });
  test('valida tamanho', () => {
    expect(isInviteCode('ABCD2345')).toBe(true);
    expect(isInviteCode('abcd-2345')).toBe(true);
    expect(isInviteCode('AB')).toBe(false);
    expect(isInviteCode('ABCD23456')).toBe(false);
  });
  test('extrai de link https, de link ritmo:// e de texto solto', () => {
    expect(extractInviteCode('https://ritmo.exemplo.com/join/ABCD2345')).toBe('ABCD2345');
    expect(extractInviteCode('ritmo://join/abcd2345')).toBe('ABCD2345');
    expect(extractInviteCode('ABCD2345')).toBe('ABCD2345');
    expect(extractInviteCode('abcd-2345')).toBe('ABCD2345');
    expect(extractInviteCode('oi, tudo bem?')).toBeNull();
    expect(extractInviteCode('bora treinar')).toBeNull();
  });
  test('extrai de uma mensagem completa de convite', () => {
    const msg = buildInviteMessage({ groupName: 'Turma', code: 'ABCD2345', startsOn: '18/11/2026', endsOn: '15/12/2026', baseUrl: 'https://ritmo.exemplo.com' });
    expect(extractInviteCode(msg)).toBe('ABCD2345');
  });
});

describe('links e mensagem', () => {
  test('sem domínio, só o esquema do app', () => {
    expect(inviteLinks('ABCD2345')).toEqual({ scheme: 'ritmo://join/ABCD2345', https: null });
  });
  test('com domínio', () => {
    expect(inviteLinks('ABCD2345', { baseUrl: 'https://ritmo.exemplo.com/' }).https).toBe('https://ritmo.exemplo.com/join/ABCD2345');
  });
  test('mensagem inclui código, período e links de instalação quando configurados', () => {
    const msg = buildInviteMessage({
      groupName: 'Desafio de verão',
      code: 'ABCD2345',
      startsOn: '18/11/2026',
      endsOn: '15/12/2026',
      testflightUrl: 'https://testflight.apple.com/join/xyz',
      playUrl: 'https://play.google.com/apps/internaltest/123',
    });
    expect(msg).toContain('Código do grupo: ABCD2345');
    expect(msg).toContain('18/11/2026 a 15/12/2026');
    expect(msg).toContain('TestFlight');
    expect(msg).toContain('Google Play');
    expect(msg).not.toContain('Link: https');
  });
  test('url do WhatsApp é codificada', () => {
    expect(whatsappUrl('oi & tchau')).toBe('whatsapp://send?text=oi%20%26%20tchau');
  });
});
