import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLeague } from '@/data/LeagueProvider';
import { strings } from '@/i18n';
import { colors, fonts } from '@/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(active: IconName, idle: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? active : idle} size={24} color={color as string} />;
  };
}

export default function TabLayout() {
  const s = strings();
  const { snapshot } = useLeague();
  const insets = useSafeAreaInsets();
  const unseen = snapshot && !snapshot.today.revealed && snapshot.today.pendingMoments > 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          height: 68 + insets.bottom,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, minHeight: 14, flexShrink: 0 },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: s.tabs.today, tabBarIcon: icon('flash', 'flash-outline') }} />
      <Tabs.Screen
        name="drop"
        options={{
          title: s.tabs.drop,
          tabBarIcon: icon('albums', 'albums-outline'),
          tabBarBadge: unseen ? '' : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.hot, minWidth: 10, maxHeight: 10, borderRadius: 5, top: 4 },
        }}
      />
      <Tabs.Screen name="league" options={{ title: s.tabs.league, tabBarIcon: icon('trophy', 'trophy-outline') }} />
      <Tabs.Screen name="me" options={{ title: s.tabs.me, tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
