import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Member, Provenance } from '@/domain/types';
import { strings } from '@/i18n';
import { colors, fonts, radius, space, type } from '@/theme/tokens';

// ——— Text ———————————————————————————————————————————————————————————

type Variant = keyof typeof type;

export function Txt({
  variant = 'body',
  color = colors.text,
  style,
  ...props
}: TextProps & { variant?: Variant; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text {...props} style={[type[variant] as TextStyle, { color }, style]} />;
}

// ——— Layout ——————————————————————————————————————————————————————————

export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['top'],
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: ('top' | 'bottom')[];
}) {
  const content = <View style={[padded && styles.padded, styles.content]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Txt variant="label" color={colors.textMuted}>
        {title}
      </Txt>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Txt variant="label" color={colors.accent}>
            {action}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Row({ children, style, gap = space.md }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

// ——— Controls ————————————————————————————————————————————————————————

export function tap() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync();
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'primary' ? colors.accent : variant === 'secondary' ? colors.surfaceRaised : 'transparent';
  const fg = variant === 'primary' ? colors.accentInk : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Row gap={space.sm} style={{ justifyContent: 'center' }}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Txt variant="bodyStrong" color={fg}>
            {label}
          </Txt>
        </Row>
      )}
    </Pressable>
  );
}

export function Pill({
  label,
  color = colors.textMuted,
  bg = colors.surfaceRaised,
  style,
}: {
  label: string;
  color?: string;
  bg?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Txt variant="label" color={color} style={{ fontSize: 10, letterSpacing: 1.2 }}>
        {label}
      </Txt>
    </View>
  );
}

/** Always-visible reminder that nothing in the demo is real. */
export function DemoBadge({ style, short }: { style?: StyleProp<ViewStyle>; short?: boolean }) {
  const label = short ? strings().common.demo : `${strings().common.demo} · ${strings().common.simulated}`;
  return <Pill label={label} color={colors.accentInk} bg={colors.accent} style={style} />;
}

const PROVENANCE_COLORS: Record<Provenance, string> = {
  verified: colors.success,
  device: colors.text,
  inferred: colors.gold,
  manual: colors.textMuted,
  simulated: colors.accent,
};

export function ProvenanceTag({ provenance, ink }: { provenance: Provenance; ink?: string }) {
  const label = strings().drop.provenance[provenance];
  return (
    <View style={[styles.provenance, { borderColor: ink ?? PROVENANCE_COLORS[provenance] }]}>
      <View style={[styles.dot, { backgroundColor: ink ?? PROVENANCE_COLORS[provenance] }]} />
      <Txt variant="label" color={ink ?? PROVENANCE_COLORS[provenance]} style={{ fontSize: 9 }}>
        {label}
      </Txt>
    </View>
  );
}

// ——— People ——————————————————————————————————————————————————————————

export function Avatar({ member, size = 40, ring }: { member: Member; size?: number; ring?: string }) {
  const initials = member.displayName.slice(0, 2).toUpperCase();
  return (
    <View
      accessibilityLabel={member.displayName}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: member.color,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 2 : 0,
        borderColor: ring,
      }}>
      <Text style={{ fontFamily: fonts.black, fontSize: size * 0.36, color: '#0B0B0B' }}>{initials}</Text>
    </View>
  );
}

export function AvatarStack({ members, size = 28, max = 6 }: { members: Member[]; size?: number; max?: number }) {
  const shown = members.slice(0, max);
  return (
    <View style={{ flexDirection: 'row' }}>
      {shown.map((m, i) => (
        <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -size * 0.3 }}>
          <Avatar member={m} size={size} ring={colors.bg} />
        </View>
      ))}
      {members.length > max ? (
        <View style={[styles.more, { width: size, height: size, borderRadius: size / 2, marginLeft: -size * 0.3 }]}>
          <Txt variant="label" style={{ fontSize: 10 }}>{`+${members.length - max}`}</Txt>
        </View>
      ) : null}
    </View>
  );
}

// ——— States ——————————————————————————————————————————————————————————

export function EmptyState({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'flex-start', gap: space.md }}>
      <Txt variant="heading">{title}</Txt>
      {subtitle ? <Txt color={colors.textMuted}>{subtitle}</Txt> : null}
      {children}
    </Card>
  );
}

export function Loading() {
  return (
    <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export { Ionicons };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 120 },
  content: { gap: space.xl, width: '100%', maxWidth: 640, alignSelf: 'center' },
  padded: { paddingHorizontal: space.lg, paddingTop: space.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: -space.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  button: { minHeight: 52, borderRadius: radius.pill, paddingHorizontal: space.xl, justifyContent: 'center' },
  buttonGhost: { borderWidth: 1, borderColor: colors.border },
  buttonDanger: { borderWidth: 1, borderColor: colors.danger },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  provenance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  more: { backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
});
