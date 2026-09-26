import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AwardGrid, Leaderboard, RecordList } from '@/components/LeagueBlocks';
import { MomentCard } from '@/components/MomentCard';
import { Avatar, Card, DemoBadge, EmptyState, Row, SectionHeader, Screen, Txt } from '@/components/ui';
import { useLeague } from '@/data/LeagueProvider';
import { memberMap } from '@/data/selectors';
import { strings } from '@/i18n';
import { formatCompact, formatDuration, formatMonth } from '@/lib/format';
import { colors, radius, space } from '@/theme/tokens';

export default function SeasonRecapScreen() {
  const s = strings();
  const { month } = useLocalSearchParams<{ month: string }>();
  const { snapshot } = useLeague();
  const recap = snapshot?.pastSeasons.find((r) => r.season.month === month);
  if (!snapshot || !recap) return <Screen edges={[]}><EmptyState title={s.common.error} /></Screen>;
  const members = memberMap(snapshot);
  const champion = recap.championId ? members.get(recap.championId) : undefined;
  const duo = recap.iconicDuo ? [members.get(recap.iconicDuo.a), members.get(recap.iconicDuo.b)] : [];

  return (
    <Screen edges={[]}>
      {snapshot.mode === 'demo' ? <DemoBadge /> : null}
      <LinearGradient colors={['#FFD23F', '#FF7A00', '#2A0E00']} style={styles.hero}>
        <Txt variant="label" color="#2A0E00">
          {s.league.recap} · {formatMonth(recap.season.month)}
        </Txt>
        <Txt variant="hero" color="#1A0800">
          {s.league.champion.toUpperCase()}
        </Txt>
        {champion ? (
          <Row>
            <Avatar member={champion} size={72} ring="#1A0800" />
            <View>
              <Txt variant="display" color="#1A0800">
                {champion.displayName.toUpperCase()}
              </Txt>
              <Txt variant="bodyStrong" color="#2A0E00">
                {recap.standings[0]?.points} {s.common.points}
              </Txt>
            </View>
          </Row>
        ) : null}
      </LinearGradient>

      <SectionHeader title={s.league.totals} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Total value={formatCompact(recap.totals.steps)} label={s.stats.steps} />
        <Total value={`${Math.round(recap.totals.minutesTogether / 60)}h`} label={s.stats.together} />
        <Total value={String(recap.totals.moments)} label="moments" />
      </View>

      {recap.iconicDuo && duo[0] && duo[1] ? (
        <>
          <SectionHeader title={s.league.iconicDuo} />
          <Card>
            <Row>
              <Avatar member={duo[0]} size={44} />
              <Avatar member={duo[1]} size={44} />
              <View style={{ flex: 1 }}>
                <Txt variant="heading">
                  {duo[0].displayName} × {duo[1].displayName}
                </Txt>
                <Txt variant="small" color={colors.textMuted}>
                  {formatDuration(recap.iconicDuo.minutes)} {s.stats.together}
                </Txt>
              </View>
            </Row>
          </Card>
        </>
      ) : null}

      <SectionHeader title={s.league.leaderboard} />
      <Leaderboard standings={recap.standings} members={members} meId={snapshot.meId} />

      <SectionHeader title={s.league.awards} />
      <AwardGrid awards={recap.awards} members={members} />

      {recap.records.length ? (
        <>
          <SectionHeader title={s.league.records} />
          <RecordList records={recap.records} members={members} />
        </>
      ) : null}

      {recap.unexpected.length ? (
        <>
          <SectionHeader title={s.league.unexpected} />
          {recap.unexpected.map((m) => (
            <Pressable key={m.id} onPress={() => router.push(`/story/${m.date}`)}>
              <MomentCard moment={m} members={snapshot.members} size="compact" />
            </Pressable>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function Total({ value, label }: { value: string; label: string }) {
  return (
    <Card style={{ flex: 1, padding: space.md, gap: 2 }}>
      <Txt variant="title" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
      <Txt variant="label" color={colors.textMuted} style={{ fontSize: 9 }}>
        {label}
      </Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: space.xl, gap: space.md },
});
