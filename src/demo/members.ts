import type { DataSourceKind, Member, MemberId } from '@/domain/types';

/**
 * The demo League. Entirely fictional people and numbers.
 * Personas give each member a recognisable "character" so the Drops tell stories.
 */

export interface Persona {
  stepsMean: number;
  stepsSd: number;
  bedtime: number; // minutes since midnight of the day (> 1440 = after midnight)
  wake: number;
  leave: number;
  back: number;
  places: number;
  photos: number;
  calendar: number;
  homebodyChance: number;
  artists: string[];
}

const ALL: DataSourceKind[] = ['motion', 'sleep', 'proximity', 'routine', 'music', 'photos', 'calendar'];
const without = (...skip: DataSourceKind[]) => ALL.filter((s) => !skip.includes(s));

export const DEMO_MEMBERS: Member[] = [
  { id: 'hippolyte', displayName: 'Hippolyte', tag: 'HIPPO', color: '#FF5A36', sources: ALL },
  { id: 'joseph', displayName: 'Joseph', tag: 'JOJO', color: '#FFD23F', sources: ALL },
  { id: 'arthur', displayName: 'Arthur', tag: 'ARTH', color: '#3DDC97', sources: ALL },
  { id: 'tom', displayName: 'Tom', tag: 'TOM', color: '#4D9DFF', sources: without('music') },
  { id: 'maulus', displayName: 'Maulus', tag: 'MAUL', color: '#B266FF', sources: ALL },
  { id: 'flora', displayName: 'Flora', tag: 'FLO', color: '#FF5FA2', sources: ALL },
  { id: 'pitouf', displayName: 'Pitouf', tag: 'PITOUF', color: '#22D3EE', sources: without('calendar') },
  { id: 'zenou', displayName: 'Zenou', tag: 'ZEN', color: '#C6FF3D', sources: without('photos') },
];

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

export const PERSONAS: Record<MemberId, Persona> = {
  hippolyte: { stepsMean: 9500, stepsSd: 2400, bedtime: h(24, 10), wake: h(7, 50), leave: h(8, 40), back: h(19, 10), places: 4, photos: 18, calendar: 3, homebodyChance: 0.03, artists: ['PNL', 'Ninho', 'Aya Nakamura'] },
  joseph: { stepsMean: 10800, stepsSd: 3000, bedtime: h(23, 50), wake: h(7, 20), leave: h(8, 15), back: h(19, 30), places: 4, photos: 12, calendar: 3, homebodyChance: 0.02, artists: ['PNL', 'Tame Impala', 'Ninho'] },
  arthur: { stepsMean: 9400, stepsSd: 2600, bedtime: h(23, 30), wake: h(7, 0), leave: h(8, 5), back: h(18, 40), places: 3, photos: 9, calendar: 4, homebodyChance: 0.03, artists: ['Justice', 'Daft Punk', 'Tame Impala'] },
  tom: { stepsMean: 7600, stepsSd: 2100, bedtime: h(23, 45), wake: h(7, 5), leave: h(8, 10), back: h(18, 50), places: 3, photos: 6, calendar: 2, homebodyChance: 0.08, artists: [] },
  maulus: { stepsMean: 6200, stepsSd: 1900, bedtime: h(25, 25), wake: h(9, 40), leave: h(11, 0), back: h(20, 10), places: 3, photos: 14, calendar: 1, homebodyChance: 0.1, artists: ['Travis Scott', 'PNL', 'Kanye West'] },
  flora: { stepsMean: 11600, stepsSd: 3300, bedtime: h(23, 15), wake: h(6, 50), leave: h(7, 45), back: h(19, 45), places: 5, photos: 30, calendar: 4, homebodyChance: 0.02, artists: ['Aya Nakamura', 'Angèle', 'Stromae'] },
  pitouf: { stepsMean: 5200, stepsSd: 1800, bedtime: h(24, 40), wake: h(9, 10), leave: h(10, 30), back: h(18, 0), places: 2, photos: 55, calendar: 1, homebodyChance: 0.2, artists: ['Angèle', 'Stromae', 'Daft Punk'] },
  zenou: { stepsMean: 9600, stepsSd: 2600, bedtime: h(22, 50), wake: h(6, 35), leave: h(7, 30), back: h(18, 20), places: 4, photos: 10, calendar: 5, homebodyChance: 0.03, artists: ['Stromae', 'Justice', 'PNL'] },
};

/** Chance of meeting on a given day and typical minutes together. */
export const AFFINITIES: { a: MemberId; b: MemberId; p: number; minutes: number }[] = [
  { a: 'hippolyte', b: 'joseph', p: 0.85, minutes: 170 },
  { a: 'flora', b: 'zenou', p: 0.5, minutes: 105 },
  { a: 'maulus', b: 'pitouf', p: 0.45, minutes: 125 },
  { a: 'arthur', b: 'tom', p: 0.3, minutes: 65 },
  { a: 'hippolyte', b: 'arthur', p: 0.3, minutes: 60 },
  { a: 'hippolyte', b: 'maulus', p: 0.22, minutes: 80 },
  { a: 'joseph', b: 'flora', p: 0.22, minutes: 50 },
  { a: 'arthur', b: 'zenou', p: 0.25, minutes: 55 },
  { a: 'pitouf', b: 'flora', p: 0.18, minutes: 60 },
];
export const DEFAULT_AFFINITY = { p: 0.07, minutes: 40 };
export const TOM_AFFINITY = { p: 0.1, minutes: 35 };
