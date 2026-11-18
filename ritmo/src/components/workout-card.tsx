import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Card, PointsBadge, Row, Txt, type IconName } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MODALITY_ICONS } from '@/lib/factors';
import { photos } from '@/lib/photos';
import type { FeedWorkout } from '@/lib/types';

const urlCache = new Map<string, string>();

export function usePhotoUrl(path: string | null | undefined) {
  const [resolved, setResolved] = useState<{ path: string; url: string | null } | null>(null);
  const cached = path ? (urlCache.get(path) ?? null) : null;
  useEffect(() => {
    if (!path || urlCache.has(path)) return;
    let active = true;
    photos.signedUrl(path).then((u) => {
      if (!active) return;
      if (u) urlCache.set(path, u);
      setResolved({ path, url: u });
    });
    return () => {
      active = false;
    };
  }, [path]);
  if (!path) return null;
  return cached ?? (resolved?.path === path ? resolved.url : null);
}

export function WorkoutCard({ workout, meId, onPress, compact }: { workout: FeedWorkout; meId: string; onPress?: () => void; compact?: boolean }) {
  const theme = useTheme();
  const url = usePhotoUrl(compact ? null : workout.photo_path);
  const removed = Boolean(workout.removed_at);
  const likeCount = workout.likes?.length ?? 0;
  const liked = workout.likes?.some((l) => l.user_id === meId) ?? false;
  const commentCount = workout.comments?.[0]?.count ?? 0;
  const icon = (MODALITY_ICONS[workout.modality] ?? 'fitness') as IconName;

  return (
    <Card onPress={onPress} style={[{ gap: Spacing.two, padding: compact ? 12 : Spacing.three }, removed && { opacity: 0.6 }]}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          <Avatar name={workout.author?.display_name ?? '?'} size={compact ? 30 : 36} highlight={workout.user_id === meId} />
          <View>
            <Txt variant="bodyBold">{workout.author?.display_name ?? 'Participante'}</Txt>
            <Txt variant="caption">
              {workout.modality_label} · {workout.variant_label}
            </Txt>
          </View>
        </Row>
        <PointsBadge points={workout.points} size={compact ? 'sm' : 'md'} />
      </Row>

      {url ? <Image source={{ uri: url }} style={styles.photo} contentFit="cover" transition={150} /> : null}

      {workout.caption && !compact ? <Txt>{workout.caption}</Txt> : null}

      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={Spacing.three}>
          <Row gap={4}>
            <Ionicons name={icon} size={15} color={theme.textSecondary} />
            <Txt variant="caption">{workout.duration_min} min</Txt>
          </Row>
          {!compact ? (
            <>
              <Row gap={4}>
                <Ionicons name={liked ? 'heart' : 'heart-outline'} size={15} color={liked ? theme.danger : theme.textSecondary} />
                <Txt variant="caption">{likeCount}</Txt>
              </Row>
              <Row gap={4}>
                <Ionicons name="chatbubble-outline" size={15} color={theme.textSecondary} />
                <Txt variant="caption">{commentCount}</Txt>
              </Row>
              {workout.photo_path && !url ? <Ionicons name="image-outline" size={15} color={theme.textSecondary} /> : null}
            </>
          ) : null}
        </Row>
        {removed ? (
          <Row gap={4}>
            <Ionicons name="remove-circle" size={15} color={theme.danger} />
            <Txt variant="caption" color={theme.danger}>Removido</Txt>
          </Row>
        ) : null}
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.md, backgroundColor: '#0002' },
});
