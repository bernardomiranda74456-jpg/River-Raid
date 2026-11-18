import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar, Banner, Button, Card, Divider, Input, Loading, PointsBadge, Row, Screen, Txt } from '@/components/ui';
import { usePhotoUrl } from '@/components/workout-card';
import { Radius, Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { toApiError, workoutsApi } from '@/lib/api';
import { formatBrDate, formatDateTime } from '@/lib/dates';
import { explainPoints, formatFactor } from '@/lib/scoring';
import { useAuth } from '@/providers/auth';
import { useGroup } from '@/providers/group';

export default function WorkoutDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { group, isOrganizer } = useGroup();
  const meId = session!.user.id;

  const detail = useAsync(
    async () => {
      const [workout, likes, comments] = await Promise.all([workoutsApi.get(id), workoutsApi.likes(id), workoutsApi.comments(id)]);
      return { workout, likes, comments };
    },
    [id],
  );
  const workout = detail.data?.workout;
  const photoUrl = usePhotoUrl(workout?.photo_path);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState('');

  const liked = detail.data?.likes.some((l) => l.user_id === meId) ?? false;

  async function toggleLike() {
    if (!workout) return;
    setActionError(null);
    try {
      if (liked) await workoutsApi.unlike(workout.id, meId);
      else await workoutsApi.like(workout.id, meId);
      await detail.refresh();
    } catch (err) {
      setActionError(toApiError(err).message);
    }
  }

  async function sendComment() {
    if (!workout || !comment.trim()) return;
    setSending(true);
    setActionError(null);
    try {
      await workoutsApi.comment(workout.id, meId, comment);
      setComment('');
      await detail.refresh();
    } catch (err) {
      setActionError(toApiError(err).message);
    } finally {
      setSending(false);
    }
  }

  async function remove() {
    if (!workout) return;
    setActionError(null);
    try {
      await workoutsApi.remove(workout.id, reason);
      setRemoving(false);
      await detail.refresh();
    } catch (err) {
      setActionError(toApiError(err).message);
    }
  }

  function confirmDeleteComment(commentId: string) {
    Alert.alert('Apagar comentário?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => { await workoutsApi.deleteComment(commentId).catch(() => {}); detail.refresh(); } },
    ]);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
      <Screen keyboard contentStyle={{ gap: Spacing.three }} onRefresh={detail.refresh}>
        {detail.error ? <Banner message={detail.error} onRetry={detail.reload} /> : null}
        {detail.loading && !detail.data ? <Loading /> : null}
        {workout ? (
          <>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row>
                <Avatar name={workout.author?.display_name ?? '?'} highlight={workout.user_id === meId} />
                <View>
                  <Txt variant="bodyBold">{workout.author?.display_name}</Txt>
                  <Txt variant="caption">
                    {formatBrDate(workout.performed_on)} · publicado {formatDateTime(workout.created_at, group?.timezone)}
                  </Txt>
                </View>
              </Row>
              <PointsBadge points={workout.points} size="lg" />
            </Row>

            {workout.removed_at ? (
              <Banner message={`Removido pelo organizador: ${workout.removal_reason ?? ''}. Não conta no ranking.`} />
            ) : null}

            {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.photo} contentFit="cover" transition={200} /> : workout.photo_path ? <Loading text="Carregando foto…" /> : null}
            {workout.caption ? <Txt>{workout.caption}</Txt> : null}

            <Card style={{ gap: Spacing.one, backgroundColor: theme.backgroundElement, borderColor: 'transparent' }}>
              <Txt variant="label">Como os pontos foram calculados</Txt>
              <Txt variant="heading" color={theme.primary}>{explainPoints(workout.duration_min, workout.factor_value, workout.points)}</Txt>
              <Txt variant="caption">
                {workout.modality_label} · {workout.variant_label} → fator {formatFactor(workout.factor_value)} (tabela {workout.factor_table_version}). Arredondado para o inteiro mais próximo.
              </Txt>
            </Card>

            <Row gap={Spacing.three}>
              <Pressable onPress={toggleLike} disabled={Boolean(workout.removed_at)} accessibilityRole="button" style={styles.action}>
                <Ionicons name={liked ? 'heart' : 'heart-outline'} size={24} color={liked ? theme.danger : theme.text} />
                <Txt variant="bodyBold">{detail.data?.likes.length ?? 0}</Txt>
              </Pressable>
              <Row gap={6}>
                <Ionicons name="chatbubble-outline" size={22} color={theme.text} />
                <Txt variant="bodyBold">{detail.data?.comments.length ?? 0}</Txt>
              </Row>
            </Row>
            {detail.data && detail.data.likes.length > 0 ? (
              <Txt variant="caption">Curtido por {detail.data.likes.map((l) => (l.user_id === meId ? 'você' : l.profile?.display_name)).join(', ')}</Txt>
            ) : null}

            {actionError ? <Banner message={actionError} /> : null}
            <Divider />

            <View style={{ gap: Spacing.two }}>
              <Txt variant="heading">Comentários</Txt>
              {detail.data?.comments.length === 0 ? <Txt variant="caption">Seja a primeira pessoa a comentar.</Txt> : null}
              {detail.data?.comments.map((c) => (
                <Pressable key={c.id} onLongPress={c.user_id === meId ? () => confirmDeleteComment(c.id) : undefined}>
                  <Row style={{ alignItems: 'flex-start' }}>
                    <Avatar name={c.author?.display_name ?? '?'} size={30} highlight={c.user_id === meId} />
                    <View style={{ flex: 1 }}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <Txt variant="bodyBold">{c.author?.display_name}</Txt>
                        <Txt variant="caption">{formatDateTime(c.created_at, group?.timezone)}</Txt>
                      </Row>
                      <Txt>{c.body}</Txt>
                    </View>
                  </Row>
                </Pressable>
              ))}
              {!workout.removed_at ? (
                <Row style={{ alignItems: 'flex-end' }}>
                  <TextInput
                    value={comment}
                    onChangeText={setComment}
                    placeholder="Escreva um comentário"
                    placeholderTextColor={theme.textMuted}
                    multiline
                    maxLength={500}
                    style={[styles.commentInput, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
                  />
                  <Button title="Enviar" variant="accent" onPress={sendComment} disabled={!comment.trim()} loading={sending} />
                </Row>
              ) : null}
            </View>

            {isOrganizer && !workout.removed_at ? (
              <>
                <Divider />
                {removing ? (
                  <Card style={{ gap: Spacing.two, borderColor: theme.danger }}>
                    <Txt variant="heading">Remover este check-in</Txt>
                    <Txt variant="caption">O treino sai do ranking, mas fica no histórico com o motivo. A pessoa verá o motivo.</Txt>
                    <Input value={reason} onChangeText={setReason} placeholder="Motivo (obrigatório)" autoFocus />
                    <Row>
                      <Button title="Cancelar" variant="outline" style={{ flex: 1 }} onPress={() => setRemoving(false)} />
                      <Button title="Remover" variant="danger" style={{ flex: 1 }} onPress={remove} disabled={reason.trim().length < 3} />
                    </Row>
                  </Card>
                ) : (
                  <Button title="Remover check-in (organizador)" variant="ghost" icon="remove-circle-outline" onPress={() => setRemoving(true)} />
                )}
              </>
            ) : null}
            <Button title="Voltar ao feed" variant="ghost" onPress={() => router.back()} />
          </>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg, backgroundColor: '#0002' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentInput: { flex: 1, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, maxHeight: 100 },
});
