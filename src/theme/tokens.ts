import type { CardStyle } from '@/domain/types';

/**
 * THE LEAGUE design tokens. Dark-first, high contrast, loud accents.
 * One place to tweak the whole look.
 */

export const colors = {
  bg: '#09090B',
  surface: '#131316',
  surfaceRaised: '#1B1B20',
  border: '#27272F',
  text: '#F6F6F7',
  textMuted: '#A1A1AA',
  textFaint: '#63636E',
  accent: '#D4FF3A', // acid lime — the League colour
  accentInk: '#0B0B0B',
  hot: '#FF4D2E',
  danger: '#FF4D4D',
  success: '#3DDC97',
  gold: '#FFD23F',
  silver: '#C9CCD6',
  bronze: '#E0915A',
  overlay: 'rgba(0,0,0,0.55)',
} as const;

export const fonts = {
  /** Condensed poster font for big numbers and award names. */
  display: 'Anton_400Regular',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  black: 'Inter_900Black',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const type = {
  hero: { fontFamily: fonts.display, fontSize: 56, lineHeight: 60, letterSpacing: 0.5 },
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 46, letterSpacing: 0.5 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: 0.4 },
  heading: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.4, textTransform: 'uppercase' as const },
} as const;

/** Visual family of each Daily Drop card: background gradient + ink colour. */
/** `tint` = a readable colour of the family on a dark background (chips, labels). */
export const cardThemes: Record<CardStyle, { gradient: [string, string, ...string[]]; ink: string; accent: string; tint: string }> = {
  duo: { gradient: ['#FF2E93', '#7B2FF7', '#1A0B2E'], ink: '#FFFFFF', accent: '#FFD1EC', tint: '#FF4FA8' },
  alert: { gradient: ['#FF4D2E', '#8A1405', '#140302'], ink: '#FFFFFF', accent: '#FFD2C7', tint: '#FF6A4D' },
  crowd: { gradient: ['#FFC21A', '#FF7A00', '#E64A00'], ink: '#1A0A00', accent: '#1A0A00', tint: '#FFB800' },
  record: { gradient: ['#E4FF5C', '#B4F02E', '#6FCB1F'], ink: '#0B0B0B', accent: '#0B0B0B', tint: '#D4FF3A' },
  battle: { gradient: ['#2F54FF', '#101C7A', '#04061A'], ink: '#FFFFFF', accent: '#D4FF3A', tint: '#7B93FF' },
  sync: { gradient: ['#00E5FF', '#4A3AFF', '#0B0830'], ink: '#FFFFFF', accent: '#B6F7FF', tint: '#00E5FF' },
  night: { gradient: ['#2A1B6B', '#0E0A2A', '#000000'], ink: '#EDE9FF', accent: '#A594FF', tint: '#A594FF' },
  stat: { gradient: ['#F6F6F7', '#D9D9E0', '#B8B8C4'], ink: '#0B0B0B', accent: '#FF4D2E', tint: '#F6F6F7' },
  vibe: { gradient: ['#FF7AE0', '#FF9E5E', '#3B1030'], ink: '#FFFFFF', accent: '#FFF1B8', tint: '#FF8BE5' },
};

export const medal = (rank: number) =>
  rank === 1 ? colors.gold : rank === 2 ? colors.silver : rank === 3 ? colors.bronze : colors.textFaint;
