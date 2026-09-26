import type { Locale } from '@/i18n';

/** Locale-aware number & time formatting without relying on full Intl support. */

const THIN_NBSP = ' ';

export function formatInt(value: number, locale: Locale = 'fr'): string {
  const rounded = Math.round(value);
  const sep = locale === 'fr' ? THIN_NBSP : ',';
  const sign = rounded < 0 ? '-' : '';
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function formatDecimal(value: number, digits = 1, locale: Locale = 'fr'): string {
  const [int, dec] = value.toFixed(digits).split('.');
  const intPart = formatInt(Number(int), locale);
  if (!dec || Number(dec) === 0) return intPart;
  return `${intPart}${locale === 'fr' ? ',' : '.'}${dec}`;
}

/** 1 950 700 → "1,95 M", 19 507 → "19,5 k" */
export function formatCompact(value: number, locale: Locale = 'fr'): string {
  if (Math.abs(value) >= 1_000_000) return `${formatDecimal(value / 1_000_000, 2, locale)}\u202FM`;
  if (Math.abs(value) >= 10_000) return `${formatDecimal(value / 1_000, 1, locale)}\u202Fk`;
  return formatInt(value, locale);
}

/** 374 → "6h14", 45 → "45 min", 120 → "2h" */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}${THIN_NBSP}min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, '0')}`;
}

/** Minutes since midnight (may exceed 1440) → "23h47" / "01h12". */
export function formatClock(minutes: number, locale: Locale = 'fr'): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return locale === 'fr' ? `${h}h${mm}` : `${h}:${mm}`;
}

/** 26 → "26 heures" */
export function formatHours(hours: number, locale: Locale = 'fr'): string {
  const h = Math.round(hours);
  if (locale === 'fr') return `${h} heure${h > 1 ? 's' : ''}`;
  return `${h} hour${h > 1 ? 's' : ''}`;
}

const FR_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const FR_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parts(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, weekday };
}

/** "samedi 26 septembre" */
export function formatDayLong(date: string, locale: Locale = 'fr'): string {
  const { m, d, weekday } = parts(date);
  return locale === 'fr'
    ? `${FR_DAYS[weekday]} ${d === 1 ? '1er' : d} ${FR_MONTHS[m - 1]}`
    : `${EN_DAYS[weekday]}, ${EN_MONTHS[m - 1]} ${d}`;
}

/** "26 sept." */
export function formatDayShort(date: string, locale: Locale = 'fr'): string {
  const { m, d } = parts(date);
  const month = locale === 'fr' ? FR_MONTHS[m - 1] : EN_MONTHS[m - 1];
  return `${d} ${month.slice(0, month.length > 5 ? 4 : month.length)}${month.length > 5 ? '.' : ''}`;
}

/** "Septembre 2026" from "2026-09" */
export function formatMonth(month: string, locale: Locale = 'fr'): string {
  const [y, m] = month.split('-').map(Number);
  const name = locale === 'fr' ? FR_MONTHS[m - 1] : EN_MONTHS[m - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
