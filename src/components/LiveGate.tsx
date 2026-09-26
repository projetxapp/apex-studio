import { router } from 'expo-router';
import { View } from 'react-native';

import { useLeague } from '@/data/LeagueProvider';
import { strings } from '@/i18n';
import { colors, space } from '@/theme/tokens';
import { Button, EmptyState, Loading, Screen, Txt } from './ui';

/**
 * Shown in live mode when there is nothing to display yet:
 * Supabase not configured, signed out, or no League joined.
 */
export function LiveGate() {
  const s = strings();
  const { auth, loading, error, setMode, refresh, ready } = useLeague();
  if (!ready || loading) return <Loading />;

  const demoButton = <Button label={s.today.openDemo} variant="secondary" icon="sparkles" onPress={() => setMode('demo')} />;

  let body;
  if (!auth.configured) {
    body = <EmptyState title={s.settings.notConfigured}>{demoButton}</EmptyState>;
  } else if (!auth.session) {
    body = (
      <EmptyState title={s.auth.title} subtitle={s.auth.subtitle}>
        <Button label={s.auth.signIn} icon="log-in" onPress={() => router.push('/auth')} />
        {demoButton}
      </EmptyState>
    );
  } else if (error) {
    body = (
      <EmptyState title={s.common.error} subtitle={error}>
        <Button label={s.common.retry} onPress={() => void refresh()} />
      </EmptyState>
    );
  } else {
    body = (
      <EmptyState title={s.today.noLeague}>
        <Button label={s.today.createOrJoin} icon="people" onPress={() => router.push('/onboarding')} />
        {demoButton}
      </EmptyState>
    );
  }
  return (
    <Screen>
      <View style={{ gap: space.xs, marginTop: space.lg }}>
        <Txt variant="display">{s.app.name}</Txt>
        <Txt color={colors.textMuted}>{s.app.tagline}</Txt>
      </View>
      {body}
    </Screen>
  );
}
