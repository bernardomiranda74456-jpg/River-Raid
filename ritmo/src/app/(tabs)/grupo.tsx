import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Share, View } from 'react-native';

import { Avatar, Banner, Button, Card, Divider, Loading, Row, Screen, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { factorsApi, groupsApi } from '@/lib/api';
import { challengeStatus, diffDays, formatBrDate, todayInTz } from '@/lib/dates';
import { env } from '@/lib/env';
import { groupByModality } from '@/lib/factors';
import { buildInviteMessage, inviteLinks, whatsappUrl } from '@/lib/invite';
import { formatFactor } from '@/lib/scoring';
import { useAuth } from '@/providers/auth';
import { useGroup } from '@/providers/group';

export default function GrupoScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session, profile } = useAuth();
  const { group, isOrganizer } = useGroup();
  const [copied, setCopied] = useState(false);

  const members = useAsync(() => groupsApi.members(group!.id), [group?.id], { enabled: Boolean(group) });
  const table = useAsync(() => factorsApi.active(), [], {});
  useFocusEffect(
    useCallback(() => {
      members.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [group?.id]),
  );

  if (!group) return null;
  const today = todayInTz(group.timezone);
  const status = challengeStatus(group.starts_on, group.ends_on, today);
  const message = buildInviteMessage({
    groupName: group.name,
    code: group.invite_code,
    startsOn: formatBrDate(group.starts_on),
    endsOn: formatBrDate(group.ends_on),
    baseUrl: env.inviteBaseUrl,
    testflightUrl: env.testflightUrl,
    playUrl: env.playUrl,
  });

  async function shareWhatsApp() {
    const url = whatsappUrl(message);
    if (await Linking.canOpenURL(url).catch(() => false)) {
      await Linking.openURL(url);
    } else {
      await Share.share({ message });
    }
  }

  async function copyCode() {
    await Clipboard.setStringAsync(group!.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen contentStyle={{ gap: Spacing.three }}>
      <Card style={{ gap: Spacing.two }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="title">{group.name}</Txt>
          {isOrganizer ? <Button title="Editar" variant="ghost" icon="create-outline" onPress={() => router.push('/groups/edit')} /> : null}
        </Row>
        <Row gap={6}>
          <Ionicons name="calendar" size={16} color={theme.textSecondary} />
          <Txt variant="caption">
            {formatBrDate(group.starts_on)} a {formatBrDate(group.ends_on)} ·{' '}
            {status === 'active'
              ? `faltam ${diffDays(today, group.ends_on)} dias`
              : status === 'upcoming'
                ? `começa em ${diffDays(today, group.starts_on)} dias`
                : 'encerrado'}
          </Txt>
        </Row>
        <Row gap={6}>
          <Ionicons name="globe-outline" size={16} color={theme.textSecondary} />
          <Txt variant="caption">Fuso: {group.timezone}</Txt>
        </Row>
      </Card>

      <Card style={{ gap: Spacing.two }}>
        <Txt variant="heading">Convite</Txt>
        <Txt variant="caption">Compartilhe o código ou o link. Quem instalar o app depois entra em “Entrar com código”.</Txt>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="mono" color={theme.primary}>{group.invite_code}</Txt>
          <Button title={copied ? 'Copiado!' : 'Copiar'} variant="outline" icon={copied ? 'checkmark' : 'copy-outline'} onPress={copyCode} />
        </Row>
        <Txt variant="caption" selectable>{inviteLinks(group.invite_code, { baseUrl: env.inviteBaseUrl }).https ?? inviteLinks(group.invite_code).scheme}</Txt>
        <Button title="Convidar pelo WhatsApp" icon="logo-whatsapp" variant="accent" onPress={shareWhatsApp} />
        <Button title="Compartilhar de outro jeito" variant="ghost" icon="share-outline" onPress={() => Share.share({ message })} />
      </Card>

      <Card style={{ gap: Spacing.two }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="heading">Participantes</Txt>
          <Txt variant="caption">{members.data?.length ?? '…'}</Txt>
        </Row>
        {members.error ? <Banner message={members.error} onRetry={members.reload} /> : null}
        {members.loading && !members.data ? <Loading /> : null}
        {members.data?.map((m) => (
          <Row key={m.user_id} style={{ justifyContent: 'space-between' }}>
            <Row>
              <Avatar name={m.profile?.display_name ?? '?'} size={34} highlight={m.user_id === session?.user.id} />
              <View>
                <Txt variant="bodyBold">
                  {m.profile?.display_name}
                  {m.user_id === session?.user.id ? ' (você)' : ''}
                </Txt>
                <Txt variant="caption">{m.role === 'organizer' ? 'Organizador' : `Entrou em ${formatBrDate(m.joined_at.slice(0, 10))}`}</Txt>
              </View>
            </Row>
          </Row>
        ))}
      </Card>

      <Card style={{ gap: Spacing.two }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="heading">Tabela de fatores</Txt>
          <Txt variant="caption">{table.data ? `versão ${table.data.version}` : ''}</Txt>
        </Row>
        <Txt variant="caption">Pontos = minutos × fator, arredondado por treino. Referência: caminhada a 5 km/h = 1 ponto por minuto.</Txt>
        {table.error ? <Banner message={table.error} onRetry={table.reload} /> : null}
        {groupByModality(table.data?.factors ?? []).map((g) => (
          <View key={g.modality} style={{ gap: 2 }}>
            <Divider />
            <Txt variant="bodyBold">{g.label}</Txt>
            {g.items.map((f) => (
              <Row key={f.code} style={{ justifyContent: 'space-between' }}>
                <Txt variant="caption" style={{ flex: 1 }}>
                  {f.variant_label}
                  {f.provisional ? ' (provisório)' : ''}
                </Txt>
                <Txt variant="caption" color={theme.text}>{formatFactor(f.factor)}</Txt>
              </Row>
            ))}
          </View>
        ))}
      </Card>

      <Card style={{ gap: Spacing.two }}>
        <Txt variant="heading">Você</Txt>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row>
            <Avatar name={profile?.display_name ?? '?'} size={34} highlight />
            <View>
              <Txt variant="bodyBold">{profile?.display_name}</Txt>
              <Txt variant="caption">{session?.user.email}</Txt>
            </View>
          </Row>
          <Button title="Editar" variant="ghost" icon="person-outline" onPress={() => router.push('/profile')} />
        </Row>
        <Button title="Trocar de grupo" variant="outline" icon="swap-horizontal" onPress={() => router.push('/groups')} />
      </Card>
    </Screen>
  );
}
