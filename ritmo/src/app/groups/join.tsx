import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Banner, Button, Input, Screen, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { groupsApi, toApiError } from '@/lib/api';
import { extractInviteCode, isInviteCode, normalizeInviteCode } from '@/lib/invite';
import { useGroup } from '@/providers/group';

export default function JoinGroupScreen() {
  const router = useRouter();
  const { refresh, selectGroup } = useGroup();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fromClipboard, setFromClipboard] = useState(false);

  // Se a pessoa copiou a mensagem do WhatsApp, oferece o código automaticamente.
  useEffect(() => {
    Clipboard.getStringAsync()
      .then((text) => {
        const found = text ? extractInviteCode(text) : null;
        if (found) {
          setCode(found);
          setFromClipboard(true);
        }
      })
      .catch(() => {});
  }, []);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const g = await groupsApi.join(normalizeInviteCode(code));
      await refresh();
      await selectGroup(g.id);
      router.replace('/(tabs)');
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen keyboard contentStyle={{ gap: Spacing.four }}>
      <Txt variant="caption">Digite o código de 8 caracteres que veio no convite, ou cole o link.</Txt>
      <Input
        label="Código do grupo"
        value={code}
        onChangeText={(t) => setCode(extractInviteCode(t) ?? normalizeInviteCode(t).slice(0, 12))}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="ABCD2345"
        autoFocus
        style={{ fontSize: 24, letterSpacing: 4, textAlign: 'center', fontWeight: '700' }}
        hint={fromClipboard ? 'Código detectado na área de transferência.' : undefined}
        onSubmitEditing={isInviteCode(code) ? join : undefined}
      />
      {error ? <Banner message={error} onRetry={join} /> : null}
      <Button title="Entrar no grupo" icon="enter" onPress={join} disabled={!isInviteCode(code)} loading={busy} />
    </Screen>
  );
}
