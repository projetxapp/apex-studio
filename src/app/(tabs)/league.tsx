import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AwardGrid, Leaderboard, RecordList } from '@/components/LeagueBlocks';
import { LiveGate } from '@/components/LiveGate';
import { Avatar, AvatarStack, Card, DemoBadge, EmptyState, Ionicons, Row, SectionHeader, Screen, Txt } from '@/components/ui';
import { useLeague } from '@/data/LeagueProvider';
import { daysLeftInSeason, memberMap } from '@/data/selectors';
import { interpolate, strings } from '@/i18n';
import { formatMonth } from '@/lib/format';
import { colors, space } from '@/theme/tokens';

export default function LeagueScreen() {
  const s = strings();
  const { snapshot } = useLeague();
  if (!snapshot) return <LiveGate />;
  const members = memberMap(snapshot);
  const groupRecords = snapshot.records.filter((r) => r.scope === 'group');

  return (
    <Screen>
      <View style={{ gap: space.sm, marginTop: space.sm }}>
        <Txt variant="label" color={colors.textMuted}>
          {s.league.season} · {interpolate(s.league.daysLeft, { n: daysLeftInSeason(snapshot) })}
        </Txt>
        <Txt variant="display">{formatMonth(snapshot.season.month).toUpperCase()}</Txt>
        {snapshot.mode === 'demo' ? <DemoBadge /> : null}
      </View>

      <SectionHeader title={s.league.leaderboard} />
      {snapshot.standings.some((st) => st.points > 0) ? (
        <Leaderboard standings={snapshot.standings} members={members} meId={snapshot.meId} />
      ) : (
        <EmptyState title={s.today.liveEmpty} subtitle={s.today.liveEmptySub} />
      )}
      <Txt variant="small" color={colors.textFaint}>
        {s.league.fairPlay}
      </Txt>

      {snapshot.awards.length ? (
        <>
          <SectionHeader title={s.league.awards} />
          <AwardGrid awards={snapshot.awards} members={members} />
        </>
      ) : null}

      {groupRecords.length ? (
        <>
          <SectionHeader title={s.league.groupRecords} />
          <RecordList records={groupRecords} members={members} />
        </>
      ) : null}

      <SectionHeader title={s.league.members} action={s.common.seeAll} onAction={() => router.push('/people')} />
      <Pressable onPress={() => router.push('/people')}>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <AvatarStack members={snapshot.members} size={34} max={8} />
            <Row gap={space.xs}>
              <Txt variant="bodyStrong">{snapshot.members.length}</Txt>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Row>
          </Row>
        </Card>
      </Pressable>

      {snapshot.pastSeasons.length ? (
        <>
          <SectionHeader title={s.league.pastSeasons} />
          {snapshot.pastSeasons.map((recap) => {
            const champion = recap.championId ? members.get(recap.championId) : undefined;
            return (
              <Pressable key={recap.season.id} onPress={() => router.push(`/season/${recap.season.month}`)}>
                <Card>
                  <Row>
                    {champion ? <Avatar member={champion} size={44} ring={colors.gold} /> : null}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Txt variant="label" color={colors.gold}>
                        {s.league.recap}
                      </Txt>
                      <Txt variant="title">{formatMonth(recap.season.month).toUpperCase()}</Txt>
                      {champion ? (
                        <Txt variant="small" color={colors.textMuted}>
                          {s.league.champion} : {champion.displayName}
                        </Txt>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                  </Row>
                </Card>
              </Pressable>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}
