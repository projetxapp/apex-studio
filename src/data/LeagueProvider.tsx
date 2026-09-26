import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { buildDemoSnapshot, DEFAULT_DEMO_STATE, nextDemoState, type DemoState } from '@/demo/demoLeague';
import type { DataSourceKind, MemberId, ReactionEmoji } from '@/domain/types';
import { loadJSON, saveJSON } from '@/lib/storage';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { listMyLeagues, loadLiveSnapshot, setLiveReaction, type LeagueSummary } from './liveSource';
import type { LeagueSnapshot } from './snapshot';

export type Mode = 'demo' | 'live';

export interface PrivacyPrefs {
  sources: DataSourceKind[];
  paused: boolean;
  hideSensitive: boolean;
}

interface Prefs {
  mode: Mode;
  demo: DemoState;
  activeLeagueId: string | null;
  /** Demo-mode privacy toggles (live mode stores them in Supabase). */
  privacy: PrivacyPrefs;
}

const DEFAULT_PREFS: Prefs = {
  mode: 'demo',
  demo: DEFAULT_DEMO_STATE,
  activeLeagueId: null,
  privacy: { sources: [], paused: false, hideSensitive: true },
};

const PREFS_KEY = 'the-league:prefs:v1';

interface LeagueContextValue {
  ready: boolean;
  mode: Mode;
  setMode: (mode: Mode) => void;
  snapshot: LeagueSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  react: (momentId: string, emoji: ReactionEmoji | null) => void;
  demo: {
    state: DemoState;
    reveal: () => void;
    nextDay: () => void;
    reset: () => void;
    setMe: (id: MemberId) => void;
  };
  auth: {
    configured: boolean;
    session: Session | null;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, displayName: string) => Promise<'signed-in' | 'check-email'>;
    signOut: () => Promise<void>;
    deleteAccount: () => Promise<void>;
  };
  leagues: {
    list: LeagueSummary[];
    activeId: string | null;
    select: (id: string) => void;
    create: (name: string) => Promise<string>;
    join: (code: string) => Promise<void>;
    leave: () => Promise<void>;
  };
  privacy: PrivacyPrefs & {
    toggleSource: (s: DataSourceKind) => void;
    setPaused: (v: boolean) => void;
    setHideSensitive: (v: boolean) => void;
  };
}

const LeagueContext = createContext<LeagueContextValue | null>(null);

