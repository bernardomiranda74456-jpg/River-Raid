import { useCallback, useEffect, useRef, useState } from 'react';

import { toApiError } from '@/lib/api';

type State<T> = { key: string; data: T | null; error: string | null };

/**
 * Carrega dados com estado de erro/retry simples, sem cache global.
 * `deps` identifica a consulta: quando muda, recarrega (e `loading` volta a true até a resposta).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], opts: { enabled?: boolean } = {}) {
  const enabled = opts.enabled ?? true;
  const key = JSON.stringify(deps);
  const [state, setState] = useState<State<T>>({ key: '', data: null, error: null });
  const [busy, setBusy] = useState(false);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const fetchNow = useCallback(async () => {
    if (!enabled) return;
    try {
      const result = await fnRef.current();
      setState({ key, data: result, error: null });
    } catch (err) {
      const message = toApiError(err).message;
      setState((s) => ({ key, data: s.key === key ? s.data : null, error: message }));
    } finally {
      setBusy(false);
    }
  }, [enabled, key]);

  useEffect(() => {
    fetchNow();
  }, [fetchNow]);

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: enabled && (busy || !current),
    /** Recarrega mostrando o estado de carregamento. */
    reload: () => {
      setBusy(true);
      fetchNow();
    },
    /** Recarrega em silêncio (mantém o conteúdo na tela). */
    refresh: () => fetchNow(),
    setData: (updater: T | null | ((prev: T | null) => T | null)) =>
      setState((s) => ({ key, error: s.key === key ? s.error : null, data: typeof updater === 'function' ? (updater as (p: T | null) => T | null)(s.key === key ? s.data : null) : updater })),
  };
}
