import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Banner, Button, Loading, Screen, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { groupsApi, toApiError } from '@/lib/api';
import { normalizeInviteCode } from '@/lib/invite';
import { localStore } from '@/lib/storage-keys';
import { useAuth } from '@/providers/auth';
import { useGroup } from '@/providers/group';

/**
 * Rota do link de convite: ritmo://join/CODIGO ou https://<dominio>/join/CODIGO.
 * Sem sessão, guarda o código e manda para o login; depois do login o código é usado.
 */
export default function JoinByLinkScreen() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = normalizeInviteCode(String(raw ?? ''));
  const router = useRouter();
  const { session, loading } = useAuth();
  const { refresh, selectGroup } = useGroup();
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const group = await groupsApi.join(code);
      await localStore.setPendingInvite(null);
      await refresh();
      await selectGroup(group.id);
      router.replace('/(tabs)');
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setJoining(false);
    }
  }

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      if (!session) {
        await localStore.setPendingInvite(code);
        if (!cancelled) router.replace('/(auth)/login');
        return;
      }
      await join();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, code]);

  return (
    <Screen contentStyle={{ gap: Spacing.three }}>
      <Txt variant="title">Convite {code}</Txt>
      {error ? (
        <>
          <Banner message={error} onRetry={join} />
          <Button title="Ir para meus grupos" variant="outline" onPress={() => router.replace('/groups')} />
        </>
      ) : (
        <Loading text={joining ? 'Entrando no grupo…' : 'Verificando…'} />
      )}
    </Screen>
  );
}
