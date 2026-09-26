import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Member, Moment, MomentType } from '@/domain/types';
import { renderMoment } from '@/engine/render';
import { strings } from '@/i18n';
import { formatDayLong, formatDecimal, formatInt } from '@/lib/format';
import { cardThemes, fonts, medal, radius, space } from '@/theme/tokens';
import { Avatar, Ionicons, ProvenanceTag } from './ui';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Partial<Record<MomentType, IconName>> = {
  MISSING: 'search',
  TROUBLE_IN_PARADISE: 'heart-dislike',
  NIGHT_OWL: 'moon',
  EARLY_BIRD: 'sunny',
  SLEEP_CHAMP: 'bed',
  MUSIC_TWINS: 'musical-notes',
  HOMEBODY: 'home',
  EXPLORER: 'compass',
  PHOTO_DUMP: 'camera',
  CALENDAR_CHAOS: 'calendar',
  GROUP_STAT: 'footsteps',
  RECORD_BROKEN: 'trophy',
  PERSONAL_RECORD: 'trending-up',
  STREAK: 'flame',
  WEIRDLY_IN_SYNC: 'git-compare',
  SAME_MINUTE: 'alarm',
  THE_LINK_UP: 'people',
  BROMANCE: 'heart',
  TODAYS_BATTLE: 'flash',
};

interface Props {
  moment: Moment;
  members: Member[];
  /** `story` fills the screen; `compact` is a list preview. */
  size?: 'story' | 'compact';
}

