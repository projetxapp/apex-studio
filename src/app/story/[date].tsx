import { router, useLocalSearchParams } from 'expo-router';

import { StoryViewer } from '@/components/StoryViewer';
import { EmptyState, Screen } from '@/components/ui';
import { useLeague } from '@/data/LeagueProvider';
import { strings } from '@/i18n';

export default function StoryScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { snapshot, react } = useLeague();
  const drop = snapshot?.drops.find((d) => d.date === date);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!snapshot || !drop) {
    return (
      <Screen>
        <EmptyState title={strings().drop.empty} />
      </Screen>
    );
  }
  return <StoryViewer drop={drop} snapshot={snapshot} onReact={react} onClose={close} />;
}
