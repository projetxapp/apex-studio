import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { LiveGate } from '@/components/LiveGate';
import { MomentCard } from '@/components/MomentCard';
import { Avatar, AvatarStack, Button, Card, DemoBadge, Ionicons, Row, SectionHeader, Screen, Txt } from '@/components/ui';
import { useLeague } from '@/data/LeagueProvider';
import { DEMO_TODAY } from '@/demo/scenario';
import { daysLeftInSeason, memberMap } from '@/data/selectors';
import { interpolate, strings } from '@/i18n';
import { daysBetween } from '@/lib/dates';
import { capitalize, formatClock, formatDayLong } from '@/lib/format';
import { colors, fonts, medal, radius, space } from '@/theme/tokens';

export default function TodayScreen() {
  const s = strings();
  const { snapshot, mode, demo } = useLeague();
  if (!snapshot) return <LiveGate />;

  const members = memberMap(snapshot);
  const me = snapshot.meId ? members.get(snapshot.meId) : undefined;
  const comp = s.competitions[snapshot.today.competition.kind];
  const leader = snapshot.standings[0];
  const myStanding = snapshot.standings.find((st) => st.memberId === snapshot.meId);
  const latest = snapshot.drops[0];
  const todayDrop = latest?.date === snapshot.today.date ? latest : undefined;
  const seasonDay = daysBetween(snapshot.season.startsOn, snapshot.today.date) + 1;

  // Teaser: one redacted chip per waiting card. No spoilers.
  const teaser = Array.from({ length: snapshot.today.pendingMoments }, (_, i) => 5 + ((i * 7) % 6));

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ gap: 2, flex: 1 }}>
          <Txt variant="label" color={colors.textMuted}>
            {capitalize(formatDayLong(snapshot.today.date))} · {interpolate(s.today.seasonDay, { n: seasonDay })}
          </Txt>
          <Txt variant="display">{snapshot.league.name.toUpperCase()}</Txt>
        </View>
        {me ? (
          <Pressable onPress={() => router.push('/(tabs)/me')}>
            <Avatar member={me} size={44} />
          </Pressable>
        ) : null}
      </View>
      {snapshot.mode === 'demo' ? (
        <View style={{ gap: space.sm, marginTop: -space.md }}>
          <DemoBadge />
          <Txt variant="small" color={colors.textFaint}>
            {s.common.simulatedLong}
          </Txt>
        </View>
      ) : null}

      {/* Competition of the day */}
      <LinearGradient colors={['#2F54FF', '#101C7A', '#050716']} style={styles.competition}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="label" color="#C9D3FF">
            {s.today.competitionOfDay}
          </Txt>
          <Ionicons name="flash" size={18} color={colors.accent} />
        </Row>
        <Txt variant="hero" style={{ fontSize: 46, lineHeight: 52 }}>
          {comp.name.toUpperCase()}
        </Txt>
        <Txt color="#DDE3FF">{comp.rule}</Txt>
        <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
          <Row gap={space.sm}>
            <AvatarStack members={snapshot.members} size={26} max={8} />
            <Txt variant="small" color="#DDE3FF">
              {interpolate(s.today.participants, { n: snapshot.today.participants })}
            </Txt>
          </Row>
        </Row>
      </LinearGradient>

      {/* Daily Drop status */}
      {snapshot.today.revealed && todayDrop ? (
        <Pressable onPress={() => router.push(`/story/${todayDrop.date}`)}>
          <LinearGradient colors={[colors.accent, '#7BD41E']} style={styles.drop}>
            <Txt variant="label" color={colors.accentInk}>
              {s.drop.title}
            </Txt>
            <Txt variant="display" color={colors.accentInk}>
              {s.today.dropReady.toUpperCase()}
            </Txt>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="bodyStrong" color={colors.accentInk}>
                {interpolate(s.today.dropReadySub, { n: todayDrop.moments.length })}
              </Txt>
              <View style={styles.play}>
                <Ionicons name="play" size={22} color={colors.accent} />
              </View>
            </Row>
          </LinearGradient>
        </Pressable>
      ) : (
        <Card style={{ gap: space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="label" color={colors.hot}>
              {interpolate(s.today.dropAt, { time: formatClock(snapshot.today.revealAt) })}
            </Txt>
            <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
          </Row>
          <Txt variant="title">{s.today.dropLocked.toUpperCase()}</Txt>
          <Txt color={colors.textMuted}>{interpolate(s.today.dropLockedSub, { n: snapshot.today.pendingMoments })}</Txt>
          {teaser.length ? (
            <View style={styles.teaser}>
              {teaser.map((width, i) => (
                <View key={i} style={styles.teaserChip}>
                  <View style={{ width: width * 9, height: 8, borderRadius: 4, backgroundColor: colors.border }} />
                </View>
              ))}
            </View>
          ) : null}
          {mode === 'demo' ? (
            <View style={{ gap: space.xs }}>
              <Button label={s.today.revealNow} icon="eye" onPress={demo.reveal} />
              <Txt variant="small" color={colors.textFaint} style={{ textAlign: 'center' }}>
                {s.today.revealNowHint}
              </Txt>
            </View>
          ) : null}
        </Card>
      )}

      {/* Season snapshot */}
      {leader && leader.points > 0 ? (
        <>
          <SectionHeader title={`${s.league.season} · ${interpolate(s.league.daysLeft, { n: daysLeftInSeason(snapshot) })}`} action={s.common.seeAll} onAction={() => router.push('/(tabs)/league')} />
          <Card style={{ gap: space.md }}>
            {snapshot.standings.slice(0, 3).map((st) => {
              const m = members.get(st.memberId);
              if (!m) return null;
              return (
                <Pressable key={st.memberId} onPress={() => router.push(`/player/${m.id}`)}>
                  <Row>
                    <Txt style={{ fontFamily: fonts.display, fontSize: 24, width: 22 }} color={medal(st.rank)}>
                      {st.rank}
                    </Txt>
                    <Avatar member={m} size={34} />
                    <Txt variant="bodyStrong" style={{ flex: 1 }}>
                      {m.displayName}
                      {m.id === snapshot.meId ? ` (${s.common.you})` : ''}
                    </Txt>
                    <Txt variant="title">{st.points}</Txt>
                    <Txt variant="small" color={colors.textMuted}>
                      {s.common.points}
                    </Txt>
                  </Row>
                </Pressable>
              );
            })}
            {myStanding && myStanding.rank > 3 ? (
              <Txt variant="small" color={colors.textMuted}>
                {s.today.yourRank} : #{myStanding.rank} · {myStanding.points} {s.common.points}
              </Txt>
            ) : null}
          </Card>
        </>
      ) : null}

      {/* Latest revealed Drop preview */}
      {latest && latest.date !== snapshot.today.date && latest.moments[0] ? (
        <>
          <SectionHeader title={s.drop.latest} action={s.drop.history} onAction={() => router.push('/history')} />
          <Pressable onPress={() => router.push(`/story/${latest.date}`)}>
            <MomentCard moment={latest.moments[0]} members={snapshot.members} size="compact" />
          </Pressable>
        </>
      ) : null}

      {mode === 'demo' ? (
        <Card style={{ gap: space.md, borderColor: colors.accent + '55' }}>
          <Row gap={space.sm}>
            <Ionicons name="flask" size={18} color={colors.accent} />
            <Txt variant="label" color={colors.accent}>
              {s.common.demo}
            </Txt>
          </Row>
          <Txt color={colors.textMuted}>{s.today.nextDayHint}</Txt>
          <Button label={s.today.nextDay} variant="secondary" icon="play-forward" onPress={demo.nextDay} />
          {demo.state.date !== DEMO_TODAY || demo.state.revealed ? (
            <Button label={s.today.resetDemo} variant="ghost" icon="refresh" onPress={demo.reset} />
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  competition: { borderRadius: radius.xl, padding: space.xl, gap: space.sm },
  drop: { borderRadius: radius.xl, padding: space.xl, gap: space.sm },
  play: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teaser: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  teaserChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
