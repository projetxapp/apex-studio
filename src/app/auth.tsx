import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Screen, Txt } from '@/components/ui';
import { useLeague } from '@/data/LeagueProvider';
import { strings } from '@/i18n';
import { colors, fonts, radius, space } from '@/theme/tokens';

export default function AuthScreen() {
  const s = strings();
  const { auth, setMode } = useLeague();
  const [signUp, setSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    setMessage(null);
    if (password.length < 8) return setMessage(s.auth.passwordTooShort);
    setBusy(true);
    try {
      if (signUp) {
        const result = await auth.signUp(email, password, name || email.split('@')[0]);
        if (result === 'check-email') {
          setMessage(s.auth.checkEmail);
          setSignUp(false);
          return;
        }
      } else {
        await auth.signIn(email, password);
      }
      setMode('live');
      router.replace('/onboarding');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!auth.configured) {
    return (
      <Screen edges={[]}>
        <Card style={{ gap: space.md }}>
          <Txt>{s.auth.notConfigured}</Txt>
          <Button label={s.auth.tryDemo} onPress={() => { setMode('demo'); router.replace('/'); }} />
        </Card>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen edges={[]}>
        <View style={{ gap: space.sm }}>
          <Txt variant="display">{s.auth.title.toUpperCase()}</Txt>
          <Txt color={colors.textMuted}>{s.auth.subtitle}</Txt>
        </View>
        <View style={{ gap: space.md }}>
          {signUp ? (
            <TextInput style={styles.input} placeholder={s.auth.displayName} placeholderTextColor={colors.textFaint} value={name} onChangeText={setName} maxLength={40} />
          ) : null}
          <TextInput
            style={styles.input}
            placeholder={s.auth.email}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder={s.auth.password}
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            autoComplete={signUp ? 'new-password' : 'current-password'}
            value={password}
            onChangeText={setPassword}
          />
          {message ? <Txt color={message === s.auth.checkEmail ? colors.success : colors.danger}>{message}</Txt> : null}
          <Button label={signUp ? s.auth.signUp : s.auth.signIn} onPress={() => void submit()} loading={busy} disabled={!email || !password} />
          <Pressable onPress={() => setSignUp(!signUp)} style={{ alignItems: 'center', padding: space.sm }}>
            <Txt variant="small" color={colors.accent}>
              {signUp ? s.auth.switchToSignIn : s.auth.switchToSignUp}
            </Txt>
          </Pressable>
        </View>
        <Button label={s.auth.tryDemo} variant="ghost" icon="sparkles" onPress={() => { setMode('demo'); router.replace('/'); }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 16,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
});
