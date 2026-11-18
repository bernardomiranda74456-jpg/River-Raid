import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Banner, Empty, Loading, Txt } from '@/components/ui';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { chatApi, toApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/lib/types';
import { useAuth } from '@/providers/auth';
import { useGroup } from '@/providers/group';

type Pending = { localId: string; body: string; status: 'sending' | 'failed' };

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const { group } = useGroup();
  const meId = session!.user.id;
  const [text, setText] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const listRef = useRef<FlatList<Message | Pending>>(null);
  const seq = useRef(0);

  const chat = useAsync(() => chatApi.list(group!.id), [group?.id], { enabled: Boolean(group) });
  const setData = chat.setData;

  useFocusEffect(
    useCallback(() => {
      chat.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [group?.id]),
  );

  // Tempo real: novas mensagens do grupo chegam pelo canal; RLS garante que só participantes recebem.
  useEffect(() => {
    if (!group) return;
    const channel = supabase
      .channel(`chat:${group.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${group.id}` }, async (payload) => {
        const id = (payload.new as { id: string }).id;
        try {
          const full = await chatApi.get(id);
          setData((prev) => (prev && !prev.some((m) => m.id === full.id) ? [full, ...prev] : prev));
        } catch {
          chat.refresh();
        }
      })
      .subscribe();
    // Fallback: sincroniza a cada 20 s caso o realtime não esteja disponível.
    const timer = setInterval(() => chat.refresh(), 20_000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id]);

  async function send(body: string, retryId?: string) {
    if (!group || !body.trim()) return;
    seq.current += 1;
    const localId = retryId ?? `local-${seq.current}`;
    setText('');
    setPending((p) => [{ localId, body, status: 'sending' }, ...p.filter((x) => x.localId !== localId)]);
    try {
      const msg = await chatApi.send(group.id, meId, body);
      setPending((p) => p.filter((x) => x.localId !== localId));
      setData((prev) => (prev && !prev.some((m) => m.id === msg.id) ? [msg, ...prev] : prev));
    } catch (err) {
      setPending((p) => p.map((x) => (x.localId === localId ? { ...x, status: 'failed' } : x)));
      if (!toApiError(err).retryable) {
        // erro não recuperável: mantém como falha para o usuário decidir
      }
    }
  }

  if (!group) return null;
  const items: (Message | Pending)[] = [...pending, ...(chat.data ?? [])];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.background }} keyboardVerticalOffset={90}>
      {chat.error ? (
        <View style={{ padding: Spacing.three }}>
          <Banner message={chat.error} onRetry={chat.reload} />
        </View>
      ) : null}
      <FlatList
        ref={listRef}
        inverted
        data={items}
        keyExtractor={(m) => ('localId' in m ? m.localId : m.id)}
        contentContainerStyle={{ padding: Spacing.three, gap: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' }}
        ListEmptyComponent={
          chat.loading && !chat.data ? (
            <Loading />
          ) : (
            <View style={{ transform: [{ scaleY: -1 }] }}>
              <Empty icon="chatbubbles-outline" title="Chat do grupo" text="Combine treinos, mande figurinha mental, provoque a concorrência." />
            </View>
          )
        }
        renderItem={({ item }) => {
          const isPending = 'localId' in item;
          const mine = isPending || item.user_id === meId;
          const name = isPending ? profile?.display_name ?? 'Você' : item.author?.display_name ?? '…';
          return (
            <View style={{ flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
              {!mine ? <Avatar name={name} size={28} /> : null}
              <View
                style={[
                  styles.bubble,
                  mine ? { backgroundColor: theme.primary, borderBottomRightRadius: 4 } : { backgroundColor: theme.card, borderBottomLeftRadius: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
                ]}>
                {!mine ? <Txt variant="caption" color={theme.primary}>{name}</Txt> : null}
                <Txt color={mine ? theme.onPrimary : theme.text}>{item.body}</Txt>
                {isPending ? (
                  item.status === 'failed' ? (
                    <Pressable onPress={() => send(item.body, item.localId)}>
                      <Txt variant="caption" color={theme.accent}>Falhou · tocar para reenviar</Txt>
                    </Pressable>
                  ) : (
                    <Txt variant="caption" color={theme.onPrimary}>enviando…</Txt>
                  )
                ) : (
                  <Txt variant="caption" color={mine ? theme.onPrimary : theme.textMuted} style={{ fontSize: 11 }}>{formatDateTime(item.created_at, group.timezone)}</Txt>
                )}
              </View>
            </View>
          );
        }}
      />
      <View style={[styles.composer, { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Mensagem para o grupo"
          placeholderTextColor={theme.textMuted}
          multiline
          maxLength={1000}
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        />
        <Pressable onPress={() => send(text)} disabled={!text.trim()} accessibilityLabel="Enviar" style={[styles.send, { backgroundColor: text.trim() ? theme.accent : theme.backgroundElement }]}>
          <Ionicons name="send" size={20} color={text.trim() ? theme.onAccent : theme.textMuted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '80%', padding: 10, borderRadius: Radius.md, gap: 2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 8, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, maxHeight: 120 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