export function MomentCard({ moment, members, size = 'story' }: Props) {
  const theme = cardThemes[moment.style];
  const r = renderMoment(moment, members);
  const people = moment.memberIds.map((id) => members.find((m) => m.id === id)).filter((m): m is Member => !!m);
  const compact = size === 'compact';
  const ink = theme.ink;
  const icon = ICONS[moment.type];
  const s = strings();

  return (
    <LinearGradient
      colors={theme.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[styles.card, compact ? styles.compact : styles.story]}>
      {/* Poster watermark */}
      <Text aria-hidden style={[styles.watermark, { color: ink, fontSize: compact ? 120 : 220 }]}>
        {r.title.split(' ')[0]}
      </Text>

      <View style={styles.top}>
        <View style={styles.topRow}>
          <Text style={[styles.date, { color: ink }]}>{formatDayLong(moment.date).toUpperCase()}</Text>
          <ProvenanceTag provenance={moment.provenance} ink={ink} />
        </View>
        <View style={styles.titleRow}>
          {icon ? <Ionicons name={icon} size={compact ? 22 : 30} color={ink} /> : null}
          <Text style={[styles.title, { color: ink, fontSize: compact ? 30 : 46, lineHeight: compact ? 36 : 54 }]} numberOfLines={2}>
            {r.title}
          </Text>
        </View>
      </View>

      {!compact ? <Visual moment={moment} people={people} everyone={members} ink={ink} accent={theme.accent} /> : null}

      <View style={{ gap: compact ? space.sm : space.md }}>
        <Text style={[styles.headline, { color: ink, fontSize: compact ? 17 : 24, lineHeight: compact ? 23 : 31 }]}>
          {r.headline}
        </Text>
        {r.caption ? (
          <Text style={[styles.caption, { color: theme.accent, fontSize: compact ? 14 : 19 }]}>« {r.caption} »</Text>
        ) : null}
        {!compact && moment.type !== 'TODAYS_BATTLE' && r.stats.length ? (
          <View style={styles.stats}>
            {r.stats.map((st) => (
              <View key={st.label} style={styles.stat}>
                <Text style={[styles.statValue, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
                  {st.value}
                </Text>
                <Text style={[styles.statLabel, { color: ink }]}>{st.label.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {compact && people.length ? (
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {people.slice(0, 6).map((p) => (
              <Avatar key={p.id} member={p} size={24} />
            ))}
          </View>
        ) : null}
        {!compact && moment.type === 'TODAYS_BATTLE' ? (
          <Text style={[styles.note, { color: ink }]}>{s.league.fairPlay}</Text>
        ) : null}
      </View>
    </LinearGradient>
  );
}

/** Type-specific centrepiece so each card family looks different. */
function Visual({
  moment,
  people,
  everyone,
  ink,
  accent,
}: {
  moment: Moment;
  people: Member[];
  everyone: Member[];
  ink: string;
  accent: string;
}) {
  const s = strings();
  if (moment.type === 'TODAYS_BATTLE' && moment.results) {
    const rows = moment.results.slice(0, 5);
    return (
      <View style={styles.podium}>
        {rows.map((r) => {
          const m = everyone.find((p) => p.id === r.memberId);
          const unit = s.competitions[moment.vars.competition?.v as keyof typeof s.competitions]?.unit ?? '';
          return (
            <View key={r.memberId} style={[styles.podiumRow, { borderColor: ink + '33' }]}>
              <Text style={[styles.rank, { color: r.rank ? medal(r.rank) : ink }]}>{r.rank || '–'}</Text>
              {m ? <Avatar member={m} size={30} /> : null}
              <Text style={[styles.podiumName, { color: ink }]} numberOfLines={1}>
                {m?.displayName ?? ''}
              </Text>
              <Text style={[styles.podiumValue, { color: ink }]}>
                {unit === 'km' ? formatDecimal(r.value, 1) : formatInt(r.value)}
                {unit === '%' ? '%' : ` ${unit}`}
              </Text>
              <Text style={[styles.podiumPts, { color: r.eligible ? accent : ink + '99' }]}>
                {r.eligible ? `+${r.points}` : s.drop.notEligible}
              </Text>
            </View>
          );
        })}
      </View>
    );
  }
  if (people.length === 0) return <View style={{ flex: 1 }} />;
  if (people.length === 1) {
    const ghost = moment.type === 'MISSING';
    return (
      <View style={styles.visual}>
        <View style={ghost ? styles.ghost : undefined}>
          <Avatar member={people[0]} size={132} ring={ink} />
        </View>
        <Text style={[styles.bigName, { color: ink }]}>{people[0].displayName.toUpperCase()}</Text>
      </View>
    );
  }
  if (people.length === 2) {
    const glyph = moment.type === 'TROUBLE_IN_PARADISE' ? '÷' : moment.style === 'sync' ? '=' : '×';
    return (
      <View style={styles.visual}>
        <View style={styles.duo}>
          <Avatar member={people[0]} size={112} ring={ink} />
          <Text style={[styles.glyph, { color: ink }]}>{glyph}</Text>
          <Avatar member={people[1]} size={112} ring={ink} />
        </View>
      </View>
    );
  }
  return (
    <View style={styles.visual}>
      <View style={styles.crowd}>
        {people.map((p) => (
          <Avatar key={p.id} member={p} size={people.length > 6 ? 54 : 68} ring={ink} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'space-between' },
  story: { flex: 1, padding: space.xl, paddingTop: space.xxl },
  compact: { padding: space.lg, minHeight: 220, gap: space.md },
  watermark: {
    position: 'absolute',
    width: 1200,
    textAlign: 'right',
    right: -20,
    bottom: -40,
    fontFamily: fonts.display,
    opacity: 0.08,
    letterSpacing: -2,
  },
  top: { gap: space.sm },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, opacity: 0.8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  title: { fontFamily: fonts.display, letterSpacing: 0.5, flexShrink: 1 },
  headline: { fontFamily: fonts.black, letterSpacing: -0.3 },
  caption: { fontFamily: fonts.semibold },
  stats: { flexDirection: 'row', gap: space.xl, marginTop: space.sm },
  stat: { flex: 1, maxWidth: 180 },
  statValue: { fontFamily: fonts.display, fontSize: 40, lineHeight: 46 },
  statLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, opacity: 0.8 },
  note: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, opacity: 0.7 },
  visual: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, marginVertical: space.lg },
  bigName: { fontFamily: fonts.display, fontSize: 34, letterSpacing: 1 },
  ghost: { opacity: 0.45, borderRadius: 80, borderWidth: 2, borderStyle: 'dashed', padding: 6, borderColor: '#fff' },
  duo: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  glyph: { fontFamily: fonts.display, fontSize: 48 },
  crowd: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm, maxWidth: 320 },
  podium: { flex: 1, justifyContent: 'center', gap: space.sm, marginVertical: space.lg },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rank: { fontFamily: fonts.display, fontSize: 28, width: 26, textAlign: 'center' },
  podiumName: { fontFamily: fonts.bold, fontSize: 16, flex: 1 },
  podiumValue: { fontFamily: fonts.semibold, fontSize: 14, opacity: 0.85 },
  podiumPts: { fontFamily: fonts.black, fontSize: 14, minWidth: 64, textAlign: 'right' },
});
