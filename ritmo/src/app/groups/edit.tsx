import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Banner, Button, Input, Screen, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { groupsApi, toApiError } from '@/lib/api';
import { formatBrDate, parseBrDate } from '@/lib/dates';
import { useGroup } from '@/providers/group';

export default function EditGroupScreen() {
  const router = useRouter();
  const { group, refresh } = useGroup();
  const [name, setName] = useState(group?.name ?? '');
  const [start, setStart] = useState(group ? formatBrDate(group.starts_on) : '');
  const [end, setEnd] = useState(group ? formatBrDate(group.ends_on) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startIso = parseBrDate(start);
  const endIso = parseBrDate(end);
  const valid = group && name.trim().length >= 2 && startIso && endIso && endIso >= startIso;

  async function save() {
    if (!valid || !group) return;
    setBusy(true);
    setError(null);
    try {
      await groupsApi.update(group.id, name.trim(), startIso!, endIso!);
      await refresh();
      router.back();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen keyboard contentStyle={{ gap: Spacing.four }}>
      <Txt variant="caption">Treinos já registrados fora do novo período continuam no histórico, mas saem do placar do desafio.</Txt>
      <Input label="Nome" value={name} onChangeText={setName} />
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <View style={{ flex: 1 }}><Input label="Início" value={start} onChangeText={setStart} keyboardType="numbers-and-punctuation" /></View>
        <View style={{ flex: 1 }}><Input label="Fim" value={end} onChangeText={setEnd} keyboardType="numbers-and-punctuation" /></View>
      </View>
      {error ? <Banner message={error} onRetry={save} /> : null}
      <Button title="Salvar" onPress={save} disabled={!valid} loading={busy} />
    </Screen>
  );
}
