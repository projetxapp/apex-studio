import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Award, Member, MemberId, RecordEntry, Standing } from '@/domain/types';
import { formatValue, joinNames } from '@/engine/render';
import { interpolate, strings } from '@/i18n';
import { formatDayShort } from '@/lib/format';
import { colors, fonts, medal, radius, space } from '@/theme/tokens';
import { Avatar, AvatarStack, Card, Ionicons, Row, Txt } from './ui';

/** Building blocks shared by the League tab, season recaps and player profiles. */

export function Leaderboard({
  standings,
  members,
  meId,
}: {
  standings: Standing[];
  members: Map<MemberId, Member>;
  meId: MemberId | null;
}) {
  const s = strings();
  return (
    <Card style={{ paddingVertical: space.sm, gap: 0 }}>
      {standings.map((st, i) => {
        const m = members.get(st.memberId);
        if (!m) return null;
        const isMe = m.id === meId;
        return (
          <Pressable
            key={st.memberId}
            onPress={() => router.push(`/player/${m.id}`)}
            style={[styles.row, i > 0 && styles.rowBorder, isMe && styles.me]}>
            <Txt style={styles.rank} color={medal(st.rank)}>
              {st.rank}
            </Txt>
            <Avatar member={m} size={36} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">
                {m.displayName}
                {isMe ? ` · ${s.common.you}` : ''}
              </Txt>
              <Txt variant="small" color={colors.textMuted}>
                {interpolate(st.wins > 1 ? s.league.wins : s.league.winsOne, { n: st.wins })}
              </Txt>
            </View>
            {st.delta !== 0 ? (
              <Row gap={2}>
                <Ionicons name={st.delta > 0 ? 'caret-up' : 'caret-down'} size={12} color={st.delta > 0 ? colors.success : colors.danger} />
                <Txt variant="small" color={st.delta > 0 ? colors.success : colors.danger}>
                  {Math.abs(st.delta)}
                </Txt>
              </Row>
            ) : null}
            <Txt style={styles.points}>{st.points}</Txt>
          </Pressable>
        );
      })}
    </Card>
  );
}

export function AwardTile({ award, members }: { award: Award; members: Map<MemberId, Member> }) {
  const s = strings();
  const copy = s.awards[award.key];
  const people = award.memberIds.map((id) => members.get(id)).filter((m): m is Member => !!m);
  return (
    <View style={[styles.award, award.competitive && { borderColor: colors.accent + '66' }]}>
      <Txt variant="label" color={award.competitive ? colors.accent : colors.hot}>
        {copy.title}
      </Txt>
      <Row gap={space.sm}>
        <AvatarStack members={people} size={30} />
        <Txt variant="bodyStrong" style={{ flex: 1 }} numberOfLines={2}>
          {joinNames(people.map((p) => p.displayName))}
        </Txt>
      </Row>
      <Txt variant="small" color={colors.textMuted}>
        {interpolate(copy.description, { value: award.value ? formatValue(award.value) : '' })}
      </Txt>
    </View>
  );
}

export function AwardGrid({ awards, members }: { awards: Award[]; members: Map<MemberId, Member> }) {
  return (
    <View style={styles.grid}>
      {awards.map((a) => (
        <AwardTile key={a.id} award={a} members={members} />
      ))}
    </View>
  );
}

export function RecordList({ records, members }: { records: RecordEntry[]; members: Map<MemberId, Member> }) {
  const s = strings();
  return (
    <Card style={{ paddingVertical: space.sm }}>
      {records.map((r, i) => {
        const people = r.memberIds.map((id) => members.get(id)).filter((m): m is Member => !!m);
        return (
          <View key={r.id} style={[styles.recordRow, i > 0 && styles.rowBorder]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="small" color={colors.textMuted}>
                {s.records[r.key]}
              </Txt>
              <Txt variant="bodyStrong" numberOfLines={1}>
                {people.length > 3 ? `${people.length} ${s.stats.members}` : joinNames(people.map((p) => p.displayName))}
              </Txt>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Txt style={styles.recordValue}>{formatValue(r.value)}</Txt>
              <Txt variant="small" color={colors.textFaint}>
                {formatDayShort(r.date)}
              </Txt>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  me: { backgroundColor: colors.accent + '0F', marginHorizontal: -space.lg, paddingHorizontal: space.lg },
  rank: { fontFamily: fonts.display, fontSize: 24, width: 24, textAlign: 'center' },
  points: { fontFamily: fonts.display, fontSize: 26, color: colors.text, minWidth: 44, textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  award: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  recordValue: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
});
