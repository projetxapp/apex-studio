# THE LEAGUE

> Ta vie est le jeu. A private social competition app for 5–15 friends:
> Spotify Wrapped × BeReal × a private fantasy league.

Every day the League gets a **competition**. Every evening at 21:00 the **Daily Drop** reveals the
funniest things that happened in the group (BROMANCE, MISSING, THE LINK-UP, RECORD BROKEN,
WEIRDLY IN SYNC…) as swipeable story cards. Seasons last one calendar month.

**Phase 1 status:** a full interactive prototype running on **simulated data**, plus real accounts
and private Leagues on Supabase. No sensor data is collected yet.

**Zero-cost by design:** no paid AI API, no paid services. Moments come from a deterministic,
rule-based **Moment Engine** (`src/engine`). Runs on the free tiers of Expo, Supabase and GitHub.

---

## Quick start (try it on your phone)

Requirements: Node 20+ (22 recommended), the free **Expo Go** app on your iPhone/Android.

```bash
npm install
npm start          # then scan the QR code with the Camera app (iOS) or Expo Go (Android)
```

- Phone and computer must be on the same Wi-Fi. If not, use `npx expo start --tunnel`.
- Web preview: `npm run web` (useful for quick checks; the app is designed for phones).
- **Expo Go is enough for this version**: every library used is bundled in Expo Go.
  A custom development build will only be needed when native modules (HealthKit, location…) arrive.

The app opens in **demo mode**: the fictional League *Les Légendes* (Hippolyte, Joseph, Arthur, Tom,
Maulus, Flora, Pitouf, Zenou). Everything in it is fake and labelled `DÉMO · DONNÉES SIMULÉES`.

### Things to try in the demo

1. **Aujourd’hui** → tap **Révéler maintenant** to reveal tonight’s Drop early.
2. Watch the story: tap right/left (or swipe) to navigate, hold to pause, react with emojis.
3. **Simuler le jour suivant** — the Moment Engine generates a brand-new fictional day, live.
   Go past 30 September to close the season.
4. **League** → season leaderboard, awards, records, the **August 2026 season recap**.
5. **Moi → Réglages → Voir la démo en tant que** — play as another member.
6. Signature moments: 19 Sep (THE LINK-UP 6/8, 3h42), 22 Sep (RECORD BROKEN 18 492 steps),
   24 Sep (BROMANCE 6h14), 25 Sep (TROUBLE IN PARADISE, MISSING Tom 26 h, WEIRDLY IN SYNC).

---

## Features (phase 1)

| Area | What works |
| --- | --- |
| **Today** | Current League, competition of the day + rule, participants, locked Drop teaser with 21:00 reveal, season top 3, latest Drop, demo controls |
| **Daily Drop** | Full-screen story viewer: progress bars, auto-advance, tap/swipe, hold to pause, 5 emoji reactions, end screen, 9 visual card families |
| **League** | Monthly leaderboard (points, wins, rank change), awards, group records, members, past-season recaps |
| **Player profile** | Rank, points, battle wins, titles, awards, records, closest teammate, best moments |
| **History** | Previous Drops grouped by month |
| **People** | Members list with rank and closest ally |
| **Settings** | Demo/real mode, “play as”, data-source opt-ins (all off by default), pause tracking, hide sensitive moments, account, League invite code + share, leave League, delete account |
| **Auth & Leagues** | Email + password sign-up/sign-in, create a League (8-char invite code), join with a code, multiple Leagues |

### Moment Engine (no AI, fully deterministic)

`src/engine/`:

- `rules.ts` — 19 rules turning structured metrics into candidate moments (BROMANCE, MISSING,
  THE LINK-UP, TROUBLE IN PARADISE, WEIRDLY IN SYNC, SAME MINUTE, MUSIC TWINS, NIGHT OWL, EARLY BIRD,
  HIBERNATION, HOMEBODY, EXPLORER, PHOTO DUMP, CALENDAR CHAOS, GROUP STAT, RECORD BROKEN,
  PERSONAL BEST, ON FIRE streaks, TODAY’S BATTLE).
