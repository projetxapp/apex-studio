import { router } from 'expo-router';
import { View } from 'react-native';

import { LiveGate } from '@/components/LiveGate';
import { PlayerProfileView } from '@/components/PlayerProfileView';
import { Button, DemoBadge, Row, Screen } from '@/components/ui';
import { useLeague } from '@/data/LeagueProvider';
import { strings } from '@/i18n';
import { space } from '@/theme/tokens';

export default function MeScreen() {
  const s = strings();
  const { snapshot } = useLeague();
  if (!snapshot || !snapshot.meId) return <LiveGate />;
  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
        {snapshot.mode === 'demo' ? <DemoBadge /> : <View />}
      </Row>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label={s.profile.history} icon="time" variant="secondary" onPress={() => router.push('/history')} style={{ flex: 1 }} />
        <Button label={s.profile.settings} icon="settings" variant="secondary" onPress={() => router.push('/settings')} style={{ flex: 1 }} />
      </View>
      <PlayerProfileView snapshot={snapshot} memberId={snapshot.meId} />
    </Screen>
  );
}
