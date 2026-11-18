import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Banner, Button, Input, Screen, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { groupsApi, toApiError } from '@/lib/api';
import { DEFAULT_TZ, addDays, formatBrDate, parseBrDate, todayInTz } from '@/lib/dates';
import { useGroup } from '@/providers/group';

export default function NewGroupScreen() {
  const router = useRouter();
  const { refresh, selectGroup } = useGroup();
  const today = todayInTz(DEFAULT_TZ);
  const [name, setName] = useState('');
  const [start, setStart] = useState(formatBrDate(today));
  const [end, setEnd] = useState(formatBrDate(addDays(today, 27)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startIso = parseBrDate(start);
  const endIso = parseBrDate(end);
  const dateError = start && !startIso ? 'Use o formato dd/mm/aaaa' : null;
  const endError = end && !endIso ? 'Use o formato dd/mm/aaaa' : startIso && endIso && endIso < startIso ? 'Fim antes do início' : null;
  const valid = name.trim().length >= 2 && startIso && endIso && !endError;

  async function create() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const g = await groupsApi.create(name.trim(), startIso!, endIso!, DEFAULT_TZ);
      await refresh();
      await selectGroup(g.id);
      router.replace('/(tabs)/grupo');
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen keyboard contentStyle={{ gap: Spacing.four }}>
      <Txt variant="caption">
        Você será o organizador: pode compartilhar o convite e remover check-ins inválidos. O fuso do grupo é {DEFAULT_TZ}.
      </Txt>
      <Input label="Nome do desafio" placeholder="Ex.: Desafio de verão" value={name} onChangeText={setName} autoFocus />
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <View style={{ flex: 1 }}>
          <Input label="Início" value={start} onChangeText={setStart} keyboardType="numbers-and-punctuation" error={dateError} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Fim" value={end} onChangeText={setEnd} keyboardType="numbers-and-punctuation" error={endError} />
        </View>
      </View>
      {error ? <Banner message={error} onRetry={create} /> : null}
      <Button title="Criar e gerar convite" icon="rocket" onPress={create} disabled={!valid} loading={busy} />
    </Screen>
  );
}
