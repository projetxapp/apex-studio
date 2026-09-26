import type { CardStyle, MomentCategory, MomentType } from '@/domain/types';

/**
 * Static facts about each moment type. Titles are the short English award names
 * and are never translated.
 */
export interface MomentTypeInfo {
  title: string;
  category: MomentCategory;
  style: CardStyle;
  /** Moments that may reveal sensitive routines (sleep, home) can be hidden by the member. */
  sensitive: boolean;
}

export const MOMENT_CATALOG: Record<MomentType, MomentTypeInfo> = {
  BROMANCE: { title: 'BROMANCE', category: 'social', style: 'duo', sensitive: false },
  MISSING: { title: 'MISSING', category: 'social', style: 'alert', sensitive: false },
  THE_LINK_UP: { title: 'THE LINK-UP', category: 'social', style: 'crowd', sensitive: false },
  TROUBLE_IN_PARADISE: { title: 'TROUBLE IN PARADISE?', category: 'social', style: 'alert', sensitive: false },
  WEIRDLY_IN_SYNC: { title: 'WEIRDLY IN SYNC', category: 'social', style: 'sync', sensitive: true },
  SAME_MINUTE: { title: 'SAME MINUTE', category: 'social', style: 'sync', sensitive: true },
  MUSIC_TWINS: { title: 'MUSIC TWINS', category: 'social', style: 'vibe', sensitive: false },
  NIGHT_OWL: { title: 'NIGHT OWL', category: 'fact', style: 'night', sensitive: true },
  EARLY_BIRD: { title: 'EARLY BIRD', category: 'fact', style: 'night', sensitive: true },
  SLEEP_CHAMP: { title: 'HIBERNATION', category: 'fact', style: 'night', sensitive: true },
  HOMEBODY: { title: 'HOMEBODY', category: 'fact', style: 'vibe', sensitive: true },
  EXPLORER: { title: 'EXPLORER', category: 'fact', style: 'vibe', sensitive: false },
  PHOTO_DUMP: { title: 'PHOTO DUMP', category: 'fact', style: 'vibe', sensitive: false },
  CALENDAR_CHAOS: { title: 'CALENDAR CHAOS', category: 'fact', style: 'stat', sensitive: false },
  GROUP_STAT: { title: 'THE LEAGUE, TOGETHER', category: 'fact', style: 'stat', sensitive: false },
  RECORD_BROKEN: { title: 'RECORD BROKEN', category: 'competitive', style: 'record', sensitive: false },
  PERSONAL_RECORD: { title: 'PERSONAL BEST', category: 'competitive', style: 'record', sensitive: false },
  STREAK: { title: 'ON FIRE', category: 'competitive', style: 'battle', sensitive: false },
  TODAYS_BATTLE: { title: 'TODAY’S BATTLE', category: 'competitive', style: 'battle', sensitive: false },
};
