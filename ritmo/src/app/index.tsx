import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui';
import { useAuth } from '@/providers/auth';
import { useGroup } from '@/providers/group';

export default function Index() {
  const { session, loading } = useAuth();
  const { group, loading: groupLoading } = useGroup();
  if (loading || (session && groupLoading)) return <Loading text="Abrindo o Ritmo…" />;
  if (!session) return <Redirect href="/(auth)/login" />;
  return <Redirect href={group ? '/(tabs)' : '/groups'} />;
}
