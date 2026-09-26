import { Pressable, StyleSheet, View } from 'react-native';

import type { DailyDrop } from '@/domain/types';
import { MOMENT_CATALOG } from '@/engine/catalog';
import { interpolate, strings } from '@/i18n';
import { capitalize, formatDayLong } from '@/lib/format';
import { cardThemes, colors, radius, space } from '@/theme/tokens';
import { Card, Row, Txt } from './ui';

export function DropRow({ drop, onPress }: { drop: DailyDrop; onPress: () => void }) {
  const s = strings();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={{ gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="bodyStrong">{capitalize(formatDayLong(drop.date))}</Txt>
          <Txt variant="small" color={colors.textMuted}>
            {interpolate(s.drop.moments, { n: drop.moments.length })}
          </Txt>
        </Row>
        <View style={styles.chips}>
          {drop.moments.map((m) => (
            <View key={m.id} style={[styles.chip, { backgroundColor: cardThemes[m.style].tint + '22' }]}>
              <Txt variant="label" color={cardThemes[m.style].tint} style={{ fontSize: 10 }}>
                {MOMENT_CATALOG[m.type].title}
              </Txt>
            </View>
          ))}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
});
