import { getLocale, interpolate, strings, type Locale } from '@/i18n';
import { formatClock, formatDecimal, formatDuration, formatHours, formatInt } from '@/lib/format';
import type { CompetitionKind, Member, Moment, MomentValue } from '@/domain/types';
import { MOMENT_CATALOG } from './catalog';

export interface RenderedMoment {
  title: string;
  headline: string;
  caption: string;
  stats: { label: string; value: string }[];
}

export function formatValue(value: MomentValue, locale: Locale = getLocale()): string {
  const s = strings(locale);
  const { v, f } = value;
  if (typeof v === 'string') {
    if (f === 'competition') return s.competitions[v as CompetitionKind]?.name ?? v;
    if (f === 'unit') return s.units[v as keyof typeof s.units] ?? v;
    return v;
  }
  switch (f) {
    case 'int':
      return formatInt(v, locale);
    case 'duration':
      return formatDuration(v);
    case 'clock':
      return formatClock(v, locale);
    case 'km':
      return `${formatDecimal(v, 1, locale)} km`;
    case 'percent':
      return `${v > 0 ? '+' : ''}${formatInt(v, locale)} %`;
    case 'hours':
      return formatHours(v, locale);
    default:
      return String(v);
  }
}

export function joinNames(names: string[], locale: Locale = getLocale()): string {
  if (names.length <= 1) return names.join('');
  const and = locale === 'fr' ? ' et ' : ' and ';
  return `${names.slice(0, -1).join(', ')}${and}${names[names.length - 1]}`;
}

export function renderMoment(moment: Moment, members: Member[], locale: Locale = getLocale()): RenderedMoment {
  const s = strings(locale);
  const copy = s.moments[moment.type];
  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName ?? '?';
  const names = moment.memberIds.map(nameOf);

  const vars: Record<string, string> = {
    a: names[0] ?? '',
    b: names[1] ?? '',
    c: names[2] ?? '',
    names: joinNames(names, locale),
  };
  for (const [key, value] of Object.entries(moment.vars)) vars[key] = formatValue(value, locale);

  if (moment.type === 'GROUP_STAT') {
    const key = String(moment.vars.comparisonKey?.v ?? 'marathon');
    const times = Number(moment.vars.times?.v ?? 1);
    const c = s.comparisons as Record<string, string>;
    vars.comparison =
      times > 1 && c[`${key}s`] ? interpolate(c[`${key}s`], { n: times }) : `${times > 1 ? `${times} × ` : ''}${c[key]}`;
  }

  const H = copy.headlines.length;
  const Q = copy.quips.length;
  let quipIndex = Math.floor(moment.variant / H) % Q;
  if (moment.type === 'THE_LINK_UP') {
    // Quip 0 is reserved for "biggest gathering of the month".
    quipIndex = moment.vars.biggest?.v === 'yes' ? 0 : 1 + (quipIndex % (Q - 1));
  }

  const fill = (template: string) => interpolate(template, vars);
  // A template is usable only if every placeholder it needs has a value (e.g. a podium of 2 has no {c}).
  const usable = (template: string) => [...template.matchAll(/\{(\w+)\}/g)].every((m) => Boolean(vars[m[1]]));
  const quip = usable(copy.quips[quipIndex]) ? copy.quips[quipIndex] : (copy.quips.find(usable) ?? '');
  const headline = copy.headlines[moment.variant % H];

  return {
    title: MOMENT_CATALOG[moment.type].title,
    headline: fill(headline),
    caption: fill(quip),
    stats: moment.stats.map((st) => ({
      label: (s.stats as Record<string, string>)[st.key] ?? st.key,
      value: formatValue(st.value, locale),
    })),
  };
}
