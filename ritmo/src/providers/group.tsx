import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { groupsApi, toApiError } from '@/lib/api';
import { localStore } from '@/lib/storage-keys';
import type { Group } from '@/lib/types';
import { useAuth } from '@/providers/auth';

type GroupState = {
  groups: Group[];
  group: Group | null;
  loading: boolean;
  isOrganizer: boolean;
  /** Erro ao usar um convite aberto antes do login (ritmo://join/CODIGO). */
  inviteError: string | null;
  selectGroup: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const GroupContext = createContext<GroupState | null>(null);

export function GroupProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [groupsState, setGroups] = useState<Group[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Chave da última carga concluída; enquanto difere da sessão atual, estamos carregando.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const current = Boolean(session) && loadedFor === session?.user.id;
  const loading = Boolean(session) && !current;
  const groups = useMemo(() => (current ? groupsState : []), [current, groupsState]);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      let list = await groupsApi.mine();
      let preferred: string | null = null;
      // Convite aberto antes do login: entra agora, mesmo que a pessoa já tenha outros grupos.
      const pending = await localStore.getPendingInvite();
      if (pending) {
        try {
          const joined = await groupsApi.join(pending);
          preferred = joined.id;
          list = await groupsApi.mine();
          await localStore.setPendingInvite(null);
        } catch (err) {
          const e = toApiError(err);
          if (!e.retryable) {
            setInviteError(`Não foi possível usar o convite ${pending}: ${e.message}`);
            await localStore.setPendingInvite(null);
          }
        }
      }
      setGroups(list);
      const stored = await localStore.getActiveGroup();
      const next = preferred ?? list.find((g) => g.id === stored)?.id ?? list[0]?.id ?? null;
      setActiveId(next);
      await localStore.setActiveGroup(next);
    } catch {
      // mantém o estado anterior (pode estar offline)
    } finally {
      setLoadedFor(session.user.id);
    }
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    // Carga inicial e recarga quando a sessão muda (estado só é atualizado após a resposta da rede).
    Promise.resolve().then(() => (cancelled ? undefined : refresh()));
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const selectGroup = useCallback(async (id: string) => {
    setActiveId(id);
    await localStore.setActiveGroup(id);
  }, []);

  const group = groups.find((g) => g.id === activeId) ?? null;
  const value = useMemo<GroupState>(
    () => ({
      groups,
      group,
      loading,
      isOrganizer: Boolean(group && session && group.owner_id === session.user.id),
      inviteError,
      selectGroup,
      refresh,
    }),
    [groups, group, loading, session, inviteError, selectGroup, refresh],
  );
  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
}

export function useGroup(): GroupState {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error('useGroup fora do GroupProvider');
  return ctx;
}
