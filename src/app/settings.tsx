import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, Share, StyleSheet, Switch, View } from 'react-native';

import { Avatar, Button, Card, Divider, Ionicons, Row, SectionHeader, Screen, Txt } from '@/components/ui';
import { useLeague } from '@/data/LeagueProvider';
import type { DataSourceKind } from '@/domain/types';
import { interpolate, strings } from '@/i18n';
import { colors, radius, space } from '@/theme/tokens';

const SOURCES: DataSourceKind[] = ['motion', 'sleep', 'proximity', 'routine', 'music', 'photos', 'calendar', 'screen', 'transport'];

function confirm(message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(message)) onYes();
    return;
  }
  Alert.alert(message, undefined, [
    { text: strings().common.cancel, style: 'cancel' },
    { text: strings().common.continue, style: 'destructive', onPress: onYes },
  ]);
}

export default function SettingsScreen() {
  const s = strings();
  const { mode, setMode, snapshot, demo, auth, leagues, privacy } = useLeague();

  return (
    <Screen edges={[]}>
      {/* Mode */}
      <SectionHeader title={s.settings.mode} />
      <View style={styles.segment}>
        {(['demo', 'live'] as const).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} style={[styles.segmentItem, mode === m && styles.segmentActive]}>
            <Txt variant="bodyStrong" color={mode === m ? colors.accentInk : colors.text}>
              {m === 'demo' ? s.settings.demoMode : s.settings.liveMode}
            </Txt>
            <Txt variant="small" color={mode === m ? colors.accentInk : colors.textMuted}>
              {m === 'demo' ? s.settings.demoModeSub : s.settings.liveModeSub}
            </Txt>
          </Pressable>
        ))}
      </View>

      {mode === 'demo' && snapshot ? (
        <>
          <SectionHeader title={s.settings.demoAs} />
          <View style={styles.people}>
            {snapshot.members.map((m) => (
              <Pressable key={m.id} onPress={() => demo.setMe(m.id)} style={{ alignItems: 'center', gap: 4 }}>
                <Avatar member={m} size={46} ring={demo.state.meId === m.id ? colors.accent : undefined} />
                <Txt variant="small" color={demo.state.meId === m.id ? colors.accent : colors.textMuted}>
                  {m.displayName}
                </Txt>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {/* Account & League (live) */}
      {mode === 'live' ? (
        <>
          <SectionHeader title={s.settings.account} />
          <Card style={{ gap: space.md }}>
            {!auth.configured ? (
              <Txt color={colors.textMuted}>{s.settings.notConfigured}</Txt>
            ) : auth.session ? (
              <>
                <Txt>{auth.session.user.email}</Txt>
                <Button label={s.settings.signOut} variant="secondary" icon="log-out" onPress={() => void auth.signOut()} />
                <Button
                  label={s.settings.deleteData}
                  variant="danger"
                  icon="trash"
                  onPress={() =>
                    confirm(s.settings.deleteConfirm, () => {
                      auth.deleteAccount().catch((e) => Alert.alert(s.common.error, String(e?.message ?? e)));
                    })
                  }
                />
              </>
            ) : (
              <Button label={s.settings.signIn} icon="log-in" onPress={() => router.push('/auth')} />
            )}
          </Card>

          {snapshot && snapshot.mode === 'live' ? (
            <>
              <SectionHeader title={s.settings.league} />
              <Card style={{ gap: space.md }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt color={colors.textMuted}>{s.settings.leagueName}</Txt>
                  <Txt variant="bodyStrong">{snapshot.league.name}</Txt>
                </Row>
                <Divider />
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt color={colors.textMuted}>{s.settings.inviteCode}</Txt>
                  <Txt variant="title" color={colors.accent} selectable>
                    {snapshot.league.inviteCode}
                  </Txt>
                </Row>
                <Button
                  label={s.settings.shareCode}
                  icon="share-social"
                  variant="secondary"
                  onPress={() => void Share.share({ message: `THE LEAGUE — code : ${snapshot.league.inviteCode}` })}
                />
                {leagues.list.length > 1 ? (
                  <View style={{ gap: space.sm }}>
                    {leagues.list.map((l) => (
                      <Pressable key={l.id} onPress={() => leagues.select(l.id)}>
                        <Row>
                          <Ionicons name={l.id === leagues.activeId ? 'radio-button-on' : 'radio-button-off'} size={18} color={colors.accent} />
                          <Txt>{l.name}</Txt>
                        </Row>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Button label={s.onboarding.title} variant="ghost" icon="add" onPress={() => router.push('/onboarding')} />
                <Button label={s.settings.leave} variant="danger" onPress={() => confirm(s.settings.leave, () => void leagues.leave())} />
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      {/* Data sources */}
      <SectionHeader title={s.settings.permissions} />
      <Txt variant="small" color={colors.textMuted}>
        {s.settings.permissionsSub}
      </Txt>
      <Card style={{ gap: space.md }}>
        {SOURCES.map((src, i) => (
          <View key={src} style={{ gap: space.md }}>
            {i > 0 ? <Divider /> : null}
            <Row>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="bodyStrong">{s.sources[src].label}</Txt>
                <Txt variant="small" color={colors.textMuted}>
                  {s.sources[src].detail}
                </Txt>
              </View>
              <Switch
                value={privacy.sources.includes(src)}
                onValueChange={() => privacy.toggleSource(src)}
                trackColor={{ true: colors.accent, false: colors.border }}
                thumbColor={colors.text}
                accessibilityLabel={s.sources[src].label}
              />
            </Row>
          </View>
        ))}
      </Card>

      {/* Privacy */}
      <SectionHeader title={s.settings.privacy} />
      <Card style={{ gap: space.md }}>
        <Row>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="bodyStrong">{s.settings.pause}</Txt>
            <Txt variant="small" color={colors.textMuted}>
              {s.settings.pauseSub}
            </Txt>
          </View>
          <Switch value={privacy.paused} onValueChange={privacy.setPaused} trackColor={{ true: colors.accent, false: colors.border }} thumbColor={colors.text} />
        </Row>
        <Divider />
        <Row>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="bodyStrong">{s.settings.hideSensitive}</Txt>
            <Txt variant="small" color={colors.textMuted}>
              {s.settings.hideSensitiveSub}
            </Txt>
          </View>
          <Switch
            value={privacy.hideSensitive}
            onValueChange={privacy.setHideSensitive}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor={colors.text}
          />
        </Row>
      </Card>
      <Card style={{ gap: space.sm }}>
        {s.settings.principles.map((p) => (
          <Row key={p} gap={space.sm} style={{ alignItems: 'flex-start' }}>
            <Ionicons name="shield-checkmark" size={16} color={colors.success} style={{ marginTop: 3 }} />
            <Txt variant="small" color={colors.textMuted} style={{ flex: 1 }}>
              {p}
            </Txt>
          </Row>
        ))}
      </Card>

      <SectionHeader title={s.settings.about} />
      <Card style={{ gap: space.sm }}>
        <Txt color={colors.textMuted}>{s.settings.aboutText}</Txt>
        <Txt variant="small" color={colors.textFaint}>
          {interpolate(s.settings.version, { v: Constants.expoConfig?.version ?? '0.1.0' })}
        </Txt>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { gap: space.sm },
  segmentItem: {
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  segmentActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
});
