import { router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Screen, Txt } from '@/components/ui';
import { useLeague } from '@/data/LeagueProvider';
import { interpolate, strings } from '@/i18n';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function OnboardingScreen() {
  const s = strings();
  const { leagues, auth } = useLeague();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  if (!auth.session) {
    return (
      <Screen edges={[]}>
        <Button label={s.auth.signIn} onPress={() => router.replace('/auth')} />
      </Screen>
    );
  }

  const run = async (kind: 'create' | 'join') => {
    setError(null);
    setBusy(kind);
    try {
      if (kind === 'create') setCreated(await leagues.create(name.trim()));
      else {
        await leagues.join(code);
        router.replace('/');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes('invalid_code') ? s.onboarding.invalidCode : msg);
    } finally {
      setBusy(null);
    }
  };

  if (created) {
    return (
      <Screen edges={[]}>
        <Card style={{ gap: space.lg }}>
          <Txt variant="title">{interpolate(s.onboarding.created, { code: '' }).trim()}</Txt>
          <Txt variant="hero" color={colors.accent} selectable style={{ textAlign: 'center' }}>
            {created}
          </Txt>
          <Button label={s.settings.shareCode} icon="share-social" onPress={() => void Share.share({ message: `THE LEAGUE — code : ${created}` })} />
          <Button label={s.common.continue} variant="secondary" onPress={() => router.replace('/')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <Txt variant="display">{s.onboarding.title.toUpperCase()}</Txt>
      <Card style={{ gap: space.md }}>
        <Txt variant="heading">{s.onboarding.join}</Txt>
        <Txt variant="small" color={colors.textMuted}>
          {s.onboarding.joinSub}
        </Txt>
        <TextInput
          style={[styles.input, styles.code]}
          placeholder="ABCD2345"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
          maxLength={9}
          value={code}
          onChangeText={setCode}
        />
        <Button label={s.onboarding.join} onPress={() => void run('join')} loading={busy === 'join'} disabled={code.trim().length < 8} />
      </Card>
      <Card style={{ gap: space.md }}>
        <Txt variant="heading">{s.onboarding.create}</Txt>
        <Txt variant="small" color={colors.textMuted}>
          {s.onboarding.createSub}
        </Txt>
        <TextInput
          style={styles.input}
          placeholder={s.onboarding.leagueName}
          placeholderTextColor={colors.textFaint}
          maxLength={40}
          value={name}
          onChangeText={setName}
        />
        <Button label={s.onboarding.create} variant="secondary" onPress={() => void run('create')} loading={busy === 'create'} disabled={name.trim().length < 2} />
      </Card>
      {error ? <Txt color={colors.danger}>{error}</Txt> : null}
      <View />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 16,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  code: { fontFamily: fonts.display, fontSize: 28, letterSpacing: 6, textAlign: 'center' },
});
