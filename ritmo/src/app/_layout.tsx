import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/providers/auth';
import { GroupProvider, useGroup } from '@/providers/group';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <GroupProvider>
            <Navigation />
          </GroupProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Navigation() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { session, loading: authLoading } = useAuth();
  const { group, loading: groupLoading } = useGroup();
  const segments = useSegments();
  const router = useRouter();

  const ready = !authLoading && (!session || !groupLoading);

  // Guarda de rotas: sem sessão → login; com sessão e sem grupo → escolher grupo.
  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});
    const first = segments[0] as string | undefined;
    const inAuth = first === '(auth)';
    const inJoin = first === 'join';
    if (!session) {
      if (!inAuth && !inJoin) router.replace('/(auth)/login');
      return;
    }
    if (inAuth) {
      router.replace(group ? '/(tabs)' : '/groups');
      return;
    }
    if (!group && first !== 'groups' && !inJoin) {
      router.replace('/groups');
    }
  }, [ready, session, group, segments, router]);

  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...navTheme,
        colors: { ...navTheme.colors, primary: colors.primary, background: colors.background, card: colors.card, text: colors.text, border: colors.border },
      }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { color: colors.text }, headerBackTitle: 'Voltar' }}>
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/verify" options={{ title: 'Código de acesso' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="groups/index" options={{ title: 'Seus grupos', headerShown: false }} />
        <Stack.Screen name="groups/new" options={{ title: 'Novo grupo', presentation: 'modal' }} />
        <Stack.Screen name="groups/join" options={{ title: 'Entrar com código', presentation: 'modal' }} />
        <Stack.Screen name="groups/edit" options={{ title: 'Editar grupo', presentation: 'modal' }} />
        <Stack.Screen name="join/[code]" options={{ title: 'Convite' }} />
        <Stack.Screen name="workout/[id]" options={{ title: 'Treino' }} />
        <Stack.Screen name="participant/[userId]" options={{ title: 'Participante' }} />
        <Stack.Screen name="profile" options={{ title: 'Seu perfil', presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
