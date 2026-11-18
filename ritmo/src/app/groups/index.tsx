import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Banner, Button, Card, Loading, Row, Screen, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatBrDate } from '@/lib/dates';
import { useAuth } from '@/providers/auth';
import { useGroup } from '@/providers/group';

export default function GroupsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const { groups, loading, selectGroup, inviteError } = useGroup();

  async function open(id: string) {
    await selectGroup(id);
    router.replace('/(tabs)');
  }

  return (
    <Screen contentStyle={{ paddingTop: insets.top + Spacing.three, gap: Spacing.three }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Txt variant="caption">Olá, {profile?.display_name ?? '…'}</Txt>
          <Txt variant="title">Seus grupos</Txt>
        </View>
        <Button title="Sair" variant="ghost" icon="log-out-outline" onPress={signOut} />
      </Row>
      {inviteError ? <Banner message={inviteError} /> : null}

      {loading ? <Loading /> : null}
      {!loading && groups.length === 0 ? (
        <Card style={{ gap: Spacing.two, alignItems: 'center' }}>
          <Ionicons name="people" size={36} color={theme.primary} />
          <Txt variant="heading">Você ainda não está em um grupo</Txt>
          <Txt variant="caption" style={{ textAlign: 'center' }}>
            Crie um desafio e convide amigos pelo WhatsApp, ou entre com o código que recebeu.
          </Txt>
        </Card>
      ) : null}
      {groups.map((g) => (
        <Card key={g.id} onPress={() => open(g.id)}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row>
              <Avatar name={g.name} />
              <View>
                <Txt variant="bodyBold">{g.name}</Txt>
                <Txt variant="caption">
                  {formatBrDate(g.starts_on)} – {formatBrDate(g.ends_on)}
                </Txt>
              </View>
            </Row>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </Row>
        </Card>
      ))}

      <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
        <Button title="Criar grupo" icon="add-circle" onPress={() => router.push('/groups/new')} />
        <Button title="Entrar com código" icon="key" variant="accent" onPress={() => router.push('/groups/join')} />
      </View>
    </Screen>
  );
}
