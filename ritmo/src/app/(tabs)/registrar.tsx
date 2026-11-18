import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Banner, Button, Card, Chip, Input, Loading, Row, Screen, Txt, type IconName } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { factorsApi, toApiError, workoutsApi } from '@/lib/api';
import { formatBrDate, parseBrDate, todayInTz } from '@/lib/dates';
import { MODALITY_ICONS, SHORTCUTS, groupByModality, variantPrompt, type Factor } from '@/lib/factors';
import { photos, type PickedPhoto } from '@/lib/photos';
import { calcPoints, explainPoints, formatFactor } from '@/lib/scoring';
import { useAuth } from '@/providers/auth';
import { useGroup } from '@/providers/group';

const DURATIONS = [20, 30, 45, 60, 90];

export default function RegistrarScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { group } = useGroup();
  const meId = session!.user.id;

  const table = useAsync(() => factorsApi.active(), [], {});
  const groups = useMemo(() => groupByModality(table.data?.factors ?? []), [table.data]);

  const [modality, setModality] = useState('corrida');
  const [factorCode, setFactorCode] = useState('corrida_630_730');
  const [duration, setDuration] = useState('30');
  const [date, setDate] = useState(formatBrDate(todayInTz(group?.timezone)));
  const [caption, setCaption] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [showAll, setShowAll] = useState(false);
  // client_id fixa a identidade do envio: reenvios após falha contam uma vez só.
  const [clientId, setClientId] = useState(() => Crypto.randomUUID());
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; points: number } | null>(null);

  const modalityGroup = groups.find((g) => g.modality === modality);
  // Faixa efetiva: a escolhida, se pertence à modalidade; senão a padrão do atalho ou a primeira.
  const effectiveCode = modalityGroup?.items.some((f) => f.code === factorCode)
    ? factorCode
    : (SHORTCUTS.find((s) => s.modality === modality)?.defaultCode ?? modalityGroup?.items[0]?.code ?? factorCode);
  const factor: Factor | undefined = table.data?.factors.find((f) => f.code === effectiveCode);
  const minutes = Number.parseInt(duration, 10);
  const validMinutes = Number.isInteger(minutes) && minutes >= 1 && minutes <= 600;
  const dateIso = parseBrDate(date);
  const todayIso = todayInTz(group?.timezone);
  const dateError = !dateIso
    ? 'Use o formato dd/mm/aaaa'
    : group && (dateIso < group.starts_on || dateIso > group.ends_on)
      ? `Fora do período do desafio (${formatBrDate(group.starts_on)} a ${formatBrDate(group.ends_on)})`
      : dateIso > todayIso
        ? 'Não dá para registrar no futuro'
        : null;
  const preview = factor && validMinutes ? calcPoints(minutes, factor.factor) : 0;
  const canPublish = Boolean(group && factor && validMinutes && dateIso && !dateError && !publishing);

  function reset() {
    setClientId(Crypto.randomUUID());
    setCaption('');
    setPhoto(null);
    setSuccess(null);
    setError(null);
    setDuration('30');
    setDate(formatBrDate(todayInTz(group?.timezone)));
  }

  async function publish() {
    if (!group || !factor || !dateIso) return;
    setPublishing(true);
    setError(null);
    try {
      let photoPath: string | null = null;
      if (photo) {
        photoPath = await photos.upload(photos.photoPath(group.id, meId, clientId), photo);
      }
      const w = await workoutsApi.create({
        groupId: group.id,
        clientId,
        performedOn: dateIso,
        durationMin: minutes,
        factorCode: factor.code,
        caption: caption.trim() || null,
        photoPath,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSuccess({ id: w.id, points: w.points });
    } catch (err) {
      const e = toApiError(err);
      setError(e.retryable ? `${e.message} Seu treino não será duplicado ao tentar de novo.` : e.message);
    } finally {
      setPublishing(false);
    }
  }

  if (!group) return null;

  if (success) {
    return (
      <Screen contentStyle={{ gap: Spacing.four, alignItems: 'center', paddingTop: Spacing.six }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark" size={52} color={theme.onAccent} />
        </View>
        <Txt variant="title">Treino publicado!</Txt>
        <Txt variant="display" color={theme.primary}>+{success.points} pts</Txt>
        <Txt variant="caption" style={{ textAlign: 'center' }}>Já está no feed e no ranking do grupo.</Txt>
        <View style={{ gap: Spacing.two, width: '100%' }}>
          <Button title="Ver no feed" icon="list" onPress={() => { const id = success.id; reset(); router.push({ pathname: '/workout/[id]', params: { id } }); }} />
          <Button title="Registrar outro" variant="outline" onPress={reset} />
        </View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
      <Screen keyboard contentStyle={{ gap: Spacing.four }}>
        {table.error ? <Banner message={table.error} onRetry={table.reload} /> : null}
        {table.loading && !table.data ? <Loading text="Carregando tabela de fatores…" /> : null}

        <View style={{ gap: Spacing.two }}>
          <Txt variant="label">Modalidade</Txt>
          <Row style={{ flexWrap: 'wrap' }}>
            {SHORTCUTS.map((s) => (
              <Chip key={s.modality} label={s.label} icon={s.icon as IconName} selected={modality === s.modality} onPress={() => { setModality(s.modality); setShowAll(false); }} />
            ))}
            <Chip label={showAll ? 'Menos' : 'Outras…'} icon={showAll ? 'chevron-up' : 'ellipsis-horizontal'} selected={showAll || !SHORTCUTS.some((s) => s.modality === modality)} onPress={() => setShowAll((v) => !v)} />
          </Row>
          {showAll ? (
            <Row style={{ flexWrap: 'wrap' }}>
              {groups
                .filter((g) => !SHORTCUTS.some((s) => s.modality === g.modality))
                .map((g) => (
                  <Chip key={g.modality} small label={g.label} icon={(MODALITY_ICONS[g.modality] ?? 'fitness') as IconName} selected={modality === g.modality} onPress={() => setModality(g.modality)} />
                ))}
            </Row>
          ) : null}
        </View>

        {modalityGroup ? (
          <View style={{ gap: Spacing.two }}>
            <Txt variant="label">{variantPrompt(modality)}</Txt>
            {modalityGroup.items.map((f) => {
              const selected = f.code === effectiveCode;
              return (
                <Pressable
                  key={f.code}
                  onPress={() => setFactorCode(f.code)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.option, { backgroundColor: selected ? theme.primary : theme.card, borderColor: selected ? theme.primary : theme.border }]}>
                  <Txt variant="bodyBold" color={selected ? theme.onPrimary : theme.text} style={{ flex: 1 }}>
                    {f.variant_label}
                    {f.provisional ? ' *' : ''}
                  </Txt>
                  <Txt variant="caption" color={selected ? theme.onPrimary : theme.textSecondary}>× {formatFactor(f.factor)}</Txt>
                </Pressable>
              );
            })}
            {modalityGroup.items.some((f) => f.provisional) ? <Txt variant="caption">* fator provisório, pode ser revisado durante o piloto.</Txt> : null}
          </View>
        ) : null}

        <View style={{ gap: Spacing.two }}>
          <Txt variant="label">Duração (minutos)</Txt>
          <Row style={{ flexWrap: 'wrap' }}>
            {DURATIONS.map((d) => (
              <Chip key={d} small label={`${d}`} selected={duration === String(d)} onPress={() => setDuration(String(d))} />
            ))}
          </Row>
          <Input value={duration} onChangeText={(t) => setDuration(t.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" placeholder="Ex.: 42" error={duration && !validMinutes ? 'Entre 1 e 600 minutos' : null} />
        </View>

        <Input label="Data do treino" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" error={dateError} hint={`Hoje é ${formatBrDate(todayIso)} no fuso do grupo.`} />

        <View style={{ gap: Spacing.two }}>
          <Txt variant="label">Foto (opcional)</Txt>
          {photo ? (
            <View>
              <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="cover" />
              <Pressable onPress={() => setPhoto(null)} style={[styles.removePhoto, { backgroundColor: theme.card }]} accessibilityLabel="Remover foto">
                <Ionicons name="close" size={18} color={theme.text} />
              </Pressable>
            </View>
          ) : (
            <Row>
              <Button title="Câmera" variant="outline" icon="camera" style={{ flex: 1 }} onPress={async () => setPhoto((await photos.pickFromCamera()) ?? photo)} />
              <Button title="Galeria" variant="outline" icon="images" style={{ flex: 1 }} onPress={async () => setPhoto((await photos.pickFromLibrary()) ?? photo)} />
            </Row>
          )}
        </View>

        <Input label="Legenda (opcional)" value={caption} onChangeText={setCaption} placeholder="Como foi o treino?" multiline maxLength={500} style={{ minHeight: 72, textAlignVertical: 'top' }} />

        <Card style={{ backgroundColor: theme.backgroundElement, borderColor: 'transparent', gap: Spacing.one }}>
          <Txt variant="label">Prévia da pontuação</Txt>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="caption">{factor && validMinutes ? explainPoints(minutes, factor.factor, preview) : 'Preencha a modalidade e a duração'}</Txt>
            <Txt variant="title" color={theme.primary}>{preview} pts</Txt>
          </Row>
          <Txt variant="caption">O valor oficial é calculado no servidor com a tabela {table.data?.version ?? '…'}.</Txt>
        </Card>

        {error ? <Banner message={error} onRetry={publish} /> : null}

        <Button title={`Publicar · ${preview} pts`} variant="accent" icon="send" onPress={publish} disabled={!canPublish} loading={publishing} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: Radius.md, borderWidth: 1 },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.md },
  removePhoto: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
