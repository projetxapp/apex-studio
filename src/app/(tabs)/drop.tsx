import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { LiveGate } from '@/components/LiveGate';
import { AvatarStack, Button, Card, DemoBadge, EmptyState, Ionicons, Row, SectionHeader, Screen, Txt } from '@/components/ui';
import { useLeague } from '@/data/LeagueProvider';
import { memberMap } from '@/data/selectors';
import type { DailyDrop } from '@/domain/types';
import { DropRow } from '@/components/DropRow';
import { MOMENT_CATALOG } from '@/engine/catalog';
import { interpolate, strings } from '@/i18n';
import { capitalize, formatClock, formatDayLong } from '@/lib/format';
import { cardThemes, colors, radius, space } from '@/theme/tokens';

export default function DropScreen() {
  const s = strings();
  const { snapshot, mode, demo } = useLeague();
  if (!snapshot) return <LiveGate />;
  const members = memberMap(snapshot);
  const [latest, ...older] = snapshot.drops;
  const coverTheme = cardThemes[latest?.moments[0]?.style ?? 'duo'];

  const people = (drop: DailyDrop) =>
    [...new Set(drop.moments.flatMap((m) => m.memberIds))].map((id) => members.get(id)).filter((m) => !!m);

  return (
    <Screen>
      <View style={{ gap: space.sm, marginTop: space.sm }}>
        <Txt variant="display">{s.drop.title.toUpperCase()}</Txt>
        {snapshot.mode === 'demo' ? <DemoBadge /> : null}
      </View>

      {!snapshot.today.revealed ? (
        <Card style={{ gap: space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="label" color={colors.hot}>
              {capitalize(formatDayLong(snapshot.today.date))}
            </Txt>
            <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
          </Row>
          <Txt variant="title">{interpolate(s.drop.locked, { time: formatClock(snapshot.today.revealAt) }).toUpperCase()}</Txt>
          {mode === 'demo' ? <Button label={s.today.revealNow} icon="eye" onPress={demo.reveal} /> : null}
        </Card>
      ) : null}

      {latest ? (
        <Pressable onPress={() => router.push(`/story/${latest.date}`)} accessibilityRole="button">
          <LinearGradient colors={coverTheme.gradient} style={styles.cover}>
            <Txt variant="label" color={coverTheme.ink} style={{ opacity: 0.8 }}>
              {s.drop.latest} · {capitalize(formatDayLong(latest.date))}
            </Txt>
            <Txt variant="hero" color={coverTheme.ink}>
              {MOMENT_CATALOG[latest.moments[0]?.type ?? 'GROUP_STAT'].title}
            </Txt>
            <Txt variant="bodyStrong" color={coverTheme.ink} style={{ opacity: 0.85 }}>
              {interpolate(s.drop.more, { n: latest.moments.length - 1 })}
            </Txt>
            <Row style={{ justifyContent: 'space-between', marginTop: space.lg }}>
              <AvatarStack members={people(latest)} size={30} max={7} />
              <View style={styles.play}>
                <Ionicons name="play" size={24} color={colors.text} />
              </View>
            </Row>
          </LinearGradient>
        </Pressable>
      ) : (
        <EmptyState title={s.drop.empty} />
      )}

      {older.length ? (
        <>
          <SectionHeader title={s.drop.history} action={s.common.seeAll} onAction={() => router.push('/history')} />
          <View style={{ gap: space.md }}>
            {older.slice(0, 6).map((drop) => (
              <DropRow key={drop.date} drop={drop} onPress={() => router.push(`/story/${drop.date}`)} />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: radius.xl, padding: space.xl, minHeight: 260, justifyContent: 'flex-end', gap: space.xs },
  play: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
