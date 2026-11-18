import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { Banner, Card, Empty, Loading, Row, Screen, Txt } from '@/components/ui';
import { WorkoutCard } from '@/components/workout-card';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { rankingApi, workoutsApi } from '@/lib/api';
import { formatBrDate } from '@/lib/dates';
import type { Period } from '@/lib/types';
import { useAuth } from '@/providers/auth';
import { useGroup } from '@/providers/group';

/** Treinos que compõem a pontuação de um participante no período do ranking. */
export default function ParticipantScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { userId, period = 'challenge', name } = useLocalSearchParams<{ userId: string; period?: Period; name?: string }>();
  const { session } = useAuth();
  const { group } = useGroup();

  const data = useAsync(
    async () => {
      const window = await rankingApi.window(group!.id, period as Period);
      const workouts = await workoutsApi.feed(group!.id, { userId, from: window.starts_on, to: window.ends_on });
      return { window, workouts };
    },
    [group?.id, userId, period],
    { enabled: Boolean(group) },
  );

  const valid = (data.data?.workouts ?? []).filter((w) => !w.removed_at);
  const total = valid.reduce((s, w) => s + w.points, 0);

  return (
    <Screen contentStyle={{ gap: Spacing.two }}>
      <Stack.Screen options={{ title: name ?? 'Participante' }} />
      {data.data ? (
        <Card style={{ backgroundColor: theme.primary, borderColor: theme.primary, marginBottom: Spacing.two }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="caption" color={theme.onPrimary}>
              {period === '7d' ? 'Últimos 7 dias' : 'Desafio'} · {formatBrDate(data.data.window.starts_on)} a {formatBrDate(data.data.window.ends_on)}
            </Txt>
            <Txt variant="title" color={theme.accent}>{total} pts</Txt>
          </Row>
          <Txt variant="caption" color={theme.onPrimary}>
            {valid.length} {valid.length === 1 ? 'treino conta' : 'treinos contam'} para este placar.
          </Txt>
        </Card>
      ) : null}
      {data.error ? <Banner message={data.error} onRetry={data.reload} /> : null}
      {data.loading && !data.data ? <Loading /> : null}
      {data.data?.workouts.map((w) => (
        <WorkoutCard key={w.id} workout={w} meId={session!.user.id} compact onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })} />
      ))}
      {data.data && data.data.workouts.length === 0 ? <Empty title="Nenhum treino no período" /> : null}
    </Screen>
  );
}
