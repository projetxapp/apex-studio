import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { LeagueSnapshot } from '@/data/snapshot';
import { memberMap, playerProfile } from '@/data/selectors';
import { formatValue } from '@/engine/render';
import { interpolate, strings } from '@/i18n';
import { formatDuration, formatMonth } from '@/lib/format';
import { colors, fonts, medal, radius, space } from '@/theme/tokens';
import { AwardGrid } from './LeagueBlocks';
import { MomentCard } from './MomentCard';
import { Avatar, Card, EmptyState, Pill, Row, SectionHeader, Txt } from './ui';

export function PlayerProfileView({ snapshot, memberId }: { snapshot: LeagueSnapshot; memberId: string }) {
  const s = strings();
  const profile = playerProfile(snapshot, memberId);
  if (!profile) return <EmptyState title={s.common.error} />;
  const members = memberMap(snapshot);
  const { member, standing } = profile;
  const isMe = member.id === snapshot.meId;

  return (
    <>
      <View style={styles.hero}>
        <Avatar member={member} size={96} ring={member.color} />
        <View style={{ flex: 1, gap: 4 }}>
          {isMe ? <Pill label={s.profile.you} color={colors.accentInk} bg={colors.accent} /> : null}
          <Txt variant="display">{member.displayName.toUpperCase()}</Txt>
          <Txt variant="label" color={member.color}>
            {member.tag}
          </Txt>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat label={s.profile.seasonRank} value={standing ? `#${standing.rank}` : '–'} color={standing ? medal(standing.rank) : undefined} />
        <Stat label={s.profile.points} value={String(standing?.points ?? 0)} />
        <Stat label={s.profile.battleWins} value={String(profile.battleWins)} />
        <Stat label={s.profile.appearances} value={String(profile.appearances)} />
      </View>

      {profile.titles.length ? (
        <>
          <SectionHeader title={s.profile.titles} />
          <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
            {profile.titles.map((t) => (
              <Pill key={t.month} label={`${t.label} · ${formatMonth(t.month)}`} color={colors.accentInk} bg={colors.gold} />
            ))}
          </Row>
        </>
      ) : null}

      {profile.closest ? (
        <>
          <SectionHeader title={s.profile.closestTeammate} />
          <Pressable onPress={() => router.push(`/player/${profile.closest!.member.id}`)}>
            <Card>
              <Row>
                <Avatar member={profile.closest.member} size={44} />
                <View style={{ flex: 1 }}>
                  <Txt variant="heading">{profile.closest.member.displayName}</Txt>
                  <Txt variant="small" color={colors.textMuted}>
                    {interpolate(s.profile.together, { time: formatDuration(profile.closest.minutes) })}
                  </Txt>
                </View>
              </Row>
            </Card>
          </Pressable>
        </>
      ) : null}

      {profile.awards.length ? (
        <>
          <SectionHeader title={s.profile.awards} />
          <AwardGrid awards={profile.awards} members={members} />
        </>
      ) : null}

      {profile.records.length ? (
        <>
          <SectionHeader title={s.profile.records} />
          <Card style={{ gap: space.md }}>
            {profile.records.map((r) => (
              <Row key={r.id} style={{ justifyContent: 'space-between' }}>
                <Txt color={colors.textMuted} style={{ flex: 1 }}>
                  {s.records[r.key]}
                </Txt>
                <Txt style={{ fontFamily: fonts.display, fontSize: 20 }}>{formatValue(r.value)}</Txt>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title={s.profile.moments} />
      {profile.moments.length ? (
        <View style={{ gap: space.md }}>
          {profile.moments.map((m) => (
            <Pressable key={m.id} onPress={() => router.push(`/story/${m.date}`)}>
              <MomentCard moment={m} members={snapshot.members} size="compact" />
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState title={s.profile.noMoments} />
      )}
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Txt style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 36 }} color={color ?? colors.text}>
        {value}
      </Txt>
      <Txt variant="label" color={colors.textMuted} style={{ fontSize: 9 }} numberOfLines={2}>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: 2,
  },
});
