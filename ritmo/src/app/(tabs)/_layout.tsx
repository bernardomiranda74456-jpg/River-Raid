import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, Text, View, type ColorValue } from 'react-native';

import { type IconName } from '@/components/ui';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGroup } from '@/providers/group';

function icon(name: IconName, active: IconName) {
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? active : name} size={size} color={typeof color === 'string' ? color : undefined} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const theme = useTheme();
  const router = useRouter();
  const { group } = useGroup();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: theme.text, fontWeight: '800' },
        headerTintColor: theme.primary,
        tabBarStyle: { backgroundColor: theme.tabBar, borderTopColor: 'transparent', height: 64, paddingTop: 6 },
        tabBarActiveTintColor: Brand.lime,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: { backgroundColor: theme.background },
        headerRight: () => (
          <Pressable onPress={() => router.push('/groups')} hitSlop={8} style={{ paddingHorizontal: 16 }} accessibilityLabel="Trocar de grupo">
            <Ionicons name="swap-horizontal" size={22} color={theme.primary} />
          </Pressable>
        ),
      }}>
      <Tabs.Screen name="index" options={{ title: 'Feed', headerTitle: group?.name ?? 'Feed', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="ranking" options={{ title: 'Ranking', tabBarIcon: icon('trophy-outline', 'trophy') }} />
      <Tabs.Screen
        name="registrar"
        options={{
          title: 'Registrar',
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: Brand.lime,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -22,
                borderWidth: 4,
                borderColor: theme.tabBar,
                opacity: focused ? 1 : 0.95,
              }}>
              <Ionicons name="add" size={30} color={Brand.limeText} />
              <Text style={{ position: 'absolute', bottom: -18, fontSize: 11, fontWeight: '700', color: focused ? Brand.lime : theme.tabInactive }}>Registrar</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarIcon: icon('chatbubbles-outline', 'chatbubbles') }} />
      <Tabs.Screen name="grupo" options={{ title: 'Grupo', tabBarIcon: icon('people-outline', 'people') }} />
    </Tabs>
  );
}
