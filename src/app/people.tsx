import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Avatar, Card, DemoBadge, EmptyState, Ionicons, Row, Screen, Txt } from '@/components/ui';
import { useLeague } from '@/data/LeagueProvider';
import { playerProfile } from '@/data/selectors';
import { interpolate, strings } from '@/i18n';
import { colors, medal, space } from '@/theme/tokens';

export default function PeopleScreen() {
  const s = strings();
  const { snapshot } = useLeague();
  if (!snapshot) return <Screen edges={[]}><EmptyState title={s.today.noLeague} /></Screen>;
  const ordered = [...snapshot.members].sort(
    (a, b) =>
      (snapshot.standings.find((x) => x.memberId === a.id)?.rank ?? 99) -
      (snapshot.standings.find((x) => x.memberId === b.id)?.rank ?? 99),
  );
  return (
    <Screen edges={[]}>
      {snapshot.mode === 'demo' ? <DemoBadge /> : null}
      <View style={{ gap: space.md }}>
        {ordered.map((m) => {
          const p = playerProfile(snapshot, m.id);
          const rank = p?.standing?.rank;
          return (
            <Pressable key={m.id} onPress={() => router.push(`/player/${m.id}`)}>
              <Card>
                <Row>
                  <Avatar member={m} size={48} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="heading">
                      {m.displayName}
                      {m.id === snapshot.meId ? ` · ${s.common.you}` : ''}
                    </Txt>
                    <Txt variant="small" color={colors.textMuted}>
                      {p?.closest ? `${s.people.closest} : ${p.closest.member.displayName}` : m.tag}
                      {m.sources.length ? ` · ${interpolate(s.people.sources, { n: m.sources.length })}` : ''}
                    </Txt>
                  </View>
                  {rank ? (
                    <Txt variant="title" color={medal(rank)}>
                      #{rank}
                    </Txt>
                  ) : null}
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </Row>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
