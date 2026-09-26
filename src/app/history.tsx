import { router } from 'expo-router';
import { View } from 'react-native';

import { DropRow } from '@/components/DropRow';
import { DemoBadge, EmptyState, SectionHeader, Screen } from '@/components/ui';
import { useLeague } from '@/data/LeagueProvider';
import { dropsByMonth } from '@/data/selectors';
import { strings } from '@/i18n';
import { formatMonth } from '@/lib/format';
import { space } from '@/theme/tokens';

export default function HistoryScreen() {
  const s = strings();
  const { snapshot } = useLeague();
  const groups = snapshot ? dropsByMonth(snapshot.drops) : [];
  return (
    <Screen edges={[]}>
      {snapshot?.mode === 'demo' ? <DemoBadge /> : null}
      {groups.length === 0 ? <EmptyState title={s.history.empty} /> : null}
      {groups.map((g) => (
        <View key={g.month} style={{ gap: space.md }}>
          <SectionHeader title={formatMonth(g.month)} />
          {g.drops.map((d) => (
            <DropRow key={d.date} drop={d} onPress={() => router.push(`/story/${d.date}`)} />
          ))}
        </View>
      ))}
    </Screen>
  );
}
