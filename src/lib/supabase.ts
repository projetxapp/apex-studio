import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** false when the app is built without Supabase settings — the demo still works. */
export const isSupabaseConfigured = Boolean(url && publishableKey);

const isServer = typeof window === 'undefined' && Platform.OS === 'web';

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(url as string, publishableKey as string, {
      auth: {
        storage: isServer ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: !isServer,
        detectSessionInUrl: false,
      },
    })
  : null;

// Only refresh the session while the app is in the foreground (recommended for React Native).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