- `engine.ts` — scores candidates, applies a **novelty penalty** (same pair / same type seen
  recently), picks a varied Drop (~70 % social & facts / ~30 % competitive, one card per type,
  nobody hogging it), and rotates **caption variants** to avoid repetition.
- `competition.ts` — daily competition rotation, scoring, points (10/7/5, +2 participation) and
  **anti-cheat plausibility checks**.
- `season.ts` — standings, records, awards, season recap.
- `render.ts` + `src/i18n/fr.ts` — moments are stored as structured data and turned into French
  sentences at display time (several headlines × several quips per type).

### Fair play & anti-cheat

- Competitions only use signals any phone can provide (movement) or that anyone can opt into for
  free (time together). No advantage from owning a watch or connecting more accounts.
  *Dépasse-toi* compares you to **your own** 14-day median.
- Photo count, songs, app opens, calendar events → **fun facts only, never points**.
- Manual values never earn points; implausible values (e.g. 30 000 steps in 60 active minutes,
  distance inconsistent with steps) are shown as “non compté”.
- Every card shows its provenance: *Vérifié / Mesuré / Estimé / Déclaré / Simulé*.
  In the database, clients cannot write `verified` data; only the server can.

---

## Supabase

Project **`the-league`** (Free plan, region Paris `eu-west-3`), ref `tzqcwmribjbfcfqkzeoq`.
The app reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env`.
The publishable key is designed to ship in apps (all tables are protected by RLS).
**Never** put the `service_role`/secret key in the app or in git.

### Tables (all with Row Level Security)

| Table | Who can read | Who can write |
| --- | --- | --- |
| `profiles` | yourself + members of your Leagues | yourself (name, colour) |
| `leagues` | members | owner renames; creation via `create_league()` |
| `league_members` | members of that League | via `join_league()` / `leave_league()` |
| `seasons`, `competitions` | members | server only |
| `daily_moments`, `season_points`, `awards` | members | server only (service role) |
| `moment_reactions` | members | yourself (emoji only) |
| `daily_metrics` | **only you** | only you; `verified` forbidden from clients |
| `privacy_settings` | **only you** | only you |
| view `season_standings` | members (security invoker) | — |

RPC functions: `create_league`, `join_league`, `leave_league`, `rotate_invite_code`,
`ensure_current_season`, `delete_my_account`. Internal helpers live in a non-exposed `private` schema.
Anonymous (signed-out) visitors have no access to anything.

### Migrations

SQL files in `supabase/migrations/` (already applied to the project):

1. `20260926045346_init_league_schema.sql` — schema, RLS policies, RPCs, sign-up trigger
2. `20260926045435_private_helpers.sql` — moves helper functions out of the public API

To apply them to another project: Supabase dashboard → SQL editor → run each file in order, or with the
Supabase CLI: `npx supabase link --project-ref <ref> && npx supabase db push`.

**Test the security rules locally** (needs a local Postgres; nothing touches Supabase):

```bash
npm run db:test    # 40 RLS checks: isolation between Leagues, private metrics, no forged moments…
```

### E-mail (important for inviting friends)

Supabase’s free built-in e-mail sender **only delivers to members of your Supabase team** and is
heavily rate-limited, so friends won’t receive confirmation e-mails. Free options:

- **Recommended (free):** create a free [Brevo](https://www.brevo.com) account (its free plan allows a few
  hundred e-mails per day — check current limits), verify your sender address, then paste its SMTP settings in
  Supabase → Authentication → Emails → SMTP settings. Keeps e-mail confirmation on.
- **Solo testing now:** sign up with the e-mail of your Supabase account: it can receive the
  confirmation e-mail from the built-in sender.
- Turning off “Confirm email” works for a tiny closed beta but lets anyone register with someone
  else’s address. Supabase advises against it; if you do it temporarily, turn it back on afterwards.

---

## Demo mode vs real data

- Demo data is generated **in the app** (`src/demo`), never written to Supabase, and always labelled.
- Screens only consume a `LeagueSnapshot` (`src/data/snapshot.ts`). The demo (`src/demo/demoLeague.ts`)
  and Supabase (`src/data/liveSource.ts`) both produce that shape, so real data sources can replace
  the simulation **without rewriting the UI**.
- A real League currently shows empty states for moments and rankings: no data is collected in phase 1.

## Project structure

```
src/
  app/            Expo Router screens: (tabs)/index|drop|league|me, story/[date], player/[id],
                  season/[month], people, history, settings, auth, onboarding
  components/     UI kit (ui.tsx), MomentCard, StoryViewer, LeagueBlocks, PlayerProfileView…
  domain/types.ts Shared domain model
  engine/         Moment Engine (rules, selection, competitions, seasons, rendering) + tests
  demo/           Fictional League: members/personas, generator, scripted storylines
  data/           LeagueProvider (state, auth, modes), live Supabase source, selectors
  i18n/           fr.ts (complete), en.ts (partial, falls back to French)
  theme/tokens.ts Design tokens (dark-first colours, fonts, card families)