export function LeagueProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [leagueList, setLeagueList] = useState<LeagueSummary[]>([]);
  const [liveSnapshot, setLiveSnapshot] = useState<LeagueSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load persisted preferences and the Supabase session once.
  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await loadJSON(PREFS_KEY, DEFAULT_PREFS);
      if (!alive) return;
      setPrefs({ ...DEFAULT_PREFS, ...stored, demo: { ...DEFAULT_DEMO_STATE, ...stored.demo } });
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (alive) setSession(data.session);
      }
      if (alive) setReady(true);
    })();
    const sub = supabase?.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      alive = false;
      sub?.data.subscription.unsubscribe();
    };
  }, []);

  const update = useCallback((fn: (p: Prefs) => Prefs) => {
    setPrefs((prev) => {
      const next = fn(prev);
      void saveJSON(PREFS_KEY, next);
      return next;
    });
  }, []);

  const userId = session?.user.id ?? null;

  const refresh = useCallback(async () => {
    if (!supabase || !userId) {
      setLeagueList([]);
      setLiveSnapshot(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listMyLeagues(supabase, userId);
      setLeagueList(list);
      const active = list.find((l) => l.id === prefs.activeLeagueId) ?? list[0];
      setLiveSnapshot(active ? await loadLiveSnapshot(supabase, userId, active.id) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [userId, prefs.activeLeagueId]);

  useEffect(() => {
    // Fetching remote data when entering live mode is exactly what effects are for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ready && prefs.mode === 'live') void refresh();
  }, [ready, prefs.mode, refresh]);

  const demoSnapshot = useMemo(() => (ready ? buildDemoSnapshot(prefs.demo) : null), [ready, prefs.demo]);

  const react = useCallback(
    (momentId: string, emoji: ReactionEmoji | null) => {
      if (prefs.mode === 'demo') {
        update((p) => {
          const myReactions = { ...p.demo.myReactions };
          if (emoji) myReactions[momentId] = emoji;
          else delete myReactions[momentId];
          return { ...p, demo: { ...p.demo, myReactions } };
        });
        return;
      }
      if (!supabase || !userId || !liveSnapshot) return;
      // Optimistic update, then persist.
      setLiveSnapshot({
        ...liveSnapshot,
        reactions: [
          ...liveSnapshot.reactions.filter((r) => !(r.momentId === momentId && r.memberId === userId)),
          ...(emoji ? [{ momentId, memberId: userId, emoji }] : []),
        ],
      });
      setLiveReaction(supabase, userId, momentId, emoji).catch((e) => setError(String(e?.message ?? e)));
    },
    [prefs.mode, update, userId, liveSnapshot],
  );

  const value: LeagueContextValue = {
    ready,
    mode: prefs.mode,
    setMode: (mode) => update((p) => ({ ...p, mode })),
    snapshot: prefs.mode === 'demo' ? demoSnapshot : liveSnapshot,
    loading,
    error,
    refresh,
    react,
    demo: {
      state: prefs.demo,
      reveal: () => update((p) => ({ ...p, demo: { ...p.demo, revealed: true } })),
      nextDay: () => update((p) => ({ ...p, demo: nextDemoState(p.demo) })),
      reset: () => update((p) => ({ ...p, demo: { ...DEFAULT_DEMO_STATE, meId: p.demo.meId } })),
      setMe: (id) => update((p) => ({ ...p, demo: { ...p.demo, meId: id } })),
    },
    auth: {
      configured: isSupabaseConfigured,
      session,
      signIn: async (email, password) => {
        if (!supabase) throw new Error('Supabase not configured');
        const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (e) throw e;
      },
      signUp: async (email, password, displayName) => {
        if (!supabase) throw new Error('Supabase not configured');
        const { data, error: e } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() } },
        });
        if (e) throw e;
        return data.session ? 'signed-in' : 'check-email';
      },
      signOut: async () => {
        await supabase?.auth.signOut();
        setLiveSnapshot(null);
        setLeagueList([]);
      },
      deleteAccount: async () => {
        if (!supabase) return;
        const { error: e } = await supabase.rpc('delete_my_account');
        if (e) throw e;
        await supabase.auth.signOut();
        setLiveSnapshot(null);
        setLeagueList([]);
      },
    },
    leagues: {
      list: leagueList,
      activeId: liveSnapshot?.league.id ?? prefs.activeLeagueId,
      select: (id) => update((p) => ({ ...p, activeLeagueId: id })),
      create: async (name) => {
        if (!supabase) throw new Error('Supabase not configured');
        const { data, error: e } = await supabase.rpc('create_league', { p_name: name });
        if (e) throw e;
        update((p) => ({ ...p, activeLeagueId: data.id, mode: 'live' }));
        await refresh();
        return data.invite_code;
      },
      join: async (code) => {
        if (!supabase) throw new Error('Supabase not configured');
        const { data, error: e } = await supabase.rpc('join_league', { p_code: code });
        if (e) throw e;
        update((p) => ({ ...p, activeLeagueId: data, mode: 'live' }));
        await refresh();
      },
      leave: async () => {
        if (!supabase || !liveSnapshot) return;
        const { error: e } = await supabase.rpc('leave_league', { p_league: liveSnapshot.league.id });
        if (e) throw e;
        update((p) => ({ ...p, activeLeagueId: null }));
        await refresh();
      },
    },
    privacy: {
      ...prefs.privacy,
      toggleSource: (s) =>
        update((p) => ({
          ...p,
          privacy: {
            ...p.privacy,
            sources: p.privacy.sources.includes(s) ? p.privacy.sources.filter((x) => x !== s) : [...p.privacy.sources, s],
          },
        })),
      setPaused: (v) => update((p) => ({ ...p, privacy: { ...p.privacy, paused: v } })),
      setHideSensitive: (v) => update((p) => ({ ...p, privacy: { ...p.privacy, hideSensitive: v } })),
    },
  };

  // Mirror privacy choices to Supabase when signed in (best effort; RLS keeps them private).
  useEffect(() => {
    if (!supabase || !userId || !ready) return;
    void supabase
      .from('privacy_settings')
      .update({
        enabled_sources: prefs.privacy.sources,
        tracking_paused: prefs.privacy.paused,
        hide_sensitive: prefs.privacy.hideSensitive,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
  }, [userId, ready, prefs.privacy]);

  return <LeagueContext.Provider value={value}>{children}</LeagueContext.Provider>;
}

export function useLeague(): LeagueContextValue {
  const ctx = useContext(LeagueContext);
  if (!ctx) throw new Error('useLeague must be used inside <LeagueProvider>');
  return ctx;
}
