import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner, Button, Input, Screen, Txt } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toApiError } from '@/lib/api';
import { env } from '@/lib/env';
import { localStore } from '@/lib/storage-keys';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    localStore.getLastEmail().then((e) => e && setEmail(e));
  }, []);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && name.trim().length >= 2;

  async function sendCode() {
    setError(null);
    setSending(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error: err } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: true, data: { display_name: name.trim() } },
      });
      if (err) throw err;
      await localStore.setLastEmail(cleanEmail);
      router.push({ pathname: '/(auth)/verify', params: { email: cleanEmail, name: name.trim() } });
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen keyboard contentStyle={{ paddingTop: insets.top + Spacing.five, gap: Spacing.four }}>
        <View style={{ gap: Spacing.two }}>
          <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: Brand.petrol, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="pulse" size={32} color={Brand.lime} />
          </View>
          <Txt variant="display">Ritmo</Txt>
          <Txt variant="body" color={theme.textSecondary}>
            Desafios de treino entre amigos. Entre com seu e-mail: enviamos um código de 6 dígitos, sem senha.
          </Txt>
        </View>

        {!env.isConfigured ? (
          <Banner kind="info" message="Backend não configurado. Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY no .env (ou nas variáveis do EAS)." />
        ) : null}

        <View style={{ gap: Spacing.three }}>
          <Input label="Seu nome" placeholder="Como os amigos te chamam" value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" />
          <Input
            label="E-mail"
            placeholder="voce@exemplo.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            onSubmitEditing={valid ? sendCode : undefined}
          />
        </View>

        {error ? <Banner message={error} onRetry={valid ? sendCode : undefined} /> : null}

        <Button title="Receber código por e-mail" icon="mail" onPress={sendCode} disabled={!valid} loading={sending} />
        <Txt variant="caption" style={{ textAlign: 'center' }}>
          O nome aparece no feed e no ranking. Você pode mudar depois.
        </Txt>
      </Screen>
    </KeyboardAvoidingView>
  );
}