supabase/
  migrations/     SQL migrations (source of truth for the database)
  tests/          Local RLS test suite
e2e/              Optional Playwright web smoke test
```

Adding English later: fill `src/i18n/en.ts` (TypeScript enforces the shape) and call `setLocale('en')`.

## Checks & tests

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint (expo lint)
npm test            # Jest: engine, anti-cheat, rules, rendering, demo snapshot (22 tests)
npm run db:test     # RLS tests on a throwaway local Postgres
# Optional web smoke test (Playwright + Chromium):
npx expo export --platform web && node e2e/serve.cjs & node e2e/smoke.cjs
```

## Costs & limits (be aware)

- **This app:** €0. Supabase Free (500 MB DB, pauses after ~7 days without activity: open the
  dashboard to restore it), Expo Go free, GitHub free.
- **iOS distribution:** Expo Go is free for testing. Installing a standalone build on friends’
  iPhones (TestFlight / App Store) requires the **Apple Developer Program: US$99/year**.
  Native modules like HealthKit require a development build, which needs that account for devices.
  EAS Build has a free tier with limited monthly builds; local builds need a Mac with Xcode.
- **Claude Code** itself is billed through your own Anthropic/Claude subscription; the app does not
  call any AI API.
- iOS does **not** guarantee continuous background execution, location updates or health sync.
  Future data will arrive when iOS allows it; the app must tolerate gaps.

## Known limitations

- No real sensor data yet: real Leagues show empty Drops/rankings until data sources exist.
- Server-side finalisation (computing moments & points for real Leagues) is not built yet.
- Demo reactions from other members are simulated; your own reactions are stored on the device.
- “Hide sensitive moments” and “pause” are stored, but only take effect once real data exists.
- English localisation is partial.
- `apex-studio.zip` at the repository root is an older, unrelated prototype (it used a paid AI API);
  it is not part of THE LEAGUE and can be deleted.

## Roadmap

1. **HealthKit (steps, distance, sleep)** — development build + Swift/Expo module; read samples
   on device, flag user-entered samples as `manual`, upload daily aggregates only.
2. **Privacy-first proximity** — mutual opt-in per pair, on-device detection (Bluetooth/coarse
   region), upload only “together for N minutes”, never positions; labelled *Estimé*.
3. **More deterministic moments** — weekly/monthly narratives, rivalries, comebacks, group streaks.
4. **Notifications & reliable finalisation** — scheduled Supabase job finalises each day,
   writes moments/points server-side, local 21:00 notification; tolerate late data.
5. **Closed beta** — custom SMTP, TestFlight (Apple Developer account), feedback loop.
