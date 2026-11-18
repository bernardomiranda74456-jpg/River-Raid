import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, Input, Txt } from '@/components/ui';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { saveWebConfig } from '@/lib/env';

/**
 * Tela inicial da versão web quando o app ainda não sabe qual Supabase usar.
 * Pede a URL e a publishable key (valores públicos) uma única vez.
 */
export function WebConfigScreen() {
  const theme = useTheme();
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const urlOk = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url.trim().replace(/\/+$/, '')) || /^https?:\/\/(localhost|127\.0\.0\.1|[\w.-]+)(:\d+)?$/.test(url.trim());
  const keyOk = key.trim().length > 20;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: Spacing.three, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', gap: Spacing.four }}>
      <View style={{ gap: Spacing.two, marginTop: Spacing.five }}>
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: Brand.petrol, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="pulse" size={32} color={Brand.lime} />
        </View>
        <Txt variant="display">Ritmo</Txt>
        <Txt variant="heading">Conectar ao seu Supabase</Txt>
        <Txt variant="caption">
          Cole os dois valores públicos do projeto (Project Settings → API Keys). Eles ficam salvos só neste navegador. A chave secreta nunca deve ser usada aqui.
        </Txt>
      </View>
      <Card style={{ gap: Spacing.three }}>
        <Input label="Project URL" placeholder="https://xxxxxxxx.supabase.co" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
        <Input label="Publishable key" placeholder="sb_publishable_… (ou a anon key eyJ…)" value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} />
        <Button title="Salvar e abrir o app" icon="link" onPress={() => saveWebConfig(url, key)} disabled={!urlOk || !keyOk} />
      </Card>
      <Txt variant="caption">Depois de salvar, use “Adicionar à Tela de Início” no Safari para abrir o Ritmo como um app.</Txt>
    </ScrollView>
  );
}
