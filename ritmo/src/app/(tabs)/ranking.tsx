import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Avatar, Banner, Card, Empty, Loading, Row, Screen, SegmentedControl, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { rankingApi } from '@/lib/api';
import { formatBrDate } from '@/lib/dates';
import { ordinal } from '@/lib/scoring';
import type { Period } from '@/lib/types';
import { useAuth } from '@/providers/auth';
import { useGroup } from '@/providers/group';

export default function RankingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { group } = useGroup();
  const meId = session!.user.id;
  const [period, setPeriod] = useState<Period>('challenge');

  const ranking = useAsync(
    async () => {
      const [rows, window] = await Promise.all([rankingApi.list(group!.id, period), rankingApi.window(group!.id, period)]);
      return { rows, window };
    },
    [group?.id, period],
    { enabled: Boolean(group) },
  );
  useFocusEffect(
    useCallback(() => {
      ranking.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [group?.id, period]),
  );

  if (!group) return null;
  const rows = ranking.data?.rows ?? [];
  const me = rows.find((r) => r.user_id === meId);
  const win = ranking.data?.window;

  return (
    <Screen contentStyle={{ gap: Spacing.three }} onRefresh={ranking.refresh}>
        <SegmentedControl
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'challenge', label: 'Desafio' },
            { value: '7d', label: 'Últimos 7 dias' },
          ]}
        />
        {win ? (
          <Txt variant="caption" style={{ textAlign: 'center' }}>
            {formatBrDate(win.starts_on)} a {formatBrDate(win.ends_on)} · fuso {group.timezone}
          </Txt>
        ) : null}
        {ranking.error ? <Banner message={ranking.error} onRetry={ranking.reload} /> : null}
        {ranking.loading && !ranking.data ? <Loading text="Calculando placar…" /> : null}

        {me ? (
          <Card style={{ backgroundColor: theme.primary, borderColor: theme.primary }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row>
                <View style={{ alignItems: 'center', minWidth: 44 }}>
                  <Txt variant="title" color={theme.accent}>{ordinal(me.rank)}</Txt>
                  {me.tied ? <Txt variant="caption" color={theme.accent}>empate</Txt> : null}
                </View>
                <View>
                  <Txt variant="bodyBold" color={theme.onPrimary}>Você</Txt>
                  <Txt variant="caption" color={theme.onPrimary}>
                    {me.workouts} {me.workouts === 1 ? 'treino' : 'treinos'} · {me.minutes} min
                  </Txt>
                </View>
              </Row>
              <Txt variant="title" color={theme.accent}>{me.points} pts</Txt>
            </Row>
          </Card>
        ) : null}

        {rows.map((r) => {
          const isMe = r.user_id === meId;
          return (
            <Card
              key={r.user_id}
              onPress={() => router.push({ pathname: '/participant/[userId]', params: { userId: r.user_id, period, name: r.display_name } })}
              style={[{ paddingVertical: 12 }, isMe && { borderColor: theme.accent, borderWidth: 2 }]}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row>
                  <View style={{ alignItems: 'center', minWidth: 40 }}>
                    <Txt variant="heading" color={r.rank === 1 ? theme.primary : theme.text}>{ordinal(r.rank)}</Txt>
                    {r.tied ? <Txt variant="caption" style={{ fontSize: 10 }}>empate</Txt> : null}
                  </View>
                  <Avatar name={r.display_name} size={36} highlight={isMe} />
                  <View style={{ flexShrink: 1 }}>
                    <Txt variant="bodyBold" numberOfLines={1}>{r.display_name}{isMe ? ' (você)' : ''}</Txt>
                    <Txt variant="caption">
                      {r.workouts} {r.workouts === 1 ? 'treino' : 'treinos'} · {r.minutes} min
                    </Txt>
                  </View>
                </Row>
                <Row gap={4}>
                  <Txt variant="heading">{r.points}</Txt>
                  <Txt variant="caption">pts</Txt>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </Row>
              </Row>
            </Card>
          );
        })}
        {!ranking.loading && rows.length === 0 && !ranking.error ? <Empty icon="trophy-outline" title="Sem participantes ainda" /> : null}
    </Screen>
  );
}
