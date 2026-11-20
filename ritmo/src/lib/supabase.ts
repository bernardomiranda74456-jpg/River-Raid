import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env } from '@/lib/env';

export const supabase = createClient(
  env.supabaseUrl || 'http://localhost:54321',
  env.supabasePublishableKey || 'missing-key',
  {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // No navegador, o link do e-mail volta com a sessão na URL (login por link, sem SMTP próprio).
      detectSessionInUrl: Platform.OS === 'web',
    },
  },
);

// Renova o token só enquanto o app está em primeiro plano (recomendação do Supabase para RN).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
