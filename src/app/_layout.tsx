import { Anton_400Regular } from '@expo-google-fonts/anton';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { LeagueProvider } from '@/data/LeagueProvider';
import { colors, fonts } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border, primary: colors.accent },
};

const pushed = {
  headerShown: true,
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerShadowVisible: false,
  headerTitleStyle: { fontFamily: fonts.bold, fontSize: 16 },
  headerBackButtonDisplayMode: 'minimal' as const,
};

export default function RootLayout() {
  const [loaded, fontError] = useFonts({
    Anton_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  });

  useEffect(() => {
    if (loaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, fontError]);

  if (!loaded && !fontError) return null;

  return (
    <ThemeProvider value={navTheme}>
      <LeagueProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="story/[date]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="player/[id]" options={{ ...pushed, title: '' }} />
          <Stack.Screen name="season/[month]" options={{ ...pushed, title: '' }} />
          <Stack.Screen name="people" options={{ ...pushed, title: 'Membres' }} />
          <Stack.Screen name="history" options={{ ...pushed, title: 'Historique' }} />
          <Stack.Screen name="settings" options={{ ...pushed, title: 'Réglages' }} />
          <Stack.Screen name="auth" options={{ ...pushed, title: '', presentation: 'modal' }} />
          <Stack.Screen name="onboarding" options={{ ...pushed, title: '' }} />
        </Stack>
      </LeagueProvider>
    </ThemeProvider>
  );
}
