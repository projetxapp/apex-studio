import type { ISODate } from '@/domain/types';

/** Date helpers that work on plain `YYYY-MM-DD` strings (UTC arithmetic, no timezone drift). */

export function parseISODate(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseISODate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000);
}

/** `YYYY-MM` */
export function monthOf(date: ISODate): string {
  return date.slice(0, 7);
}

export function startOfMonth(date: ISODate): ISODate {
  return `${monthOf(date)}-01`;
}

export function endOfMonth(date: ISODate): ISODate {
  const d = parseISODate(startOfMonth(date));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return toISODate(d);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(date: ISODate): number {
  return parseISODate(date).getUTCDay();
}

export function isWeekend(date: ISODate): boolean {
  const w = weekday(date);
  return w === 0 || w === 6;
}

export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Today in the device's local timezone. */
export function localToday(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
