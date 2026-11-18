import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Banner, Button, Input, Screen, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { profilesApi, toApiError } from '@/lib/api';
import { clearWebConfig, env } from '@/lib/env';
import { useAuth } from '@/providers/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await profilesApi.updateName(session.user.id, name);
      await refreshProfile();
      router.back();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen keyboard contentStyle={{ gap: Spacing.four }}>
      <Txt variant="caption">Conectado como {session?.user.email}</Txt>
      <Input label="Nome exibido" value={name} onChangeText={setName} autoCapitalize="words" />
      {error ? <Banner message={error} onRetry={save} /> : null}
      <Button title="Salvar" onPress={save} disabled={name.trim().length < 1} loading={busy} />
      <Button title="Sair da conta" variant="outline" icon="log-out-outline" onPress={async () => { await signOut(); router.replace('/(auth)/login'); }} />
      {env.canConfigureAtRuntime && !env.fromBuild ? (
        <Button title="Trocar o projeto Supabase" variant="ghost" icon="server-outline" onPress={async () => { await signOut(); clearWebConfig(); }} />
      ) : null}
    </Screen>
  );
}
