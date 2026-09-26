import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LeagueSnapshot } from '@/data/snapshot';
import { reactionSummary } from '@/data/selectors';
import type { DailyDrop, ReactionEmoji } from '@/domain/types';
import { interpolate, strings } from '@/i18n';
import { formatDayLong } from '@/lib/format';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { MomentCard } from './MomentCard';
import { Button, DemoBadge, Ionicons, tap, Txt } from './ui';

const SLIDE_MS = 9000;

interface Props {
  drop: DailyDrop;
  snapshot: LeagueSnapshot;
  onReact: (momentId: string, emoji: ReactionEmoji | null) => void;
  onClose: () => void;
}

export function StoryViewer({ drop, snapshot, onReact, onClose }: Props) {
  const s = strings();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const [entrance] = useState(() => new Animated.Value(0));
  const total = drop.moments.length;
  const finished = index >= total;

  const go = (next: number) => {
    tap();
    setIndex(Math.max(0, Math.min(total, next)));
  };

  // Card entrance ("reveal") animation.
  useEffect(() => {
    entrance.setValue(0);
    Animated.spring(entrance, { toValue: 1, useNativeDriver: true, friction: 7, tension: 60 }).start();
  }, [index, entrance]);

  // Auto-advance, paused while the finger is down. Resumes where it stopped.
  const valueRef = useRef(0);
  const shownIndex = useRef(-1);
  useEffect(() => {
    const id = progress.addListener(({ value }) => {
      valueRef.current = value;
    });
    return () => progress.removeListener(id);
  }, [progress]);

  useEffect(() => {
    if (shownIndex.current !== index) {
      shownIndex.current = index;
      progress.setValue(0);
      valueRef.current = 0;
    }
    if (finished || paused) return;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: SLIDE_MS * (1 - valueRef.current),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start(({ finished: done }) => {
      if (done) setIndex((i) => i + 1);
    });
    return () => anim.stop();
  }, [index, paused, finished, progress]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 20 || g.dy > 30,
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 90 && Math.abs(g.dx) < 60) onClose();
          else if (g.dx < -40) setIndex((i) => Math.min(total, i + 1));
          else if (g.dx > 40) setIndex((i) => Math.max(0, i - 1));
        },
      }),
    [onClose, total],
  );

  const moment = drop.moments[index];
  const reactions = moment ? reactionSummary(snapshot, moment.id) : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.sm }]} {...pan.panHandlers}>
      {/* Progress segments */}
      <View style={styles.bars}>
        {drop.moments.map((m, i) => (
          <View key={m.id} style={styles.bar}>
            <Animated.View
              style={[
                styles.barFill,
                {
                  width:
                    i < index
                      ? '100%'
                      : i === index
                        ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                        : '0%',
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.header}>
        <View style={{ gap: 2, flexShrink: 1 }}>
          <Text style={styles.headerTitle}>{snapshot.league.name.toUpperCase()}</Text>
          <Text style={styles.headerSub}>
            {s.drop.title} · {formatDayLong(drop.date)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          {snapshot.mode === 'demo' ? <DemoBadge short /> : null}
          <Pressable onPress={onClose} hitSlop={16} accessibilityLabel={s.common.close}>
            <Ionicons name="close" size={28} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.stage}>
        {finished ? (
          <View style={styles.end}>
            <Txt variant="hero" style={{ textAlign: 'center' }}>
              {s.drop.end.toUpperCase()}
            </Txt>
            <Txt color={colors.textMuted} style={{ textAlign: 'center' }}>
              {s.drop.endSub}
            </Txt>
            <View style={{ gap: space.md, width: '100%', marginTop: space.xl }}>
              <Button label={s.drop.replay} icon="refresh" variant="secondary" onPress={() => setIndex(0)} />
              <Button label={s.common.close} onPress={onClose} />
            </View>
          </View>
        ) : (
          <Animated.View
            style={{
              flex: 1,
              opacity: entrance,
              transform: [
                { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              ],
            }}>
            <MomentCard moment={moment} members={snapshot.members} />
          </Animated.View>
        )}

        {/* Tap zones: left = back, right = next. Long press pauses. */}
        {!finished ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <View style={styles.zones}>
              <Pressable
                style={{ flex: 1 }}
                onPress={() => go(index - 1)}
                onPressIn={() => setPaused(true)}
                onPressOut={() => setPaused(false)}
                accessibilityLabel="Précédent"
              />
              <Pressable
                style={{ flex: 2 }}
                onPress={() => go(index + 1)}
                onPressIn={() => setPaused(true)}
                onPressOut={() => setPaused(false)}
                accessibilityLabel="Suivant"
              />
            </View>
          </View>
        ) : null}
      </View>

      {!finished && reactions ? (
        <View style={styles.reactions}>
          {reactions.counts.map(({ emoji, count }) => {
            const active = reactions.mine === emoji;
            return (
              <Pressable
                key={emoji}
                onPress={() => {
                  tap();
                  onReact(moment.id, active ? null : emoji);
                }}
                style={[styles.reaction, active && styles.reactionActive]}
                accessibilityLabel={`${s.drop.react} ${emoji}`}>
                <Text style={styles.emoji}>{emoji}</Text>
                {count > 0 ? <Text style={[styles.count, active && { color: colors.accentInk }]}>{count}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {!finished ? (
        <Text style={styles.hint}>
          {index + 1}/{total} · {interpolate(s.drop.moments, { n: total })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    maxWidth: 520, // phone-shaped story on desktop browsers
    alignSelf: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: space.md,
    gap: space.md,
  },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: colors.text },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.text, letterSpacing: 1 },
  headerSub: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  stage: { flex: 1 },
  zones: { flex: 1, flexDirection: 'row', marginBottom: 80 },
  end: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  reactions: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  reaction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  reactionActive: { backgroundColor: colors.accent },
  emoji: { fontSize: 20 },
  count: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  hint: { fontFamily: fonts.medium, fontSize: 11, color: colors.textFaint, textAlign: 'center' },
});
