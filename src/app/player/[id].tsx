import { useLocalSearchParams } from 'expo-router';

import { PlayerProfileView } from '@/components/PlayerProfileView';
import { DemoBadge, EmptyState, Screen } from '@/components/ui';
import { useLeague } from '@/data/LeagueProvider';
import { strings } from '@/i18n';

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot } = useLeague();
  if (!snapshot) return <Screen edges={[]}><EmptyState title={strings().common.error} /></Screen>;
  return (
    <Screen edges={[]}>
      {snapshot.mode === 'demo' ? <DemoBadge /> : null}
      <PlayerProfileView snapshot={snapshot} memberId={id} />
    </Screen>
  );
}
