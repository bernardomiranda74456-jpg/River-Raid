import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, SectionList, View } from 'react-native';

import { Banner, Empty, Loading, SegmentedControl, Txt } from '@/components/ui';
import { WorkoutCard } from '@/components/workout-card';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { workoutsApi } from '@/lib/api';
import { dayLabel, todayInTz } from '@/lib/dates';
import type { FeedWorkout } from '@/lib/types';
import { useAuth } from '@/providers/auth';
import { useGroup } from '@/providers/group';

type Filter = 'all' | 'mine';

export default function FeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { group } = useGroup();
  const meId = session!.user.id;
  const [filter, setFilter] = useState<Filter>('all');

  const feed = useAsync(() => workoutsApi.feed(group!.id), [group?.id], { enabled: Boolean(group) });
  useFocusEffect(
    useCallback(() => {
      feed.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [group?.id]),
  );

  const today = todayInTz(group?.timezone);
  const sections = useMemo(() => {
    const rows = (feed.data ?? []).filter((w) => filter === 'all' || w.user_id === meId);
    const byDay = new Map<string, FeedWorkout[]>();
    for (const w of rows) byDay.set(w.performed_on, [...(byDay.get(w.performed_on) ?? []), w]);
    return [...byDay.entries()].map(([day, data]) => ({
      title: dayLabel(day, today),
      points: data.filter((w) => !w.removed_at).reduce((s, w) => s + w.points, 0),
      data,
    }));
  }, [feed.data, filter, meId, today]);

  if (!group) return null;

  return (
    <SectionList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: Spacing.six }}
      sections={sections}
      keyExtractor={(w) => w.id}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={feed.loading && Boolean(feed.data)} onRefresh={feed.refresh} tintColor={theme.primary} />}
      ListHeaderComponent={
        <View style={{ gap: Spacing.two, marginBottom: Spacing.two }}>
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'mine', label: 'Meus treinos' },
            ]}
          />
          {feed.error ? <Banner message={feed.error} onRetry={feed.reload} /> : null}
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: Spacing.two, marginBottom: Spacing.one }}>
          <Txt variant="heading">{section.title}</Txt>
          <Txt variant="caption">{section.points} pts no dia</Txt>
        </View>
      )}
      renderItem={({ item }) => <WorkoutCard workout={item} meId={meId} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: item.id } })} />}
      ListEmptyComponent={
        feed.loading && !feed.data ? (
          <Loading text="Carregando treinos…" />
        ) : (
          <Empty
            icon="barbell-outline"
            title={filter === 'mine' ? 'Você ainda não registrou treinos' : 'Nenhum treino ainda'}
            text="Toque em Registrar para publicar o primeiro check-in."
          />
        )
      }
    />
  );
}
