import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Banner, Button, Input, Screen, Txt } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { toApiError } from '@/lib/api';
import { webAppUrl } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export default function VerifyScreen() {
  const { email, name } = useLocalSearchParams<{ email: string; name?: string }>();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  async function verify() {
    setError(null);
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.verifyOtp({ email: email!, token: code.replace(/\D/g, ''), type: 'email' });
      if (err) throw err;
      // O guard em _layout redireciona para grupos/abas ao detectar a sessão.
      router.replace('/');
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setResent(false);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({ email: email!, options: { shouldCreateUser: true, data: { display_name: name }, emailRedirectTo: webAppUrl() } });
      if (err) throw err;
      setResent(true);
    } catch (err) {
      setError(toApiError(err).message);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen keyboard contentStyle={{ gap: Spacing.four }}>
        <View style={{ gap: Spacing.one }}>
          <Txt variant="title">Digite o código</Txt>
          <Txt variant="caption">Enviamos um e-mail para {email}. Digite o código de 6 dígitos ou, se o e-mail trouxer só um link, toque nele neste mesmo navegador. Confira também a caixa de spam.</Txt>
        </View>
        <Input
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          placeholder="000000"
          autoFocus
          style={{ fontSize: 28, letterSpacing: 8, textAlign: 'center', fontWeight: '700' }}
          onSubmitEditing={code.length === 6 ? verify : undefined}
        />
        {error ? <Banner message={error} /> : null}
        {resent ? <Banner kind="success" message="Novo código enviado." /> : null}
        <Button title="Entrar" icon="log-in" onPress={verify} disabled={code.length !== 6} loading={busy} />
        <Button title="Reenviar código" variant="ghost" onPress={resend} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
